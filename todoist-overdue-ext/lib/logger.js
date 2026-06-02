// lib/logger.js — кольцевой буфер логов поверх chrome.storage.local.
// Хранит до MAX_LOGS записей. Любые сообщения санируются от секретов.

const LOGS_KEY = 'logs';
const MAX_LOGS = 500;

const LEVELS = Object.freeze({
  info: 'info',
  warn: 'warn',
  error: 'error',
});

// Грубая санитизация: не пишем токены/ключи, даже если они случайно попали в строку.
function sanitize(value) {
  if (value == null) return value;
  let s = typeof value === 'string' ? value : safeStringify(value);
  // Bearer-токены Todoist
  s = s.replace(/Bearer\s+[A-Za-z0-9_\-]+/gi, 'Bearer ***');
  // api-key заголовки/поля
  s = s.replace(/(api[-_]?key["'\s:=]+)[A-Za-z0-9_\-]+/gi, '$1***');
  // Длинные hex/base64-подобные токены (32+ символов)
  s = s.replace(/\b[A-Fa-f0-9]{32,}\b/g, '***');
  s = s.replace(/\bxkeysib-[A-Za-z0-9]+\b/g, 'xkeysib-***');
  return s;
}

function safeStringify(v) {
  try {
    return JSON.stringify(v);
  } catch {
    try { return String(v); } catch { return '[unserializable]'; }
  }
}

function localGet(keys) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(keys, (items) => {
      const err = chrome.runtime.lastError;
      if (err) reject(new Error(err.message));
      else resolve(items);
    });
  });
}

function localSet(items) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set(items, () => {
      const err = chrome.runtime.lastError;
      if (err) reject(new Error(err.message));
      else resolve();
    });
  });
}

// Простейшая сериализация конкурентных append'ов: цепочка промисов.
let writeChain = Promise.resolve();

async function appendEntry(entry) {
  writeChain = writeChain.then(async () => {
    const { [LOGS_KEY]: existing = [] } = await localGet([LOGS_KEY]);
    const list = Array.isArray(existing) ? existing : [];
    list.push(entry);
    // Кольцевой буфер: сбрасываем самые старые.
    const trimmed = list.length > MAX_LOGS ? list.slice(list.length - MAX_LOGS) : list;
    await localSet({ [LOGS_KEY]: trimmed });
  }).catch((e) => {
    // не роняем цепочку
    console.error('[logger] append failed:', e);
  });
  return writeChain;
}

async function write(level, source, message, meta) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    source: String(source || 'app'),
    message: sanitize(message),
    meta: meta !== undefined ? sanitize(meta) : undefined,
  };
  // Дублируем в консоль SW/страницы — удобно для разработки.
  const consoleFn = level === 'error' ? console.error
                  : level === 'warn'  ? console.warn
                  : console.log;
  consoleFn(`[${entry.source}] ${entry.message}`, meta ?? '');
  await appendEntry(entry);
}

export const logger = {
  LEVELS,
  MAX_LOGS,
  LOGS_KEY,

  info(source, message, meta)  { return write(LEVELS.info,  source, message, meta); },
  warn(source, message, meta)  { return write(LEVELS.warn,  source, message, meta); },
  error(source, message, meta) { return write(LEVELS.error, source, message, meta); },

  /** Прочитать все логи (массив). */
  async getAll() {
    const { [LOGS_KEY]: existing = [] } = await localGet([LOGS_KEY]);
    return Array.isArray(existing) ? existing : [];
  },

  /** Последние N записей. */
  async tail(n = 10) {
    const all = await this.getAll();
    return all.slice(-n);
  },

  /** Очистить журнал. */
  async clear() {
    await localSet({ [LOGS_KEY]: [] });
  },

  /** Экспорт в текст для скачивания. */
  async exportText() {
    const all = await this.getAll();
    return all.map((e) => {
      const meta = e.meta !== undefined ? ` | ${typeof e.meta === 'string' ? e.meta : JSON.stringify(e.meta)}` : '';
      return `${e.ts} [${e.level.toUpperCase()}] ${e.source}: ${e.message}${meta}`;
    }).join('\n');
  },
};
