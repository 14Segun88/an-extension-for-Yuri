// popup.js — полная реализация popup: тумблер, статус, мини-журнал.

import { storage } from '../lib/storage.js';
import { logger } from '../lib/logger.js';

// DOM элементы
const els = {
  botStatus: document.getElementById('bot-status'),
  nextRun: document.getElementById('next-run'),
  lastRun: document.getElementById('last-run'),
  lastResult: document.getElementById('last-result'),
  toggleBot: document.getElementById('toggle-bot'),
  runNow: document.getElementById('run-now'),
  openOptions: document.getElementById('open-options'),
  logContainer: document.getElementById('log-container'),
};

// Отображение статуса бота
function updateBotStatus(enabled) {
  if (enabled) {
    els.botStatus.textContent = 'Бот: ВКЛ';
    els.botStatus.className = 'status-badge enabled';
    els.toggleBot.textContent = 'Стоп';
  } else {
    els.botStatus.textContent = 'Бот: ВЫКЛ';
    els.botStatus.className = 'status-badge disabled';
    els.toggleBot.textContent = 'Старт';
  }
}

// Форматирование даты/времени
function formatDateTime(isoString) {
  if (!isoString) return '—';
  try {
    const date = new Date(isoString);
    return date.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

// Обновление отображения следующего запуска
function updateNextRunDisplay(nextRunAt) {
  if (!nextRunAt) {
    els.nextRun.textContent = '—';
    return;
  }
  try {
    const date = new Date(nextRunAt);
    els.nextRun.textContent = date.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }) + ' МСК';
  } catch {
    els.nextRun.textContent = '—';
  }
}

// Обновление отображения последнего запуска
function updateLastRunDisplay(lastRun) {
  if (!lastRun) {
    els.lastRun.textContent = '—';
    els.lastResult.textContent = '—';
    return;
  }
  els.lastRun.textContent = formatDateTime(lastRun.at);
  els.lastResult.textContent = `найдено: ${lastRun.found}, отправлено: ${lastRun.sent}, ошибок: ${lastRun.errors}`;
}

// Загрузка и отображение мини-журнала
async function loadMiniLog() {
  try {
    const logs = await logger.tail(10);
    els.logContainer.innerHTML = logs.map(entry => {
      const ts = new Date(entry.ts).toLocaleTimeString('ru-RU');
      return `<div class="log-entry ${entry.level}">
        <span class="log-ts">${ts}</span>
        <span class="log-source">[${entry.source}]</span>
        <span class="log-msg">${entry.message}</span>
      </div>`;
    }).join('');
    if (logs.length === 0) {
      els.logContainer.innerHTML = '<div class="log-entry">Нет записей</div>';
    }
  } catch (e) {
    console.error('[popup] loadMiniLog error:', e);
  }
}

// Загрузка состояния
async function loadState() {
  try {
    const settings = await storage.getAll();
    updateBotStatus(settings.botEnabled);
    updateNextRunDisplay(settings.nextRunAt);
    updateLastRunDisplay(settings.lastRun);
    await loadMiniLog();
  } catch (e) {
    console.error('[popup] loadState error:', e);
  }
}

// Переключение бота
async function toggleBot() {
  try {
    const current = await storage.get('botEnabled');
    const newState = !current;
    await storage.set('botEnabled', newState);
    updateBotStatus(newState);
    const response = await chrome.runtime.sendMessage({
      type: newState ? 'START' : 'STOP'
    });
    if (response?.ok) {
      await logger.info('popup', newState ? 'Бот запущен' : 'Бот остановлен');
    } else {
      await logger.error('popup', `Ошибка переключения: ${response?.error}`);
    }
    await loadState();
  } catch (e) {
    console.error('[popup] toggleBot error:', e);
  }
}

// Запустить скан сейчас
async function runNow() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'RUN_NOW' });
    if (response?.ok) {
      await logger.info('popup', 'Скан запущен вручную');
    } else {
      await logger.error('popup', `Ошибка запуска: ${response?.error}`);
    }
    await loadState();
  } catch (e) {
    console.error('[popup] runNow error:', e);
  }
}

// Открыть настройки
function openOptions() {
  if (chrome.runtime.openOptionsPage) {
    chrome.runtime.openOptionsPage();
  } else {
    window.open(chrome.runtime.getURL('options/options.html'));
  }
}

// Инициализация
async function init() {
  await loadState();

  // Слушатели событий
  els.toggleBot.addEventListener('click', toggleBot);
  els.runNow.addEventListener('click', runNow);
  els.openOptions.addEventListener('click', openOptions);

  // Подписка на изменения storage
  storage.onChange(async (changes) => {
    if ('botEnabled' in changes || 'nextRunAt' in changes || 'lastRun' in changes) {
      await loadState();
    }
    if ('logs' in changes) {
      await loadMiniLog();
    }
  });
}

init();
