#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Модуль фонового мониторинга входящей почты (IMAP Inbox Monitor)
для «Чайковский завод МЕХАНИКА».

1. Слушает ящик pdu@mehan59.ru через IMAP (imap.ya.ru:993).
2. Различает РЕАЛЬНЫЕ ответы от заводов и системные отлупы (Bounce/NDR).
3. При РЕАЛЬНОМ ответе (человек / делопроизводство / входящий номер):
   - Автоматически создает сделку в campaign_emails/leads.json;
   - Переносит карточку на Вкладку 4 (Лиды ⚡);
   - ИСКЛЮЧАЕТ завод из дальнейшей рассылки фолоу-ап писем.
4. При отлупе (Bounce / Несуществующий адрес / postmaster):
   - Фиксирует адрес в campaign_emails/bounced_emails.json;
   - Также исключает из холодных дожимов (защита репутации домена).
"""

import os
import sys
import json
import imaplib
import email
from email.header import decode_header
import ssl
import re
from datetime import datetime

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if os.path.exists(os.path.join(BASE_DIR, "../../campaign_emails")):
    ROOT_DIR = os.path.abspath(os.path.join(BASE_DIR, "../.."))
else:
    ROOT_DIR = BASE_DIR

CAMPAIGN_EMAILS_DIR = os.path.join(ROOT_DIR, "campaign_emails")
DATASET_PATH = os.path.join(CAMPAIGN_EMAILS_DIR, "campaign_dataset.json")
LEADS_PATH = os.path.join(CAMPAIGN_EMAILS_DIR, "leads.json")
BOUNCED_PATH = os.path.join(CAMPAIGN_EMAILS_DIR, "bounced_emails.json")
ENV_PATH = os.path.join(ROOT_DIR, "todoist-overdue-ext/backend/.env")

def load_env():
    env = {}
    if os.path.exists(ENV_PATH):
        with open(ENV_PATH, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    env[k.strip()] = v.strip().strip('"').strip("'")
    return env

env = load_env()
IMAP_HOST = env.get("IMAP_HOST", "imap.ya.ru")
IMAP_PORT = int(env.get("IMAP_PORT", 993))
IMAP_USER = env.get("SMTP_USER", "pdu@mehan59.ru")
IMAP_PASS = env.get("SMTP_PASS", "zyntqqqdqafgyksv")

def decode_mime_words(s):
    if not s:
        return ""
    try:
        parts = decode_header(s)
        res = []
        for content, encoding in parts:
            if isinstance(content, bytes):
                res.append(content.decode(encoding or "utf-8", errors="replace"))
            else:
                res.append(str(content))
        return "".join(res)
    except Exception:
        return str(s)

def load_json(path, default=[]):
    if os.path.exists(path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return default
    return default

def save_json(path, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def is_bounce_message(sender, subject, body=""):
    s_low = sender.lower()
    sub_low = subject.lower()
    b_low = body.lower()

    bounce_senders = ["postmaster@", "mailer-daemon@", "mail delivery system", "noreply@yandex.ru"]
    for bs in bounce_senders:
        if bs in s_low:
            return True

    bounce_keywords = [
        "не удалось выполнить доставку",
        "доставка следующим получателям отложена",
        "delivery status notification",
        "undelivered mail returned to sender",
        "mail delivery failed",
        "failure notice",
        "address rejected",
        "user unknown",
        "mailbox unavailable"
    ]
    for bk in bounce_keywords:
        if bk in sub_low or bk in b_low[:400]:
            return True

    return False

def extract_body(msg):
    body = ""
    try:
        if msg.is_multipart():
            for part in msg.walk():
                ctype = part.get_content_type()
                cdisp = str(part.get("Content-Disposition", ""))
                if ctype == "text/plain" and "attachment" not in cdisp:
                    payload = part.get_payload(decode=True)
                    if payload:
                        charset = part.get_content_charset() or "utf-8"
                        body = payload.decode(charset, errors="replace")
                        break
        else:
            payload = msg.get_payload(decode=True)
            if payload:
                charset = msg.get_content_charset() or "utf-8"
                body = payload.decode(charset, errors="replace")
    except Exception as e:
        body = f"[Ошибка чтения тела: {e}]"
    return body.strip()

def check_inbox_and_sync():
    dataset = load_json(DATASET_PATH, [])
    leads = load_json(LEADS_PATH, [])
    bounced = load_json(BOUNCED_PATH, [])
    bounced_ids = set(b.get("plantId") for b in bounced if b.get("plantId"))

    existing_lead_ids = set()
    for l in leads:
        cid = l.get("contactId")
        if cid:
            existing_lead_ids.add(cid)
        lid = l.get("id")
        if isinstance(lid, int) and lid < 1000:
            existing_lead_ids.add(lid)

    email_to_plant = {}
    domain_to_plant = {}
    company_keywords = []

    GENERIC_DOMAINS = {"ya.ru", "yandex.ru", "mail.ru", "bk.ru", "inbox.ru", "list.ru", "gmail.com", "rambler.ru"}

    for plant in dataset:
        p_email = plant.get("to_email", "").strip().lower()
        p_id = plant.get("id")
        p_comp = plant.get("company", "")

        if p_email:
            email_to_plant[p_email] = plant
            if "@" in p_email:
                dom = p_email.split("@")[1].strip().lower()
                if dom not in GENERIC_DOMAINS:
                    domain_to_plant[dom] = plant

        # Специальные домены холдингов
        if p_id == 5 or "элемаш" in p_comp.lower() or "мсз" in p_comp.lower():
            domain_to_plant["rosatom.ru"] = plant
            domain_to_plant["elemash.ru"] = plant
        if p_id in [21, 36, 51] or "мытищинский" in p_comp.lower():
            domain_to_plant["mmzavod.ru"] = plant
            domain_to_plant["mmz.ru"] = plant
        if p_id == 14 or "lazerrez" in p_comp.lower() or "роднок" in p_comp.lower():
            domain_to_plant["lazerrezspb.ru"] = plant

        clean_name = re.sub(r'["«»ОООАОПАОЗАО]+', ' ', p_comp).strip()
        words = [w for w in clean_name.split() if len(w) > 4]
        if words:
            company_keywords.append((words[0].lower(), plant))

    # IMAP Connect
    context = ssl.create_default_context()
    try:
        mail = imaplib.IMAP4_SSL(IMAP_HOST, IMAP_PORT, ssl_context=context)
        mail.login(IMAP_USER, IMAP_PASS)
    except Exception as e:
        return {"ok": False, "error": f"IMAP Error: {e}"}

    new_leads_added = []
    new_bounces_added = []
    matched_replies = []

    try:
        status, _ = mail.select("INBOX", readonly=True)
        if status == "OK":
            status, msgs = mail.search(None, "ALL")
            if status == "OK" and msgs[0]:
                all_ids = msgs[0].split()
                # Анализируем последние 35 писем
                recent_ids = all_ids[-35:] if len(all_ids) > 35 else all_ids

                for mid in reversed(recent_ids):
                    res, data = mail.fetch(mid, "(BODY.PEEK[HEADER.FIELDS (FROM TO SUBJECT DATE)])")
                    if res != "OK" or not data or not isinstance(data[0], tuple):
                        continue

                    header_bytes = data[0][1]
                    msg_obj = email.message_from_bytes(header_bytes)
                    sender_raw = decode_mime_words(msg_obj.get("From", ""))
                    subject_raw = decode_mime_words(msg_obj.get("Subject", ""))
                    date_raw = msg_obj.get("Date", "")
                    sender_lower = sender_raw.lower()
                    subject_lower = subject_raw.lower()

                    # Пропускаем свои исходящие BCC и адреса руководства/команды
                    if (
                        sender_lower.startswith("пыхтеев")
                        or "pdu@mehan59.ru" in sender_lower
                        or "krantehpto@list.ru" in sender_lower
                        or "кораблев" in sender_lower
                    ):
                        continue

                    # Определяем, связано ли с заводом
                    matched_plant = None
                    for femail, plant in email_to_plant.items():
                        if femail in sender_lower:
                            matched_plant = plant
                            break

                    if not matched_plant:
                        for dom, plant in domain_to_plant.items():
                            if ("@" + dom) in sender_lower:
                                matched_plant = plant
                                break

                    if not matched_plant:
                        for kw, plant in company_keywords:
                            if kw in subject_lower:
                                matched_plant = plant
                                break

                    if matched_plant:
                        # Получаем тело для точного анализа
                        res_b, b_data = mail.fetch(mid, "(RFC822)")
                        body_text = ""
                        if res_b == "OK" and b_data and isinstance(b_data[0], tuple):
                            full_msg = email.message_from_bytes(b_data[0][1])
                            body_text = extract_body(full_msg)

                        # ПРОВЕРКА: Это отлуп (Bounce) или РЕАЛЬНЫЙ ответ?
                        if is_bounce_message(sender_raw, subject_raw, body_text):
                            if matched_plant["id"] not in bounced_ids:
                                b_record = {
                                    "plantId": matched_plant["id"],
                                    "company": matched_plant["company"],
                                    "email": matched_plant.get("to_email"),
                                    "detectedAt": datetime.now().isoformat(),
                                    "reason": "Undelivered / Mailbox Unavailable"
                                }
                                bounced.append(b_record)
                                bounced_ids.add(matched_plant["id"])
                                new_bounces_added.append(b_record)
                            continue

                        # РЕАЛЬНЫЙ входящий ответ (ЛИД / Согласование)
                        reg_match = re.search(r'(?:вх\.?\s*(?:рег\.?\s*)?№?\s*|регистрационный\s*№?\s*)([A-Za-zА-Яа-я0-9\/\-\.]+)', body_text + " " + subject_raw, re.IGNORECASE)
                        reg_number = reg_match.group(0).strip() if reg_match else ""
                        clean_preview = re.sub(r'\s+', ' ', body_text)[:300].strip()

                        reply_record = {
                            "plantId": matched_plant["id"],
                            "company": matched_plant["company"],
                            "from": sender_raw,
                            "subject": subject_raw,
                            "date": date_raw,
                            "regNumber": reg_number,
                            "preview": clean_preview
                        }
                        matched_replies.append(reply_record)

                        if matched_plant["id"] not in existing_lead_ids:
                            status_label = f"Зарегистрировано ({reg_number})" if reg_number else "Ответ получен (Лид ⚡)"
                            notes = f"Авто-захват из входящей почты ({date_raw}). " + (f"Входящий: {reg_number}. " if reg_number else "") + f"Цитата: {clean_preview[:160]}"

                            new_lead = {
                                "id": int(datetime.now().timestamp() * 1000),
                                "createdAt": datetime.now().isoformat(),
                                "contactId": matched_plant["id"],
                                "company": matched_plant["company"],
                                "fio": matched_plant.get("fio") or sender_raw,
                                "contactFio": sender_raw,
                                "phone": matched_plant.get("phone", ""),
                                "email": matched_plant.get("to_email", ""),
                                "stage": "stage_4",
                                "status": status_label,
                                "shelves": 5,
                                "sheet": "6000x2000",
                                "price": "3 850 000 ₽",
                                "notes": notes
                            }
                            leads.append(new_lead)
                            existing_lead_ids.add(matched_plant["id"])
                            new_leads_added.append(new_lead)

    finally:
        try:
            mail.logout()
        except Exception:
            pass

    if new_leads_added:
        save_json(LEADS_PATH, leads)
        print(f"[IMAP Monitor] 🎯 Зафиксировано {len(new_leads_added)} новых РЕАЛЬНЫХ ответов в leads.json!", file=sys.stderr)
    if new_bounces_added:
        save_json(BOUNCED_PATH, bounced)
        print(f"[IMAP Monitor] ⚠️ Обнаружено {len(new_bounces_added)} недоставленных адресов (исключены из рассылки).", file=sys.stderr)

    return {
        "ok": True,
        "checkedAt": datetime.now().isoformat(),
        "totalMatched": len(matched_replies),
        "newLeadsAdded": len(new_leads_added),
        "newBouncesAdded": len(new_bounces_added),
        "replies": matched_replies,
        "leadsCount": len(leads),
        "bouncedCount": len(bounced)
    }

if __name__ == "__main__":
    res = check_inbox_and_sync()
    print(json.dumps(res, ensure_ascii=False, indent=2))
