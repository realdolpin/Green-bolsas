# Passagem — bolsas de estudo comparticipadas

1. Importa a base de dados:  `mysql -u root -p < database/schema.sql`
2. Edita `api/config.php` com as credenciais do MySQL.
3. Arranca localmente (PHP 8+ com pdo_mysql):  `php -S localhost:8000`  e abre http://localhost:8000
4. Torna-te admin: `UPDATE users SET is_admin=1 WHERE email='o.teu@email.com';` (aparece o formulário "Publicar bolsa").

Antes de ir para produção: ligar um gateway de pagamento real (ver comentário em `upgrade`), usar HTTPS e adicionar proteção CSRF.

## Expansão de administração e mentoria

Depois de importar o esquema original, executa `database/migration_expansion.sql` na base `bolsas` (por exemplo, pelo separador SQL do phpMyAdmin). A migração acrescenta perfis, notificações, favoritos, ligações e mensagens sem apagar as tabelas existentes. Se já tinhas executado uma versão anterior, volta a executar esta versão actualizada para aplicar os novos estados de subscrição/candidatura e o campo de eliminação lógica de contas.

Para notificações de bolsas a 7 e 2 dias do prazo, e avisos de expiração Premium, agenda `api/cron_notifications.php` para correr diariamente no Agendador de Tarefas do Windows, usando `C:\xampp\php\php.exe` como programa e `C:\xampp\htdocs\Green-bolsas\api\cron_notifications.php` como argumento. O script só aceita execução pelo PHP CLI. A página também verifica avisos quando é aberta.

Os pagamentos Premium continuam demonstrativos: nenhuma cobrança ou transferência real é realizada.
