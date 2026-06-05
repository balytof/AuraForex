@echo off
echo Iniciando o Servidor AuraForex...
start "AuraForex Server" cmd /k "node server.js"
timeout /t 3
start http://localhost:3005/smc_bot_dashboard.html
