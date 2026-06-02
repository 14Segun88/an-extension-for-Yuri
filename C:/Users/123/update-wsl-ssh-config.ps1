# update-wsl-ssh-config.ps1
# Автоматически обновляет SSH конфиг с актуальным IP WSL

Write-Host "=== Обновление SSH конфига для WSL ===" -ForegroundColor Cyan

# Получите IP WSL
$wslIP = wsl hostname -I.Trim()
Write-Host "IP WSL: $wslIP" -ForegroundColor Green

# Создайте SSH конфиг
$configContent = @"
# SSH конфигурация для подключения к WSL
# Разместите этот файл как: C:\Users\123\.ssh\config

Host wsl
    HostName $wslIP
    User segun
    Port 2222
    StrictHostKeyChecking no
    UserKnownHostsFile /dev/null
    ServerAliveInterval 30
    ServerAliveCountMax 3
    ConnectTimeout 10
"@

# Запишите конфиг
$configPath = "C:\Users\123\.ssh\config"
$configContent | Out-File -FilePath $configPath -Encoding UTF8 -NoNewline

Write-Host "SSH конфиг обновлён: $configPath" -ForegroundColor Green
Write-Host ""
Write-Host "Для подключения в VS Code/Cursor:" -ForegroundColor Cyan
Write-Host "  F1 -> Remote-SSH: Connect to Host -> wsl" -ForegroundColor White
Write-Host ""
Write-Host "Или напрямую:" -ForegroundColor Yellow
Write-Host "  segun@$wslIP -p 2222" -ForegroundColor White