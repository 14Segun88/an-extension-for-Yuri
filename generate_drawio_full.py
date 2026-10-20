import html
import os

def escape(s):
    # Escape for XML attribute value
    return html.escape(s).replace('"', '&quot;').replace("'", '&apos;').replace('\n', '&#xa;')

class DrawioBuilder:
    def __init__(self, page_w=1760, page_h=1360):
        self.page_w = page_w
        self.page_h = page_h
        self.cells = []
        self.cell_id = 1
        
        # Base containers
        self.cells.append('<mxCell id="0"/>')
        self.cells.append('<mxCell id="1" parent="0"/>')

    def get_id(self):
        self.cell_id += 1
        return str(self.cell_id)

    def add_node(self, cid, val, x, y, w, h, style, parent="1"):
        val_esc = escape(val)
        self.cells.append(
            f'<mxCell id="{cid}" value="{val_esc}" style="{style}" vertex="1" parent="{parent}">'
            f'<mxGeometry x="{x}" y="{y}" width="{w}" height="{h}" as="geometry"/>'
            f'</mxCell>'
        )

    def add_edge(self, cid, val, src, tgt, style, points=None, parent="1"):
        val_esc = escape(val) if val else ""
        points_xml = ""
        if points:
            pts_inner = "".join([f'<mxPoint x="{p[0]}" y="{p[1]}"/>' for p in points])
            points_xml = f'<mxGeometry relative="1" as="geometry"><Array as="points">{pts_inner}</Array></mxGeometry>'
        else:
            points_xml = '<mxGeometry relative="1" as="geometry"/>'
            
        self.cells.append(
            f'<mxCell id="{cid}" value="{val_esc}" style="{style}" edge="1" parent="{parent}" source="{src}" target="{tgt}">'
            f'{points_xml}'
            f'</mxCell>'
        )

    def build_xml(self, diagram_name="B2B Рассылка КП ЧЗМ"):
        content = "\n    ".join(self.cells)
        return (
            f'<mxfile host="app.diagrams.net" modified="2026-10-07T10:00:00.000Z" agent="Antigravity" version="21.0.0" type="device">\n'
            f'  <diagram id="diagram_b2b" name="{escape(diagram_name)}">\n'
            f'    <mxGraphModel dx="1600" dy="1200" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="{self.page_w}" pageHeight="{self.page_h}" math="0" shadow="0">\n'
            f'      <root>\n'
            f'    {content}\n'
            f'      </root>\n'
            f'    </mxGraphModel>\n'
            f'  </diagram>\n'
            f'</mxfile>'
        )

builder = DrawioBuilder(page_w=1760, page_h=1360)

# Colors
C_BLUE_DARK = "#0d47a1"
C_BLUE_MED = "#1976d2"
C_BLUE_LIGHT = "#e3f2fd"
C_BLUE_BORDER = "#1565c0"

C_PURPLE_DARK = "#4a148c"
C_PURPLE_MED = "#7b1fa2"
C_PURPLE_LIGHT = "#f3e5f5"
C_PURPLE_BORDER = "#6a1b9a"

C_ORANGE_DARK = "#e65100"
C_ORANGE_MED = "#f57c00"
C_ORANGE_LIGHT = "#fff3e0"
C_ORANGE_BORDER = "#ef6c00"

C_GREEN_DARK = "#1b5e20"
C_GREEN_MED = "#2e7d32"
C_GREEN_LIGHT = "#e8f5e9"
C_GREEN_BORDER = "#2e7d32"

# 1. Header Banner
banner_id = builder.get_id()
builder.add_node(
    banner_id,
    "<b>B2B-РАССЫЛКА КОММЕРЧЕСКОГО ПРЕДЛОЖЕНИЯ: СТЕЛЛАЖ ДЛЯ ЛИСТОВОГО МЕТАЛЛА 6000×2000 мм</b><br/>"
    "<span style='font-size:12px;font-weight:normal;color:#37474f;'>"
    "Производитель: Чайковский завод «Механика» (ЧЗМ, модель 16112.200) | Автоматизация рассылки через корпоративный Яндекс 360 (SMTP)"
    "</span>",
    x=40, y=20, w=1680, h=65,
    style="rounded=1;whiteSpace=wrap;html=1;arcSize=6;fillColor=#f8f9fa;strokeColor=#b0bec5;strokeWidth=1.5;fontSize=15;fontColor=#212121;align=center;"
)

