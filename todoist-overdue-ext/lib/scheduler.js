// lib/scheduler.js — расчёт ближайшего scanTime в Europe/Moscow и управление alarm.
// computeNextRun(scanTime, tz) → UTC-таймстамп ближайшего HH:MM в Europe/Moscow.
// setAlarm() / clearAlarm().

import { logger } from './logger.js';

/**
 * Вычисляет момент следующего запуска в UTC (timestamp).
 * @param {string} scanTime — время в формате HH:MM (локально интерпретируется в tz)
 * @param {string} tz — timezone, например 'Europe/Moscow'
 * @returns {number} — timestamp в мс
 */
export function computeNextRun(scanTime, tz = 'Europe/Moscow') {
  const [hours, minutes] = scanTime.split(':').map(Number);
  const now = new Date();

  // Получаем текущее время в указанной timezone
  const nowInTz = new Date(now.toLocaleString('en-US', { timeZone: tz }));

  // Создаём дату для указанного времени в той же timezone
  const nextRunInTz = new Date(nowInTz);
  nextRunInTz.setHours(hours, minutes, 0, 0);

  // Если время уже прошло сегодня — переносим на завтра
  if (nextRunInTz <= nowInTz) {
    nextRunInTz.setDate(nextRunInTz.getDate() + 1);
  }

  // Конвертируем в UTC timestamp
  const nextRunMs = nextRunInTz.getTime();

  // Логируем для отладки
  console.log('[scheduler] computeNextRun:', {
    scanTime,
    tz,
    now: now.toISOString(),
    nowInTz: nowInTz.toISOString(),
    nextRunInTz: nextRunInTz.toISOString(),
    nextRunMs,
    nowMs: now.getTime(),
    diff: nextRunMs - now.getTime(),
  });

  return nextRunMs;
}

/**
 * Устанавливает alarm на ближайший scanTime.
 * @param {string} scanTime — HH:MM
 * @param {string} tz — timezone
 */
export async function setAlarm(scanTime, tz = 'Europe/Moscow') {
  try {
    const nextRunMs = computeNextRun(scanTime, tz);
    const nextRunIso = new Date(nextRunMs).toISOString();

    // Очищаем старые alarm с тем же именем
    await clearAlarm();

    // Создаём новый alarm
    await chrome.alarms.create('todoist-overdue-scan', {
      when: nextRunMs,
    });

    logger.info('scheduler', 'Alarm установлен', { nextRun: nextRunIso, scanTime, tz });
    return nextRunIso;
  } catch (e) {
    logger.error('scheduler', 'Ошибка установки alarm', { error: e.message });
    throw e;
  }
}

/**
 * Удаляет alarm.
 */
export async function clearAlarm() {
  try {
    await chrome.alarms.clear('todoist-overdue-scan');
    logger.info('scheduler', 'Alarm очищен');
  } catch (e) {
    logger.error('scheduler', 'Ошибка очистки alarm', { error: e.message });
    throw e;
  }
}

/**
 * Возвращает информацию о текущем alarm (если есть).
 */
export async function getAlarm() {
  try {
    const alarm = await chrome.alarms.get('todoist-overdue-scan');
    return alarm;
  } catch (e) {
    logger.error('scheduler', 'Ошибка получения alarm', { error: e.message });
    return null;
  }
}
