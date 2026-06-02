# update-wsl-ssh-portproxy.ps1
# Автоматически обновляет правило порт-форвардинга для SSH в WSL

Write-Host "=== Обновление правила порт-форвардинга для WSL SSH ===" -ForegroundColor Cyan

# Получите IP WSL
$wslIP = wsl hostname -I.Trim()
Write-Host "IP WSL: $wslIP" -ForegroundColor Green

# Удалите старое правило (если есть)
netsh interface portproxy delete v4tov4 listenport=2222 listenaddress=0.0.0.0 -ErrorAction SilentlyContinue

# Добавьте новое правило
netsh interface portproxy add v4tov4 listenport=2222 listenaddress=0.0.0.0 connectport=2222 connectaddress=$wslIP

if ($LASTEXITCODE -eq 0) {
    Write-Host "Правило успешно обновлено!" -ForegroundColor Green
    Write-Host "SSH доступен на: localhost:2222" -ForegroundColor Cyan
} else {
    Write-Host "Ошибка при создании правила. Запустите от имени администратора." -ForegroundColor Red
}

# Покажите текущие правила
Write-Host ""
Write-Host "Текущие правила порт-форвардинга:" -ForegroundColor Yellow
netsh interface portproxy show all