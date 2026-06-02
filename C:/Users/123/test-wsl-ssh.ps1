# test-wsl-ssh.ps1
# Тест подключения к WSL через SSH

Write-Host "=== Тест SSH подключения к WSL ===" -ForegroundColor Cyan

Write-Host "Тестируем подключение..." -ForegroundColor Yellow
ssh -v -p 2222 segun@127.0.0.1 echo "SSH работает!"

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ SSH подключение успешно!" -ForegroundColor Green
} else {
    Write-Host "❌ Ошибка подключения. Проверьте:" -ForegroundColor Red
    Write-Host "  1. SSH сервер запущен в WSL: wsl bash -c 'sudo ps aux | grep sshd'" -ForegroundColor White
    Write-Host "  2. Порт 2222 открыт: wsl bash -c 'sudo ss -tlnp | grep 2222'" -ForegroundColor White
    Write-Host "  3. Правило порт-форвардинга: netsh interface portproxy show all" -ForegroundColor White
    Write-Host "  4. Пароль пользователя WSL" -ForegroundColor White
}