# Badges inside / under banner
b1 = builder.get_id()
builder.add_node(
    b1, "<b>🏭 Продукт ЧЗМ:</b> Стеллаж 16112.200 (5 платформ, до 25 т, выкат 100%, 6000×2000 мм)",
    x=40, y=95, w=410, h=36,
    style="rounded=1;whiteSpace=wrap;html=1;arcSize=10;fillColor=#e8f5e9;strokeColor=#4caf50;strokeWidth=1.2;fontSize=11;fontColor=#1b5e20;"
)

b2 = builder.get_id()
builder.add_node(
    b2, "<b>🎯 Целевая аудитория:</b> Заводы машиностроения и металлообработки (Москва, МО, СПб, ЛО)",
    x=465, y=95, w=420, h=36,
    style="rounded=1;whiteSpace=wrap;html=1;arcSize=10;fillColor=#e3f2fd;strokeColor=#2196f3;strokeWidth=1.2;fontSize=11;fontColor=#0d47a1;"
)

b3 = builder.get_id()
builder.add_node(
    b3, "<b>👤 ЛПР:</b> Главный инженер, нач. производства, нач. склада, директор по закупкам",
    x=900, y=95, w=405, h=36,
    style="rounded=1;whiteSpace=wrap;html=1;arcSize=10;fillColor=#fff3e0;strokeColor=#ff9800;strokeWidth=1.2;fontSize=11;fontColor=#e65100;"
)

b4 = builder.get_id()
builder.add_node(
    b4, "<b>📨 Движок:</b> Яндекс 360 (SMTP + Nodemailer) с антиспам-паузами и персональным стилем",
    x=1320, y=95, w=400, h=36,
    style="rounded=1;whiteSpace=wrap;html=1;arcSize=10;fillColor=#f3e5f5;strokeColor=#ab47bc;strokeWidth=1.2;fontSize=11;fontColor=#4a148c;"
)

# SWIMLANES
# Col 1: База и Подготовка
sw1 = builder.get_id()
builder.add_node(
    sw1, "1. СБОР И ВАЛИДАЦИЯ БАЗЫ",
    x=40, y=145, w=380, h=1180,
    style=f"swimlane;startSize=35;rounded=1;arcSize=6;fontStyle=1;fontSize=13;fillColor={C_BLUE_LIGHT};strokeColor={C_BLUE_BORDER};strokeWidth=2;fontColor={C_BLUE_DARK};"
)

# Col 2: Движок отправки (Яндекс 360)
sw2 = builder.get_id()
builder.add_node(
    sw2, "2. ПОДГОТОВКА И ДВИЖОК (ЯНДЕКС 360)",
    x=440, y=145, w=390, h=1180,
    style=f"swimlane;startSize=35;rounded=1;arcSize=6;fontStyle=1;fontSize=13;fillColor={C_PURPLE_LIGHT};strokeColor={C_PURPLE_BORDER};strokeWidth=2;fontColor={C_PURPLE_DARK};"
)

# Col 3: Цепочка касаний (Follow-up)
sw3 = builder.get_id()
builder.add_node(
    sw3, "3. ВОРОНКА И FOLLOW-UP ЦЕПОЧКА",
    x=850, y=145, w=450, h=1180,
    style=f"swimlane;startSize=35;rounded=1;arcSize=6;fontStyle=1;fontSize=13;fillColor={C_ORANGE_LIGHT};strokeColor={C_ORANGE_BORDER};strokeWidth=2;fontColor={C_ORANGE_DARK};"
)

# Col 4: Обработка лидов, CRM и KPI
sw4 = builder.get_id()
builder.add_node(
    sw4, "4. ОБРАБОТКА ЛИДОВ, CRM И KPI",
    x=1320, y=145, w=400, h=1180,
    style=f"swimlane;startSize=35;rounded=1;arcSize=6;fontStyle=1;fontSize=13;fillColor={C_GREEN_LIGHT};strokeColor={C_GREEN_BORDER};strokeWidth=2;fontColor={C_GREEN_DARK};"
)

