#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Генератор персонализированных писем (Шаг 2.1)
на базе авторского текста Дениса Юрьевича Пыхтеева (ЧЗ «Механика»)
для 15 валидированных промышленных предприятий.
"""

import os
import json
import pandas as pd

# Пути к вложениям
ATTACHMENTS = [
    {
        "filename": "Механика Инф.pdf",
        "path": "/home/segun/CascadeProjects/Расширение для Юрия/Вложения/Механика Инф.pdf",
        "description": "Информационное письмо о заводе ЧЗМ"
    },
    {
        "filename": "КП_ЧЗМ_стеллаж_для_предприятий_с_фото.pdf",
        "path": "/home/segun/CascadeProjects/Расширение для Юрия/Вложения/КП_ЧЗМ_стеллаж_для_предприятий_с_фото.pdf",
        "description": "Коммерческое предложение на стеллаж 25 тн с фото"
    }
]

def generate_plain_text(row):
    salutation = row['Тег_Обращение']
    company = row['Компания']
    pain_point = row['Тег_Болевая_Точка']
    
    text = f"""{salutation}

«Чайковский завод МЕХАНИКА» является российским разработчиком и производителем промышленной металлической мебели и нестандартного оборудования для разных отраслей.

В пример для производства {company}, прошу рассмотреть уникальный стеллаж с приводами грузоподъемностью 25 тн для хранения листового металла. 
Оборудование решает ключевую задачу: {pain_point.lower()}.

Ролик — демонстрация в действии (Rutube):
https://rutube.ru/video/9b4e718a696a972789687791713ba5fa/

Официальный сайт завода: https://mehan59.ru/

Во вложении два файла: 
1. Информационное письмо о предприятии ЧЗМ («Механика Инф.pdf»)
2. Коммерческое предложение с фото и техническими параметрами («КП_ЧЗМ_стеллаж_для_предприятий_с_фото.pdf»)

В продолжение разговора прошу перенаправить информацию в технический отдел (главному инженеру / ПТО) и отдел закупок, либо связаться со мной для предварительного расчета под параметры Вашего цеха.

С Благодарностью,
Заместитель директора по развитию
«Чайковский завод МЕХАНИКА»
г. Санкт-Петербург
Пыхтеев Денис Юрьевич
--
Тел.: +7 (919) 700-07-20
E-mail: pdu@mehan59.ru
Сайт: mehan59.ru
"""
    return text.strip()

def generate_html(row):
    salutation = row['Тег_Обращение']
    company = row['Компания']
    pain_point = row['Тег_Болевая_Точка']
    
    html = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #222222; margin: 0; padding: 0; }}
  .container {{ max-width: 650px; margin: 0 auto; padding: 20px; }}
  .salutation {{ font-size: 16px; font-weight: 600; color: #1a237e; margin-bottom: 16px; }}
  .highlight-box {{ background: #f0f4f8; border-left: 4px solid #1976d2; padding: 12px 16px; margin: 16px 0; border-radius: 0 4px 4px 0; }}
  .video-btn {{ display: inline-block; background: #e53935; color: #ffffff !important; text-decoration: none; padding: 10px 18px; border-radius: 4px; font-weight: 600; margin: 8px 0; }}
  .site-link {{ color: #1976d2; text-decoration: underline; }}
  .attachments-box {{ background: #fafafa; border: 1px solid #e0e0e0; border-radius: 6px; padding: 12px 16px; margin: 16px 0; }}
  .attachments-box ul {{ margin: 6px 0 0 0; padding-left: 20px; }}
  .signature {{ margin-top: 24px; padding-top: 16px; border-top: 1px solid #eeeeee; font-size: 13px; color: #424242; }}
  .signature-name {{ font-size: 15px; font-weight: bold; color: #1a237e; }}
  .signature-title {{ color: #616161; font-weight: 500; }}
  .signature-phone {{ font-size: 14px; font-weight: 600; color: #2e7d32; margin-top: 4px; }}
</style>
</head>
<body>
<div class="container">
  <div class="salutation">{salutation}</div>
  
  <p><b>«Чайковский завод МЕХАНИКА»</b> является российским разработчиком и производителем промышленной металлической мебели и нестандартного оборудования для разных отраслей.</p>
  
  <p>В пример для производства <b>{company}</b>, прошу рассмотреть уникальный <b>электромеханический стеллаж с приводами грузоподъемностью 25 тн</b> для хранения листового металла.</p>
  
  <div class="highlight-box">
    <b>Эффект для цеха:</b> {pain_point}.
  </div>
  
  <p><b>Ролик — демонстрация работы стеллажа в действии:</b><br/>
    <a href="https://rutube.ru/video/9b4e718a696a972789687791713ba5fa/" class="video-btn" target="_blank">▶ Смотреть видео на Rutube (1:20 мин)</a>
  </p>
  
  <p>Ссылка на официальный сайт завода: <a href="https://mehan59.ru/" class="site-link" target="_blank">https://mehan59.ru/</a></p>
  
  <div class="attachments-box">
    <b>📎 Во вложении к письму два файла:</b>
    <ul>
      <li><b>Механика Инф.pdf</b> — информационное письмо и презентация возможностей ЧЗМ</li>
      <li><b>КП_ЧЗМ_стеллаж_для_предприятий_с_фото.pdf</b> — технико-коммерческое предложение с чертежами и фото</li>
    </ul>
  </div>
  
  <p>В продолжение разговора прошу перенаправить информацию в технический отдел (главному инженеру / ПТО) и отдел закупок, либо связаться со мной по телефону для предварительного расчета под габариты Вашего производства.</p>
  
  <div class="signature">
    С Благодарностью,<br/>
    <span class="signature-title">Заместитель директора по развитию</span><br/>
    <b>«Чайковский завод МЕХАНИКА»</b> (г. Санкт-Петербург)<br/>
    <div class="signature-name">Пыхтеев Денис Юрьевич</div>
    <div class="signature-phone">Тел.: +7 (919) 700-07-20</div>
    <div>E-mail: <a href="mailto:pdu@mehan59.ru">pdu@mehan59.ru</a> | Сайт: <a href="https://mehan59.ru/">mehan59.ru</a></div>
  </div>
</div>
</body>
</html>
"""
    return html

