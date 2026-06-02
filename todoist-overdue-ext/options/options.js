// options.js — полная реализация страницы настроек.

import { storage, DEFAULTS } from '../lib/storage.js';
import { logger } from '../lib/logger.js';

// DOM элементы
const els = {
  todoistToken: document.getElementById('todoist-token'),
  brevoApiKey: document.getElementById('brevo-api-key'),
  scanTime: document.getElementById('scan-time'),
  senderEmail: document.getElementById('sender-email'),
  senderName: document.getElementById('sender-name'),
  recipients: document.getElementById('recipients'),
  nextRunDisplay: document.getElementById('next-run-display'),
  todoistStatus: document.getElementById('todoist-status'),
  brevoStatus: document.getElementById('brevo-status'),
  actionStatus: document.getElementById('action-status'),
  saveStatus: document.getElementById('save-status'),
  recipientsHint: document.getElementById('recipients-hint'),
  logFilter: document.getElementById('log-filter'),
  logContainer: document.getElementById('log-container'),
};

// Валидация email
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Парсинг recipients из textarea
function parseRecipients(text) {
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);
}

// Форматирование recipients в textarea
function formatRecipients(emails) {
  return Array.isArray(emails) ? emails.join('\n') : '';
}

// Отображение статуса
function setStatus(element, message, type = 'ok') {
  if (!element) return;
  element.textContent = message;
  element.className = 'status ' + type;
  if (!message) element.className = 'status';
}

// Загрузка настроек в формы
async function loadSettings() {
  try {
    const settings = await storage.getAll();
    els.todoistToken.value = settings.todoistToken || '';
    els.brevoApiKey.value = settings.brevoApiKey || '';
    els.scanTime.value = settings.scanTime || DEFAULTS.scanTime;
    els.senderEmail.value = settings.senderEmail || DEFAULTS.senderEmail;
    els.senderName.value = settings.senderName || DEFAULTS.senderName;
    els.recipients.value = formatRecipients(settings.recipients || []);
    updateNextRunDisplay(settings.scanTime);
    validateRecipients();
  } catch (e) {
    console.error('[options] loadSettings error:', e);
    setStatus(els.saveStatus, 'Ошибка загрузки настроек', 'error');
  }
}

