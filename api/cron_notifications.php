<?php
// Executar apenas pelo PHP CLI, uma vez por dia, através do Agendador de Tarefas.
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require __DIR__.'/config.php';
$pdo=new PDO('mysql:host='.DB_HOST.';dbname='.DB_NAME.';charset=utf8mb4',DB_USER,DB_PASS,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
$notice=$pdo->prepare('INSERT IGNORE INTO notifications(user_id,type,event_key,content,link) VALUES(?,?,?,?,?)');
$users=$pdo->query('SELECT id FROM users WHERE is_active=1')->fetchAll(PDO::FETCH_COLUMN);
$scholarships=$pdo->query("SELECT id,title,DATEDIFF(deadline,CURDATE()) days_left FROM scholarships WHERE status='published' AND active=1 AND DATEDIFF(deadline,CURDATE()) IN (7,2,0)")->fetchAll();
foreach($scholarships as $s){
  $days=(int)$s['days_left'];$type=$days===0?'scholarship_closed':'scholarship_deadline';
  $message=$days===0?'A bolsa "'.$s['title'].'" encerra hoje.':'A bolsa "'.$s['title'].'" encerra em '.$days.' dias.';
  foreach($users as $uid)$notice->execute([(int)$uid,$type,'scholarship:'.$s['id'].':deadline:'.$days,$message,'scholarship:'.$s['id']]);
}
$ending=$pdo->query("SELECT id,DATEDIFF(premium_until,CURDATE()) days_left FROM users WHERE plan='premium' AND DATEDIFF(premium_until,CURDATE()) IN (7,2,0)")->fetchAll();
foreach($ending as $u){$days=(int)$u['days_left'];$notice->execute([(int)$u['id'],'subscription','premium:expiry:'.$days,'A tua subscrição Premium '.($days===0?'expira hoje.':'expira em '.$days.' dias.'),null]);}
$pdo->exec("UPDATE users SET plan='basico',subscription_status='expired' WHERE plan='premium' AND premium_until<CURDATE()");
fwrite(STDOUT,'Notificações verificadas: '.date('Y-m-d H:i:s').PHP_EOL);
