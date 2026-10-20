// background.js — service worker (MV3).
// Полная логика: alarms + scanAndNotify, обработка сообщений START/STOP/RUN_NOW/TEST_BREVO/TEST_TODOIST.

import { storage, DEFAULTS } from './lib/storage.js';
import { logger } from './lib/logger.js';
import { getProjects, getTasks, getCollaborators, getProjectOwners, addTaskCommentWithNotify, createOverdueComment } from './lib/todoist.js';
import { groupByAssigneeEmail, filterByType, groupByRecipients } from './lib/overdue.js';
import { sendEmail, generateTaskHtml, sendTestEmail, checkBrevoAccount } from './lib/brevo.js';
import { setAlarm, clearAlarm } from './lib/scheduler.js';

// Имя alarm
const ALARM_NAME = 'todoist-overdue-scan';

/**
 * Основная функция сканирования и уведомления.
 */
async function scanAndNotify() {
  const startTime = Date.now();
  await logger.info('background', 'Начало скана');

  try {
    // Получаем настройки
    const settings = await storage.getAll();
    const { todoistToken, brevoApiKey, timezone, senderEmail, senderName, replyToEmail, recipients, scanTypes, addTodoistComments, commentAuthorEmail } = settings;

    if (!todoistToken || !brevoApiKey) {
      await logger.warn('background', 'Скан пропущен: не настроены токены');
      return;
    }

    // Получаем задачи и проекты
    const [tasksData, projectsData] = await Promise.all([
      getTasks(todoistToken),
      getProjects(todoistToken),
    ]);

    // Логируем структуру ответов для отладки
    await logger.info('background', `Projects type: ${typeof projectsData}, isArray: ${Array.isArray(projectsData)}`);
    await logger.info('background', `Tasks type: ${typeof tasksData}, isArray: ${Array.isArray(tasksData)}`);
    
    if (!Array.isArray(projectsData)) {
      await logger.info('background', `Projects data: ${JSON.stringify(projectsData).slice(0, 500)}`);
    }
    if (!Array.isArray(tasksData)) {
      await logger.info('background', `Tasks data: ${JSON.stringify(tasksData).slice(0, 500)}`);
    }

    // Обрабатываем разные форматы ответа
    const projects = Array.isArray(projectsData) ? projectsData :
                    (projectsData?.results || projectsData?.projects || projectsData?.items || []);

    const tasks = Array.isArray(tasksData) ? tasksData :
                  (tasksData?.results || tasksData?.tasks || tasksData?.items || []);

    await logger.info('background', 'Получены данные', {
      projectsCount: projects.length,
      tasksCount: tasks.length,
    });

    // Получаем коллабораторов для всех проектов
    const collaboratorsByProject = new Map();
    const projectIds = projects.map(p => p.id);
    for (const projectId of projectIds) {
      try {
        const collaboratorsData = await getCollaborators(todoistToken, projectId);
        // Обрабатываем формат {results: [...]}
        const collaborators = Array.isArray(collaboratorsData) ? collaboratorsData :
                             (collaboratorsData?.results || collaboratorsData?.collaborators || []);
        collaboratorsByProject.set(projectId, collaborators);
      } catch (e) {
        await logger.warn('background', `Не удалось получить коллабораторов проекта ${projectId}`, { error: e.message });
      }
    }

    // Пропускаем получение руководителей проектов в обычном скане,
    // чтобы не засорять лог ошибками team/members.

    // Фильтруем задачи по выбранным типам
    const nowMsk = new Date(new Date().toLocaleString('en-US', { timeZone: timezone || 'Europe/Moscow' }));

    // Обязательные проверки для каждого запуска:
    // 1) просроченные, 2) без срока при назначенном ответственном, 3) без ответственного
    const requiredScanTypes = ['overdue', 'noDueDate', 'noResponsible'];
    const configuredScanTypes = Array.isArray(scanTypes) ? scanTypes : (DEFAULTS.scanTypes || []);
    const activeScanTypes = Array.from(new Set([...configuredScanTypes, ...requiredScanTypes]));

    await logger.info('background', `Типы сканирования: ${JSON.stringify(activeScanTypes)}`);
    
    let allFilteredTasks = [];
    
    for (const scanType of activeScanTypes) {
      const filteredTasks = filterByType(tasks, scanType, nowMsk);
      await logger.info('background', `Тип ${scanType}: найдено ${filteredTasks.length} задач`);
      allFilteredTasks = allFilteredTasks.concat(filteredTasks);
    }
    
    // Убираем дубликаты задач
    const uniqueTasks = Array.from(new Map(allFilteredTasks.map(task => [task.id, task])).values());
    await logger.info('background', `Всего уникальных задач: ${uniqueTasks.length} из ${tasks.length}`);

    if (uniqueTasks.length === 0) {
      await logger.info('background', 'Нет задач для уведомления');
      await updateLastRun({ found: 0, sent: 0, errors: 0 });
      return;
    }

    // Группируем задачи по типам
    const recipientsSet = new Set(recipients || []);
    await logger.info('background', `Recipients из настроек: ${JSON.stringify(Array.from(recipientsSet))}`);

    // Разделяем задачи по типам для правильной группировки
    const overdueTasks = filterByType(uniqueTasks, 'overdue', nowMsk);
    const noDueDateTasks = filterByType(uniqueTasks, 'noDueDate', nowMsk);
    const noResponsibleTasks = filterByType(uniqueTasks, 'noResponsible', nowMsk);

    const byEmail = new Map();

    if (recipientsSet.size > 0) {
      // Группируем просроченные задачи и задачи без сроков по assignee email
      const tasksWithAssignee = [...overdueTasks, ...noDueDateTasks];
      const { byEmail: byAssigneeEmail, skipped: skippedAssignee } = groupByAssigneeEmail(tasksWithAssignee, projects, collaboratorsByProject, recipientsSet);

      // Группируем задачи без ответственного по recipients
      const { byEmail: byRecipientEmail, skipped: skippedNoResponsible } = groupByRecipients(noResponsibleTasks, recipientsSet);

      // Добавляем задачи по assignee email
      for (const [email, tasks] of byAssigneeEmail) {
        byEmail.set(email, tasks);
      }

      // Добавляем задачи по recipient email
      for (const [email, tasks] of byRecipientEmail) {
        if (byEmail.has(email)) {
          byEmail.set(email, [...byEmail.get(email), ...tasks]);
        } else {
          byEmail.set(email, tasks);
        }
      }

      // Объединяем и логируем пропущенные задачи
      const skipped = [...skippedAssignee, ...skippedNoResponsible];
      for (const { task, reason } of skipped) {
        await logger.warn('background', `Задача пропущена: ${reason}`, { taskId: task.id, content: task.content });
      }
    } else {
      await logger.info('background', 'Recipients пустой: отправка писем пропущена');
    }

    // Добавляем комментарии в Todoist (если включено)
    let commentsAdded = 0;
    await logger.info('background', 'Проверка настроек комментариев', { 
      addTodoistComments,
      commentAuthorEmail,
      hasAddTodoistComments: !!addTodoistComments,
      hasCommentAuthorEmail: !!commentAuthorEmail
    });
    
    if (addTodoistComments && commentAuthorEmail) {
      const managerEmail = commentAuthorEmail.trim();
      const managerEmailLower = managerEmail.toLowerCase();

      await logger.info('background', 'Добавление комментариев в Todoist...', {
        tasksCount: uniqueTasks.length,
        authorEmail: commentAuthorEmail,
        managerEmail,
      });

      // Определяем тип каждой задачи
      for (const task of uniqueTasks) {
        try {
          let scanType = null;

          // Определяем тип задачи
          if (filterByType([task], 'overdue', nowMsk).length > 0) {
            scanType = 'overdue';
          } else if (filterByType([task], 'noDueDate', nowMsk).length > 0) {
            scanType = 'noDueDate';
          } else if (filterByType([task], 'noResponsible', nowMsk).length > 0) {
            scanType = 'noResponsible';
          }

          if (scanType) {
            const commentText = createOverdueComment(task, scanType, commentAuthorEmail, managerEmail);

            const projectCollaborators = collaboratorsByProject.get(task.project_id) || [];
            const managerCollaborator = projectCollaborators.find(c => (c?.email || '').toLowerCase() === managerEmailLower);

            const notifyIds = [];
            if (task.responsible_uid) {
              notifyIds.push(task.responsible_uid);
            }
            if (managerCollaborator?.id) {
              notifyIds.push(managerCollaborator.id);
            }

            await addTaskCommentWithNotify(todoistToken, task.id, commentText, notifyIds);
            commentsAdded++;

            await logger.info('background', `Комментарий добавлен к задаче ${task.id}`, {
              scanType,
              taskId: task.id,
              content: task.content,
              managerEmail,
              notifyIds,
            });
          }
        } catch (e) {
          await logger.error('background', `Ошибка добавления комментария к задаче ${task.id}`, {
            error: e.message,
            taskId: task.id,
            content: task.content
          });
        }
      }

      await logger.info('background', `Комментарии добавлены: ${commentsAdded} из ${uniqueTasks.length}`);
    }

    // Отправляем письма
    let sent = 0;
    let errors = 0;
    const today = new Date().toLocaleDateString('ru-RU', { timeZone: timezone || 'Europe/Moscow' });
    const managerEmail = (replyToEmail || '').trim();

    const splitTasksByCategory = (tasksList) => {
      const overdue = [];
      const noResponsible = [];
      const noDueDate = [];
      const noTime = [];

      for (const task of tasksList) {
        if (filterByType([task], 'overdue', nowMsk).length > 0) overdue.push(task);
        if (filterByType([task], 'noResponsible', nowMsk).length > 0) noResponsible.push(task);
        if (filterByType([task], 'noDueDate', nowMsk).length > 0) noDueDate.push(task);

        const dueDateValue = task?.due?.date;
        const hasNoTime = !!task?.due && !task?.due?.datetime && typeof dueDateValue === 'string' && !dueDateValue.includes('T');
        if (hasNoTime) noTime.push(task);
      }

      return { overdue, noResponsible, noDueDate, noTime };
    };

    const renderTaskSection = (title, tasksList) => {
      if (!tasksList.length) return '';
      return `
        <h3 style="margin: 20px 0 8px;">${title} (${tasksList.length})</h3>
        ${generateTaskHtml(tasksList)}
      `;
    };

    for (const [email, tasksForEmail] of byEmail.entries()) {
      const categorized = splitTasksByCategory(tasksForEmail);

      // Формируем тему письма
      let subjectParts = [];
      if (categorized.overdue.length > 0) subjectParts.push('просроченные');
      if (categorized.noDueDate.length > 0) subjectParts.push('без дедлайна');
      if (categorized.noResponsible.length > 0) subjectParts.push('без ответственного');
      if (categorized.noTime.length > 0) subjectParts.push('без времени');

      const subject = `Задачи Todoist (${subjectParts.join(', ')}) на ${today} — ${tasksForEmail.length} шт.`;

      const html = `
        <h2>У вас ${tasksForEmail.length} задач требуют внимания</h2>
        ${renderTaskSection('Просроченные', categorized.overdue)}
        ${renderTaskSection('Без ответственного', categorized.noResponsible)}
        ${renderTaskSection('Без дедлайна', categorized.noDueDate)}
        ${renderTaskSection('Без назначенного времени', categorized.noTime)}
        <p style="margin-top: 20px; font-size: 12px; color: #6b7280;">
          Это автоматическое уведомление от Todoist Overdue Notifier.
          ${replyToEmail ? `Для ответов используйте: ${replyToEmail}` : ''}
        </p>
      `;

      // Логируем параметры перед отправкой
      await logger.info('background', `Подготовка письма для ${email}`, JSON.stringify({
        subject,
        senderEmail,
        senderName,
        replyToEmail,
        taskCount: tasksForEmail.length,
      }));

      const result = await sendEmail(brevoApiKey, {
        to: email,
        subject,
        html,
        senderEmail,
        senderName,
        replyToEmail,
      });

      // Логируем полный результат
      await logger.info('background', `Результат отправки для ${email}`, JSON.stringify({
        ok: result?.ok,
        error: result?.error,
        messageId: result?.messageId,
      }));

      if (result.ok) {
        sent++;
        await logger.info('background', `Письмо отправлено: ${email}`, { count: tasksForEmail.length });
      } else {
        errors++;
        await logger.error('background', `Ошибка отправки: ${email}`, { error: result.error });
      }
    }

    // Отдельное уведомление руководителю (Reply-To email)
    if (managerEmail && uniqueTasks.length > 0) {
      const managerCategorized = splitTasksByCategory(uniqueTasks);
      const managerSubject = `Контроль задач Todoist на ${today} — ${uniqueTasks.length} шт.`;
      const managerHtml = `
        <h2>Сводка по задачам, требующим внимания: ${uniqueTasks.length}</h2>
        <ul style="margin-bottom: 20px;">
          <li>Просроченные: ${managerCategorized.overdue.length}</li>
          <li>Без ответственного: ${managerCategorized.noResponsible.length}</li>
          <li>Без дедлайна: ${managerCategorized.noDueDate.length}</li>
          <li>Без назначенного времени: ${managerCategorized.noTime.length}</li>
        </ul>
        ${renderTaskSection('Просроченные', managerCategorized.overdue)}
        ${renderTaskSection('Без ответственного', managerCategorized.noResponsible)}
        ${renderTaskSection('Без дедлайна', managerCategorized.noDueDate)}
        ${renderTaskSection('Без назначенного времени', managerCategorized.noTime)}
        <p style="margin-top: 20px; font-size: 12px; color: #6b7280;">
          Это автоматическая эскалация руководителю из поля Reply-To email.
        </p>
      `;

      const managerResult = await sendEmail(brevoApiKey, {
        to: managerEmail,
        subject: managerSubject,
        html: managerHtml,
        senderEmail,
        senderName,
        replyToEmail,
      });

      await logger.info('background', `Результат отправки руководителю ${managerEmail}`, JSON.stringify({
        ok: managerResult?.ok,
        error: managerResult?.error,
        messageId: managerResult?.messageId,
        taskCount: uniqueTasks.length,
      }));

      if (managerResult.ok) {
        sent++;
      } else {
        errors++;
      }
    }

    // Обновляем lastRun
    await updateLastRun({ found: uniqueTasks.length, sent, errors });

    // Показываем уведомление Chrome
    if (sent > 0) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/128.png',
        title: 'Todoist Overdue Notifier',
        message: `Отправлено ${sent} писем, задач с проблемами: ${uniqueTasks.length}`,
      });
    }

    const duration = Date.now() - startTime;
    await logger.info('background', `Скан завершён за ${duration}мс`, { found: uniqueTasks.length, sent, errors });
  } catch (e) {
    await logger.error('background', `Ошибка скана: ${e.message}`, { error: e.stack });
    await updateLastRun({ found: 0, sent: 0, errors: 1 });
  }
}

