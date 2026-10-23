#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Генератор полной цепочки фоллоу-ап писем (Касания 2, 3, 4, 5)
для всех 30 предприятий базы ЧЗ «Механика» (за исключением ответивших лидов, таких как Росатом / АО «МСЗ»).
"""

import json
import os

BASE_DIR = "/home/segun/CascadeProjects/Расширение для Юрия/campaign_emails"
DATASET_PATH = os.path.join(BASE_DIR, "campaign_dataset.json")
LEADS_PATH = os.path.join(BASE_DIR, "leads.json")

with open(DATASET_PATH, "r", encoding="utf-8") as f:
    full_dataset = json.load(f)

# Читаем список ответивших лидов (их ID исключаются из рассылки)
lead_ids = set()
if os.path.exists(LEADS_PATH):
    try:
        with open(LEADS_PATH, "r", encoding="utf-8") as f:
            leads = json.load(f)
            for l in leads:
                if l.get("contactId"):
                    lead_ids.add(l.get("contactId"))
                if l.get("id") and isinstance(l.get("id"), int) and l.get("id") < 1000:
                    lead_ids.add(l.get("id"))
    except Exception as e:
        print("Warning reading leads:", e)

# Также исключаем заводы #5 (Росатом) и #21 (ММЗ) гарантированно
lead_ids.add(5)
lead_ids.add(21)

eligible_plants = [p for p in full_dataset if p.get("id") not in lead_ids]
print(f"Всего заводов для цепочки касаний: {len(eligible_plants)} (исключены лиды: {lead_ids})")

def build_subject(orig_sub):
    return f"Re: {orig_sub}" if not orig_sub.startswith("Re:") else orig_sub

def create_touch_2(item):
    """Касание 2 (Follow-up №1, День 3–5): Выгода 70% площади цеха и парк раскроя"""
    company = item["company"]
    salutation = item.get("salutation", "Здравствуйте!")
    subject = build_subject(item["subject"])
    batch = item.get("batch", 1)
    if batch == 1:
        send_date_ref = "14 октября"
    elif batch == 2:
        send_date_ref = "18 октября"
    elif batch == 3:
        send_date_ref = "20 октября"
    else:
        send_date_ref = "ранее"
    
    plain_text = f"""{salutation}

{send_date_ref} я направлял в адрес {company} коммерческое предложение и демонстрационное видео по электромеханическому стеллажу грузоподъемностью 25 тн производства «Чайковского завода МЕХАНИКА».

Подскажите, пожалуйста, удалось ли ознакомиться с материалами?

Чтобы оперативно рассчитать компоновку и адаптировать выкатные кассеты стеллажа под специфику заготовительного участка Вашего предприятия, уточните:
1. Какого формата листовой прокат у вас в приоритете (1500х3000 мм или крупногабаритный до 2000х6000 мм)?
2. Какое оборудование раскроя задействовано в цехе (лазерные или плазменные комплексы)?

Ключевой эффект для цеха: вертикальное механизированное хранение 25 тонн листа высвобождает до 70% площади цеха и исключает риск повреждения и замятия кромок дорогостоящего металла при кантовании кран-балкой.

Демонстрационный видеоролик в действии (Rutube, 1:20 мин):
https://rutube.ru/video/9b4e718a696a972789687791713ba5fa/

Официальный сайт завода: https://mehan59.ru/

Готовы направить экспресс-расчет окупаемости и предварительные чертежи привязки под пролет Вашего цеха.

