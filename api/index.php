<?php
require __DIR__.'/config.php';
session_set_cookie_params(['httponly'=>true,'samesite'=>'Lax']);
session_start();
if (empty($_SESSION['csrf'])) $_SESSION['csrf']=bin2hex(random_bytes(32));
header('Content-Type: application/json; charset=utf-8');
if ($_SERVER['REQUEST_METHOD']==='POST' && !hash_equals($_SESSION['csrf'], $_SERVER['HTTP_X_CSRF_TOKEN']??'')) { http_response_code(419); echo json_encode(['error'=>'Sessão expirada. Actualiza a página e tenta novamente.']); exit; }

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
  $s = db()->prepare('SELECT id,name,email,plan,premium_until,premium_started_at,subscription_status,is_admin,`role`,is_active,phone,country,city,birth_date,institution,education,academic_level FROM users WHERE id=?');
  $s->execute([$_SESSION['uid']]); $u = $s->fetch();
  if ($u && $u['plan']==='premium' && $u['premium_until'] && $u['premium_until'] < date('Y-m-d')) {
    notice((int)$u['id'],'subscription','premium:expiry:0','A tua subscrição Premium expirou.','subscription');
    db()->prepare("UPDATE users SET plan='basico',subscription_status='expired' WHERE id=?")->execute([$u['id']]); $u['plan']='basico'; $u['subscription_status']='expired';
  }
  if ($u && !$u['is_active']) { session_destroy(); return null; }
  if ($u) $u['role'] = $u['is_admin'] ? 'admin' : $u['role'];
  return $u ?: null;
}
function need(): array { return user() ?? fail('Inicia sessão para continuar.', 401); }
function admin(): array { $u=need(); if (!$u['is_admin']) fail('Sem permissão.',403); return $u; }
function mentor(): array { $u=need(); if ($u['is_admin'] || $u['role']!=='mentor') fail('Acesso exclusivo a mentores.',403); return $u; }
function premium(): array { $u=need(); if ($u['plan']!=='premium' || !$u['premium_until'] || $u['premium_until']<date('Y-m-d')) fail('Esta funcionalidade requer Premium activo.',403); return $u; }
function mentorCountries(): array { return ['Angola','Brasil','Estados Unidos','Portugal','Itália','Roménia','China','Canadá','Reino Unido','França','Alemanha','África do Sul','Japão','Austrália']; }
function mentorEducation(): array { return ['Curso técnico','Licenciatura','Pós-graduação','Mestrado','Doutoramento','Certificação profissional','Outra formação (detalhes na biografia)']; }
function mentorLevels(): array { return ['Curso técnico','Licenciatura','Pós-graduação','Mestrado','Doutoramento']; }
function mentorFields(): array { return ['Engenharia Informática','Engenharia','Tecnologias de Informação','Medicina','Saúde Pública','Enfermagem','Gestão','Economia','Direito','Educação','Ciências Sociais','Ciências Naturais','Agricultura','Artes e Humanidades']; }
function mentorSpecialties(): array { return array_merge(mentorFields(),['Candidaturas internacionais','Preparação de candidaturas','Cartas de motivação','Preparação para entrevistas','Procura de bolsas']); }
function mentorLanguages(): array { return ['Português','Inglês','Francês','Espanhol','Italiano','Alemão','Mandarim','Árabe','Russo','Japonês','Coreano','Neerlandês','Suaíli','Romeno']; }
function mentorAvailability(): array { return ['Tempo inteiro','Tempo parcial','Dias úteis','Fins de semana','Manhãs','Tardes','Noites','Por marcação','Online','Presencial']; }
function allowedOne($value,array $options,string $label): string { if(!is_string($value))fail('Selecciona uma opção válida para '.$label.'.');$value=trim($value);if(!in_array($value,$options,true))fail('Selecciona uma opção válida para '.$label.'.');return $value; }
function allowedMany($value,array $options,string $label,bool $required=true): string { if(!is_array($value))fail('Selecciona opções válidas para '.$label.'.');$items=[];foreach($value as $x){if(!is_string($x))fail('Existe uma opção inválida em '.$label.'.');$x=trim($x);if($x!=='')$items[]=$x;}$items=array_values(array_unique($items));foreach($items as $item)if(!in_array($item,$options,true))fail('Existe uma opção inválida em '.$label.'.');if($required&&!$items)fail('Selecciona pelo menos uma opção para '.$label.'.');return implode(', ',$items); }
function notice(int $uid,string $type,string $key,string $message,?string $link=null): void {
  db()->prepare('INSERT IGNORE INTO notifications(user_id,type,event_key,content,link) VALUES(?,?,?,?,?)')->execute([$uid,$type,$key,$message,$link]);
}
function notifyAll(string $type,string $key,string $message,?string $link=null): void {
  $s=db()->query("SELECT id FROM users WHERE is_active=1 AND `role`='student' AND is_admin=0"); foreach($s->fetchAll(PDO::FETCH_COLUMN) as $id) notice((int)$id,$type,$key,$message,$link);
}
function dueNotices(): void {
  $rows=db()->query("SELECT id,title,deadline,DATEDIFF(deadline,CURDATE()) days_left FROM scholarships WHERE status='published' AND active=1 AND DATEDIFF(deadline,CURDATE()) IN (7,2,0)")->fetchAll();
  foreach($rows as $r) { $days=(int)$r['days_left']; $type=$days===0?'scholarship_closed':'scholarship_deadline'; $message=$days===0?'A bolsa "'.$r['title'].'" encerra hoje.':'A bolsa "'.$r['title'].'" encerra em '.$days.' dias.'; notifyAll($type,'scholarship:'.$r['id'].':deadline:'.$days,$message,'scholarship:'.$r['id']); }
  $exp=db()->query("SELECT id,DATEDIFF(premium_until,CURDATE()) days_left FROM users WHERE plan='premium' AND DATEDIFF(premium_until,CURDATE()) IN (7,2,0)")->fetchAll();
  foreach($exp as $r) { $days=(int)$r['days_left']; notice((int)$r['id'],'subscription','premium:expiry:'.$days,'A tua subscrição Premium '.($days===0?'expira hoje.':'expira em '.$days.' dias.'),'subscription'); }
  db()->exec("UPDATE users SET subscription_status='expired',plan='basico' WHERE plan='premium' AND premium_until<CURDATE() AND subscription_status<>'expired'");
}

