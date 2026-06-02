// background.js — service worker (MV3).
// Полная логика: alarms + scanAndNotify, обработка сообщений START/STOP/RUN_NOW/TEST_BREVO/TEST_TODOIST.

import { storage, DEFAULTS } from './lib/storage.js';
import { logger } from './lib/logger.js';
import { getProjects, getTasks, getCollaborators } from './lib/todoist.js';
import { filterOverdue, groupByAssigneeEmail } from './lib/overdue.js';
import { sendEmail, generateTaskHtml, sendTestEmail } from './lib/brevo.js';
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
    const { todoistToken, brevoApiKey, timezone, senderEmail, senderName, recipients } = settings;

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
    const projectsStr = JSON.stringify(projectsData);
    const tasksStr = JSON.stringify(tasksData);

    await logger.info('background', `Projects type: ${typeof projectsData}, isArray: ${Array.isArray(projectsData)}`);
    await logger.info('background', `Projects sample: ${projectsStr.slice(0, 500)}`);
    if (Array.isArray(projectsData) && projectsData.length > 0) {
      await logger.info('background', `First project: ${JSON.stringify(projectsData[0]).slice(0, 400)}`);
    }

    await logger.info('background', `Tasks type: ${typeof tasksData}, isArray: ${Array.isArray(tasksData)}`);
    await logger.info('background', `Tasks sample: ${tasksStr.slice(0, 500)}`);
    if (Array.isArray(tasksData) && tasksData.length > 0) {
      await logger.info('background', `First task: ${JSON.stringify(tasksData[0]).slice(0, 400)}`);
    }

    // Обрабатываем разные форматы ответа
    const projects = Array.isArray(projectsData) ? projectsData :
                    (projectsData?.results || projectsData?.projects || projectsData?.items || []);

    const tasks = Array.isArray(tasksData) ? tasksData :
                  (tasksData?.results || tasksData?.tasks || tasksData?.items || []);

    await logger.info('background', 'После обработки', {
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

    // Фильтруем просроченные задачи
    const nowMsk = new Date(new Date().toLocaleString('en-US', { timeZone: timezone || 'Europe/Moscow' }));
    const overdueTasks = filterOverdue(tasks, nowMsk);
    await logger.info('background', `Найдено просроченных: ${overdueTasks.length} из ${tasks.length}`);

    if (overdueTasks.length === 0) {
      await logger.info('background', 'Нет просроченных задач');
      await updateLastRun({ found: 0, sent: 0, errors: 0 });
      return;
    }

    // Группируем по email
    const recipientsSet = new Set(recipients || []);
    await logger.info('background', `Recipients из настроек: ${JSON.stringify(Array.from(recipientsSet))}`);

    const { byEmail, skipped } = groupByAssigneeEmail(overdueTasks, projects, collaboratorsByProject, recipientsSet);

    // Логируем пропущенные
    for (const { task, reason } of skipped) {
      await logger.warn('background', `Задача пропущена: ${reason}`, { taskId: task.id, content: task.content });
    }

    // Отправляем письма
    let sent = 0;
    let errors = 0;
    const today = new Date().toLocaleDateString('ru-RU', { timeZone: timezone || 'Europe/Moscow' });

    for (const [email, tasksForEmail] of byEmail.entries()) {
      const subject = `Просроченные задачи Todoist на ${today} (${tasksForEmail.length} шт.)`;
      const html = `
        <h2>У вас ${tasksForEmail.length} просроченных задач</h2>
        ${generateTaskHtml(tasksForEmail)}
        <p style="margin-top: 20px; font-size: 12px; color: #6b7280;">
          Это автоматическое уведомление от Todoist Overdue Notifier.
        </p>
      `;

      // Логируем параметры перед отправкой
      await logger.info('background', `Подготовка письма для ${email}`, JSON.stringify({
        subject,
        senderEmail,
        senderName,
        taskCount: tasksForEmail.length,
      }));

      const result = await sendEmail(brevoApiKey, {
        to: email,
        subject,
        html,
        senderEmail,
        senderName,
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

    // Обновляем lastRun
    await updateLastRun({ found: overdueTasks.length, sent, errors });

    // Показываем уведомление Chrome
    if (sent > 0) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/128.png',
        title: 'Todoist Overdue Notifier',
        message: `Отправлено ${sent} писем, просрочено ${overdueTasks.length} задач`,
      });
    }

    const duration = Date.now() - startTime;
    await logger.info('background', `Скан завершён за ${duration}мс`, { found: overdueTasks.length, sent, errors });
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
          const recipients = msg?.recipients || (await storage.get('recipients'));
          if (!brevoApiKey || !senderEmail || !recipients?.length) {
            sendResponse({ ok: false, error: 'Не все параметры указаны' });
            return;
          }
          const result = await sendTestEmail(brevoApiKey, senderEmail, senderName, recipients[0]);
          sendResponse(result);
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