С уважением,
Заместитель директора по развитию
«Чайковский завод МЕХАНИКА»
г. Санкт-Петербург
Пыхтеев Денис Юрьевич
--
Тел.: +7 (919) 700-07-20
E-mail: pdu@mehan59.ru
Сайт: mehan59.ru""".strip()

    html = f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8">
<style>
  body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #222222; margin: 0; padding: 0; }}
  .container {{ max-width: 650px; margin: 0 auto; padding: 20px; }}
  .salutation {{ font-size: 16px; font-weight: 600; color: #1a237e; margin-bottom: 16px; }}
  .highlight-box {{ background: #f0f7ff; border-left: 4px solid #0284c7; padding: 14px 16px; margin: 16px 0; border-radius: 0 4px 4px 0; }}
  .benefit-box {{ background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 12px 16px; margin: 16px 0; }}
  .video-btn {{ display: inline-block; background: #e53935; color: #ffffff !important; text-decoration: none; padding: 10px 18px; border-radius: 4px; font-weight: 600; margin: 8px 0; }}
  .site-link {{ color: #1976d2; text-decoration: underline; }}
  .questions-list {{ margin: 8px 0; padding-left: 20px; }}
  .questions-list li {{ margin-bottom: 6px; font-weight: 500; }}
  .signature {{ margin-top: 24px; padding-top: 16px; border-top: 1px solid #eeeeee; font-size: 13px; color: #424242; }}
  .signature-name {{ font-size: 15px; font-weight: bold; color: #1a237e; }}
  .signature-title {{ color: #616161; font-weight: 500; }}
  .signature-phone {{ font-size: 14px; font-weight: 600; color: #2e7d32; margin-top: 4px; }}
</style>
</head>
<body>
<div class="container">
  <div class="salutation">{salutation}</div>
  <p>{send_date_ref} я направлял в адрес <b>{company}</b> коммерческое предложение и демонстрационное видео по электромеханическому стеллажу грузоподъемностью 25 тн производства «Чайковского завода МЕХАНИКА».</p>
  <p>Подскажите, пожалуйста, удалось ли ознакомиться с материалами?</p>
  <div class="highlight-box">
    <b>Вопрос для адаптации под заготовительный участок {company}:</b>
    <ol class="questions-list">
      <li>Какого формата листовой прокат у вас в приоритете (1500х3000 мм или крупногабаритный до 2000х6000 мм)?</li>
      <li>Какое оборудование раскроя задействовано в цехе (лазерные или плазменные комплексы)?</li>
    </ol>
  </div>
  <div class="benefit-box">
    <b>💡 Эффект для цеха:</b> Вертикальное механизированное хранение 25 тонн листа высвобождает <b>до 70% площади цеха</b> и исключает деформацию кромок дорогостоящего металла при кантовании кран-балкой.
  </div>
  <p><b>Ролик — демонстрация работы стеллажа в действии:</b><br/>
    <a href="https://rutube.ru/video/9b4e718a696a972789687791713ba5fa/" class="video-btn" target="_blank">▶ Смотреть видео на Rutube (1:20 мин)</a>
  </p>
  <p>Ссылка на официальный сайт завода: <a href="https://mehan59.ru/" class="site-link" target="_blank">https://mehan59.ru/</a></p>
  <p>Готовы оперативно подготовить экспресс-расчет окупаемости и предварительные чертежи привязки под пролет Вашего цеха.</p>
  <div class="signature">
    С уважением,<br/>
    <span class="signature-title">Заместитель директора по развитию</span><br/>
    <b>«Чайковский завод МЕХАНИКА»</b> (г. Санкт-Петербург)<br/>
    <div class="signature-name">Пыхтеев Денис Юрьевич</div>
    <div class="signature-phone">Тел.: +7 (919) 700-07-20</div>
    <div>E-mail: <a href="mailto:pdu@mehan59.ru">pdu@mehan59.ru</a> | Сайт: <a href="https://mehan59.ru/">mehan59.ru</a></div>
  </div>
</div>
</body>
</html>""".strip()

    return {
        "id": item["id"],
        "company": company,
        "to_email": item["to_email"],
        "fio": item.get("fio"),
        "position": item.get("position"),
        "region": item.get("region"),
        "batch": item.get("batch", 1),
        "stage": "stage_2",
        "touchNumber": 2,
        "subject": subject,
        "salutation": salutation,
        "plain_text": plain_text,
        "html": html,
        "attachments": []
    }

