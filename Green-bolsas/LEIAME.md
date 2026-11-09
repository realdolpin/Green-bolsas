# Green Bolsas

1. Instalar: apaga a base `bolsas` (se existir) e, no phpMyAdmin, separador Importar, escolhe `database/schema.sql`. Este ficheiro cria tudo (tabelas e bolsas por defeito). Não há migrações.
2. Edita `api/config.php` com as credenciais do MySQL.
3. Abre http://localhost/Green-bolsas/ (XAMPP) ou corre `php -S localhost:8000`.
4. Cria a tua conta no site e, no separador SQL: `UPDATE users SET is_admin=1 WHERE email='o.teu@email.com';`
5. Agenda `api/cron_notifications.php` no Agendador de Tarefas (php.exe) para avisos de prazo.

Os pagamentos Premium são demonstrativos. Antes de produção: HTTPS e gateway de pagamento real.