# Common card styles
NODE_CARD = "rounded=1;whiteSpace=wrap;html=1;arcSize=8;strokeWidth=1.5;align=left;spacingLeft=10;spacingRight=10;fontSize=11;"
DECISION_CARD = "rhombus;whiteSpace=wrap;html=1;strokeWidth=1.5;fontSize=10;fontStyle=1;align=center;"
ARROW_STYLE = "edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;html=1;strokeWidth=2;fontSize=10;"

# === COLUMN 1 NODES ===
n1_1 = builder.get_id()
builder.add_node(
    n1_1,
    "<b>1.1 Источники контактов</b><br/>"
    "• Реестры машиностроения и металлообработки<br/>"
    "• Каталоги производств, сайты заводов (раздел Руководство)<br/>"
    "• Профессиональные базы (LinkedIn, HH, 2GIS/Контур)",
    x=60, y=195, w=340, h=80,
    style=f"{NODE_CARD}fillColor=#ffffff;strokeColor={C_BLUE_BORDER};fontColor=#212121;"
)

# Вилка 1.1: Ветка А (Платные аккаунты / личные кабинеты)
n1_1_a = builder.get_id()
builder.add_node(
    n1_1_a,
    "<b>Ветка А: Платные базы</b><br/>"
    "• LinkedIn Sales Navigator<br/>"
    "• База резюме HH.ru<br/>"
    "• Контур.Фокус / СБИС<br/>"
    "<span style='color:#c62828;'>✕ Пропущено (нет аккаунтов)</span>",
    x=50, y=305, w=165, h=115,
    style=f"{NODE_CARD}fillColor=#fafafa;strokeColor=#9e9e9e;strokeWidth=1;dashed=1;fontColor=#616161;fontSize=10;"
)

# Вилка 1.1: Ветка Б (Открытый скрейпинг - ФАКТИЧЕСКИ СДЕЛАНО)
n1_1_b = builder.get_id()
builder.add_node(
    n1_1_b,
    "<b>Ветка Б: Без аккаунтов [ВЫПОЛНЕНО ✅]</b><br/>"
    "• Каталоги: Заводы.рф, Metaprom<br/>"
    "• ЕГРЮЛ (ОКВЭД 25.62, 25.11, 28)<br/>"
    "• Скрипт: <i>b2b_crawler_no_auth.py</i><br/>"
    "• Файлы: <b>.xlsx</b> / <b>.csv</b> (15 ЛПР)",
    x=230, y=305, w=175, h=115,
    style=f"{NODE_CARD}fillColor=#e8f5e9;strokeColor=#2e7d32;strokeWidth=2;fontColor=#1b5e20;fontSize=10;"
)

n1_2 = builder.get_id()
builder.add_node(
    n1_2,
    "<b>1.2 Структура данных контакта</b><br/>"
    "• Компания (название завода, тип производства)<br/>"
    "• ФИО ЛПР, Точная должность (напр. Главный инженер)<br/>"
    "• Корпоративный E-mail, Телефон, Регион (Мск / СПБ)",
    x=60, y=450, w=340, h=80,
    style=f"{NODE_CARD}fillColor=#ffffff;strokeColor={C_BLUE_BORDER};fontColor=#212121;"
)

n1_3 = builder.get_id()
builder.add_node(
    n1_3,
    "<b>1.3 Очистка и Валидация [ВЫПОЛНЕНО ✅]</b><br/>"
    "• Синтаксис RFC 5322: <b>15 из 15 (100% OK)</b><br/>"
    "• Проверка DNS MX: <b>15 активных серверов (100%)</b><br/>"
    "• Серверы: Яндекс 360 (5), Заводские Exchange (4), VK (1), Хостинг (5)<br/>"
    "• Скрипт: <i>validate_and_segment.py</i>",
    x=60, y=555, w=340, h=95,
    style=f"{NODE_CARD}fillColor=#e8f5e9;strokeColor=#2e7d32;strokeWidth=2;fontColor=#1b5e20;"
)

