// lib/todoist.js — клиент Todoist REST API v1.
// getProjects(), getTasks(), getCollaborators(projectId) с обработкой ошибок и логированием.

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
