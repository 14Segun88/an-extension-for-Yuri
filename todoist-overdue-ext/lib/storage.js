// lib/storage.js — обёртка над chrome.storage.local.
// Единая точка чтения/записи настроек и состояния. Никаких секретов в логах.

export const DEFAULTS = Object.freeze({
  todoistToken: '',
  brevoApiKey: '',
  scanTime: '09:00',           // HH:MM, локально интерпретируется в Europe/Moscow
  timezone: 'Europe/Moscow',
  senderEmail: 'loftglam@gmail.com',
  senderName: 'Todoist Overdue Bot',
  recipients: [],              // массив email-ов сотрудников
  botEnabled: false,
  lastRun: null,               // { at: ISO, found: n, sent: n, errors: n }
  nextRunAt: null,             // ISO момента ближайшего запуска
});

// Ключи, которые считаем секретами — не светим в логах/экспорте.
export const SECRET_KEYS = Object.freeze(['todoistToken', 'brevoApiKey']);

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

function localRemove(keys) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.remove(keys, () => {
      const err = chrome.runtime.lastError;
      if (err) reject(new Error(err.message));
      else resolve();
    });
  });
}

export const storage = {
  /** Прочитать одно значение настройки с подстановкой дефолта. */
  async get(key) {
    const items = await localGet([key]);
    if (key in items) return items[key];
    return key in DEFAULTS ? DEFAULTS[key] : undefined;
  },

  /** Прочитать несколько ключей. Возвращает объект с дефолтами для отсутствующих. */
  async getMany(keys) {
    const items = await localGet(keys);
    const out = {};
    for (const k of keys) {
      out[k] = (k in items) ? items[k] : (k in DEFAULTS ? DEFAULTS[k] : undefined);
    }
    return out;
  },

  /** Прочитать все настройки (с дефолтами). */
  async getAll() {
    const keys = Object.keys(DEFAULTS);
    return this.getMany(keys);
  },

  /** Записать одно значение. */
  async set(key, value) {
    await localSet({ [key]: value });
  },

  /** Записать пачку значений. */
  async setMany(patch) {
    await localSet(patch);
  },

  /** Удалить ключ(и). */
  async remove(keys) {
    await localRemove(keys);
  },

  /**
   * Гарантирует, что в storage присутствуют все ключи из defaults.
   * Существующие значения не перезаписывает.
   */
  async ensureDefaults(defaults = DEFAULTS) {
    const present = await localGet(Object.keys(defaults));
    const patch = {};
    for (const [k, v] of Object.entries(defaults)) {
      if (!(k in present)) patch[k] = v;
    }
    if (Object.keys(patch).length > 0) {
      await localSet(patch);
    }
  },

  /** Подписка на изменения chrome.storage.local. Возвращает функцию отписки. */
  onChange(handler) {
    const listener = (changes, areaName) => {
      if (areaName !== 'local') return;
      handler(changes);
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  },

  /** Возвращает копию настроек без секретов — для экспорта/диагностики. */
  async getSafeSnapshot() {
    const all = await this.getAll();
    for (const k of SECRET_KEYS) {
      if (k in all) all[k] = all[k] ? '***' : '';
    }
    return all;
  },
};