n1_4 = builder.get_id()
builder.add_node(
    n1_4,
    "<b>1.4 Сегментация базы [ВЫПОЛНЕНО ✅]</b><br/>"
    "• <b>Сегмент А (Москва и МО)</b>: 8 заводов (<i>b2b_segment_A_moscow.xlsx</i>)<br/>"
    "• <b>Сегмент B (СПб и ЛО)</b>: 7 заводов (<i>b2b_segment_B_spb.xlsx</i>)<br/>"
    "• Профили ЛПР: Техническая дирекция (11), Производство (3), Гендир (1)<br/>"
    "• Сгенерированы персональные теги: {Обращение}, {Болевая_Точка}",
    x=60, y=670, w=340, h=95,
    style=f"{NODE_CARD}fillColor=#e8f5e9;strokeColor=#2e7d32;strokeWidth=2;fontColor=#1b5e20;"
)

n1_5 = builder.get_id()
builder.add_node(
    n1_5,
    "<b>1.5 Готовая выборка для рассылки [ГОТОВО К ОТПРАВКЕ 🚀]</b><br/>"
    "• Файл: <b>b2b_contacts_validated.xlsx / .csv</b> (15 проверенных ЛПР)<br/>"
    "• Доставляемость: <b>100% Active MX</b>, риск спам-ловушек: <b>0%</b><br/>"
    "• Готово к передаче в Шаг 2.1 (Шаблонизация писем)",
    x=60, y=785, w=340, h=85,
    style=f"{NODE_CARD}fillColor=#bbdefb;strokeColor={C_BLUE_BORDER};fontColor={C_BLUE_DARK};strokeWidth=2;"
)

# === COLUMN 2 NODES ===
n2_1 = builder.get_id()
builder.add_node(
    n2_1,
    "<b>2.1 Персонализация и Шаблоны [ВЫПОЛНЕНО ✅]</b><br/>"
    "• Авторский шаблон: <b>Денис Юрьевич Пыхтеев (ЧЗ «Механика»)</b><br/>"
    "• Индивидуальные теги: {Обращение}, {Компания}, {Болевая_Точка}<br/>"
    "• Ролик Rutube: <i>rutube.ru/video/9b4e718a...</i> (1:20 мин)<br/>"
    "• Сгенерировано 15 писем: <b>campaign_dataset.json</b>",
    x=460, y=195, w=350, h=95,
    style=f"{NODE_CARD}fillColor=#e8f5e9;strokeColor=#2e7d32;strokeWidth=2;fontColor=#1b5e20;"
)

n2_2 = builder.get_id()
builder.add_node(
    n2_2,
    "<b>2.2 Вложения ЧЗМ подключены [ВЫПОЛНЕНО ✅]</b><br/>"
    "• Вложение 1: <b>Механика Инф.pdf</b> (209 КБ, презентация завода)<br/>"
    "• Вложение 2: <b>КП_ЧЗМ_стеллаж_для_предприятий_с_фото.pdf</b> (303 КБ)<br/>"
    "• Общий вес: <b>~512 КБ</b> (идеально для корпоративного антиспама)",
    x=460, y=315, w=350, h=85,
    style=f"{NODE_CARD}fillColor=#e8f5e9;strokeColor=#2e7d32;strokeWidth=2;fontColor=#1b5e20;"
)

n2_3 = builder.get_id()
builder.add_node(
    n2_3,
    "<b>2.3 Движок: Яндекс 360 [ВЫПОЛНЕНО ✅]</b><br/>"
    "• Отправитель: <b>pdu@mehan59.ru</b> (SSL порт 465, smtp.ya.ru)<br/>"
    "• Скрытая копия (BCC): <b>pdu@mehan59.ru, mahovik@mail.ru</b><br/>"
    "• Тест на <i>loftglam@gmail.com</i>: <b>ДОСТАВЛЕНО (250 Ok)</b><br/>"
    "• Скрипт отправки: <i>send_test_email.js</i>",
    x=460, y=420, w=350, h=95,
    style=f"{NODE_CARD}fillColor=#e8f5e9;strokeColor=#2e7d32;strokeWidth=2;fontColor=#1b5e20;"
)

n2_4 = builder.get_id()
builder.add_node(
    n2_4,
    "<b>2.4 Доставляемость и Антиспам</b><br/>"
    "• Проверка DKIM, SPF, DMARC корпоративного домена<br/>"
    "• Юридический блок, контакты компании и ссылка отписки (152-ФЗ)<br/>"
    "• Имитация ручной отправки: отсутствие спам-триггеров",
    x=460, y=530, w=350, h=80,
    style=f"{NODE_CARD}fillColor=#ffffff;strokeColor={C_PURPLE_BORDER};fontColor=#212121;"
)

