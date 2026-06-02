# start-wsl-ssh-tunnel.ps1
# Создаёт SSH туннель и подключается к WSL из VS Code

Write-Host "=== Настройка SSH туннеля для WSL ===" -ForegroundColor Cyan

$wslIP = wsl hostname -I.Trim()
Write-Host "IP WSL: $wslIP" -ForegroundColor Green

# Проверяем есть ли уже туннель на порту 12222
$listening = netstat -ano | Select-String "12222"
if ($listening) {
    Write-Host "Туннель уже работает на порту 12222" -ForegroundColor Yellow
} else {
    Write-Host "Создание туннеля..." -ForegroundColor Yellow
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "ssh -N -L 12222:$wslIP:2222 segun@$wslIP" -Wait:$false
    Write-Host "Введите пароль в новом окне SSH" -ForegroundColor Cyan
    Start-Sleep -Seconds 3
}

# Обновляем SSH конфиг
$configContent = @"
# SSH конфигурация для подключения к WSL
Host wsl
    HostName 127.0.0.1
    User segun
    Port 12222
    StrictHostKeyChecking no
    UserKnownHostsFile /dev/null
"@

$configContent | Out-File -FilePath "C:\Users\123\.ssh\config" -Encoding UTF8 -NoNewline

Write-Host ""
Write-Host "✅ Готово!" -ForegroundColor Green
Write-Host ""
Write-Host "Теперь в VS Code/Cursor:" -ForegroundColor Cyan
Write-Host "  F1 -> Remote-SSH: Connect to Host -> wsl" -ForegroundColor White
Write-Host ""
Write-Host "Окно с туннелем должно оставаться открытым!" -ForegroundColor Yellow