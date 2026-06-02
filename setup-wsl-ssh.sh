#!/bin/bash
# Скрипт настройки SSH сервера в WSL для подключения из редакторов

set -e

echo "=== Настройка SSH сервера в WSL ==="

# 1. Установка OpenSSH сервера
echo "[1/5] Установка OpenSSH сервера..."
sudo apt update
sudo apt install -y openssh-server

# 2. Создание директории для SSH ключей
echo "[2/5] Настройка SSH конфигурации..."
sudo mkdir -p /run/sshd

# 3. Генерация хост-ключей (если нет)
echo "[3/5] Генерация хост-ключей..."
sudo ssh-keygen -A

# 4. Настройка порта (по умолчанию 2222 чтобы не конфликтовать)
echo "[4/5] Настройка порта SSH..."
if ! grep -q "Port 2222" /etc/ssh/sshd_config; then
    echo "Port 2222" | sudo tee -a /etc/ssh/sshd_config
fi

# Разрешаем вход по паролю
echo "PasswordAuthentication yes" | sudo tee -a /etc/ssh/sshd_config
echo "PermitRootLogin prohibit-password" | sudo tee -a /etc/ssh/sshd_config

# 5. Запуск SSH сервера
echo "[5/5] Запуск SSH сервера..."
sudo /usr/sbin/sshd

echo ""
echo "=== SSH сервер запущен ==="
echo ""
echo "Информация для подключения:"
echo "  Порт: 2222"
echo "  Пользователь: $(whoami)"
echo "  Хост: localhost"
echo ""
echo "Для подключения из VS Code/Cursor:"
echo "  1. Установите расширение 'Remote - SSH'"
echo "  2. Подключитесь к: localhost:2222"
echo "  3. Введите пароль вашего пользователя WSL"
echo ""
echo "Чтобы SSH сервер запускался автоматически при старте WSL:"
echo "  Добавьте в ~/.bashrc:"
echo "  sudo /usr/sbin/sshd"
echo ""
