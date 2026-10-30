<?php
require __DIR__.'/config.php';
session_set_cookie_params(['httponly'=>true,'samesite'=>'Lax']);
session_start();
header('Content-Type: application/json; charset=utf-8');

function db(): PDO {
  static $pdo;
  return $pdo ??= new PDO('mysql:host='.DB_HOST.';dbname='.DB_NAME.';charset=utf8mb4', DB_USER, DB_PASS,
    [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
}
function out($d, int $c=200){ http_response_code($c); echo json_encode($d, JSON_UNESCAPED_UNICODE); exit; }
function fail(string $m, int $c=400){ out(['error'=>$m], $c); }
function body(): array { return json_decode(file_get_contents('php://input'), true) ?? []; }
function user(): ?array {
  if (empty($_SESSION['uid'])) return null;
  $s = db()->prepare('SELECT id,name,email,plan,premium_until,is_admin FROM users WHERE id=?');
  $s->execute([$_SESSION['uid']]); $u = $s->fetch();
  if ($u && $u['plan']==='premium' && $u['premium_until'] && $u['premium_until'] < date('Y-m-d')) {
    db()->prepare("UPDATE users SET plan='basico' WHERE id=?")->execute([$u['id']]); $u['plan']='basico';
  }
  return $u ?: null;
}
function need(): array { return user() ?? fail('Inicia sessão para continuar.', 401); }

$a = $_GET['action'] ?? '';
$in = body();
try {
switch ($a) {
  case 'register':
    $n=trim($in['name']??''); $e=strtolower(trim($in['email']??'')); $p=$in['password']??'';
    if ($n===''||!filter_var($e,FILTER_VALIDATE_EMAIL)||strlen($p)<8) fail('Preenche nome, email válido e palavra-passe com 8+ caracteres.');
    $s=db()->prepare('SELECT 1 FROM users WHERE email=?'); $s->execute([$e]);
    if ($s->fetch()) fail('Este email já tem conta. Inicia sessão.', 409);
    db()->prepare('INSERT INTO users(name,email,password_hash) VALUES(?,?,?)')->execute([$n,$e,password_hash($p,PASSWORD_DEFAULT)]);
    session_regenerate_id(true); $_SESSION['uid']=(int)db()->lastInsertId(); out(['user'=>user()]);

  case 'login':
    $s=db()->prepare('SELECT id,password_hash FROM users WHERE email=?'); $s->execute([strtolower(trim($in['email']??''))]); $r=$s->fetch();
    if (!$r || !password_verify($in['password']??'', $r['password_hash'])) fail('Email ou palavra-passe incorretos.', 401);
    session_regenerate_id(true); $_SESSION['uid']=(int)$r['id']; out(['user'=>user()]);

  case 'logout': session_destroy(); out(['ok'=>true]);
  case 'me': out(['user'=>user(), 'price'=>PREMIUM_PRICE]);

  case 'scholarships':
    $w=['active=1','deadline>=CURDATE()']; $p=[];
    foreach (['country','scope','level'] as $f) if (!empty($_GET[$f])) { $w[]="$f=?"; $p[]=$_GET[$f]; }
    if (!empty($_GET['q'])) { $w[]='(title LIKE ? OR institution LIKE ?)'; $p[]='%'.$_GET['q'].'%'; $p[]='%'.$_GET['q'].'%'; }
    $s=db()->prepare('SELECT * FROM scholarships WHERE '.implode(' AND ',$w).' ORDER BY deadline'); $s->execute($p);
    $rows=$s->fetchAll(); $u=user(); $applied=[];
    if ($u){ $x=db()->prepare('SELECT scholarship_id FROM applications WHERE user_id=?'); $x->execute([$u['id']]); $applied=$x->fetchAll(PDO::FETCH_COLUMN); }
    out(['items'=>$rows,'applied'=>array_map('intval',$applied)]);

  case 'apply': // plano básico e premium podem candidatar-se
    $u=need(); $sid=(int)($in['scholarship_id']??0); $m=trim($in['motivation']??'');
    if (strlen($m)<30) fail('Escreve uma carta de motivação com pelo menos 30 caracteres.');
    $s=db()->prepare('SELECT 1 FROM scholarships WHERE id=? AND active=1 AND deadline>=CURDATE()'); $s->execute([$sid]);
    if (!$s->fetch()) fail('Bolsa não disponível.', 404);
    try { db()->prepare('INSERT INTO applications(user_id,scholarship_id,motivation) VALUES(?,?,?)')->execute([$u['id'],$sid,$m]); }
    catch (PDOException $e) { fail('Já te inscreveste nesta bolsa.', 409); }
    out(['ok'=>true]);

  case 'my_applications':
    $u=need(); $s=db()->prepare('SELECT a.status,a.created_at,s.title,s.country FROM applications a JOIN scholarships s ON s.id=a.scholarship_id WHERE a.user_id=? ORDER BY a.created_at DESC');
    $s->execute([$u['id']]); out(['items'=>$s->fetchAll()]);

  case 'upgrade':
    // SIMULAÇÃO: marca como pago de imediato. Em produção, cria o pagamento no gateway
    // (ex.: Multicaixa Express, Stripe, PayPal) e só ativa o premium no webhook de confirmação.
    $u=need(); $ref='SIM-'.strtoupper(bin2hex(random_bytes(4)));
    db()->prepare("INSERT INTO payments(user_id,amount,reference,status) VALUES(?,?,?,'pago')")->execute([$u['id'],PREMIUM_PRICE,$ref]);
    $from = ($u['plan']==='premium' && $u['premium_until']) ? $u['premium_until'] : date('Y-m-d');
    db()->prepare("UPDATE users SET plan='premium', premium_until=DATE_ADD(?, INTERVAL 30 DAY) WHERE id=?")->execute([$from,$u['id']]);
    out(['user'=>user(),'reference'=>$ref]);

  case 'mentorship': // só premium
    $u=need(); if ($u['plan']!=='premium') fail('A mentoria direta é exclusiva do plano premium.', 403);
    $m=trim($in['message']??''); if (strlen($m)<10) fail('Descreve em que precisas de ajuda.');
    $sid=!empty($in['scholarship_id'])?(int)$in['scholarship_id']:null;
    db()->prepare('INSERT INTO mentorship_requests(user_id,scholarship_id,message) VALUES(?,?,?)')->execute([$u['id'],$sid,$m]); out(['ok'=>true]);

  case 'admin_publish': // só administradores
    $u=need(); if (!$u['is_admin']) fail('Sem permissão.', 403);
    foreach (['title','institution','country','scope','level','coverage_percent','deadline','description'] as $k) if (empty($in[$k])) fail("Campo em falta: $k");
    db()->prepare('INSERT INTO scholarships(title,institution,country,scope,level,coverage_percent,deadline,description) VALUES(?,?,?,?,?,?,?,?)')
      ->execute([$in['title'],$in['institution'],$in['country'],$in['scope'],$in['level'],(int)$in['coverage_percent'],$in['deadline'],$in['description']]);
    out(['ok'=>true]);

  default: fail('Ação desconhecida.', 404);
}
} catch (PDOException $e) { fail('Erro na base de dados.', 500); }