// Обновление отображения следующего запуска
function updateNextRunDisplay(scanTime) {
  if (!scanTime) {
    els.nextRunDisplay.textContent = '';
    return;
  }
  try {
    const [hours, minutes] = scanTime.split(':').map(Number);
    const now = new Date();
    const next = new Date();
    next.setHours(hours, minutes, 0, 0);
    if (next <= now) {
      next.setDate(next.getDate() + 1);
    }
    const options = { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Moscow' };
    els.nextRunDisplay.textContent = `Следующий скан: ${next.toLocaleString('ru-RU', options)} МСК`;
  } catch (e) {
    els.nextRunDisplay.textContent = '';
  }
}

// Валидация recipients
function validateRecipients() {
  const text = els.recipients.value;
  const emails = parseRecipients(text);
  const invalid = emails.filter(e => !isValidEmail(e));
  if (invalid.length > 0) {
    els.recipientsHint.textContent = `Невалидные email: ${invalid.join(', ')}`;
    els.recipientsHint.style.color = 'var(--error)';
    return false;
  }
  if (emails.length === 0) {
    els.recipientsHint.textContent = 'Добавьте хотя бы одного получателя';
    els.recipientsHint.style.color = 'var(--warn)';
    return false;
  }
  els.recipientsHint.textContent = `${emails.length} получатель(ей)`;
  els.recipientsHint.style.color = 'var(--success)';
  return true;
}

// Сохранение настроек
async function saveSettings() {
  try {
    setStatus(els.saveStatus, 'Сохранение...', 'ok');
    const recipients = parseRecipients(els.recipients.value);
    const invalid = recipients.filter(e => !isValidEmail(e));
    if (invalid.length > 0) {
      setStatus(els.saveStatus, 'Невалидные email', 'error');
      return;
    }
    if (!isValidEmail(els.senderEmail.value)) {
      setStatus(els.saveStatus, 'Невалидный sender email', 'error');
      return;
    }
    await storage.setMany({
      todoistToken: els.todoistToken.value.trim(),
      brevoApiKey: els.brevoApiKey.value.trim(),
      scanTime: els.scanTime.value,
      senderEmail: els.senderEmail.value.trim(),
      senderName: els.senderName.value.trim(),
      recipients,
    });
    updateNextRunDisplay(els.scanTime.value);
    setStatus(els.saveStatus, 'Сохранено', 'ok');
    await logger.info('options', 'Настройки сохранены');
  } catch (e) {
    console.error('[options] saveSettings error:', e);
    setStatus(els.saveStatus, 'Ошибка сохранения', 'error');
  }
}

// Тест Todoist
async function testTodoist() {
  const token = els.todoistToken.value.trim();
  if (!token) {
    setStatus(els.todoistStatus, 'Введите токен', 'error');
    return;
  }
  try {
    setStatus(els.todoistStatus, 'Проверка...', 'ok');
    const response = await fetch('https://api.todoist.com/rest/v2/projects', {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    setStatus(els.todoistStatus, `OK (${data.length} проектов)`, 'ok');
    await logger.info('options', 'Todoist тест пройден', { projects: data.length });
  } catch (e) {
    setStatus(els.todoistStatus, `Ошибка: ${e.message}`, 'error');
    await logger.error('options', 'Todoist тест не пройден', { error: e.message });
  }
}

// Тест Brevo
async function testBrevo() {
  const apiKey = els.brevoApiKey.value.trim();
  if (!apiKey) {
    setStatus(els.brevoStatus, 'Введите ключ', 'error');
    return;
  }
  try {
    setStatus(els.brevoStatus, 'Проверка...', 'ok');
    const response = await fetch('https://api.brevo.com/v3/account', {
      headers: { 'api-key': apiKey },
    });
    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    const data = await response.json();
    console.log('[Brevo Test] Account data:', data);
    setStatus(els.brevoStatus, 'OK', 'ok');
    await logger.info('options', 'Brevo тест пройден');
  } catch (e) {
    console.error('[Brevo Test] Error:', e);
    setStatus(els.brevoStatus, `Ошибка: ${e.message}`, 'error');
    await logger.error('options', 'Brevo тест не пройден', { error: e.message });
  }
}

// Запустить скан сейчас
async function runNow() {
  try {
    setStatus(els.actionStatus, 'Запуск...', 'ok');
    const response = await chrome.runtime.sendMessage({ type: 'RUN_NOW' });
    if (response?.ok) {
      setStatus(els.actionStatus, 'Запущен', 'ok');
      await logger.info('options', 'Скан запущен вручную');
    } else {
      setStatus(els.actionStatus, `Ошибка: ${response?.error}`, 'error');
    }
  } catch (e) {
    setStatus(els.actionStatus, `Ошибка: ${e.message}`, 'error');
  }
}

// Отправить тестовое письмо
async function sendTestEmail() {
  try {
    setStatus(els.actionStatus, 'Отправка...', 'ok');
    const response = await chrome.runtime.sendMessage({ type: 'TEST_BREVO' });
    if (response?.ok) {
      setStatus(els.actionStatus, 'Отправлено', 'ok');
      await logger.info('options', 'Тестовое письмо отправлено');
    } else {
      setStatus(els.actionStatus, `Ошибка: ${response?.error}`, 'error');
    }
  } catch (e) {
    setStatus(els.actionStatus, `Ошибка: ${e.message}`, 'error');
  }
}

// Загрузка и отображение логов
async function loadLogs() {
  try {
    const filter = els.logFilter.value;
    const allLogs = await logger.getAll();
    const filtered = filter === 'all' ? allLogs : allLogs.filter(l => l.level === filter);
    els.logContainer.innerHTML = filtered.map(entry => {
      const ts = new Date(entry.ts).toLocaleString('ru-RU');
      return `<div class="log-entry ${entry.level}">
        <span class="log-ts">${ts}</span>
        <span class="log-source">[${entry.source}]</span>
        <span class="log-msg">${entry.message}</span>
      </div>`;
    }).join('');
    if (filtered.length === 0) {
      els.logContainer.innerHTML = '<div class="log-entry">Нет записей</div>';
    }
  } catch (e) {
    console.error('[options] loadLogs error:', e);
  }
}

// Очистить логи
async function clearLogs() {
  if (!confirm('Очистить журнал?')) return;
  try {
    await logger.clear();
    await loadLogs();
    await logger.info('options', 'Журнал очищен');
  } catch (e) {
    console.error('[options] clearLogs error:', e);
  }
}

// Экспорт логов
async function exportLogs() {
  try {
    const text = await logger.exportText();
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `todoist-overdue-logs-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    await logger.info('options', 'Логи экспортированы');
  } catch (e) {
    console.error('[options] exportLogs error:', e);
  }
}

// Инициализация
async function init() {
  await loadSettings();
  await loadLogs();

  // Слушатели событий
  document.getElementById('save').addEventListener('click', saveSettings);
  document.getElementById('test-todoist').addEventListener('click', testTodoist);
  document.getElementById('test-brevo').addEventListener('click', testBrevo);
  document.getElementById('run-now').addEventListener('click', runNow);
  document.getElementById('send-test-email').addEventListener('click', sendTestEmail);
  document.getElementById('log-refresh').addEventListener('click', loadLogs);
  document.getElementById('log-clear').addEventListener('click', clearLogs);
  document.getElementById('log-export').addEventListener('click', exportLogs);
  els.logFilter.addEventListener('change', loadLogs);
  els.recipients.addEventListener('input', validateRecipients);
  els.scanTime.addEventListener('change', () => updateNextRunDisplay(els.scanTime.value));

  // Подписка на изменения storage для автообновления логов
  storage.onChange((changes) => {
    if ('logs' in changes) {
      loadLogs();
    }
  });
}

init();
