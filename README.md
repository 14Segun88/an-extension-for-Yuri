# Todoist Overdue Notifier — Конспект разработки

## Обзор проекта
Chrome-расширение для автоматического сканирования Todoist на просроченные задачи и отправки уведомлений сотрудникам через Brevo API.

## Архитектура

### Структура проекта
```
todoist-overdue-ext/
├── manifest.json              # Манифест MV3
├── background.js               # Service Worker: alarms + scanAndNotify
├── popup/                      # UI popup (тумблер, статус, мини-журнал)
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── options/                    # Страница настроек
│   ├── options.html
│   ├── options.css
│   └── options.js
├── lib/                        # Модули бизнес-логики
│   ├── storage.js              # Обёртка над chrome.storage.local
│   ├── logger.js               # Кольцевой буфер логов (500 записей)
│   ├── todoist.js              # Клиент Todoist REST API v1
│   ├── overdue.js              # Фильтр просроченных задач + группировка
│   ├── brevo.js                # Отправка писем через Brevo API
│   └── scheduler.js            # Расчёт времени + chrome.alarms
└── icons/                      # Иконки 16×16, 48×48, 128×128 PNG
```

### Основные компоненты

#### 1. manifest.json
- **Manifest Version**: 3
- **Permissions**: alarms, storage, notifications
- **Host Permissions**: api.todoist.com, api.brevo.com
- **Background**: service worker
- **Action**: popup с иконками
- **Options**: отдельная страница настроек

#### 2. background.js
- **Service Worker**: обрабатывает alarms, запускает сканы
- **scanAndNotify()**: основная функция сканирования
- **Обработчики сообщений**: START, STOP, RUN_NOW, TEST_BREVO, TEST_TODOIST
- **Восстановление состояния**: при установке/запуске Chrome

#### 3. lib/storage.js
- **DEFAULTS**: дефолтные значения настроек
- **SECRET_KEYS**: список секретных полей (не логируются)
- **API**: get, set, getMany, setMany, remove, ensureDefaults, onChange, getSafeSnapshot

#### 4. lib/logger.js
- **MAX_LOGS**: 500 записей в кольцевом буфере
- **LEVELS**: info, warn, error
- **Санитизация**: удаление токенов/ключей из логов
- **API**: info, warn, error, getAll, tail, clear, exportText

#### 5. lib/todoist.js
- **API**: Todoist REST API v1 (GET /api/v1/projects, /api/v1/tasks, /api/v1/projects/{id}/collaborators)
- **Формат ответа**: `{results: [...]}`
- **Обработка ошибок**: 401/403/429 с ретраями

#### 6. lib/overdue.js
- **isOverdue(task, nowMsk)**: проверка просроченности
  - `due.datetime`: ISO с timezone
  - `due.date`: только дата (интерпретируется в МСК)
- **groupByAssigneeEmail()**: группировка по email ответственных
  - Пропускает задачи без responsible_uid
  - Пропускает задачи с email не в списке recipients
  - Нечувствительно к регистру email

#### 7. lib/brevo.js
- **API**: POST https://api.brevo.com/v3/smtp/email
- **Payload**: sender, to, subject, htmlContent
- **Ретраи**: 2× при 429/5xx с экспоненциальным бэкоффом
- **HTML-шаблон**: таблица «Проект | Задача | Дедлайн | Ссылка»

#### 8. lib/scheduler.js
- **computeNextRun(scanTime, tz)**: расчёт ближайшего запуска в Europe/Moscow
- **setAlarm() / clearAlarm()**: управление chrome.alarms
- **Логика**: создаёт дату в timezone, конвертирует в UTC timestamp

## Процесс разработки

### Этап 1: Скелет
- manifest.json с permissions и host_permissions
- Иконки-заглушки (16×16, 48×48, 128×128)
- Пустые html/js/css для popup и options
- Загрузка в Chrome как распакованное расширение

### Этап 2: Storage + Logger
- lib/storage.js: обёртка над chrome.storage.local
- lib/logger.js: кольцевой буфер логов с санитизацией секретов

### Этап 3: Options UI
- Формы настроек: Todoist token, Brevo API key, время скана, sender email/name, recipients
- Валидация email, кнопки тестирования Todoist/Brevo
- Журнал: фильтрация, обновление, очистка, экспорт .txt
- Автосохранение, подписка на изменения storage