n2_5 = builder.get_id()
builder.add_node(
    n2_5,
    "<b>2.5 Очередь и Rate Limiting</b><br/>"
    "• Рандомизированные паузы: <b>30 – 60 секунд</b> между письмами<br/>"
    "• Суточный лимит: до <b>300 – 500 писем/день</b> с одного ящика<br/>"
    "• Защита от блокировок спам-фильтрами почтовых сервисов",
    x=460, y=640, w=350, h=80,
    style=f"{NODE_CARD}fillColor=#ffffff;strokeColor={C_PURPLE_BORDER};fontColor=#212121;"
)

n2_6 = builder.get_id()
builder.add_node(
    n2_6,
    "<b>2.6 Логирование и Обработка ошибок</b><br/>"
    "• Запись Message-ID, статуса, времени доставки<br/>"
    "• Автоповтор (Retry) при временных сбоях сети (2×)<br/>"
    "• Фиксация Bounce (несуществующих адресов) для очистки базы",
    x=460, y=750, w=350, h=80,
    style=f"{NODE_CARD}fillColor=#e1bee7;strokeColor={C_PURPLE_BORDER};fontColor={C_PURPLE_DARK};"
)

# === COLUMN 3 NODES (SEQUENCE) ===
n3_1 = builder.get_id()
builder.add_node(
    n3_1,
    "<b>Письмо 1 (День 0) — Основное КП</b><br/>"
    "• Проблема: поиск листов, риск травм, потеря места<br/>"
    "• Решение: Стеллаж 16112.200 (5 полок, 25 т, 100% выкат)<br/>"
    "• Вложение: PDF КП с фото + запрос данных для расчета",
    x=870, y=195, w=410, h=80,
    style=f"{NODE_CARD}fillColor=#ffffff;strokeColor={C_ORANGE_BORDER};fontColor=#212121;"
)

d3_1 = builder.get_id()
builder.add_node(
    d3_1, "Ответил /<br/>Запрос?",
    x=1015, y=295, w=120, h=55,
    style=f"{DECISION_CARD}fillColor=#ffe0b2;strokeColor={C_ORANGE_BORDER};fontColor={C_ORANGE_DARK};"
)

n3_2 = builder.get_id()
builder.add_node(
    n3_2,
    "<b>Письмо 2 (День 3–5) — Экономия площади</b><br/>"
    "• Напоминание о письме 1 в той же цепочке (Re: ...)<br/>"
    "• Акцент: высвобождение до 70% полезной площади цеха<br/>"
    "• Быстрый доступ к любому листу за 45 секунд",
    x=870, y=385, w=410, h=75,
    style=f"{NODE_CARD}fillColor=#ffffff;strokeColor={C_ORANGE_BORDER};fontColor=#212121;"
)

d3_2 = builder.get_id()
builder.add_node(
    d3_2, "Ответил?",
    x=1020, y=480, w=110, h=50,
    style=f"{DECISION_CARD}fillColor=#ffe0b2;strokeColor={C_ORANGE_BORDER};fontColor={C_ORANGE_DARK};"
)

n3_3 = builder.get_id()
builder.add_node(
    n3_3,
    "<b>Письмо 3 (День 7–10) — Кейс и Надежность</b><br/>"
    "• Пример внедрения на производстве сходного профиля<br/>"
    "• Надежность привода и расчет под лист 6000×2000 мм<br/>"
    "• Сокращение работы кран-балки и ручного труда",
    x=870, y=560, w=410, h=75,
    style=f"{NODE_CARD}fillColor=#ffffff;strokeColor={C_ORANGE_BORDER};fontColor=#212121;"
)

d3_3 = builder.get_id()
builder.add_node(
    d3_3, "Ответил?",
    x=1020, y=655, w=110, h=50,
    style=f"{DECISION_CARD}fillColor=#ffe0b2;strokeColor={C_ORANGE_BORDER};fontColor={C_ORANGE_DARK};"
)

