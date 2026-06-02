// lib/brevo.js — отправка писем через Brevo API.
// sendEmail({to, subject, html}) → POST https://api.brevo.com/v3/smtp/email
// Шаблон HTML: таблица «Проект | Задача | Дедлайн | Ссылка».
// Ретраи 2× при 429/5xx с экспоненциальным бэкоффом.

import { logger } from './logger.js';

const BASE_URL = 'https://api.brevo.com/v3/smtp/email';

/**
 * Отправляет письмо через Brevo.
 * @param {string} apiKey — Brevo API key
 * @param {object} params — { to, subject, html, senderEmail, senderName }
 * @returns {Promise<{ok: boolean, messageId?: string, error?: string}>}
 */
export async function sendEmail(apiKey, { to, subject, html, senderEmail, senderName }) {
  const payload = {
    sender: { email: senderEmail, name: senderName },
    to: [{ email: to }],
    subject,
    htmlContent: html,
  };

  const maxRetries = 2;
  let attempt = 0;

  while (attempt <= maxRetries) {
    try {
      logger.info('brevo', `Отправка письма ${to} (попытка ${attempt + 1})`);
      console.log('[brevo] Payload:', JSON.stringify(payload, null, 2));

      const response = await fetch(BASE_URL, {
        method: 'POST',
        headers: {
          'api-key': apiKey,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      console.log('[brevo] Response status:', response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        let errorMsg = `HTTP ${response.status}`;
        if (response.status === 401) errorMsg = 'Невалидный API key (401)';
        else if (response.status === 403) errorMsg = 'Доступ запрещён (403)';
        else if (response.status === 429) errorMsg = 'Слишком много запросов (429)';
        else if (response.status >= 500) errorMsg = `Ошибка сервера (${response.status})`;
        else if (errorText) errorMsg += `: ${errorText}`;

        // Детальное логирование ошибки
        const errorDetails = {
          status: response.status,
          statusText: response.statusText,
          body: errorText.slice(0, 500),
        };
        logger.error('brevo', `Ошибка отправки ${to}`, JSON.stringify(errorDetails));
        console.error('[brevo] Ошибка отправки:', to, errorDetails);

        // Ретраи при 429 и 5xx
        if ((response.status === 429 || response.status >= 500) && attempt < maxRetries) {
          const delayMs = Math.pow(2, attempt) * 1000; // 1s, 2s
          logger.warn('brevo', `Ретрай через ${delayMs}мс: ${errorMsg}`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
          attempt++;
          continue;
        }

        return { ok: false, error: errorMsg };
      }

      const data = await response.json();
      console.log('[brevo] Success response:', data);
      logger.info('brevo', `Письмо отправлено ${to}`, { messageId: data.messageId });
      return { ok: true, messageId: data.messageId };
    } catch (e) {
      // Детальное логирование сетевой ошибки
      logger.error('brevo', `Сетевая ошибка отправки ${to}`, {
        error: e.message,
        stack: e.stack?.slice(0, 300),
        attempt: attempt + 1,
      });
      console.error('[brevo] Сетевая ошибка:', e);

      if (attempt < maxRetries) {
        const delayMs = Math.pow(2, attempt) * 1000;
        logger.warn('brevo', `Ретрай через ${delayMs}мс: ${e.message}`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        attempt++;
        continue;
      }
      return { ok: false, error: `Сетевая ошибка: ${e.message}` };
    }
  }

  return { ok: false, error: 'Превышен лимит попыток' };
}

/**
 * Генерирует HTML-таблицу со списком задач.
 */
export function generateTaskHtml(tasks) {
  const rows = tasks.map(task => {
    const project = task.project_name || 'Без проекта';
    const content = task.content || 'Без названия';
    const deadline = task.due?.date || task.due?.datetime || '—';
    const url = task.url || '#';
    return `
      <tr>
        <td>${escapeHtml(project)}</td>
        <td><a href="${escapeHtml(url)}">${escapeHtml(content)}</a></td>
        <td>${escapeHtml(deadline)}</td>
      </tr>
    `;
  }).join('');

  return `
    <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%;">
      <thead>
        <tr style="background: #f3f4f6;">
          <th style="text-align: left;">Проект</th>
          <th style="text-align: left;">Задача</th>
          <th style="text-align: left;">Дедлайн</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
}

/**
 * Экранирует HTML-спецсимволы.
 */
function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, '&#039;');
}

/**
 * Отправляет тестовое письмо.
 */
export async function sendTestEmail(apiKey, senderEmail, senderName, recipientEmail) {
  const subject = 'Тестовое письмо — Todoist Overdue Notifier';
  const html = `
    <h2>Тестовое письмо</h2>
    <p>Если вы видите это сообщение, значит Brevo настроен правильно.</p>
    <p>Отправитель: ${escapeHtml(senderName)} <${escapeHtml(senderEmail)}></p>
    <p>Получатель: ${escapeHtml(recipientEmail)}</p>
    <p>Время: ${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })} МСК</p>
  `;
  return sendEmail(apiKey, { to: recipientEmail, subject, html, senderEmail, senderName });
}