$a = $_GET['action'] ?? '';
$in = body();
$getActions=['me','scholarships','scholarship_detail','my_applications','application_detail','profile','saved','subscription','notifications','mentor_list','mentor_requests','mentor_profile','my_mentorships','mentor_chat','admin_dashboard','admin_scholarships','admin_users','admin_applications','admin_subscriptions','admin_notifications','admin_mentor_connections','admin_mentor_profile'];
if (in_array($a,$getActions,true) && $_SERVER['REQUEST_METHOD']!=='GET' && !in_array($a,['profile','saved','mentor_chat'],true)) fail('Método não permitido.',405);
if (!in_array($a,$getActions,true) && $_SERVER['REQUEST_METHOD']!=='POST') fail('Método não permitido.',405);
if (in_array($a,['admin_mentor_save','admin_mentor_update'],true)) {
  $in['country']=allowedOne($in['country']??'',mentorCountries(),'país');
  $in['education']=allowedOne($in['education']??'',mentorEducation(),'formação académica');
  $in['countries']=allowedMany($in['countries']??[],mentorCountries(),'países de experiência',false);
  $in['fields']=allowedMany($in['fields']??[],mentorFields(),'áreas de formação');
  $in['levels']=allowedMany($in['levels']??[],mentorLevels(),'níveis académicos');
  $in['languages']=allowedMany($in['languages']??[],mentorLanguages(),'idiomas');
  $in['specialties']=allowedMany($in['specialties']??[],mentorSpecialties(),'especialidades');
  $in['availability']=allowedMany($in['availability']??[],mentorAvailability(),'disponibilidade');
}
try {
switch ($a) {
  case 'register':
    $n=trim($in['name']??''); $e=strtolower(trim($in['email']??'')); $p=$in['password']??'';
    if ($n===''||!filter_var($e,FILTER_VALIDATE_EMAIL)||strlen($p)<8) fail('Preenche nome, email válido e palavra-passe com 8+ caracteres.');
    $s=db()->prepare('SELECT 1 FROM users WHERE email=?'); $s->execute([$e]);
    if ($s->fetch()) fail('Este email já tem conta. Inicia sessão.', 409);
    db()->prepare('INSERT INTO users(name,email,password_hash,`role`) VALUES(?,?,?,\'student\')')->execute([$n,$e,password_hash($p,PASSWORD_DEFAULT)]);
    session_regenerate_id(true); $_SESSION['uid']=(int)db()->lastInsertId(); out(['user'=>user()]);

  case 'login':
    $s=db()->prepare('SELECT id,password_hash,is_active FROM users WHERE email=?'); $s->execute([strtolower(trim($in['email']??''))]); $r=$s->fetch();
    if (!$r || !$r['is_active'] || !password_verify($in['password']??'', $r['password_hash'])) fail('Email ou palavra-passe incorretos.', 401);
    session_regenerate_id(true); $_SESSION['uid']=(int)$r['id']; out(['user'=>user()]);

  case 'logout': session_destroy(); out(['ok'=>true]);
  case 'me': dueNotices(); out(['user'=>user(), 'price'=>PREMIUM_PRICE, 'csrf'=>$_SESSION['csrf']]);

  case 'scholarships':
    $u=user(); if($u && $u['role']==='mentor') fail('O catálogo de bolsas é uma área de estudantes e visitantes.',403);
    $w=["active=1","status='published'",'deadline>=CURDATE()']; $p=[];
    foreach (['country','scope','level'] as $f) if (!empty($_GET[$f])) { $w[]="$f=?"; $p[]=$_GET[$f]; }
    if (!empty($_GET['q'])) { $w[]='(title LIKE ? OR institution LIKE ?)'; $p[]='%'.$_GET['q'].'%'; $p[]='%'.$_GET['q'].'%'; }
    $s=db()->prepare('SELECT * FROM scholarships WHERE '.implode(' AND ',$w).' ORDER BY deadline'); $s->execute($p);
    $rows=$s->fetchAll(); $applied=[];
    if ($u){ $x=db()->prepare('SELECT scholarship_id FROM applications WHERE user_id=?'); $x->execute([$u['id']]); $applied=$x->fetchAll(PDO::FETCH_COLUMN); }
    $saved=[]; if($u){$x=db()->prepare('SELECT scholarship_id FROM saved_scholarships WHERE user_id=?');$x->execute([$u['id']]);$saved=array_map('intval',$x->fetchAll(PDO::FETCH_COLUMN));}
    out(['items'=>$rows,'applied'=>array_map('intval',$applied),'saved'=>$saved]);

  case 'apply': // plano básico e premium podem candidatar-se
    $u=need(); if ($u['is_admin'] || $u['role']!=='student') fail('Apenas estudantes podem candidatar-se a bolsas.',403); $sid=(int)($in['scholarship_id']??0); $m=trim($in['motivation']??'');
    if (strlen($m)<30) fail('Escreve uma carta de motivação com pelo menos 30 caracteres.');
    $s=db()->prepare('SELECT 1 FROM scholarships WHERE id=? AND active=1 AND deadline>=CURDATE()'); $s->execute([$sid]);
    if (!$s->fetch()) fail('Bolsa não disponível.', 404);
    try { db()->prepare('INSERT INTO applications(user_id,scholarship_id,motivation) VALUES(?,?,?)')->execute([$u['id'],$sid,$m]); }
    catch (PDOException $e) { fail('Já te inscreveste nesta bolsa.', 409); }
    $aid=(int)db()->lastInsertId(); db()->prepare("INSERT INTO application_history(application_id,changed_by,new_status) VALUES(?,?,'submetida')")->execute([$aid,$u['id']]); notice((int)$u['id'],'application','application:'.$aid.':submitted','A tua candidatura foi submetida.','application:'.$aid); out(['ok'=>true]);

  case 'my_applications':
    $u=need(); if($u['role']==='mentor')fail('Esta área está reservada a estudantes.',403); $s=db()->prepare('SELECT a.id,a.status,a.created_at,a.motivation,s.title,s.country,s.institution,s.deadline FROM applications a JOIN scholarships s ON s.id=a.scholarship_id WHERE a.user_id=? ORDER BY a.created_at DESC');
    $s->execute([$u['id']]); out(['items'=>$s->fetchAll()]);
  case 'application_detail':
    $u=need();if($u['role']==='mentor')fail('Esta área está reservada a estudantes e administradores.',403);$id=(int)($_GET['id']??0);$sql='SELECT a.*,s.title,s.institution,s.country,s.deadline FROM applications a JOIN scholarships s ON s.id=a.scholarship_id WHERE a.id=?';$args=[$id];if(!$u['is_admin']){$sql.=' AND a.user_id=?';$args[]=$u['id'];}$s=db()->prepare($sql);$s->execute($args);$item=$s->fetch();if(!$item)fail('Candidatura não encontrada.',404);$h=db()->prepare('SELECT h.old_status,h.new_status,h.created_at,u.name changed_by FROM application_history h LEFT JOIN users u ON u.id=h.changed_by WHERE h.application_id=? ORDER BY h.created_at');$h->execute([$id]);out(['item'=>$item,'history'=>$h->fetchAll()]);
  case 'scholarship_detail':
    $u=user();if($u&&$u['role']==='mentor')fail('O catálogo de bolsas não está disponível no painel do mentor.',403);$id=(int)($_GET['id']??0);$q=db()->prepare('SELECT * FROM scholarships WHERE id=?'.($u&&$u['is_admin']?'':' AND status=\'published\''));$q->execute([$id]);$item=$q->fetch();if(!$item)fail('Bolsa não encontrada.',404);out(['item'=>$item]);
  case 'application_withdraw':
    $u=need();if($u['role']!=='student')fail('Apenas estudantes podem retirar candidaturas.',403);$id=(int)($in['id']??0);$q=db()->prepare("SELECT status FROM applications WHERE id=? AND user_id=? AND status IN ('submetida','em_analise')");$q->execute([$id,$u['id']]);$old=$q->fetchColumn();if(!$old)fail('Esta candidatura já não pode ser retirada.',409);db()->prepare("UPDATE applications SET status='retirada' WHERE id=? AND user_id=?")->execute([$id,$u['id']]);db()->prepare("INSERT INTO application_history(application_id,changed_by,old_status,new_status) VALUES(?,?,?,'retirada')")->execute([$id,$u['id'],$old]);out(['ok'=>true]);

  case 'upgrade':
    // SIMULAÇÃO: marca como pago de imediato. Em produção, cria o pagamento no gateway
    // (ex.: Multicaixa Express, Stripe, PayPal) e só ativa o premium no webhook de confirmação.
    $u=need(); if ($u['is_admin'] || $u['role']!=='student') fail('As contas administrativas não podem subscrever o Premium.',403); $ref='DEMO-'.strtoupper(bin2hex(random_bytes(4)));$method=$in['payment_method']??'reference_demo';if(!in_array($method,['multicaixa_demo','transfer_demo','reference_demo'],true))fail('Método demonstrativo inválido.');
    db()->prepare("INSERT INTO payments(user_id,amount,reference,status,payment_method) VALUES(?,?,?,'pago',?)")->execute([$u['id'],PREMIUM_PRICE,$ref,$method]);
    $from = ($u['plan']==='premium' && $u['premium_until']) ? $u['premium_until'] : date('Y-m-d');
    db()->prepare("UPDATE users SET plan='premium',premium_started_at=CURDATE(),subscription_status='active',premium_until=DATE_ADD(?, INTERVAL 30 DAY) WHERE id=?")->execute([$from,$u['id']]);
    notice((int)$u['id'],'subscription','premium:activated:'.$ref,'A subscrição Premium foi activada. Ref. '.$ref);
    out(['user'=>user(),'reference'=>$ref]);

  case 'mentorship':
    need(); fail('Escolhe um mentor e envia o pedido pelo painel de mentoria.',410);

  case 'admin_publish': // só administradores
    $u=admin();
    foreach (['title','institution','country','scope','level','coverage_percent','deadline','description'] as $k) if (empty($in[$k])) fail("Campo em falta: $k");
    db()->prepare("INSERT INTO scholarships(title,institution,country,scope,level,coverage_percent,deadline,description,status) VALUES(?,?,?,?,?,?,?,?, 'published')")
      ->execute([$in['title'],$in['institution'],$in['country'],$in['scope'],$in['level'],(int)$in['coverage_percent'],$in['deadline'],$in['description']]);
    $sid=(int)db()->lastInsertId(); notifyAll('scholarship','scholarship:'.$sid.':published','Nova bolsa publicada: '.$in['title'],'scholarship:'.$sid);
    out(['ok'=>true]);

  case 'profile':
    $u=need();
    if($u['role']==='mentor')fail('Consulta o teu perfil profissional no painel do mentor.',403);
    if($_SERVER['REQUEST_METHOD']==='GET') out(['user'=>$u]);
    $allowed=['name','phone','country','city','birth_date','institution','education','academic_level']; $set=[];$vals=[];
    foreach($allowed as $f) if(array_key_exists($f,$in)){ $v=trim((string)$in[$f]); if($f==='name' && $v==='') fail('O nome é obrigatório.'); if($f==='birth_date' && $v!=='' && !preg_match('/^\d{4}-\d{2}-\d{2}$/',$v)) fail('Data de nascimento inválida.'); $set[]="$f=?";$vals[]=$v===''?null:$v; }
    if($set){$vals[]=$u['id'];db()->prepare('UPDATE users SET '.implode(',',$set).' WHERE id=?')->execute($vals);} out(['user'=>user()]);

  case 'saved':
    $u=need();if($u['role']==='mentor')fail('Os favoritos estão reservados a estudantes.',403); if($_SERVER['REQUEST_METHOD']==='GET'){ $s=db()->prepare('SELECT s.* FROM saved_scholarships f JOIN scholarships s ON s.id=f.scholarship_id WHERE f.user_id=? ORDER BY f.created_at DESC');$s->execute([$u['id']]);out(['items'=>$s->fetchAll()]); }
    $sid=(int)($in['scholarship_id']??0); if($sid<1) fail('Bolsa inválida.');
    $s=db()->prepare('SELECT 1 FROM saved_scholarships WHERE user_id=? AND scholarship_id=?');$s->execute([$u['id'],$sid]);
    if($s->fetch()) db()->prepare('DELETE FROM saved_scholarships WHERE user_id=? AND scholarship_id=?')->execute([$u['id'],$sid]); else db()->prepare('INSERT INTO saved_scholarships(user_id,scholarship_id) VALUES(?,?)')->execute([$u['id'],$sid]); out(['saved'=>!$s->rowCount()]);

  case 'subscription':
    $u=need(); if($u['is_admin']||$u['role']==='mentor')fail('Esta área está reservada a estudantes.',403); $s=db()->prepare('SELECT amount,reference,payment_method,status,created_at FROM payments WHERE user_id=? ORDER BY created_at DESC');$s->execute([$u['id']]);out(['user'=>$u,'payments'=>$s->fetchAll(),'price'=>PREMIUM_PRICE]);

  case 'notifications':
    $u=need(); dueNotices();$scope=$u['role']==='mentor'?" AND type IN ('mentorship','message')":'';$s=db()->prepare('SELECT * FROM notifications WHERE user_id=?'.$scope.' ORDER BY created_at DESC LIMIT 100');$s->execute([$u['id']]);$items=$s->fetchAll();$c=db()->prepare('SELECT COUNT(*) FROM notifications WHERE user_id=? AND is_read=0'.$scope);$c->execute([$u['id']]);out(['items'=>$items,'unread'=>(int)$c->fetchColumn()]);
  case 'notification_read':
    $u=need();$id=(int)($in['id']??0);db()->prepare('UPDATE notifications SET is_read=1 WHERE id=? AND user_id=?')->execute([$id,$u['id']]);out(['ok'=>true]);
  case 'notifications_read_all':
    $u=need();db()->prepare('UPDATE notifications SET is_read=1 WHERE user_id=?')->execute([$u['id']]);out(['ok'=>true]);
  case 'notification_delete':
    $u=need();db()->prepare('DELETE FROM notifications WHERE id=? AND user_id=?')->execute([(int)($in['id']??0),$u['id']]);out(['ok'=>true]);

  case 'mentor_list':
    $viewer=premium();if($viewer['role']!=='student'||$viewer['is_admin'])fail('Apenas estudantes Premium podem consultar mentores.',403);$busy=db()->prepare("SELECT id FROM mentor_connections WHERE student_id=? AND status IN ('pending','accepted') LIMIT 1");$busy->execute([$viewer['id']]);if($busy->fetch())out(['items'=>[],'blocked'=>true]);$rows=db()->query("SELECT u.id,u.name,u.country,p.biography,p.education,p.experience,p.countries,p.fields,p.levels,p.languages,p.specialties,p.availability FROM users u JOIN mentor_profiles p ON p.user_id=u.id WHERE u.`role`='mentor' AND u.is_active=1 ORDER BY u.name")->fetchAll();
    $sch=(int)($_GET['scholarship_id']??0);$target=null;if($sch){$q=db()->prepare('SELECT country,level,field_of_study,language FROM scholarships WHERE id=? AND status=\'published\'');$q->execute([$sch]);$target=$q->fetch();}
    foreach($rows as &$m){$tokens=[];if($target){$checks=['País'=>['country',['countries','experience']],'Nível'=>['level',['levels','experience']],'Área'=>['field_of_study',['fields','specialties','experience']],'Idioma'=>['language',['languages']]];foreach($checks as $label=>[$tf,$mfs]){$v=mb_strtolower(trim((string)($target[$tf]??'')));if($v==='')continue;foreach($mfs as $mf)if(str_contains(mb_strtolower((string)($m[$mf]??'')),$v)){$tokens[]=$label;break;}}}$m['match_reasons']=$tokens;$m['match_percent']=$target?count($tokens)*25:null;}unset($m);
    usort($rows,fn($a,$b)=>($b['match_percent']??0)<=>($a['match_percent']??0));out(['items'=>$rows]);
  case 'mentor_profile':
    $u=mentor();$s=db()->prepare('SELECT u.id,u.name,u.email,u.phone,u.country,p.* FROM users u JOIN mentor_profiles p ON p.user_id=u.id WHERE u.id=?');$s->execute([$u['id']]);out(['profile'=>$s->fetch()]);
  case 'mentor_request':
    $u=premium();if($u['role']!=='student'||$u['is_admin'])fail('Apenas estudantes Premium podem pedir mentoria.',403);$mid=(int)($in['mentor_id']??0);$sid=!empty($in['scholarship_id'])?(int)$in['scholarship_id']:null;$msg=trim($in['message']??'');if(mb_strlen($msg)>2000)fail('Mensagem inicial demasiado longa.');if($sid){$sh=db()->prepare("SELECT id FROM scholarships WHERE id=? AND status='published' AND active=1");$sh->execute([$sid]);if(!$sh->fetch())fail('Bolsa associada indisponível.',404);}
    $m=db()->prepare("SELECT id FROM users WHERE id=? AND `role`='mentor' AND is_active=1");$m->execute([$mid]);if(!$m->fetch())fail('Mentor indisponível.',404);
    db()->beginTransaction();try{$lock=db()->prepare('SELECT id FROM users WHERE id=? FOR UPDATE');$lock->execute([$u['id']]);$q=db()->prepare("SELECT id FROM mentor_connections WHERE student_id=? AND status IN ('pending','accepted') FOR UPDATE");$q->execute([$u['id']]);if($q->fetch()) {db()->rollBack();fail('Já tens um pedido pendente ou uma mentoria activa.',409);}db()->prepare('INSERT INTO mentor_connections(student_id,mentor_id,scholarship_id,initial_message) VALUES(?,?,?,?)')->execute([$u['id'],$mid,$sid,$msg?:null]);$cid=(int)db()->lastInsertId();db()->commit();}catch(Throwable $e){if(db()->inTransaction())db()->rollBack();throw $e;}notice($mid,'mentorship','connection:'.$cid.':requested',$u['name'].' solicitou uma ligação de mentoria.','mentor_request:'.$cid);out(['ok'=>true]);
  case 'mentor_requests':
    $u=mentor();$s=db()->prepare("SELECT c.*,st.name student_name,st.institution,st.education,st.academic_level,sh.title scholarship_title FROM mentor_connections c JOIN users st ON st.id=c.student_id LEFT JOIN scholarships sh ON sh.id=c.scholarship_id WHERE c.mentor_id=? ORDER BY c.requested_at DESC");$s->execute([$u['id']]);out(['items'=>$s->fetchAll()]);
  case 'mentor_decide':
    $u=mentor();$cid=(int)($in['connection_id']??0);$decision=$in['decision']??'';if(!in_array($decision,['accepted','rejected'],true))fail('Decisão inválida.');$q=db()->prepare("UPDATE mentor_connections SET status=?,decided_at=NOW() WHERE id=? AND mentor_id=? AND status='pending'");$q->execute([$decision,$cid,$u['id']]);if(!$q->rowCount())fail('Pedido não encontrado ou já decidido.',404);$s=db()->prepare('SELECT student_id FROM mentor_connections WHERE id=?');$s->execute([$cid]);$student=(int)$s->fetchColumn();notice($student,'mentorship','connection:'.$cid.':'.$decision,'O teu pedido de mentoria foi '.($decision==='accepted'?'aceite.':'recusado.'),$decision==='accepted'?'chat:'.$cid:'mentorship:'.$cid);out(['ok'=>true]);
  case 'mentor_end':
    $u=need();$cid=(int)($in['connection_id']??0);$q=db()->prepare("UPDATE mentor_connections SET status='ended',ended_at=NOW() WHERE id=? AND student_id=? AND status='accepted'");$q->execute([$cid,$u['id']]);if(!$q->rowCount())fail('Ligação activa não encontrada.',404);$s=db()->prepare('SELECT mentor_id FROM mentor_connections WHERE id=?');$s->execute([$cid]);notice((int)$s->fetchColumn(),'mentorship','connection:'.$cid.':ended','A ligação de mentoria foi terminada pelo estudante.','mentorship:'.$cid);out(['ok'=>true]);
  case 'my_mentorships':
    $u=need();if($u['role']!=='student')fail('Esta área está reservada a estudantes.',403);$s=db()->prepare('SELECT c.*,m.name mentor_name,p.biography,p.education mentor_education,p.experience,p.specialties,p.fields,p.languages FROM mentor_connections c JOIN users m ON m.id=c.mentor_id LEFT JOIN mentor_profiles p ON p.user_id=m.id WHERE c.student_id=? ORDER BY c.requested_at DESC');$s->execute([$u['id']]);out(['items'=>$s->fetchAll()]);
  case 'mentor_cancel':
    $u=need();$id=(int)($in['connection_id']??0);$q=db()->prepare("UPDATE mentor_connections SET status='cancelled',ended_at=NOW() WHERE id=? AND student_id=? AND status='pending'");$q->execute([$id,$u['id']]);if(!$q->rowCount())fail('Pedido pendente não encontrado.',404);out(['ok'=>true]);
  case 'mentor_chat':
    $u=need();$cid=(int)($_GET['connection_id']??$in['connection_id']??0);$q=db()->prepare('SELECT * FROM mentor_connections WHERE id=? AND (student_id=? OR mentor_id=?)');$q->execute([$cid,$u['id'],$u['id']]);$c=$q->fetch();if(!$c)fail('Conversa não encontrada.',404);if($u['id']!==$c['student_id']&&$u['id']!==$c['mentor_id'])fail('Sem permissão.',403);$isMentor=(int)$u['id']===(int)$c['mentor_id'];if($isMentor&&$u['role']!=='mentor')fail('Sem permissão.',403);
    if($_SERVER['REQUEST_METHOD']==='GET'){$s=db()->prepare('SELECT m.*,u.name sender_name FROM mentor_messages m JOIN users u ON u.id=m.sender_id WHERE m.connection_id=? ORDER BY m.id');$s->execute([$cid]);$messages=$s->fetchAll();db()->prepare('UPDATE mentor_messages SET read_at=NOW() WHERE connection_id=? AND sender_id<>? AND read_at IS NULL')->execute([$cid,$u['id']]);$sub=db()->prepare('SELECT st.plan,st.premium_until,mt.is_active mentor_active FROM users st JOIN users mt ON mt.id=? WHERE st.id=?');$sub->execute([$c['mentor_id'],$c['student_id']]);$studentPlan=$sub->fetch();$ro=$c['status']!=='accepted'||$studentPlan['plan']!=='premium'||$studentPlan['premium_until']<date('Y-m-d')||!$studentPlan['mentor_active']||!$u['is_active'];out(['items'=>$messages,'read_only'=>$ro]);}
    if($c['status']!=='accepted')fail('A conversa só está disponível após aprovação.',403);$student=db()->prepare('SELECT st.plan,st.premium_until,mt.is_active mentor_active FROM users st JOIN users mt ON mt.id=? WHERE st.id=?');$student->execute([$c['mentor_id'],$c['student_id']]);$sp=$student->fetch();if($sp['plan']!=='premium'||$sp['premium_until']<date('Y-m-d'))fail('O Premium expirou. A conversa está em modo de leitura.',403);if(!$sp['mentor_active'])fail('O mentor está inactivo. A conversa está em modo de leitura.',403);$msg=trim($in['message']??'');if($msg===''||mb_strlen($msg)>5000)fail('Mensagem inválida.');db()->prepare('INSERT INTO mentor_messages(connection_id,sender_id,message) VALUES(?,?,?)')->execute([$cid,$u['id'],$msg]);$other=$isMentor?(int)$c['student_id']:(int)$c['mentor_id'];notice($other,'message','message:'.$cid.':'.db()->lastInsertId(),'Recebeste uma nova mensagem de '.$u['name'].'.');out(['ok'=>true]);

  case 'admin_dashboard':
    admin();dueNotices();$counts=[];foreach(['users'=>'COUNT(*)','scholarships'=>'COUNT(*)','active_scholarships'=>"SUM(status='published' AND active=1 AND deadline>=CURDATE())",'closed_scholarships'=>"SUM(deadline<CURDATE() OR status='suspended')",'applications'=>'COUNT(*)','premium_users'=>"SUM(plan='premium' AND premium_until>=CURDATE())"] as $key=>$expr){$table=match($key){'users'=>'users','scholarships','active_scholarships','closed_scholarships'=>'scholarships','applications'=>'applications',default=>'users'};$counts[$key]=(int)(db()->query('SELECT '.$expr.' FROM '.$table)->fetchColumn()?:0);} $counts['mentors']=(int)db()->query("SELECT COUNT(*) FROM users WHERE `role`='mentor'")->fetchColumn();$counts['active_mentorships']=(int)db()->query("SELECT COUNT(*) FROM mentor_connections WHERE status='accepted'")->fetchColumn();$counts['recent']=db()->query("SELECT activity,happened_at FROM (SELECT CONCAT('Conta criada: ',name) activity,created_at happened_at FROM users UNION ALL SELECT CONCAT('Candidatura: ',u.name,' · ',s.title),a.created_at FROM applications a JOIN users u ON u.id=a.user_id JOIN scholarships s ON s.id=a.scholarship_id UNION ALL SELECT CONCAT('Pagamento: ',u.name,' · ',p.reference),p.created_at FROM payments p JOIN users u ON u.id=p.user_id UNION ALL SELECT CONCAT('Pedido de mentoria: ',u.name),c.requested_at FROM mentor_connections c JOIN users u ON u.id=c.student_id) recent_activity ORDER BY happened_at DESC LIMIT 12")->fetchAll();out($counts);
  case 'admin_scholarships':
    admin();$s=db()->query('SELECT * FROM scholarships ORDER BY created_at DESC');out(['items'=>$s->fetchAll()]);
  case 'admin_scholarship_save':
    admin();$id=(int)($in['id']??0);$fields=['title','institution','country','scope','level','coverage_percent','deadline','description'];foreach($fields as $f)if(!isset($in[$f])||trim((string)$in[$f])==='')fail('Campo obrigatório: '.$f);$status=$in['status']??'published';if(!in_array($status,['draft','published','suspended'],true))fail('Estado inválido.');$values=[];foreach($fields as $f)$values[]=$in[$f];$values[]=$in['field_of_study']??null;$values[]=$in['language']??null;$values[]=$status;
    if($id){$old=db()->prepare('SELECT status FROM scholarships WHERE id=?');$old->execute([$id]);$oldStatus=$old->fetchColumn();if($oldStatus===false)fail('Bolsa não encontrada.',404);db()->prepare('UPDATE scholarships SET title=?,institution=?,country=?,scope=?,level=?,coverage_percent=?,deadline=?,description=?,field_of_study=?,language=?,status=?,active=IF(?=\'published\',1,0) WHERE id=?')->execute([...array_slice($values,0,11),$status,$id]);if($status==='published'&&$oldStatus!=='published')notifyAll('scholarship','scholarship:'.$id.':published:'.date('Ymd'),'Nova bolsa publicada: '.$in['title'],'scholarship:'.$id);}else{db()->prepare('INSERT INTO scholarships(title,institution,country,scope,level,coverage_percent,deadline,description,field_of_study,language,status,active) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)')->execute([...array_slice($values,0,11),$status==='published'?1:0]);$sid=(int)db()->lastInsertId();if($status==='published')notifyAll('scholarship','scholarship:'.$sid.':published','Nova bolsa publicada: '.$in['title'],'scholarship:'.$sid);}out(['ok'=>true]);
  case 'admin_scholarship_delete':
    admin();$id=(int)($in['id']??0);$q=db()->prepare("UPDATE scholarships SET status='suspended',active=0 WHERE id=?");$q->execute([$id]);out(['ok'=>true]);
  case 'admin_users':
    admin();$q=trim($_GET['q']??'');$s=db()->prepare("SELECT u.id,u.name,u.email,u.`role`,u.plan,u.premium_until,u.subscription_status,u.is_admin,u.is_active,u.phone,u.country,u.city,u.institution,u.education,u.academic_level,u.created_at,p.biography,p.experience,p.specialties,p.fields,p.languages,p.availability,(SELECT m.name FROM mentor_connections c JOIN users m ON m.id=c.mentor_id WHERE c.student_id=u.id AND c.status='accepted' LIMIT 1) mentor_name FROM users u LEFT JOIN mentor_profiles p ON p.user_id=u.id WHERE u.name LIKE ? OR u.email LIKE ? ORDER BY u.created_at DESC LIMIT 200");$s->execute(['%'.$q.'%','%'.$q.'%']);out(['items'=>$s->fetchAll()]);
  case 'admin_user_status':
    admin();$id=(int)($in['id']??0);$active=(int)!!($in['active']??false);$q=db()->prepare('UPDATE users SET is_active=? WHERE id=? AND is_admin=0');$q->execute([$active,$id]);out(['ok'=>true]);
  case 'admin_mentor_save':
    admin();$name=trim($in['name']??'');$email=strtolower(trim($in['email']??''));$password=$in['password']??'';if($name===''||!filter_var($email,FILTER_VALIDATE_EMAIL)||strlen($password)<8)fail('Nome, email válido e palavra-passe de 8+ caracteres são obrigatórios.');db()->beginTransaction();try{$q=db()->prepare('INSERT INTO users(name,email,password_hash,`role`,phone,country) VALUES(?,?,?,\'mentor\',?,?)');$q->execute([$name,$email,password_hash($password,PASSWORD_DEFAULT),$in['phone']??null,$in['country']??null]);$mid=(int)db()->lastInsertId();db()->prepare('INSERT INTO mentor_profiles(user_id,biography,education,experience,countries,fields,levels,languages,specialties,availability) VALUES(?,?,?,?,?,?,?,?,?,?)')->execute([$mid,$in['biography']??null,$in['education']??null,$in['experience']??null,$in['countries']??null,$in['fields']??null,$in['levels']??null,$in['languages']??null,$in['specialties']??null,$in['availability']??null]);db()->commit();}catch(Throwable $e){if(db()->inTransaction())db()->rollBack();throw $e;}out(['ok'=>true,'id'=>$mid]);
  case 'admin_mentor_status':
    admin();$id=(int)($in['id']??0);$active=(int)!!($in['active']??false);$q=db()->prepare("UPDATE users SET is_active=? WHERE id=? AND `role`='mentor'");$q->execute([$active,$id]);if(!$active){$s=db()->prepare("SELECT id,student_id FROM mentor_connections WHERE mentor_id=? AND status IN ('pending','accepted')");$s->execute([$id]);foreach($s->fetchAll() as $r)notice((int)$r['student_id'],'mentorship','mentor:'.$id.':disabled:connection:'.$r['id'],'O mentor foi desactivado. A ligação foi preservada e a conversa está indisponível.');}out(['ok'=>true]);
  case 'admin_mentor_update':
    admin();$id=(int)($in['id']??0);$name=trim($in['name']??'');if($name==='')fail('O nome é obrigatório.');$q=db()->prepare("UPDATE users SET name=?,phone=?,country=? WHERE id=? AND `role`='mentor'");$q->execute([$name,$in['phone']??null,$in['country']??null,$id]);$fields=['biography','education','experience','countries','fields','levels','languages','specialties','availability'];$sets=[];$vals=[];foreach($fields as $f){$sets[]="$f=?";$vals[]=$in[$f]??null;}if($sets){$vals[]=$id;db()->prepare('UPDATE mentor_profiles SET '.implode(',',$sets).' WHERE user_id=?')->execute($vals);}out(['ok'=>true]);
  case 'admin_mentor_profile':
    admin();$id=(int)($_GET['id']??0);$q=db()->prepare("SELECT u.id,u.name,u.email,u.phone,u.country,p.biography,p.education,p.experience,p.countries,p.fields,p.levels,p.languages,p.specialties,p.availability FROM users u JOIN mentor_profiles p ON p.user_id=u.id WHERE u.id=? AND u.`role`='mentor'");$q->execute([$id]);$profile=$q->fetch();if(!$profile)fail('Mentor não encontrado.',404);out(['profile'=>$profile]);
  case 'admin_mentor_connections':
    admin();out(['items'=>db()->query('SELECT c.id,c.status,c.requested_at,c.decided_at,c.ended_at,m.name mentor_name,s.name student_name,s.email student_email,sh.title scholarship_title FROM mentor_connections c JOIN users m ON m.id=c.mentor_id JOIN users s ON s.id=c.student_id LEFT JOIN scholarships sh ON sh.id=c.scholarship_id ORDER BY c.requested_at DESC')->fetchAll()]);
  case 'admin_applications':
    admin();$s=db()->query('SELECT a.*,u.name student_name,u.email,s.title scholarship_title FROM applications a JOIN users u ON u.id=a.user_id JOIN scholarships s ON s.id=a.scholarship_id ORDER BY a.created_at DESC');out(['items'=>$s->fetchAll()]);
  case 'admin_application_status':
    $auser=admin();$id=(int)($in['id']??0);$st=$in['status']??'';if(!in_array($st,['submetida','em_analise','aceite','recusada','retirada'],true))fail('Estado inválido.');$q=db()->prepare('SELECT status,user_id FROM applications WHERE id=?');$q->execute([$id]);$old=$q->fetch();if(!$old)fail('Candidatura não encontrada.',404);db()->prepare('UPDATE applications SET status=? WHERE id=?')->execute([$st,$id]);db()->prepare('INSERT INTO application_history(application_id,changed_by,old_status,new_status) VALUES(?,?,?,?)')->execute([$id,$auser['id'],$old['status'],$st]);notice((int)$old['user_id'],'application','application:'.$id.':status:'.$st.':'.time(),'O estado da tua candidatura foi actualizado: '.$st.'.');out(['ok'=>true]);
  case 'admin_subscriptions':
    admin();out(['items'=>db()->query("SELECT u.id,u.name,u.email,u.plan,u.subscription_status,u.premium_started_at,u.premium_until,p.amount,p.reference,p.payment_method,p.status payment_status,p.created_at payment_date FROM users u LEFT JOIN payments p ON p.user_id=u.id ORDER BY p.created_at DESC")->fetchAll()]);
  case 'admin_notifications':
    admin();dueNotices();out(['items'=>db()->query('SELECT n.*,u.name recipient FROM notifications n JOIN users u ON u.id=n.user_id ORDER BY n.created_at DESC LIMIT 500')->fetchAll()]);

  default: fail('Ação desconhecida.', 404);
}
} catch (PDOException $e) { fail('Erro na base de dados.', 500); }
