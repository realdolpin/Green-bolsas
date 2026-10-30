# Passagem — bolsas de estudo comparticipadas

1. Importa a base de dados:  `mysql -u root -p < database/schema.sql`
2. Edita `api/config.php` com as credenciais do MySQL.
3. Arranca localmente (PHP 8+ com pdo_mysql):  `php -S localhost:8000`  e abre http://localhost:8000
4. Torna-te admin: `UPDATE users SET is_admin=1 WHERE email='o.teu@email.com';` (aparece o formulário "Publicar bolsa").

Antes de ir para produção: ligar um gateway de pagamento real (ver comentário em `upgrade`), usar HTTPS e adicionar proteção CSRF.