def create_touch_3(item):
    """Касание 3 (Follow-up №2, День 7–10): Главный инженер, защита листа от деформаций и кран-балка"""
    company = item["company"]
    salutation = item.get("salutation", "Здравствуйте!")
    subject = build_subject(item["subject"])
    
    plain_text = f"""{salutation}

Обращаюсь к техническому руководству и службе Главного инженера {company}.

Ранее мы обсуждали решение по компактному размещению листового металла. Хочу акцентировать внимание на двух технических факторах, которые напрямую влияют на себестоимость раскроя и безопасность в цехе:

1. Сохранность геометрии проката: При традиционном напольном хранении стопками нижние листы подвергаются микродеформациям, царапинам и замятию кромок, что приводит к сбоям оптических головок лазерных станков. Электромеханический стеллаж ЧЗМ гарантирует 100% раздельное хранение каждой партии на индивидуальной полке грузоподъемностью до 5 000 кг.

2. Разгрузка цехового кранового хозяйства: Подача нужного типоразмера листа к столу резки занимает всего 2 минуты — один оператор с пульта выдвигает нужную платформу без привлечения стропальщика и ожидания кран-балки.

Параметры базовой модели ЧЗМ 16112.200:
- Формат листа: до 6000 х 2000 мм (или 1500 х 3000 мм).
- Грузоподъемность: 5 тонн на ярус / 25 тонн суммарно на стеллаж.
- Приводы: надежные мотор-редукторы с плавным пуском и концевыми датчиками.
- Производство: Россия (г. Чайковский), гарантия 24 месяца.

Видео работы электромеханического выката полок:
https://rutube.ru/video/9b4e718a696a972789687791713ba5fa/

Подскажите, удобно ли будет на этой неделе обсудить возможность интеграции такого стеллажа в технологическую цепочку Вашего цеха?

С уважением,
Пыхтеев Денис Юрьевич
«Чайковский завод МЕХАНИКА»
Тел.: +7 (919) 700-07-20 | E-mail: pdu@mehan59.ru | Сайт: mehan59.ru""".strip()

    html = f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8">
