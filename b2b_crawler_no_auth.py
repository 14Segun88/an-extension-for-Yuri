"""
b2b_crawler_no_auth.py
Скрипт для сбора и валидации контактов B2B-предприятий машиностроения и металлообработки
из 100% открытых общедоступных источников (без платных аккаунтов и регистрации).

Целевые регионы: Москва, Московская область, Санкт-Петербург, Ленинградская область.
Продукт: Стеллаж для листового металла 6000x2000 мм (ЧЗМ 16112.200).
"""

import re
import time
import requests
from bs4 import BeautifulSoup
import pandas as pd

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.8',
}

EMAIL_REGEX = re.compile(r'[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+')

# Исключаем служебные/мусорные расширения и домены
IGNORE_EXTENSIONS = ('.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.css', '.js')
IGNORE_EMAILS = {'example@', 'user@', 'email@', 'domain@', 'support@google.com', 'test@test.ru'}

def clean_email(email_str):
    if not email_str:
        return None
    email_str = email_str.strip().lower()
    for ext in IGNORE_EXTENSIONS:
        if email_str.endswith(ext):
            return None
    for ign in IGNORE_EMAILS:
        if email_str.startswith(ign):
            return None
    return email_str

def extract_contacts_from_url(url, timeout=7):
    """
    Извлекает email и телефон напрямую с сайта предприятия
    (главная страница и страница /contacts).
    """
    emails = set()
    phone = ""
    
    if not url.startswith('http'):
        url = 'https://' + url

    try:
        resp = requests.get(url, headers=HEADERS, timeout=timeout, verify=False)
        if resp.status_code == 200:
            found = EMAIL_REGEX.findall(resp.text)
            for e in found:
                cleaned = clean_email(e)
                if cleaned:
                    emails.add(cleaned)
    except Exception:
        pass

    # Пробуем страницу контактов
    contact_urls = [url.rstrip('/') + '/contacts', url.rstrip('/') + '/kontakty', url.rstrip('/') + '/contact']
    for curl in contact_urls:
        if emails:
            break
        try:
            resp = requests.get(curl, headers=HEADERS, timeout=timeout, verify=False)
            if resp.status_code == 200:
                found = EMAIL_REGEX.findall(resp.text)
                for e in found:
                    cleaned = clean_email(e)
                    if cleaned:
                        emails.add(cleaned)
        except Exception:
            continue

    return list(emails)

if __name__ == "__main__":
    print("=== МОДУЛЬ СБОРА B2B БАЗЫ БЕЗ АВТОРИЗАЦИИ ===")
    print("Чтение готовой выборки b2b_contacts_step1.xlsx...")
    try:
        df = pd.read_excel("/home/segun/CascadeProjects/Расширение для Юрия/b2b_contacts_step1.xlsx")
        print(f"Всего предприятий в базе: {len(df)}")
        print(df[["Компания", "Email", "Регион"]].to_string())
    except Exception as e:
        print("Ошибка чтения:", e)
