// lib/brevo.js — отправка писем через локальный SMTP backend (Brevo-compatible API).
// sendEmail({to, subject, html}) → POST http://127.0.0.1:8787/v3/smtp/email
// Шаблон HTML: таблица «Проект | Задача | Дедлайн | Ссылка».
// Ретраи 2× при 429/5xx с экспоненциальным бэкоффом.

import { logger } from './logger.js';

const BASE_URL = 'http://127.0.0.1:8787/v3/smtp/email';
const ACCOUNT_URL = 'http://127.0.0.1:8787/v3/account';
const STATS_URL = 'http://127.0.0.1:8787/v3/smtp/statistics/events';

/**
 * Отправляет письмо через Brevo.
 * @param {string} apiKey — Brevo API key
 * @param {object} params — { to, subject, html, senderEmail, senderName, replyToEmail }
 * @returns {Promise<{ok: boolean, messageId?: string, error?: string}>}
 */
export async function sendEmail(apiKey, { to, subject, html, senderEmail, senderName, replyToEmail }) {
  const payload = {
    sender: { email: senderEmail, name: senderName },
    to: [{ email: to }],
    subject,
    htmlContent: html,
  };

  // Добавляем replyTo если указан
  if (replyToEmail) {
    payload.replyTo = { email: replyToEmail, name: senderName };
  }

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
      
      // Детальное логирование messageId
      const messageId = data.messageId || data.messageId || 'unknown';
      logger.info('brevo', `Письмо отправлено ${to}`, { 
        messageId: messageId,
        to: to,
        subject: payload.subject,
        timestamp: new Date().toISOString()
      });
      
      return { ok: true, messageId: messageId };
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
export async function sendTestEmail(apiKey, senderEmail, senderName, recipientEmail, replyToEmail = null) {
  const subject = 'Тестовое письмо — Todoist Overdue Notifier';
  const html = `
    <h2>Тестовое письмо</h2>
    <p>Если вы видите это сообщение, значит Brevo настроен правильно.</p>
    <p>Отправитель: ${escapeHtml(senderName)} <${escapeHtml(senderEmail)}></p>
    ${replyToEmail ? `<p>Reply-To: ${escapeHtml(replyToEmail)}</p>` : ''}
    <p>Получатель: ${escapeHtml(recipientEmail)}</p>
    <p>Время: ${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })} МСК</p>
  `;
  return sendEmail(apiKey, { to: recipientEmail, subject, html, senderEmail, senderName, replyToEmail });
}

/**
 * Проверяет статус аккаунта и лимиты Brevo.
 * @param {string} apiKey — Brevo API key
 * @returns {Promise<{ok: boolean, data?: object, error?: string}>}
 */
export async function checkBrevoAccount(apiKey) {
  try {
    logger.info('brevo', 'Проверка аккаунта Brevo...');
    
    // Проверка аккаунта
    const accountResponse = await fetch(ACCOUNT_URL, {
      headers: { 'api-key': apiKey },
    });

    if (!accountResponse.ok) {
      const errorText = await accountResponse.text().catch(() => '');
      throw new Error(`HTTP ${accountResponse.status}: ${errorText}`);
    }

    const accountData = await accountResponse.json();
    
    // Проверка статистики отправки за сегодня
    const today = new Date().toISOString().split('T')[0];
    const statsResponse = await fetch(`${STATS_URL}?startDate=${today}&endDate=${today}`, {
      headers: { 'api-key': apiKey },
    });

    let statsData = null;
    if (statsResponse.ok) {
      const rawStats = await statsResponse.json();
      // Обрабатываем разные форматы ответа
      statsData = Array.isArray(rawStats) ? rawStats : (rawStats?.events || rawStats?.data || []);
    }

    // Получаем информацию о плане и кредитах
    let planInfo = { type: 'unknown', credits: 0 };
    if (accountData.plan && Array.isArray(accountData.plan)) {
      const emailPlan = accountData.plan.find(p => p.creditsType === 'sendLimit');
      if (emailPlan) {
        planInfo = {
          type: emailPlan.type || 'unknown',
          credits: emailPlan.credits || 0,
        };
      }
    }

    const result = {
      ok: true,
      data: {
        account: {
          email: accountData.email,
          firstName: accountData.firstName,
          lastName: accountData.lastName,
          companyName: accountData.companyName,
          plan: planInfo,
        },
        stats: statsData && Array.isArray(statsData) ? {
          requests: statsData.length || 0,
          delivered: statsData.filter(s => s.event === 'delivered').length || 0,
          opens: statsData.filter(s => s.event === 'opened').length || 0,
          clicks: statsData.filter(s => s.event === 'clicked').length || 0,
          bounces: statsData.filter(s => s.event === 'bounce' || s.event === 'bounced').length || 0,
        } : { requests: 0, delivered: 0, opens: 0, clicks: 0, bounces: 0 },
        timestamp: new Date().toISOString(),
      },
    };

    logger.info('brevo', 'Аккаунт Brevo проверен', result.data);
    return result;

  } catch (e) {
    logger.error('brevo', 'Ошибка проверки аккаунта Brevo', { error: e.message, stack: e.stack });
    return { ok: false, error: e.message };
  }
}
