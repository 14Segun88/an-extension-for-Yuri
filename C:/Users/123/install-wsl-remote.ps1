# install-wsl-remote.ps1
# Автоматическая настройка Remote WSL через SSH

Write-Host "=== Установка Remote WSL через SSH туннель ===" -ForegroundColor Cyan

$wslIP = wsl hostname -I.Trim()
Write-Host "IP WSL: $wslIP" -ForegroundColor Green

# 1. Создаём SSH туннель в фоновом режиме
Write-Host "Создание SSH туннеля..." -ForegroundColor Yellow

$sshCommand = "ssh -N -L 12222:$wslIP:2222 segun@$wslIP"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "`$host.UI.RawUI.WindowTitle = 'WSL SSH Tunnel'; $sshCommand"

# Ждём 5 секунд для установки туннеля
Start-Sleep -Seconds 5

# 2. Обновляем SSH конфиг
$configContent = @"
# SSH конфигурация для подключения к WSL
# Генерировано автоматически

Host wsl
    HostName 127.0.0.1
    User segun
    Port 12222
    StrictHostKeyChecking no
    UserKnownHostsFile /dev/null
    ServerAliveInterval 60
    ServerAliveCountMax 3
"@

$configPath = "C:\Users\123\.ssh\config"
$configContent | Out-File -FilePath $configPath -Encoding UTF8 -NoNewline

Write-Host "SSH конфиг обновлён: $configPath" -ForegroundColor Green

# 3. Тестируем подключение
Write-Host ""
Write-Host "Тест подключения..." -ForegroundColor Yellow
$testResult = ssh -p 12222 segun@127.0.0.1 echo "SSH работает" 2>&1

if ($testResult -like "*SSH работает*") {
    Write-Host "✅ SSH туннель работает!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Теперь в VS Code/Cursor:" -ForegroundColor Cyan
    Write-Host "  1. Откройте F1" -ForegroundColor White
    Write-Host "  2. Введите: Remote-SSH: Connect to Host" -ForegroundColor White
    Write-Host "  3. Введите: wsl" -ForegroundColor White
    Write-Host ""
    Write-Host "Окно 'WSL SSH Tunnel' должно оставаться открытым!" -ForegroundColor Yellow
} else {
    Write-Host "❌ Ошибка подключения через туннель" -ForegroundColor Red
    Write-Host "Результат: $testResult" -ForegroundColor Red
}