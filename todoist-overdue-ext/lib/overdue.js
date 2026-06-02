// lib/overdue.js — фильтр просроченных задач и группировка по assignee.
// isOverdue(task, nowMsk) — учитывает due.datetime и due.date.
// groupByAssigneeEmail(...) → Map<email, Task[]>, отчёт по пропущенным.

import { logger } from './logger.js';

/**
 * Проверяет, просрочена ли задача на момент nowMsk (Date в Europe/Moscow).
 * Учитывает due.datetime (ISO с timezone) и due.date (только дата, интерпретируется в МСК).
 */
export function isOverdue(task, nowMsk) {
  if (!task.due) {
    logger.info('overdue', `Задача без due: ${task.id}`, { content: task.content });
    return false;
  }

  const { due } = task;
  const now = nowMsk.getTime();

  logger.info('overdue', `Проверка задачи ${task.id}`, {
    content: task.content,
    due: JSON.stringify(due),
    now: new Date(now).toISOString(),
  });

  // Если есть datetime — парсим как ISO с timezone
  if (due.datetime) {
    try {
      const dueDate = new Date(due.datetime);
      const isOverdueValue = dueDate.getTime() < now;
      logger.info('overdue', `datetime: ${due.datetime} -> ${dueDate.toISOString()} -> overdue: ${isOverdueValue}`);
      return isOverdueValue;
    } catch (e) {
      logger.warn('overdue', 'Ошибка парсинга due.datetime', { taskId: task.id, datetime: due.datetime });
      return false;
    }
  }

  // Если есть только date — интерпретируем как дату в Europe/Moscow
  if (due.date) {
    try {
      // date может быть в формате YYYY-MM-DD или YYYY-MM-DDTHH:mm:ss
      let dueDate;
      if (due.date.includes('T')) {
        // Это дата-время
        dueDate = new Date(due.date);
      } else {
        // Это только дата
        const [year, month, day] = due.date.split('-').map(Number);
        // Создаём дату в МСК (UTC+3 без DST)
        dueDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
        // Конец дня в МСК: 23:59:59.999 UTC = 20:59:59.999 МСК
        dueDate = new Date(dueDate.getTime() + 23 * 60 * 60 * 1000 + 59 * 60 * 1000 + 999);
      }
      const isOverdueValue = dueDate.getTime() < now;
      logger.info('overdue', `date: ${due.date} -> ${dueDate.toISOString()} -> overdue: ${isOverdueValue}`);
      return isOverdueValue;
    } catch (e) {
      logger.warn('overdue', 'Ошибка парсинга due.date', { taskId: task.id, date: due.date });
      return false;
    }
  }

  logger.info('overdue', `Задача ${task.id} не имеет datetime или date`);
  return false;
}

/**
 * Группирует просроченные задачи по email ответственных.
 * @param {Array} tasks — все задачи
 * @param {Array} projects — все проекты
 * @param {Map<number, Array>} collaboratorsByProject — projectId → [{id, name, email}, ...]
 * @param {Set<string>} recipients — множество email получателей
 * @returns {Object} { byEmail: Map<email, Task[]>, skipped: Array<{task, reason}> }
 */
export function groupByAssigneeEmail(tasks, projects, collaboratorsByProject, recipients) {
  const byEmail = new Map();
  const skipped = [];

  // Карта projectId → project
  const projectMap = new Map(projects.map(p => [p.id, p]));

  for (const task of tasks) {
    // Пропускаем задачи без responsible_uid (личные проекты)
    if (!task.responsible_uid) {
      skipped.push({ task, reason: 'нет ответственного (responsible_uid)' });
      continue;
    }

    // Находим проект задачи
    const project = projectMap.get(task.project_id);
    if (!project) {
      skipped.push({ task, reason: 'проект не найден' });
      continue;
    }

    // Получаем коллабораторов проекта
    const collaborators = collaboratorsByProject.get(task.project_id) || [];
    const assignee = collaborators.find(c => c.id === task.responsible_uid);

    if (!assignee) {
      skipped.push({ task, reason: 'ответственный не найден в коллабораторах проекта' });
      continue;
    }

    if (!assignee.email) {
      skipped.push({ task, reason: 'у ответственного нет email' });
      continue;
    }

    // Проверяем, что email в списке получателей (нечувствительно к регистру)
    const assigneeEmailLower = assignee.email.toLowerCase();
    const recipientFound = Array.from(recipients).some(r => r.toLowerCase() === assigneeEmailLower);

    if (!recipientFound) {
      skipped.push({ task, reason: `email ${assignee.email} не в списке получателей` });
      continue;
    }

    // Добавляем задачу в группу
    if (!byEmail.has(assignee.email)) {
      byEmail.set(assignee.email, []);
    }
    byEmail.get(assignee.email).push(task);
  }

  logger.info('overdue', 'Группировка завершена', {
    total: tasks.length,
    grouped: Array.from(byEmail.values()).reduce((sum, arr) => sum + arr.length, 0),
    skipped: skipped.length,
    recipientsCount: recipients.size,
  });

  return { byEmail, skipped };
}

/**
 * Фильтрует только просроченные задачи.
 */
export function filterOverdue(tasks, nowMsk) {
  return tasks.filter(task => isOverdue(task, nowMsk));
}