def main():
    print("=== АДАПТАЦИЯ ШАБЛОНА ПИСЬМА ПОД 15 ПРЕДПРИЯТИЙ (ШАГ 2.1) ===")
    df = pd.read_csv("b2b_contacts_validated.csv")
    
    os.makedirs("campaign_emails", exist_ok=True)
    
    email_records = []
    
    for idx, row in df.iterrows():
        company = row['Компания']
        email = row['Email']
        fio = row['ФИО']
        pos = row['Должность']
        region = row['Сегмент_Регион']
        
        # Индивидуальная тема письма
        if 'главный инженер' in str(pos).lower():
            subject = f"В службу главного инженера {company}: Электромеханический стеллаж 25 тн для листового металла (КП ЧЗМ)"
        elif 'механик' in str(pos).lower():
            subject = f"В отдел главного механика {company}: Стеллаж для хранения листового металла 25 тн с приводами"
        elif 'производств' in str(pos).lower() or 'цех' in str(pos).lower():
            subject = f"Для производства {company}: Оптимизация хранения и подачи листового проката (Стеллаж 25 тн ЧЗМ)"
        else:
            subject = f"Для {company}: Электромеханический стеллаж 25 тн для хранения листового металла (КП ЧЗ «Механика»)"
            
        plain_text = generate_plain_text(row)
        html_text = generate_html(row)
        
        record = {
            "id": idx + 1,
            "company": company,
            "to_email": email,
            "fio": fio,
            "position": pos,
            "region": region,
            "subject": subject,
            "salutation": row['Тег_Обращение'],
            "pain_point": row['Тег_Болевая_Точка'],
            "plain_text": plain_text,
            "html": html_text,
            "attachments": ATTACHMENTS
        }
        email_records.append(record)
        
        # Сохранение индивидуального файла
        txt_path = f"campaign_emails/email_{idx+1:02d}_{row['Домен']}.txt"
        with open(txt_path, "w", encoding="utf-8") as f:
            f.write(f"TO: {email}\n")
            f.write(f"SUBJECT: {subject}\n")
            f.write(f"ATTACHMENTS: {', '.join([a['filename'] for a in ATTACHMENTS])}\n")
            f.write("=" * 60 + "\n\n")
            f.write(plain_text)
            
    # Сохранение полного JSON датасета для бэкенда рассылки
    with open("campaign_emails/campaign_dataset.json", "w", encoding="utf-8") as f:
        json.dump(email_records, f, ensure_ascii=False, indent=2)
        
    print(f"Сгенерировано 15 писем в папке campaign_emails/")
    print(f"Файл кампании для отправки: campaign_emails/campaign_dataset.json")
    
    # Генерация красивого интерактивного HTML-превью для Юрия / Дениса
    preview_html = """<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Предпросмотр 15 писем ЧЗМ</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f0f2f5; margin: 0; padding: 20px; }
  .layout { display: flex; max-width: 1300px; margin: 0 auto; gap: 20px; }
  .sidebar { width: 340px; background: #fff; border-radius: 8px; padding: 15px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); max-height: 90vh; overflow-y: auto; }
  .email-item { padding: 10px 12px; border-radius: 6px; margin-bottom: 8px; cursor: pointer; border: 1px solid #e0e0e0; transition: all 0.2s; font-size: 13px; }
  .email-item:hover { background: #e3f2fd; border-color: #2196f3; }
  .email-item.active { background: #1976d2; color: #fff; border-color: #1565c0; }
  .email-item.active .badge { background: #fff; color: #1976d2; }
  .badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; background: #e0e0e0; color: #424242; margin-bottom: 4px; }
  .preview-card { flex: 1; background: #fff; border-radius: 8px; padding: 25px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); min-height: 600px; }
  .header-meta { background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 6px; padding: 15px; margin-bottom: 20px; font-size: 13px; }
  .header-meta table { width: 100%; border-collapse: collapse; }
  .header-meta td { padding: 4px 8px; vertical-align: top; }
  .header-meta td:first-child { width: 120px; font-weight: bold; color: #6c757d; }
  .email-frame { border: 1px solid #e0e0e0; border-radius: 6px; padding: 20px; background: #fff; }
</style>
</head>
<body>
<h2 style="text-align: center; color: #1a237e; margin-top: 0;">📬 Предпросмотр 15 персонализированных писем ЧЗ «Механика»</h2>
<div class="layout">
  <div class="sidebar">
    <div style="font-weight: bold; margin-bottom: 12px; color: #424242;">Список предприятий (15):</div>
"""
    for idx, rec in enumerate(email_records):
        active_class = "active" if idx == 0 else ""
        preview_html += f"""
    <div class="email-item {active_class}" onclick="selectEmail({idx})">
      <span class="badge">{rec['region'].split()[1]}</span>
      <div style="font-weight: 600;">{rec['id']}. {rec['company']}</div>
      <div style="font-size: 11px; opacity: 0.85;">{rec['to_email']}</div>
    </div>
"""
    preview_html += """
  </div>
  <div class="preview-card">
    <div class="header-meta">
      <table>
        <tr><td>Кому:</td><td id="metaTo"></td></tr>
        <tr><td>Тема:</td><td id="metaSubject" style="font-weight: bold; color: #0d47a1;"></td></tr>
        <tr><td>ЛПР / Отдел:</td><td id="metaLpr"></td></tr>
        <tr><td>Регион:</td><td id="metaRegion"></td></tr>
        <tr><td>Вложения (2):</td><td id="metaAttach" style="color: #2e7d32; font-weight: 500;"></td></tr>
      </table>
    </div>
    <div class="email-frame" id="emailBody"></div>
  </div>
</div>

<script>
const data = """ + json.dumps(email_records, ensure_ascii=False) + """;

function selectEmail(idx) {
  document.querySelectorAll('.email-item').forEach((el, i) => {
    el.classList.toggle('active', i === idx);
  });
  const rec = data[idx];
  document.getElementById('metaTo').innerText = rec.company + ' <' + rec.to_email + '>';
  document.getElementById('metaSubject').innerText = rec.subject;
  document.getElementById('metaLpr').innerText = rec.fio + ' (' + rec.position + ')';
  document.getElementById('metaRegion').innerText = rec.region;
  document.getElementById('metaAttach').innerText = rec.attachments.map(a => '📎 ' + a.filename).join(' | ');
  document.getElementById('emailBody').innerHTML = rec.html;
}

selectEmail(0);
</script>
</body>
</html>
"""
    with open("campaign_emails/preview_15_emails.html", "w", encoding="utf-8") as f:
        f.write(preview_html)
        
    print(f"Интерактивное превью создано: campaign_emails/preview_15_emails.html")

if __name__ == "__main__":
    main()