/**
 * Обновляет lastRun в storage.
 */
async function updateLastRun({ found, sent, errors }) {
  await storage.set('lastRun', {
    at: new Date().toISOString(),
    found,
    sent,
    errors,
  });
}

/**
 * Запускает бот: устанавливает alarm.
 */
async function startBot() {
  try {
    const settings = await storage.getAll();
    const { scanTime, timezone } = settings;
    const nextRunAt = await setAlarm(scanTime || DEFAULTS.scanTime, timezone || DEFAULTS.timezone);
    await storage.set('botEnabled', true);
    await storage.set('nextRunAt', nextRunAt);
    await logger.info('background', 'Бот запущен', { nextRun: nextRunAt });
  } catch (e) {
    await logger.error('background', `Ошибка запуска бота: ${e.message}`);
    throw e;
  }
}

/**
 * Останавливает бот: удаляет alarm.
 */
async function stopBot() {
  try {
    await clearAlarm();
    await storage.set('botEnabled', false);
    await storage.set('nextRunAt', null);
    await logger.info('background', 'Бот остановлен');
  } catch (e) {
    await logger.error('background', `Ошибка остановки бота: ${e.message}`);
    throw e;
  }
}

/**
 * Восстанавливает состояние бота при запуске SW.
 */
async function restoreBotState() {
  try {
    const settings = await storage.getAll();
    if (settings.botEnabled) {
      const { scanTime, timezone } = settings;
      const nextRunAt = await setAlarm(scanTime || DEFAULTS.scanTime, timezone || DEFAULTS.timezone);
      await storage.set('nextRunAt', nextRunAt);
      await logger.info('background', 'Бот восстановлен', { nextRun: nextRunAt });
    } else {
      await logger.info('background', 'Бот не активен');
    }
  } catch (e) {
    await logger.error('background', `Ошибка восстановления состояния: ${e.message}`);
  }
}