<style>
  body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #222222; margin: 0; padding: 0; }}
  .container {{ max-width: 650px; margin: 0 auto; padding: 20px; }}
  .salutation {{ font-size: 16px; font-weight: 600; color: #1a237e; margin-bottom: 16px; }}
  .tech-card {{ background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 14px 18px; margin: 16px 0; }}
  .tech-card li {{ margin-bottom: 8px; }}
  .highlight-danger {{ background: #fffbeb; border-left: 4px solid #f59e0b; padding: 12px 16px; margin: 14px 0; }}
  .video-btn {{ display: inline-block; background: #e53935; color: #ffffff !important; text-decoration: none; padding: 10px 18px; border-radius: 4px; font-weight: 600; margin: 8px 0; }}
  .signature {{ margin-top: 24px; padding-top: 16px; border-top: 1px solid #eeeeee; font-size: 13px; color: #424242; }}
  .signature-name {{ font-size: 15px; font-weight: bold; color: #1a237e; }}
  .signature-phone {{ font-size: 14px; font-weight: 600; color: #2e7d32; margin-top: 4px; }}
</style>
</head>
<body>
<div class="container">
  <div class="salutation">{salutation} В техническую службу {company}</div>
  <p>Обращаюсь к техническому руководству и службе Главного инженера <b>{company}</b>.</p>
  <p>Ранее мы направляли материалы по механизированному стеллажу ЧЗМ. Хочу обратить Ваше внимание на <b>2 ключевых инженерных фактора</b>:</p>
  
  <div class="highlight-danger">
    <b>1. Сохранность геометрии дорогостоящего листа:</b><br/>
    При напольном хранении пачек нижние листы получают замятия и микропрогибы, что вызывает аварийные остановки лазерных резаков. Индивидуальные выкатные полки ЧЗМ полностью исключают трение и повреждение кромки.
  </div>

  <div class="tech-card">
    <b>2. Разгрузка кран-балки и скорость цикла:</b><br/>
    <ul>
      <li>Выкат полки с 5 тоннами металла занимает всего <b>40 секунд</b>.</li>
      <li>Один оператор управляет процессом с кнопочного пульта без участия стропальщика.</li>
      <li>Суммарная вместимость: <b>25 тонн</b> на площади всего 7×3 метра.</li>
    </ul>
  </div>

  <p><b>Видео работы электромеханического выката полок (1:20 мин):</b><br/>
    <a href="https://rutube.ru/video/9b4e718a696a972789687791713ba5fa/" class="video-btn" target="_blank">▶ Смотреть видео работы на Rutube</a>
  </p>

  <p>Подскажите, удобно ли будет на этой неделе уделить 10 минут, чтобы оценить применимость стеллажа к пролету Вашего цеха?</p>

  <div class="signature">
    С уважением,<br/>
    <b>«Чайковский завод МЕХАНИКА»</b><br/>
    <div class="signature-name">Пыхтеев Денис Юрьевич</div>
    <div class="signature-phone">Тел.: +7 (919) 700-07-20</div>
    <div>E-mail: <a href="mailto:pdu@mehan59.ru">pdu@mehan59.ru</a> | Сайт: <a href="https://mehan59.ru/">mehan59.ru</a></div>
  </div>
</div>
</body>
</html>""".strip()

    return {
        "id": item["id"],
        "company": company,
        "to_email": item["to_email"],
        "fio": item.get("fio"),
        "position": item.get("position"),
        "region": item.get("region"),
        "batch": item.get("batch", 1),
        "stage": "stage_3",
        "touchNumber": 3,
        "subject": subject,
        "salutation": salutation,
        "plain_text": plain_text,
        "html": html,
        "attachments": []
    }

def create_touch_4(item):
    """Касание 4 (Follow-up №3, День 14): Кейс внедрения и предложение 10-мин созвона"""
    company = item["company"]
    salutation = item.get("salutation", "Здравствуйте!")
    subject = build_subject(item["subject"])

    plain_text = f"""{salutation}

Понимаю высокую производственную загрузку специалистов {company}. 

Чтобы сэкономить Ваше время, предлагаем провести короткий 10–15 минутный технический экспресс-созвон (или видеозвонок) с ведущим конструктором «Чайковского завода МЕХАНИКА».

Что мы сделаем за 15 минут:
1. Зафиксируем параметры Вашего заготовительного пролета (шаг колонн, высоту до кран-балки, габариты пачек).
2. Подберем оптимальную конфигурацию стеллажа (5 или 6 полок, выкат на 100% или 70%, управление с пульта или радиоканал).
3. Бесплатно подготовим и передадим чертеж компоновки стеллажа в формате DWG/PDF под Вашу цеховую планировку.

Наш завод уже реализовал подобные проекты для десятков машиностроительных предприятий России со сроком окупаемости 4–6 месяцев за счет высвобождения производственных площадей.

Какой день и время на текущей неделе Вам будут наиболее удобны для короткой связи?

С уважением,
Пыхтеев Денис Юрьевич
«Чайковский завод МЕХАНИКА»
Тел.: +7 (919) 700-07-20 | E-mail: pdu@mehan59.ru | mehan59.ru""".strip()

    html = f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8">
<style>
  body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #222222; margin: 0; padding: 0; }}
  .container {{ max-width: 650px; margin: 0 auto; padding: 20px; }}
  .salutation {{ font-size: 16px; font-weight: 600; color: #1a237e; margin-bottom: 16px; }}
  .box {{ background: #eff6ff; border-left: 4px solid #3b82f6; padding: 14px 18px; margin: 16px 0; border-radius: 0 6px 6px 0; }}
  .box li {{ margin-bottom: 6px; }}
  .signature {{ margin-top: 24px; padding-top: 16px; border-top: 1px solid #eeeeee; font-size: 13px; color: #424242; }}
  .signature-name {{ font-size: 15px; font-weight: bold; color: #1a237e; }}
  .signature-phone {{ font-size: 14px; font-weight: 600; color: #2e7d32; margin-top: 4px; }}
</style>
</head>
<body>
<div class="container">
  <div class="salutation">{salutation}</div>
  <p>Понимаю высокую производственную загрузку специалистов <b>{company}</b>.</p>
  <p>Чтобы сэкономить Ваше время, предлагаем короткий <b>10–15 минутный технический созвон</b> с ведущим инженером-конструктором «Чайковского завода МЕХАНИКА».</p>

  <div class="box">
    <b>Что мы подготовим для Вас по итогам 15-минутного созвона:</b>
    <ul>
      <li>Техническую привязку стеллажа 16112.200 под шаг колонн и высоту Вашего цеха;</li>
      <li>Расчет экономии полезной площади (до 70 м² высвобождаемой зоны);</li>
      <li>Готовые чертежи в DWG/PDF для Вашей технологической службы.</li>
    </ul>
  </div>

  <p>Какой день и время на этой неделе были бы комфортны для 10-минутного звонка?</p>

  <div class="signature">
    С уважением,<br/>
    <b>«Чайковский завод МЕХАНИКА»</b><br/>
    <div class="signature-name">Пыхтеев Денис Юрьевич</div>
    <div class="signature-phone">Тел.: +7 (919) 700-07-20</div>
    <div>E-mail: <a href="mailto:pdu@mehan59.ru">pdu@mehan59.ru</a> | Сайт: <a href="https://mehan59.ru/">mehan59.ru</a></div>
  </div>
</div>
</body>
</html>""".strip()

    return {
        "id": item["id"],
        "company": company,
        "to_email": item["to_email"],
        "fio": item.get("fio"),
        "position": item.get("position"),
        "region": item.get("region"),
        "batch": item.get("batch", 1),
        "stage": "stage_3",
        "touchNumber": 4,
        "subject": subject,
        "salutation": salutation,
        "plain_text": plain_text,
        "html": html,
        "attachments": []
    }

def create_touch_5(item):
    """Касание 5 (Финал, День 21): Бронь производственного слота ЧЗМ на квартал"""
    company = item["company"]
    salutation = item.get("salutation", "Здравствуйте!")
    subject = build_subject(item["subject"])

    plain_text = f"""{salutation}

Финальное обращение от «Чайковского завода МЕХАНИКА».

В течение последних трех недель мы направляли материалы по автоматизации хранения листового металла для {company}.

В данный момент завод формирует производственный план и график отгрузок стеллажей модели 16112.200 на следующий период.

Если модернизация заготовительного участка и закупка системы хранения листа актуальны для Вашего предприятия в текущем полугодии — дайте, пожалуйста, знать, чтобы мы забронировали производственный слот и зафиксировали базовую стоимость (3 850 000 ₽ с НДС).

Если же вопрос сейчас не в приоритете — мы закроем данную переписку и вернемся к диалогу позже при плановом обновлении модельного ряда.

Будем признательны за любой короткий ответ: «Актуально» или «Пока не планируем».

С уважением,
Пыхтеев Денис Юрьевич
«Чайковский завод МЕХАНИКА»
Тел.: +7 (919) 700-07-20 | E-mail: pdu@mehan59.ru | Сайт: mehan59.ru""".strip()

    html = f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8">
<style>
  body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #222222; margin: 0; padding: 0; }}
  .container {{ max-width: 650px; margin: 0 auto; padding: 20px; }}
  .salutation {{ font-size: 16px; font-weight: 600; color: #1a237e; margin-bottom: 16px; }}
  .status-box {{ background: #fafafa; border: 1px solid #e0e0e0; border-radius: 6px; padding: 14px 18px; margin: 16px 0; }}
  .signature {{ margin-top: 24px; padding-top: 16px; border-top: 1px solid #eeeeee; font-size: 13px; color: #424242; }}
  .signature-name {{ font-size: 15px; font-weight: bold; color: #1a237e; }}
  .signature-phone {{ font-size: 14px; font-weight: 600; color: #2e7d32; margin-top: 4px; }}
</style>
</head>
<body>
<div class="container">
  <div class="salutation">{salutation}</div>
  <p>Финальное обращение от «Чайковского завода МЕХАНИКА» в адрес <b>{company}</b>.</p>
  <p>В настоящее время наше предприятие утверждает производственный план сборки электромеханических стеллажей 16112.200 на текущий квартал.</p>

  <div class="status-box">
    <b>Бронирование слота сборки:</b><br/>
    Если задача оптимизации хранения проката актуальна в этом полугодии, готовы зафиксировать заводскую стоимость (3 850 000 ₽ с НДС) и закрепить производственный слот за Вашим предприятием.
  </div>

  <p>Будем искренне признательны за любой короткий обратный ответ: <b>«Актуально»</b> или <b>«Пока не планируем»</b>.</p>

  <div class="signature">
    С уважением,<br/>
    <b>«Чайковский завод МЕХАНИКА»</b><br/>
    <div class="signature-name">Пыхтеев Денис Юрьевич</div>
    <div class="signature-phone">Тел.: +7 (919) 700-07-20</div>
    <div>E-mail: <a href="mailto:pdu@mehan59.ru">pdu@mehan59.ru</a> | Сайт: <a href="https://mehan59.ru/">mehan59.ru</a></div>
  </div>
</div>
</body>
</html>""".strip()

    return {
        "id": item["id"],
        "company": company,
        "to_email": item["to_email"],
        "fio": item.get("fio"),
        "position": item.get("position"),
        "region": item.get("region"),
        "batch": item.get("batch", 1),
        "stage": "stage_3",
        "touchNumber": 5,
        "subject": subject,
        "salutation": salutation,
        "plain_text": plain_text,
        "html": html,
        "attachments": []
    }

# Формируем и сохраняем датасеты
datasets = {
    "followup1_dataset.json": [create_touch_2(p) for p in eligible_plants],
    "followup2_dataset.json": [create_touch_3(p) for p in eligible_plants],
    "followup3_dataset.json": [create_touch_4(p) for p in eligible_plants],
    "followup4_dataset.json": [create_touch_5(p) for p in eligible_plants]
}

for filename, data in datasets.items():
    filepath = os.path.join(BASE_DIR, filename)
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"✅ Сохранен {filename}: {len(data)} писем")

print("\n🚀 Все 4 фоллоу-ап датасета успешно сгенерированы!")