### Этап 4: Popup UI
- Тумблер Старт/Стоп, статусы бота, следующий/последний запуск
- Кнопки: запустить сейчас, открыть настройки
- Мини-журнал (последние 10 записей)
- Автообновление при изменениях storage

### Этап 5: Todoist API
- Клиент Todoist REST API v1
- Обработка формата ответа `{results: [...]}`
- Получение проектов, задач, коллабораторов

### Этап 6: Overdue Logic
- Фильтр просроченных задач с учётом due.datetime и due.date
- Группировка по assignee email через коллабораторов
- Нечувствительное сравнение email к регистру

### Этап 7: Brevo API
- Отправка писем через Brevo REST API
- HTML-шаблон с таблицей задач
- Ретраи при ошибках

### Этап 8: Scheduler
- Расчёт ближайшего запуска в Europe/Moscow
- Управление chrome.alarms
- Конвертация timezone → UTC timestamp

### Этап 9: Background Logic
- Полная реализация scanAndNotify()
- Обработка сообщений START/STOP/RUN_NOW/TEST_BREVO/TEST_TODOIST
- Восстановление состояния при установке/запуске

## Проблемы и решения

### Проблема 1: Todoist API v2 устарел
**Решение**: Перешёл на REST API v1, затем на Sync API v9, наконец на REST API v1
**Формат ответа**: `{results: [...]}`

### Проблема 2: Brevo API key
**Решение**: Использован REST API key, а не SMTP key
**Документация**: https://developers.brevo.com/reference/sendtransacemail

### Проблема 3: Email чувствителен к регистру
**Решение**: Нечувствительное сравнение email в overdue.js
```javascript
const assigneeEmailLower = assignee.email.toLowerCase();
const recipientFound = Array.from(recipients).some(r => r.toLowerCase() === assigneeEmailLower);
```

### Проблема 4: Бесконечный цикл сканов
**Причина**: Alarm срабатывал немедленно после установки
**Решение**: Исправлена конвертация timezone в scheduler.js
```javascript
// Создаём дату в timezone, конвертируем в UTC timestamp
const nextRunInTz = new Date(nowInTz);
nextRunInTz.setHours(hours, minutes, 0, 0);
const nextRunMs = nextRunInTz.getTime();
```

### Проблема 5: Chrome не работает при закрытом браузере
**Ограничение**: Расширения живут внутри браузера
**Решение**: Оставить Chrome запущенным в фоновом режиме
**Настройка**: Chrome → Система → "Продолжать работать в фоновом режиме при закрытии браузера"

## Тестирование

### Сценарий проверки
1. Установить расширение в Chrome
2. Ввести Todoist token и Brevo API key
3. Нажать "Проверить Todoist" и "Проверить Brevo"
4. Указать время скана, sender email, recipients
5. Нажать "Сохранить настройки"
6. В popup нажать "Старт"
7. Дождаться alarm → проверить письма

### Проверка
- Todoist: shared-проект, оба ящика — коллабораторы
- Задачи со вчерашней датой, назначенные на elephant1047@gmail.com
- В popup: время скана на текущее МСК + 2 мин
- Дождаться alarm → проверить письма на обоих ящиках

## Технические детали

### Chrome Alarms
- **API**: chrome.alarms.create(name, {when})
- **Обработка**: chrome.alarms.onAlarm.addListener
- **Ограничения**: Работают только при запущенном Chrome

### Storage
- **API**: chrome.storage.local
- **Синхронизация**: chrome.storage.onChanged
- **Секреты**: Хранятся в открытом виде на машине

### Service Worker MV3
- **Жизненный цикл**: Выгружается при неактивности
- **Состояние**: Всё в chrome.storage, ничего в памяти SW

### Timezone
- **Europe/Moscow**: UTC+3 без DST
- **Конвертация**: Создаём дату в timezone, конвертируем в UTC timestamp

## Итог

Расширение полностью функционально:
- ✅ Сканирование Todoist на просроченные задачи
- ✅ Группировка по assignee email
- ✅ Отправка писем через Brevo
- ✅ Планирование по расписанию
- ✅ UI для настройки и мониторинга
- ✅ Журнал логов с экспортом
- ✅ Chrome-уведомления

**Ограничения**:
- Требуется запущенный Chrome для работы по расписанию
- Только shared-проекты (responsible_uid)
- Brevo лимит: ~300 писем/день (бесплатно)