n3_4 = builder.get_id()
builder.add_node(
    n3_4,
    "<b>Письмо 4 (День 14) — Демонстрация / Звонок</b><br/>"
    "• Предложение короткого 10-мин созвона или видео работы<br/>"
    "• Ссылка на демонстрацию выдвижения платформы под нагрузкой<br/>"
    "• Консультация с техническим специалистом ЧЗМ",
    x=870, y=735, w=410, h=75,
    style=f"{NODE_CARD}fillColor=#ffffff;strokeColor={C_ORANGE_BORDER};fontColor=#212121;"
)

d3_4 = builder.get_id()
builder.add_node(
    d3_4, "Ответил?",
    x=1020, y=830, w=110, h=50,
    style=f"{DECISION_CARD}fillColor=#ffe0b2;strokeColor={C_ORANGE_BORDER};fontColor={C_ORANGE_DARK};"
)

n3_5 = builder.get_id()
builder.add_node(
    n3_5,
    "<b>Письмо 5 (День 21) — Финальное письмо</b><br/>"
    "• Уведомление о завершении текущей серии контактов<br/>"
    "• Бронь производственного слота ЧЗМ на изготовление<br/>"
    "• Контакты для связи при появлении потребности в будущем",
    x=870, y=910, w=410, h=75,
    style=f"{NODE_CARD}fillColor=#ffffff;strokeColor={C_ORANGE_BORDER};fontColor=#212121;"
)

d3_5 = builder.get_id()
builder.add_node(
    d3_5, "Ответил?",
    x=1020, y=1005, w=110, h=50,
    style=f"{DECISION_CARD}fillColor=#ffe0b2;strokeColor={C_ORANGE_BORDER};fontColor={C_ORANGE_DARK};"
)

n3_arch = builder.get_id()
builder.add_node(
    n3_arch,
    "<b>Архив / Реактивация базы</b><br/>"
    "• Перенос контакта в холодный архив<br/>"
    "• Повторное касание через 4–6 месяцев при обновлении каталога",
    x=870, y=1085, w=410, h=55,
    style=f"{NODE_CARD}fillColor=#f5f5f5;strokeColor=#9e9e9e;fontColor=#616161;"
)

# === COLUMN 4 NODES (LEADS & KPI) ===
n4_1 = builder.get_id()
builder.add_node(
    n4_1,
    "<b>4.1 Квалификация лида: Сбор данных</b><br/>"
    "Получение параметров для точного ТКП:<br/>"
    "• Размеры листа и максимальная масса пачки (до 5 т)<br/>"
    "• Требуемый объем хранения (кол-во ярусов)<br/>"
    "• Габариты зоны склада / высота цеха<br/>"
    "• Сведения о кран-балке и электропитании (380В)",
    x=1340, y=195, w=360, h=105,
    style=f"{NODE_CARD}fillColor=#ffffff;strokeColor={C_GREEN_BORDER};fontColor=#212121;"
)

n4_2 = builder.get_id()
builder.add_node(
    n4_2,
    "<b>4.2 Фиксация сделки в CRM</b><br/>"
    "• Автосоздание сделки (Битрикс24 / amoCRM)<br/>"
    "• Прикрепление истории переписки из Яндекс 360<br/>"
    "• Назначение ответственного инженера-сметчика ЧЗМ",
    x=1340, y=330, w=360, h=75,
    style=f"{NODE_CARD}fillColor=#ffffff;strokeColor={C_GREEN_BORDER};fontColor=#212121;"
)

n4_3 = builder.get_id()
builder.add_node(
    n4_3,
    "<b>4.3 Расчет стоимости и ТКП</b><br/>"
    "• Индивидуальная адаптация стеллажа 16112.200<br/>"
    "• Расчет цены, сроков изготовления и доставки (РФ)<br/>"
    "• Выход на подписание договора поставки",
    x=1340, y=435, w=360, h=75,
    style=f"{NODE_CARD}fillColor=#c8e6c9;strokeColor={C_GREEN_BORDER};fontColor={C_GREEN_DARK};"
)