// === Event Listeners ===

chrome.runtime.onInstalled.addListener(async (details) => {
  try {
    await storage.ensureDefaults(DEFAULTS);
    await logger.info('background', `onInstalled: ${details.reason}`);
    if (details.reason === 'install') {
      await restoreBotState();
    }
  } catch (e) {
    console.error('[background] onInstalled error:', e);
  }
});

chrome.runtime.onStartup.addListener(async () => {
  try {
    await logger.info('background', 'onStartup');
    await restoreBotState();
  } catch (e) {
    console.error('[background] onStartup error:', e);
  }
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === ALARM_NAME) {
    await scanAndNotify();
    // Пересчитываем следующий запуск
    const settings = await storage.getAll();
    if (settings.botEnabled) {
      const { scanTime, timezone } = settings;
      const nextRunAt = await setAlarm(scanTime || DEFAULTS.scanTime, timezone || DEFAULTS.timezone);
      await storage.set('nextRunAt', nextRunAt);
    }
  }
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    try {
      switch (msg?.type) {
        case 'PING':
          sendResponse({ ok: true, pong: Date.now() });
          break;

        case 'START':
          await startBot();
          sendResponse({ ok: true });
          break;

        case 'STOP':
          await stopBot();
          sendResponse({ ok: true });
          break;

        case 'RUN_NOW':
          await scanAndNotify();
          sendResponse({ ok: true });
          break;

        case 'TEST_TODOIST':
          const todoistToken = msg?.todoistToken || (await storage.get('todoistToken'));
          if (!todoistToken) {
            sendResponse({ ok: false, error: 'Токен не указан' });
            return;
          }
          try {
            await getProjects(todoistToken);
            sendResponse({ ok: true });
          } catch (e) {
            sendResponse({ ok: false, error: e.message });
          }
          break;

        case 'TEST_BREVO':
          const brevoApiKey = msg?.brevoApiKey || (await storage.get('brevoApiKey'));
          const senderEmail = msg?.senderEmail || (await storage.get('senderEmail'));
          const senderName = msg?.senderName || (await storage.get('senderName'));
          const replyToEmail = msg?.replyToEmail || (await storage.get('replyToEmail'));
          const recipients = msg?.recipients || (await storage.get('recipients'));
          if (!brevoApiKey || !senderEmail || !recipients?.length) {
            sendResponse({ ok: false, error: 'Не все параметры указаны' });
            return;
          }
          const result = await sendTestEmail(brevoApiKey, senderEmail, senderName, recipients[0], replyToEmail);
          sendResponse(result);
          break;

        case 'TEST_PROJECT_OWNERS':
          const todoistTokenForOwners = msg?.todoistToken || (await storage.get('todoistToken'));
          if (!todoistTokenForOwners) {
            sendResponse({ ok: false, error: 'Токен не указан' });
            return;
          }
          try {
            const owners = await getProjectOwners(todoistTokenForOwners);
            await logger.info('background', 'Тест руководителей проектов успешен', { count: owners.length });
            sendResponse({ ok: true, data: owners });
          } catch (e) {
            await logger.error('background', 'Ошибка теста руководителей проектов', { error: e.message });
            sendResponse({ ok: false, error: e.message });
          }
          break;

        case 'CHECK_BREVO_ACCOUNT':
          const brevoApiKeyForCheck = msg?.brevoApiKey || (await storage.get('brevoApiKey'));
          if (!brevoApiKeyForCheck) {
            sendResponse({ ok: false, error: 'API key не указан' });
            return;
          }
          const accountResult = await checkBrevoAccount(brevoApiKeyForCheck);
          sendResponse(accountResult);
          break;

        default:
          sendResponse({ ok: false, error: `Unknown message type: ${msg?.type}` });
      }
    } catch (e) {
      sendResponse({ ok: false, error: String(e?.message || e) });
    }
  })();
  return true; // async response
});
