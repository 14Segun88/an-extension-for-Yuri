#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Генератор писем второго касания (Follow-up №1, День 3–5)
для 14 промышленных предприятий первой партии (за исключением ответившего Росатом / АО «МСЗ»).
Фокус письма: уточнение оборудования раскроя (лазер/плазма), форматов листа и экономия 70% площади цеха.
"""

import json
import os

DATASET_PATH = "/home/segun/CascadeProjects/Расширение для Юрия/campaign_emails/campaign_dataset.json"
OUTPUT_DATASET = "/home/segun/CascadeProjects/Расширение для Юрия/campaign_emails/followup1_dataset.json"
OUTPUT_PREVIEW = "/home/segun/CascadeProjects/Расширение для Юрия/campaign_emails/preview_followup1.html"

with open(DATASET_PATH, "r", encoding="utf-8") as f:
    full_dataset = json.load(f)

# Берем заводы первой партии (batch == 1), исключая завод №5 (АО «МСЗ» Элемаш / Росатом)
batch1_items = [item for item in full_dataset if item.get("batch") == 1 and item.get("id") != 5]

print(f"Отобрано для Follow-up №1: {len(batch1_items)} заводов.")

followup_list = []

for item in batch1_items:
    salutation = item.get("salutation", "Здравствуйте!")
    company = item["company"]
    to_email = item["to_email"]
    cid = item["id"]
    orig_subject = item["subject"]
    
    # Тема письма с Re: для продолжения цепочки
    subject = f"Re: {orig_subject}" if not orig_subject.startswith("Re:") else orig_subject

    # Plain text
    plain_text = f"""{salutation}

14 октября я направлял в адрес {company} коммерческое предложение и демонстрационное видео по электромеханическому стеллажу грузоподъемностью 25 тн производства «Чайковского завода МЕХАНИКА».

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
Региональный представитель
«Чайковский завод МЕХАНИКА»
г. Санкт-Петербург
Пыхтеев Денис Юрьевич
--
Тел.: +7 (919) 700-07-20
E-mail: pdu@mehan59.ru
Сайт: mehan59.ru
""".strip()

    # HTML
    html = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
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
  
  <p>14 октября я направлял в адрес <b>{company}</b> коммерческое предложение и демонстрационное видео по электромеханическому стеллажу грузоподъемностью 25 тн производства «Чайковского завода МЕХАНИКА».</p>
  
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
    <span class="signature-title">Региональный представитель</span><br/>
    <b>«Чайковский завод МЕХАНИКА»</b> (г. Санкт-Петербург)<br/>
    <div class="signature-name">Пыхтеев Денис Юрьевич</div>
    <div class="signature-phone">Тел.: +7 (919) 700-07-20</div>
    <div>E-mail: <a href="mailto:pdu@mehan59.ru">pdu@mehan59.ru</a> | Сайт: <a href="https://mehan59.ru/">mehan59.ru</a></div>
  </div>
</div>
</body>
</html>
""".strip()

    followup_entry = {
        "id": cid,
        "company": company,
        "to_email": to_email,
        "fio": item.get("fio"),
        "position": item.get("position"),
        "region": item.get("region"),
        "batch": 1,
        "batch_label": "Партия 1 (Follow-up №1)",
        "stage": "stage_2",
        "touchNumber": 2,
        "subject": subject,
        "salutation": salutation,
        "plain_text": plain_text,
        "html": html,
        "attachments": [] # Follow-up идет без тяжелых вложений для максимальной доставляемости
    }
    followup_list.append(followup_entry)

# Сохраняем датасет Follow-up 1
with open(OUTPUT_DATASET, "w", encoding="utf-8") as f:
    json.dump(followup_list, f, ensure_ascii=False, indent=2)

print(f"Успешно сохранен датасет: {OUTPUT_DATASET} ({len(followup_list)} писем)")

# Сохраняем HTML превью всех 14 писем
preview_html = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Предпросмотр 14 писем Follow-up №1 (День 3–5) • ЧЗ «Механика»</title>
<style>
  body {{ font-family: sans-serif; background: #0f172a; color: #f8fafc; padding: 24px; }}
  .email-card {{ background: #1e293b; border: 1px solid #334155; border-radius: 8px; margin-bottom: 24px; padding: 20px; }}
  .email-meta {{ font-size: 13px; color: #94a3b8; border-bottom: 1px solid #334155; padding-bottom: 10px; margin-bottom: 14px; }}
  .email-meta b {{ color: #38bdf8; }}
  .email-body {{ background: #ffffff; color: #111; padding: 20px; border-radius: 6px; }}
</style>
</head>
<body>
  <h1>Предпросмотр 14 писем Follow-up №1 (День 3–5) • ЧЗ «Механика»</h1>
  <p style="color: #94a3b8;">Цепочка: Уточнение раскройного парка (лазер/плазма), форматов листа и выгода 70% площади цеха.</p>
"""
for idx, entry in enumerate(followup_list):
    preview_html += f"""
  <div class="email-card">
    <div class="email-meta">
      <div><b>№ {idx+1} из {len(followup_list)}</b> | Завод: <b>{entry['company']}</b> | ID: {entry['id']}</div>
      <div>Получатель: <b>{entry['to_email']}</b> ({entry['position']} — {entry['fio']})</div>
      <div>Тема: <b>{entry['subject']}</b></div>
    </div>
    <div class="email-body">
      {entry['html']}
    </div>
  </div>
"""
preview_html += "</body></html>"

with open(OUTPUT_PREVIEW, "w", encoding="utf-8") as f:
    f.write(preview_html)

print(f"Превью сохранено: {OUTPUT_PREVIEW}")