n4_4 = builder.get_id()
builder.add_node(
    n4_4,
    "<b>4.4 Контроль целевых метрик (KPI)</b><br/>"
    "<table style='width:100%;font-size:11px;border-collapse:collapse;margin-top:4px;'>"
    "<tr style='border-bottom:1px solid #c8e6c9;'><td><b>Метрика</b></td><td align='right'><b>Цель ТЗ</b></td></tr>"
    "<tr><td>Доставляемость</td><td align='right'><b>≥ 95%</b></td></tr>"
    "<tr><td>Открытия (Open Rate)</td><td align='right'><b>≥ 20%</b></td></tr>"
    "<tr><td>Клики по ссылкам</td><td align='right'><b>≥ 3%</b></td></tr>"
    "<tr><td>Ответы (Reply Rate)</td><td align='right'><b>≥ 1%</b></td></tr>"
    "<tr><td>Запрос расчета (Лид)</td><td align='right'><b>≥ 0.5%</b></td></tr>"
    "<tr><td>Отписки</td><td align='right'><b>≤ 0.5%</b></td></tr>"
    "</table>",
    x=1340, y=540, w=360, h=175,
    style=f"{NODE_CARD}fillColor=#ffffff;strokeColor={C_GREEN_BORDER};fontColor=#212121;"
)

n4_5 = builder.get_id()
builder.add_node(
    n4_5,
    "<b>4.5 Сквозная отчетность и A/B тесты</b><br/>"
    "• Экспорт статистики отправки в Excel / Google Sheets<br/>"
    "• A/B тестирование заголовков и аргументов<br/>"
    "• Корректировка базы и сегментов по итогам отклика",
    x=1340, y=745, w=360, h=85,
    style=f"{NODE_CARD}fillColor=#ffffff;strokeColor={C_GREEN_BORDER};fontColor=#212121;"
)

# === CONNECTIONS & ARROWS ===
# Column 1 internal (Вилка от 1.1 к Веткам А и Б)
builder.add_edge(builder.get_id(), "Платные аккаунты", n1_1, n1_1_a, f"{ARROW_STYLE}strokeColor=#9e9e9e;fontColor=#757575;dashed=1;")
builder.add_edge(builder.get_id(), "Без аккаунтов [✅]", n1_1, n1_1_b, f"{ARROW_STYLE}strokeColor=#2e7d32;strokeWidth=2;fontColor=#1b5e20;fontStyle=1;")

# Соединение веток с 1.2 (Структура данных)
builder.add_edge(builder.get_id(), "При наличии подписок", n1_1_a, n1_2, f"{ARROW_STYLE}strokeColor=#bdbdbd;fontColor=#9e9e9e;dashed=1;")
builder.add_edge(builder.get_id(), "15 заводов собрано", n1_1_b, n1_2, f"{ARROW_STYLE}strokeColor=#2e7d32;strokeWidth=2;fontColor=#1b5e20;fontStyle=1;")

builder.add_edge(builder.get_id(), "", n1_2, n1_3, f"{ARROW_STYLE}strokeColor={C_BLUE_BORDER};")
builder.add_edge(builder.get_id(), "", n1_3, n1_4, f"{ARROW_STYLE}strokeColor={C_BLUE_BORDER};")
builder.add_edge(builder.get_id(), "", n1_4, n1_5, f"{ARROW_STYLE}strokeColor={C_BLUE_BORDER};")

# Col 1 -> Col 2
e_1_2 = builder.get_id()
builder.add_edge(e_1_2, "Загрузка базы", n1_5, n2_1, f"{ARROW_STYLE}strokeColor={C_BLUE_MED};", points=[(420, 827), (420, 237)])

# Col 2 internal
builder.add_edge(builder.get_id(), "", n2_1, n2_2, f"{ARROW_STYLE}strokeColor={C_PURPLE_BORDER};")
builder.add_edge(builder.get_id(), "", n2_2, n2_3, f"{ARROW_STYLE}strokeColor={C_PURPLE_BORDER};")
builder.add_edge(builder.get_id(), "", n2_3, n2_4, f"{ARROW_STYLE}strokeColor={C_PURPLE_BORDER};")
builder.add_edge(builder.get_id(), "", n2_4, n2_5, f"{ARROW_STYLE}strokeColor={C_PURPLE_BORDER};")
builder.add_edge(builder.get_id(), "", n2_5, n2_6, f"{ARROW_STYLE}strokeColor={C_PURPLE_BORDER};")

