# setup-wsl-ssh.ps1
# Скрипт для настройки SSH сервера в WSL

Write-Host "=== Настройка SSH сервера в WSL ===" -ForegroundColor Cyan

# Проверка наличия WSL
$wslDistros = wsl --list --quiet
if ([string]::IsNullOrWhiteSpace($wslDistros)) {
    Write-Host "Ошибка: WSL не установлен!" -ForegroundColor Red
    exit 1
}

Write-Host "Найденные дистрибутивы WSL:" -ForegroundColor Green
wsl --list --verbose

# Выбор дистрибутива (первый по умолчанию)
$distro = ($wslDistros -split "`n")[0].Trim()
Write-Host "Используемый дистрибутив: $distro" -ForegroundColor Yellow

# Скрипт для выполнения внутри WSL
$wslScript = @'
#!/bin/bash
echo "Установка OpenSSH сервера..."
sudo apt update
sudo apt install -y openssh-server

echo "Настройка SSH..."
sudo mkdir -p /run/sshd
sudo ssh-keygen -A

# Настройка порта 2222
if ! grep -q "Port 2222" /etc/ssh/sshd_config; then
    echo "Port 2222" | sudo tee -a /etc/ssh/sshd_config
fi

echo "PasswordAuthentication yes" | sudo tee -a /etc/ssh/sshd_config
echo "PermitRootLogin prohibit-password" | sudo tee -a /etc/ssh/sshd_config

echo "Запуск SSH сервера..."
sudo /usr/sbin/sshd

echo "=== SSH сервер запущен ==="
echo "Порт: 2222"
echo "Пользователь: $(whoami)"
'@

# Выполнение скрипта в WSL
Write-Host "Выполнение настройки в WSL..." -ForegroundColor Yellow
wsl -d $distro bash -c "$wslScript"

if ($LASTEXITCODE -eq 0) {
    Write-Host "=== Настройка завершена успешно! ===" -ForegroundColor Green
    Write-Host ""
    Write-Host "Для подключения из VS Code/Cursor:" -ForegroundColor Cyan
    Write-Host "  1. Установите расширение 'Remote - SSH'" -ForegroundColor White
    Write-Host "  2. Нажмите F1 -> Remote-SSH: Connect to Host" -ForegroundColor White
    Write-Host "  3. Выберите 'wsl' или введите 'localhost:2222'" -ForegroundColor White
    Write-Host "  4. Введите пароль вашего пользователя WSL" -ForegroundColor White
    Write-Host ""
    Write-Host "SSH конфиг уже создан: C:\Users\123\.ssh\config" -ForegroundColor Green
} else {
    Write-Host "Ошибка при настройке. Попробуйте запустить скрипт вручную в WSL:" -ForegroundColor Red
    Write-Host "  wsl -d $distro bash -c 'sudo ./setup-wsl-ssh.sh'" -ForegroundColor Yellow
}