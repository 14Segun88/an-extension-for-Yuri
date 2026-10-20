// lib/todoist.js — клиент Todoist REST API v1.
// getProjects(), getTasks(), getCollaborators(projectId) с обработкой ошибок и логированием.
// Поддержка руководителей проектов и пространств.

import { logger } from './logger.js';

const BASE_URL = 'https://api.todoist.com/api/v1';

/**
 * Выполняет GET-запрос к REST API v1.
 * @param {string} token — Todoist API token
 * @param {string} endpoint — путь, например '/projects'
 * @returns {Promise<any>} — JSON-ответ
 */
async function restGet(token, endpoint) {
  const url = `${BASE_URL}${endpoint}?token=${token}`;

  try {
    logger.info('todoist', `Запрос: ${endpoint}`);
    const response = await fetch(url, {
      method: 'GET',
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      let errorMsg = `HTTP ${response.status}`;
      if (response.status === 401) errorMsg = 'Невалидный токен (401)';
      else if (response.status === 403) errorMsg = 'Доступ запрещён (403)';
      else if (response.status === 429) errorMsg = 'Слишком много запросов (429)';
      else if (response.status === 410) errorMsg = 'API устарел (410)';
      else if (errorText) errorMsg += `: ${errorText}`;

      logger.error('todoist', `Ошибка запроса ${endpoint}`, { status: response.status, error: errorMsg });
      throw new Error(errorMsg);
    }

    const data = await response.json();
    logger.info('todoist', `Успех: ${endpoint}`, { count: Array.isArray(data) ? data.length : 1 });
    return data;
  } catch (e) {
    if (e.message.includes('HTTP')) {
      throw e; // уже залогировано
    }
    logger.error('todoist', `Сетевая ошибка: ${endpoint}`, { error: e.message });
    throw new Error(`Сетевая ошибка: ${e.message}`);
  }
}

/**
 * Получить список проектов.
 * GET /api/v1/projects
 */
export async function getProjects(token) {
  return restGet(token, '/projects');
}

/**
 * Получить список задач.
 * GET /api/v1/tasks
 */
export async function getTasks(token) {
  return restGet(token, '/tasks');
}

/**
 * Получить коллабораторов проекта.
 * GET /api/v1/projects/{project_id}/collaborators
 */
export async function getCollaborators(token, projectId) {
  return restGet(token, `/projects/${projectId}/collaborators`);
}

/**
 * Получить информацию о команде.
 * GET /api/v1/team
 */
export async function getTeamInfo(token) {
  return restGet(token, '/team');
}

/**
 * Получить членов команды с ролями.
 * GET /api/v1/team/members
 */
export async function getTeamMembers(token) {
  return restGet(token, '/team/members');
}

/**
 * Получить пространства (workspaces).
 * GET /api/v1/workspaces
 */
export async function getWorkspaces(token) {
  return restGet(token, '/workspaces');
}

/**
 * Получить руководителей проектов.
 * Комбинирует данные из проектов и команды для определения владельцев.
 */
export async function getProjectOwners(token) {
  try {
    const [projects, teamMembers] = await Promise.all([
      getProjects(token),
      getTeamMembers(token),
    ]);

    const owners = new Map();
    
    // Создаем карту членов команды по ID
    const memberMap = new Map(teamMembers.map(m => [m.id, m]));

    // Определяем владельцев проектов
    for (const project of projects) {
      // В API v1 владелец может быть указан разными способами
      const ownerId = project.owner_id || project.creator_id;
      
      if (ownerId && memberMap.has(ownerId)) {
        const owner = memberMap.get(ownerId);
        owners.set(project.id, {
          project_id: project.id,
          project_name: project.name,
          owner_id: owner.id,
          owner_name: owner.name,
          owner_email: owner.email,
          role: owner.role,
        });
      }
    }

    logger.info('todoist', `Найдено владельцев проектов: ${owners.size}`);
    return Array.from(owners.values());
  } catch (e) {
    logger.error('todoist', 'Ошибка получения владельцев проектов', { error: e.message });
    throw e;
  }
}

/**
 * Проверить валидность токена (пробует получить проекты).
 */
export async function validateToken(token) {
  try {
    await getProjects(token);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Внутренний helper: добавить комментарий к задаче.
 * @param {string} token — Todoist API token
 * @param {string} taskId — ID задачи
 * @param {string} content — текст комментария
 * @param {Array<number|string>} uidsToNotify — список user id для уведомления в Todoist
 * @returns {Promise<object>} — результат операции
 */
async function addTaskCommentInternal(token, taskId, content, uidsToNotify = []) {
  const notifyIds = Array.from(new Set((uidsToNotify || []).filter(Boolean))).map(id => Number(id)).filter(id => Number.isFinite(id));

  const baseBody = { task_id: String(taskId), content };
  if (notifyIds.length > 0) {
    baseBody.uids_to_notify = notifyIds;
  }

  logger.info('todoist', `Добавление комментария к задаче ${taskId}`, {
    notifyCount: notifyIds.length,
    notifyIds,
  });

  // Приоритетно используем Sync API: он корректнее обрабатывает uids_to_notify
  // и реально создаёт inbox-уведомления в Todoist.
  try {
    const syncUuid = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : `uuid-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const syncTempId = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : `temp-${Date.now()}-${Math.random().toString(16).slice(2)}`;

    const commandArgs = {
      item_id: String(taskId),
      content,
    };

    if (notifyIds.length > 0) {
      commandArgs.uids_to_notify = notifyIds;
    }

    const commands = [
      {
        type: 'note_add',
        uuid: syncUuid,
        temp_id: syncTempId,
        args: commandArgs,
      },
    ];

    const syncBody = new URLSearchParams();
    syncBody.set('token', token);
    syncBody.set('commands', JSON.stringify(commands));

    const syncResponse = await fetch('https://api.todoist.com/sync/v9/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      },
      body: syncBody.toString(),
    });

    if (syncResponse.ok) {
      const syncData = await syncResponse.json().catch(() => ({}));
      const syncStatus = syncData?.sync_status?.[syncUuid];

      if (syncStatus === 'ok') {
        const commentId = syncData?.temp_id_mapping?.[syncTempId] ?? null;
        logger.info('todoist', `Комментарий добавлен к задаче ${taskId}`, {
          endpoint: 'sync-v9-note_add',
          commentId,
          notifyCount: notifyIds.length,
        });
        return { id: commentId, source: 'sync-v9' };
      }

      const syncError = typeof syncStatus === 'string'
        ? syncStatus
        : JSON.stringify(syncStatus || 'unknown_sync_status');
      logger.warn('todoist', `Sync API вернул неуспешный статус для задачи ${taskId}`, {
        syncStatus: syncError,
      });
    } else {
      const syncErrorText = await syncResponse.text().catch(() => '');
      logger.warn('todoist', `Не удалось добавить комментарий через sync-v9`, {
        status: syncResponse.status,
        error: syncErrorText || `HTTP ${syncResponse.status}`,
      });
    }
  } catch (e) {
    logger.warn('todoist', `Ошибка sync-v9 при добавлении комментария к задаче ${taskId}`, {
      error: e.message,
    });
  }

  const endpoints = [
    {
      name: 'api-v1-comments',
      url: 'https://api.todoist.com/api/v1/comments',
      body: baseBody,
    },
    {
      name: 'rest-v2-comments-legacy',
      url: 'https://api.todoist.com/rest/v2/comments',
      body: baseBody,
    },
  ];

  let lastError = null;

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint.url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(endpoint.body),
      });

      if (response.ok) {
        const data = await response.json().catch(() => ({}));
        logger.info('todoist', `Комментарий добавлен к задаче ${taskId}`, {
          endpoint: endpoint.name,
          commentId: data?.id,
          notifyCount: notifyIds.length,
        });
        return data;
      }

      const errorText = await response.text().catch(() => '');
      let errorMsg = `HTTP ${response.status}`;
      if (response.status === 401) errorMsg = 'Невалидный токен (401)';
      else if (response.status === 403) errorMsg = 'Доступ запрещён (403)';
      else if (response.status === 404) errorMsg = 'Endpoint или задача не найдены (404)';
      else if (response.status === 405) errorMsg = 'Метод не поддерживается (405)';
      else if (response.status === 410) errorMsg = 'Endpoint устарел (410)';
      else if (response.status === 429) errorMsg = 'Слишком много запросов (429)';
      if (errorText) errorMsg += `: ${errorText}`;

      logger.warn('todoist', `Не удалось добавить комментарий через ${endpoint.name}`, {
        url: endpoint.url,
        status: response.status,
        error: errorMsg,
      });

      lastError = new Error(errorMsg);

      if ([401, 403, 429].includes(response.status)) {
        throw lastError;
      }
    } catch (e) {
      lastError = e;

      if (
        e.message.includes('Невалидный токен') ||
        e.message.includes('Доступ запрещён') ||
        e.message.includes('Слишком много запросов') ||
        e.message.includes('Сетевая ошибка')
      ) {
        logger.error('todoist', `Ошибка добавления комментария к задаче ${taskId}`, {
          endpoint: endpoint.name,
          error: e.message,
        });
        throw e;
      }
    }
  }

  logger.error('todoist', `Ошибка добавления комментария к задаче ${taskId}`, {
    error: lastError?.message || 'Неизвестная ошибка',
  });
  throw new Error(lastError?.message || 'Не удалось добавить комментарий');
}

/**
 * Добавить комментарий к задаче без принудительных уведомлений.
 */
export async function addTaskComment(token, taskId, content) {
  return addTaskCommentInternal(token, taskId, content, []);
}

/**
 * Добавить комментарий к задаче c уведомлением пользователей в Todoist по ID.
 */
export async function addTaskCommentWithNotify(token, taskId, content, uidsToNotify = []) {
  return addTaskCommentInternal(token, taskId, content, uidsToNotify);
}

/**
 * Создать текст комментария для просроченной задачи.
 * @param {object} task — задача Todoist
 * @param {string} scanType — тип сканирования
 * @param {string} authorEmail — email автора комментария
 * @returns {string} — текст комментария
 */
export function createOverdueComment(task, scanType, authorEmail, managerEmail = '') {
  const now = new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' });

  let comment = `📢 **Автоматическое уведомление от ${authorEmail}** (${now})\n\n`;

  switch (scanType) {
    case 'overdue':
      comment += `⚠️ Эта задача **просрочена**!\n`;
      if (task.due) {
        comment += `📅 Дедлайн: ${task.due.date || task.due.datetime}\n`;
      }
      break;
    case 'noDueDate':
      comment += `⚠️ У этой задачи **не установлен срок выполнения**!\n`;
      comment += `📝 Пожалуйста, установите дедлайн (дату/время) для задачи.\n`;
      break;
    case 'noResponsible':
      comment += `⚠️ У этой задачи **нет ответственного**!\n`;
      comment += `👤 Пожалуйста, назначьте ответственного сотрудника.\n`;
      break;
  }

  if (managerEmail) {
    const mentionByEmail = `@${managerEmail}`;
    const mentionByLogin = managerEmail.includes('@') ? `@${managerEmail.split('@')[0]}` : `@${managerEmail}`;

    comment += `\n🔔 Уведомление в Todoist: ${mentionByLogin}`;

    // Дополнительно оставляем mention по email для рабочих пространств,
    // где упоминание может матчиться по email.
    if (mentionByEmail !== mentionByLogin) {
      comment += `\n🔔 Альтернативное упоминание: ${mentionByEmail}`;
    }
  }

  comment += `\n💡 Пожалуйста, выполните задачу или обновите её статус.`;

  return comment;
}