# Col 2 -> Col 3 (Launch)
e_2_3 = builder.get_id()
builder.add_edge(e_2_3, "Старт рассылки", n2_5, n3_1, f"{ARROW_STYLE}strokeColor={C_ORANGE_MED};", points=[(830, 680), (830, 235)])

# Col 3 Sequence internal
builder.add_edge(builder.get_id(), "", n3_1, d3_1, f"{ARROW_STYLE}strokeColor={C_ORANGE_BORDER};")
builder.add_edge(builder.get_id(), "Нет (пауза 3-5 дн)", d3_1, n3_2, f"{ARROW_STYLE}strokeColor={C_ORANGE_BORDER};")

builder.add_edge(builder.get_id(), "", n3_2, d3_2, f"{ARROW_STYLE}strokeColor={C_ORANGE_BORDER};")
builder.add_edge(builder.get_id(), "Нет (пауза 3-5 дн)", d3_2, n3_3, f"{ARROW_STYLE}strokeColor={C_ORANGE_BORDER};")

builder.add_edge(builder.get_id(), "", n3_3, d3_3, f"{ARROW_STYLE}strokeColor={C_ORANGE_BORDER};")
builder.add_edge(builder.get_id(), "Нет (пауза 4-7 дн)", d3_3, n3_4, f"{ARROW_STYLE}strokeColor={C_ORANGE_BORDER};")

builder.add_edge(builder.get_id(), "", n3_4, d3_4, f"{ARROW_STYLE}strokeColor={C_ORANGE_BORDER};")
builder.add_edge(builder.get_id(), "Нет (пауза 7 дн)", d3_4, n3_5, f"{ARROW_STYLE}strokeColor={C_ORANGE_BORDER};")

builder.add_edge(builder.get_id(), "", n3_5, d3_5, f"{ARROW_STYLE}strokeColor={C_ORANGE_BORDER};")
builder.add_edge(builder.get_id(), "Нет ответа", d3_5, n3_arch, f"{ARROW_STYLE}strokeColor=#757575;")

# Sequence "Да" -> Conversion (Column 4)
GREEN_LEAD_EDGE = f"{ARROW_STYLE}strokeColor={C_GREEN_MED};fontColor={C_GREEN_DARK};fontStyle=1;"
builder.add_edge(builder.get_id(), "Да (Лид)", d3_1, n4_1, GREEN_LEAD_EDGE, points=[(1310, 322), (1310, 247)])
builder.add_edge(builder.get_id(), "Да (Лид)", d3_2, n4_1, GREEN_LEAD_EDGE, points=[(1290, 505), (1290, 247)])
builder.add_edge(builder.get_id(), "Да (Лид)", d3_3, n4_1, GREEN_LEAD_EDGE, points=[(1280, 680), (1280, 247)])
builder.add_edge(builder.get_id(), "Да (Лид)", d3_4, n4_1, GREEN_LEAD_EDGE, points=[(1270, 855), (1270, 247)])
builder.add_edge(builder.get_id(), "Да (Лид)", d3_5, n4_1, GREEN_LEAD_EDGE, points=[(1260, 1030), (1260, 247)])

# Col 4 internal
builder.add_edge(builder.get_id(), "Данные собраны", n4_1, n4_2, f"{ARROW_STYLE}strokeColor={C_GREEN_BORDER};")
builder.add_edge(builder.get_id(), "ТКП готово", n4_2, n4_3, f"{ARROW_STYLE}strokeColor={C_GREEN_BORDER};")

# Feedback from Logging / Engine to KPI
builder.add_edge(builder.get_id(), "События и статистика", n2_6, n4_4, f"{ARROW_STYLE}strokeColor={C_PURPLE_MED};dashed=1;", points=[(830, 790), (830, 890), (1320, 890), (1320, 627)])
builder.add_edge(builder.get_id(), "Экспорт отчетов", n4_4, n4_5, f"{ARROW_STYLE}strokeColor={C_GREEN_BORDER};")

# Write to file
target_file = "/home/segun/CascadeProjects/Расширение для Юрия/b2b_mailing_workflow.drawio"
xml_data = builder.build_xml()
with open(target_file, "w", encoding="utf-8") as f:
    f.write(xml_data)

print(f"Generated drawio successfully: {target_file} ({len(xml_data)} bytes)")
