const API = 'api/index.php';
const MENTOR_COUNTRIES = ['Angola','Brasil','Estados Unidos','Portugal','Itália','Roménia','China','Canadá','Reino Unido','França','Alemanha','África do Sul','Japão','Austrália'];
const MENTOR_EDUCATION = ['Curso técnico','Licenciatura','Pós-graduação','Mestrado','Doutoramento','Certificação profissional','Outra formação (detalhes na biografia)'];
const MENTOR_LEVELS = ['Curso técnico','Licenciatura','Pós-graduação','Mestrado','Doutoramento'];
const MENTOR_FIELDS = ['Engenharia Informática','Engenharia','Tecnologias de Informação','Medicina','Saúde Pública','Enfermagem','Gestão','Economia','Direito','Educação','Ciências Sociais','Ciências Naturais','Agricultura','Artes e Humanidades'];
const MENTOR_SPECIALTIES = [...MENTOR_FIELDS,'Candidaturas internacionais','Preparação de candidaturas','Cartas de motivação','Preparação para entrevistas','Procura de bolsas'];
const MENTOR_LANGUAGES = ['Português','Inglês','Francês','Espanhol','Italiano','Alemão','Mandarim','Árabe','Russo','Japonês','Coreano','Neerlandês','Suaíli','Romeno'];
const MENTOR_AVAILABILITY = ['Tempo inteiro','Tempo parcial','Dias úteis','Fins de semana','Manhãs','Tardes','Noites','Por marcação','Online','Presencial'];
const COUNTRIES = ['Angola','Brasil','Estados Unidos','Portugal','Itália','Roménia'];
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const state = { user: null, price: 0, csrf: '', country: '', applied: [], saved: [], items: [] };

function multiValue(value) { return String(value ?? '').split(',').map(x => x.trim()).filter(Boolean); }
function mentorSelect(name, label, values, value='', multiple=false, required=true) {
  const selected = multiple ? multiValue(value) : [String(value || '')];
  return `<label>${label}<select class="mentor-select" name="${name}" ${required?'required':''}><option value="">Escolhe uma opção</option>${values.map(v=>`<option value="${esc(v)}" ${selected.includes(v)?'selected':''}>${esc(v)}</option>`).join('')}</select></label>`;
}
function mentorChoiceGroup(name,label,values,value='',required=false) {
  const selected=new Set(Array.isArray(value)?value:multiValue(value));
  return `<fieldset class="choice-group" data-choice-group="${name}" data-label="${esc(label)}" data-required="${required?'true':'false'}"><legend>${esc(label)}${required?' *':''}</legend><div class="choice-grid">${values.map(v=>`<label class="choice-pill"><input type="checkbox" name="${name}[]" value="${esc(v)}" ${selected.has(v)?'checked':''}><span>${esc(v)}</span></label>`).join('')}</div>${required?'<small class="fieldhint">Selecciona pelo menos uma opção.</small>':''}</fieldset>`;
}
function formValues(form) {
  const values = Object.fromEntries(new FormData(form));
  form.querySelectorAll('[data-choice-group]').forEach(g => { const name=g.dataset.choiceGroup;delete values[`${name}[]`];values[name]=Array.from(g.querySelectorAll('input:checked'), x => x.value); });
  return values;
}

async function api(action, data, qs = '') {
  const r = await fetch(`${API}?action=${action}${qs}`, data
    ? { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': state.csrf }, body: JSON.stringify(data) } : {});
  const j = await r.json().catch(() => ({ error: 'O servidor devolveu uma resposta inválida. Tenta novamente.' }));
  if (!r.ok) throw Object.assign(new Error(j.error || 'Erro inesperado.'), { status: r.status, field: j.field });
  return j;
}
let toastTm; function toast(m, type = 'ok') { const t = $('#toast'); t.textContent = (type === 'ok' ? '✓ ' : '⚠ ') + m; t.className = 'on ' + type; clearTimeout(toastTm); toastTm = setTimeout(() => t.classList.remove('on'), 4200); }
const money = n => Number(n).toLocaleString('pt-PT') + ' Kz';
const fmtDate = d => new Date(d + 'T00:00').toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' });

function modal(html, onSubmit) {
  const f = $('#dlgForm'); f.innerHTML = html + '<div class="err" id="err"></div>';
  f.onsubmit = async e => {
    if (e.submitter?.value === 'cancel') return;
    e.preventDefault();
    const btn = e.submitter, label = btn?.textContent;
    f.querySelectorAll('[aria-invalid]').forEach(i => i.removeAttribute('aria-invalid')); $('#err').textContent = '';
    if (btn) { btn.disabled = true; btn.textContent = 'A processar…'; }
    try { await onSubmit(formValues(f)); $('#dlg').close(); }
    catch (x) {
      $('#err').textContent = x instanceof TypeError ? 'Sem ligação ao servidor. Confirma que o Apache e o MySQL estão ligados.' : x.message;
      const bad = x.field && f.elements[x.field]; if (bad) { bad.setAttribute('aria-invalid', 'true'); bad.focus(); bad.select?.(); }
    } finally { if (btn) { btn.disabled = false; btn.textContent = label; } }
  };
  f.querySelectorAll('button[value="cancel"]').forEach(b => { b.type = 'button'; b.onclick = () => $('#dlg').close(); });
  $('#dlg').showModal();
}

/* ---------- Navegação e conta ---------- */
function renderNav() {
  const u = state.user;
  $('#nav').innerHTML = u
    ? `<span>${esc(u.name)} · ${u.plan === 'premium' ? 'Premium' : 'Básico'}</span>
       <button class="btn ghost" id="bAcc">As minhas candidaturas</button><button class="btn ghost" id="bOut">Sair</button>`
    : `<button class="btn ghost" id="bIn">Entrar</button><button class="btn" id="bUp">Criar conta</button>`;
  $('#bIn')?.addEventListener('click', loginDlg); $('#bUp')?.addEventListener('click', registerDlg);
  $('#bOut')?.addEventListener('click', async () => { await api('logout', {}); state.user = null; boot(); toast('Sessão terminada.'); });
  $('#bAcc')?.addEventListener('click', async () => { await loadAccount(); $('#account').scrollIntoView({ behavior: 'smooth' }); });
}
function loginDlg() {
  modal(`<h2>Entrar</h2><label>Email<input name="email" type="email" required autocomplete="email" autofocus></label>
    <label>Palavra-passe<span class="pw"><input name="password" id="lgPw" type="password" required autocomplete="current-password"><button type="button" class="ghost" id="lgShow" aria-label="Mostrar palavra-passe">Mostrar</button></span></label>
    <div class="row"><button class="btn ghost" value="cancel">Cancelar</button><button class="btn">Entrar</button></div>
    <p class="meta">Ainda não tens conta? <a href="#" id="lgReg">Criar conta grátis</a></p>`,
    async d => { state.user = (await api('login', d)).user; await boot(); toast('Sessão iniciada. Bem-vindo, ' + state.user.name.split(' ')[0] + '.'); });
  $('#lgShow').onclick = e => { const p = $('#lgPw'), h = p.type === 'password'; p.type = h ? 'text' : 'password'; e.target.textContent = h ? 'Esconder' : 'Mostrar'; };
  $('#lgReg').onclick = e => { e.preventDefault(); registerDlg(); };
}
function registerDlg() {
  modal(`<h2>Criar conta grátis</h2><label>Nome<input name="name" required autocomplete="name"></label>
    <label>Email<input name="email" type="email" required autocomplete="email"></label>
    <label>Palavra-passe (8+ caracteres)<input name="password" type="password" minlength="8" required autocomplete="new-password"></label>
    <div class="row"><button class="btn ghost" value="cancel" formnovalidate>Cancelar</button><button class="btn">Criar conta</button></div>`,
    async d => { state.user = (await api('register', d)).user; await boot(); toast('Conta criada. Já podes candidatar-te.'); });
}

/* ---------- Lista de bolsas ---------- */
function renderChips() {
  $('#countries').innerHTML = ['', ...COUNTRIES].map(c =>
    `<button class="chip" aria-pressed="${state.country === c}" data-c="${c}">${c || 'Todos os países'}</button>`).join('');
}
async function loadList() {
  const p = new URLSearchParams({ country: state.country, level: $('#fLevel').value, scope: $('#fScope').value, q: $('#q').value });
  const j = await api('scholarships', null, '&' + p);
  state.items = j.items; state.applied = j.applied; state.saved = j.saved || [];
  $('#list').innerHTML = j.items.length ? j.items.map(card).join('')
    : '<p>Nenhuma bolsa aberta com estes filtros. Remove um filtro para ver mais resultados.</p>';
}
function card(s) {
  const done = state.applied.includes(+s.id), prem = state.user?.plan === 'premium', isAdmin=state.user?.role==='admin';
  const saved=state.saved.includes(+s.id);
  return `<article class="card">
    <div><h3>${esc(s.title)}</h3>
      <div class="meta">${esc(s.institution)} · ${esc(s.country)} · ${esc(s.level)}</div>
      <p>${esc(s.description)}</p></div>
    <div class="cov"><b>${s.coverage_percent}%</b><small>comparticipado</small><div class="bar"><i style="width:${s.coverage_percent}%"></i></div></div>
    <div class="actions">
      <span class="tag">${s.scope === 'interna' ? 'Interna' : 'Externa'}</span><span class="tag">Até ${fmtDate(s.deadline)}</span>
      ${isAdmin?'<button class="btn ghost" disabled title="Apenas estudantes podem candidatar-se">Candidaturas reservadas a estudantes</button>':`<button class="btn" data-apply="${s.id}" ${done ? 'disabled' : ''}>${done ? 'Candidatura enviada' : 'Candidatar-me'}</button>`}
      ${state.user?`<button class="btn ghost" data-save="${s.id}">${saved?'Remover guardada':'Guardar bolsa'}</button>`:''}
      ${isAdmin?'':`<button class="btn ghost" data-mentor="${s.id}">${prem ? 'Pedir mentoria' : 'Mentoria (premium)'}</button>`}
    </div></article>`;
}
function applyDlg(id) {
  if (!state.user) return registerDlg();
  if (state.user.role==='admin') return toast('Apenas estudantes podem candidatar-se a bolsas.');
  const s = state.items.find(x => +x.id === id);
  modal(`<h2>${esc(s.title)}</h2><label>Carta de motivação<textarea name="motivation" rows="6" minlength="30" required placeholder="Porque mereces esta bolsa e o que vais estudar."></textarea></label>
    <div class="row"><button class="btn ghost" value="cancel" formnovalidate>Cancelar</button><button class="btn">Enviar candidatura</button></div>`,
    async d => { await api('apply', { scholarship_id: id, motivation: d.motivation }); await loadList(); toast('Candidatura enviada.'); });
}
function mentorDlg(id) {
  state.preMentor = id;
  if (!state.user) return registerDlg();
  if (state.user.plan !== 'premium') return upgradeDlg();
  loadAccount().then(()=>studentTab('mentors',state.user,[],{payments:[]}));
}

/* ---------- Planos ---------- */
function renderPlans() {
  const restricted=state.user?.role==='admin'||state.user?.role==='mentor';
  $('#plans').hidden=restricted;
  if(restricted){$('#plans').innerHTML='';return;}
  const prem = state.user?.plan === 'premium';
  $('#plans').innerHTML = `
  <div class="plan"><h2>Básico</h2><div class="price">Grátis</div>
    <ul><li>Ver todas as bolsas abertas</li><li>Candidaturas ilimitadas</li><li>Acompanhar o estado de cada candidatura</li></ul>
    ${state.user ? '' : '<button class="btn ghost" id="pBasic">Criar conta grátis</button>'}</div>
  <div class="plan pro"><h2>Premium</h2><div class="price">${money(state.price)}<small style="font-size:1rem;font-weight:400"> /mês</small></div>
    <ul><li>Tudo do plano básico</li><li>Mentoria direta com atendimento personalizado</li><li>Apoio na carta de motivação e na entrevista</li></ul>
    <button class="btn sun" id="pPrem" ${prem ? 'disabled' : ''}>${prem ? 'Plano ativo até ' + fmtDate(state.user.premium_until) : 'Passar a premium'}</button></div>`;
  $('#pBasic')?.addEventListener('click', registerDlg);
  $('#pPrem')?.addEventListener('click', upgradeDlg);
}
function upgradeDlg() {
  if (!state.user) return registerDlg();
  if (state.user.role==='admin') return toast('As contas administrativas não podem subscrever o Premium.');
  modal(`<h2>Plano premium</h2><p>${money(state.price)} por 30 dias, com acesso à mentoria.</p>
    <p class="meta">Pagamento demonstrativo: nenhuma cobrança ou transferência real será feita.</p><label>Método de demonstração<select name="payment_method"><option value="multicaixa_demo">Multicaixa Express (simulado)</option><option value="transfer_demo">Transferência (simulada)</option><option value="reference_demo">Referência fictícia</option></select></label>
    <div class="row"><button class="btn ghost" value="cancel" formnovalidate>Cancelar</button><button class="btn sun">Confirmar subscrição</button></div>`,
    async d => { const j = await api('upgrade', d); state.user = j.user; await boot(); toast('Premium demonstrativo activo. Ref. ' + j.reference); });
}

/* ---------- Conta e administração ---------- */
async function loadAccount() {
  if (!state.user) return;
  const { items } = await api('my_applications');
  const st = { submetida: 'Submetida', em_analise: 'Em análise', aceite: 'Aceite', recusada: 'Recusada' };
  const el = $('#account'); el.hidden = false;
  el.innerHTML = `<h2>As minhas candidaturas</h2>` + (items.length
    ? `<table>${items.map(i => `<tr><td>${esc(i.title)}</td><td>${esc(i.country)}</td><td>${st[i.status]}</td></tr>`).join('')}</table>`
    : '<p>Ainda não te candidataste a nenhuma bolsa.</p>');
}
function renderAdmin() {
  const el = $('#admin'); el.hidden = !state.user?.is_admin; if (el.hidden) return;
  el.innerHTML = `<h2>Publicar bolsa</h2><form id="aForm" style="display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(200px,1fr))">
    <label>Título<input name="title" required></label><label>Instituição<input name="institution" required></label>
    <label>País<select name="country">${COUNTRIES.map(c => `<option>${c}</option>`).join('')}</select></label>
    <label>Âmbito<select name="scope"><option value="externa">Externa</option><option value="interna">Interna</option></select></label>
    <label>Nível<select name="level"><option>Licenciatura</option><option>Mestrado</option><option>Doutoramento</option><option>Curso técnico</option></select></label>
    <label>Comparticipação (%)<input name="coverage_percent" type="number" min="1" max="100" required></label>
    <label>Prazo<input name="deadline" type="date" required></label>
    <label style="grid-column:1/-1">Descrição<textarea name="description" rows="3" required></textarea></label>
    <button class="btn" style="justify-self:start">Publicar bolsa</button></form>`;
  $('#aForm').onsubmit = async e => { e.preventDefault();
    try { await api('admin_publish', Object.fromEntries(new FormData(e.target))); e.target.reset(); await loadList(); toast('Bolsa publicada.'); }
    catch (x) { toast(x.message); } };
}

/* ---------- Áreas dos três perfis e notificações ---------- */
async function renderNav() {
  const u=state.user;
  if(!u){$('#nav').innerHTML='<button class="btn ghost" id="bIn">Entrar</button><button class="btn" id="bUp">Criar conta</button>';$('#bIn').onclick=loginDlg;$('#bUp').onclick=registerDlg;return;}
  let unread=0;try{unread=(await api('notifications')).unread;}catch{}
  $('#nav').innerHTML=`<span>${esc(u.name)} · ${u.role==='admin'?'Administrador':u.role==='mentor'?'Mentor':u.plan==='premium'?'Premium':'Básico'}</span>
    <button class="btn ghost" id="bNotify">Notificações${unread?` (${unread})`:''}</button>
    ${u.role==='admin'?'<button class="btn ghost" id="bAdmin">Painel administrativo</button>':u.role==='mentor'?'<button class="btn ghost" id="bMentor">Painel do mentor</button>':'<button class="btn ghost" id="bAcc">A minha área</button>'}<button class="btn ghost" id="bOut">Sair</button>`;
  $('#bIn')?.addEventListener('click',loginDlg);$('#bUp')?.addEventListener('click',registerDlg);
  $('#bOut').onclick=async()=>{await api('logout',{});state.user=null;await boot();toast('Sessão terminada.');};
  $('#bAcc')?.addEventListener('click',()=>loadAccount().then(()=>$('#account').scrollIntoView({behavior:'smooth'})));
  $('#bAdmin')?.addEventListener('click',()=>adminPage('dashboard'));
  $('#bMentor')?.addEventListener('click',()=>mentorPage('requests'));
  $('#bNotify').onclick=loadInbox;
}
function renderAdmin(){const e=$('#admin');e.hidden=state.user?.role!=='admin';if(e.hidden)return;e.innerHTML='<h2>Painel administrativo</h2><div class="tabs" id="adminTabs"></div><div id="adminContent"></div>';}
async function adminPage(tab='dashboard'){
  if(state.user?.role!=='admin')return;
  const e=$('#admin');e.hidden=false;e.scrollIntoView({behavior:'smooth'});
  const tabs=[['dashboard','Resumo'],['scholarships','Bolsas'],['users','Utilizadores'],['mentors','Mentores'],['applications','Candidaturas'],['subscriptions','Subscrições'],['notifications','Notificações']];
  $('#adminTabs').innerHTML=tabs.map(([k,n])=>`<button class="btn ${k===tab?'':'ghost'}" data-at="${k}">${n}</button>`).join('');$('#adminTabs').onclick=x=>{const b=x.target.closest('[data-at]');if(b)adminPage(b.dataset.at);};const c=$('#adminContent');c.innerHTML='<p>A carregar…</p>';
  try{if(tab==='dashboard'){const d=await api('admin_dashboard');c.innerHTML=`<div class="statgrid">${[['Utilizadores',d.users],['Bolsas',d.scholarships],['Activas',d.active_scholarships],['Encerradas',d.closed_scholarships],['Candidaturas',d.applications],['Premium',d.premium_users],['Mentores',d.mentors],['Mentorias activas',d.active_mentorships]].map(([a,b])=>`<article class="stat"><b>${b}</b><span>${a}</span></article>`).join('')}</div><h3>Actividade recente</h3>${table(d.recent,['activity','happened_at'])}`;}
  if(tab==='scholarships'){const d=await api('admin_scholarships');c.innerHTML=`<button class="btn" id="newScholar">Criar bolsa</button>${d.items.map(s=>`<article class="rowitem"><b>${esc(s.title)}</b> · ${esc(s.institution)} · ${esc(s.country)} · ${esc(s.deadline)} · ${esc(s.status)} <button class="btn ghost" data-edit-sch="${s.id}">Editar</button>${s.status==='suspended'?` <button class="btn ghost" data-activate-sch="${s.id}">Activar</button>`:` <button class="btn ghost" data-del-sch="${s.id}">Suspender</button>`} <button class="btn danger" data-remove-sch="${s.id}">Eliminar</button></article>`).join('')}`;$('#newScholar').onclick=()=>scholarForm();c.onclick=async x=>{const edit=x.target.closest('[data-edit-sch]'),del=x.target.closest('[data-del-sch]'),act=x.target.closest('[data-activate-sch]'),remove=x.target.closest('[data-remove-sch]');if(edit)scholarForm(d.items.find(s=>+s.id===+edit.dataset.editSch));if(del&&confirm('Suspender esta bolsa?')){await api('admin_scholarship_delete',{id:+del.dataset.delSch});adminPage('scholarships');}if(act){try{await api('admin_scholarship_activate',{id:+act.dataset.activateSch});adminPage('scholarships');}catch(e){toast(e.message);}}if(remove&&confirm('Eliminar permanentemente esta bolsa? Se houver candidaturas, será necessário suspendê-la.')){try{await api('admin_scholarship_remove',{id:+remove.dataset.removeSch});adminPage('scholarships');}catch(e){toast(e.message);}}};}
  if(tab==='users'){c.innerHTML='<label>Pesquisar nome/email<input id="adminSearch"></label><div id="userRows"></div>';const load=async q=>{const d=await api('admin_users',null,'&q='+encodeURIComponent(q));$('#userRows').innerHTML=d.items.map(u=>`<article class="rowitem"><b>${esc(u.name)}</b> · ${esc(u.email)} · ${esc(u.role)} · ${esc(u.plan)} · mentor: ${esc(u.mentor_name||'—')} · ${u.is_active?'activa':'suspensa'} ${+u.id===+state.user.id?'':`<button class="btn ghost" data-ustatus="${u.id}" data-active="${u.is_active?0:1}">${u.is_active?'Suspender':'Activar'}</button> <button class="btn danger" data-udelete="${u.id}">Eliminar</button>`}<p>${esc([u.phone,u.country,u.city,u.institution,u.education,u.academic_level].filter(Boolean).join(' · '))}</p></article>`).join('')||'<p>Sem resultados.</p>';};$('#adminSearch').oninput=e=>load(e.target.value);$('#userRows').onclick=async e=>{const b=e.target.closest('[data-ustatus]'),del=e.target.closest('[data-udelete]');try{if(b)await api('admin_user_status',{id:+b.dataset.ustatus,active:+b.dataset.active});if(del&&confirm('Eliminar esta conta? Os dados financeiros e de candidaturas serão preservados e a conta ficará anonimizada.'))await api('admin_user_delete',{id:+del.dataset.udelete});if(b||del)load($('#adminSearch').value);}catch(err){toast(err.message);}};await load('');}
  if(tab==='mentors'){c.innerHTML=`<form id="mentorCreate" class="formgrid"><h3>Novo mentor</h3><label>Nome<input name="name" required></label><label>Email<input name="email" type="email" required></label><label>Palavra-passe inicial (8+)<input name="password" minlength="8" required></label><label>Contacto<input name="phone"></label><label>País<input name="country"></label><label>Formação<textarea name="education"></textarea></label><label>Experiência<textarea name="experience"></textarea></label><label>Biografia<textarea name="biography"></textarea></label><label>Países de experiência<input name="countries"></label><label>Áreas/especialidades<input name="fields"></label><label>Níveis académicos<input name="levels"></label><label>Idiomas<input name="languages"></label><label>Disponibilidade<input name="availability"></label><button class="btn">Criar conta de mentor</button></form><div id="mentorRows"></div><h3>Pedidos e histórico de ligações</h3><div id="mentorLinks"></div>`;const d=await api('admin_users',null,'&q=');const mentors=d.items.filter(x=>x.role==='mentor');$('#mentorRows').innerHTML=mentors.map(m=>`<article class="rowitem"><b>${esc(m.name)}</b> · ${esc(m.email)} · ${m.is_active?'activo':'suspenso'} · ${esc(m.specialties||m.fields||'')} <button class="btn ghost" data-medit="${m.id}">Editar</button> <button class="btn ghost" data-mstatus="${m.id}" data-active="${m.is_active?0:1}">${m.is_active?'Desactivar':'Activar'}</button></article>`).join('');const links=await api('admin_mentor_connections');$('#mentorLinks').innerHTML=table(links.items,['mentor_name','student_name','student_email','scholarship_title','status','requested_at','decided_at','ended_at']);$('#mentorRows').onclick=async e=>{const b=e.target.closest('[data-mstatus],[data-medit]');if(!b)return;const m=mentors.find(x=>+x.id===+(b.dataset.mstatus||b.dataset.medit));if(b.dataset.mstatus){await api('admin_mentor_status',{id:+b.dataset.mstatus,active:+b.dataset.active});adminPage('mentors');}else mentorEdit(m);};$('#mentorCreate').onsubmit=async x=>{x.preventDefault();try{await api('admin_mentor_save',Object.fromEntries(new FormData(x.target)));x.target.reset();toast('Mentor criado.');adminPage('mentors');}catch(e){toast(e.message);}};}
  if(tab==='applications'){const d=await api('admin_applications');c.innerHTML=d.items.map(a=>`<article class="rowitem"><b>${esc(a.student_name)}</b> · ${esc(a.scholarship_title)} · ${esc(a.status)} · ${esc(a.created_at)} <select data-appstatus="${a.id}"><option value="">Alterar estado</option>${['submetida','em_analise','aceite','recusada','retirada','suspended'].map(s=>`<option>${s}</option>`).join('')}</select> <button class="btn danger" data-appdelete="${a.id}">Eliminar candidatura</button></article>`).join('')||'<p>Sem candidaturas.</p>';c.onchange=async x=>{if(x.target.dataset.appstatus&&x.target.value){try{await api('admin_application_status',{id:+x.target.dataset.appstatus,status:x.target.value});adminPage('applications');}catch(e){toast(e.message);}}};c.onclick=async x=>{const b=x.target.closest('[data-appdelete]');if(b&&confirm('Eliminar permanentemente esta candidatura e o seu histórico?')){await api('admin_application_delete',{id:+b.dataset.appdelete});adminPage('applications');}};}
  if(tab==='subscriptions'){const d=await api('admin_subscriptions');c.innerHTML=d.items.map(s=>`<article class="rowitem"><b>${esc(s.name)}</b> · ${esc(s.email)} · Plano: ${esc(s.plan)} · Estado: ${esc(s.subscription_status)} · Válida até: ${esc(s.premium_until||'—')}<p>Pagamento: ${esc(s.payment_status||'sem pagamento')} · ${esc(s.amount||'—')} · Ref.: ${esc(s.reference||'—')} · Conta: ${s.is_active?'activa':'suspensa'}</p><button class="btn ghost" data-subaction="suspend" data-uid="${s.id}">Suspender subscrição</button> <button class="btn ghost" data-subaction="activate" data-uid="${s.id}" ${s.payment_status==='pago'&&s.premium_until>=new Date().toISOString().slice(0,10)?'':'disabled'}>Activar subscrição</button> <button class="btn danger" data-subaction="delete" data-uid="${s.id}">Eliminar subscrição</button></article>`).join('')||'<p>Sem subscrições.</p>';c.onclick=async e=>{const b=e.target.closest('[data-subaction]');if(!b)return;if(b.dataset.subaction==='delete'&&!confirm('Eliminar a subscrição? O histórico dos pagamentos será preservado.'))return;try{await api('admin_subscription_action',{id:+b.dataset.uid,action:b.dataset.subaction});adminPage('subscriptions');}catch(err){toast(err.message);}};}
  if(tab==='notifications'){const d=await api('admin_notifications');c.innerHTML=table(d.items,['recipient','type','content','is_read','created_at']);}
  }catch(x){c.innerHTML=`<p class="err">${esc(x.message)}</p>`;}
}
function table(rows,keys){if(!rows?.length)return '<p>Sem registos.</p>';return `<div class="tablewrap"><table><thead><tr>${keys.map(k=>`<th>${esc(k)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${keys.map(k=>`<td>${esc(r[k]??'—')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;}
const SCH_FIELDS=['Engenharia Informática','Engenharia','Medicina','Saúde Pública','Enfermagem','Gestão','Economia','Direito','Educação','Ciências Sociais'];
const SCH_LANGUAGES=['Português','Inglês','Francês','Espanhol','Russo','Italiano','Alemão','Mandarim','Árabe','Romeno'];
function schSelect(name,label,list,val=''){const opts=val&&!list.includes(val)?[...list,val]:list;return `<label>${label}<select name="${name}" required><option value="">Escolhe uma opção…</option>${opts.map(o=>`<option ${o===val?'selected':''}>${esc(o)}</option>`).join('')}</select></label>`;}
function scholarForm(s={}){const today=new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,10);modal(`<h2>${s.id?'Editar':'Nova'} bolsa</h2><input type="hidden" name="id" value="${esc(s.id||'')}"><label>Título<input name="title" value="${esc(s.title||'')}" required></label><label>Instituição<input name="institution" value="${esc(s.institution||'')}" required></label>${schSelect('country','País',MENTOR_COUNTRIES,s.country)}<label>Âmbito<select name="scope"><option value="externa" ${s.scope==='externa'?'selected':''}>Externa</option><option value="interna" ${s.scope==='interna'?'selected':''}>Interna</option></select></label>${schSelect('level','Nível',MENTOR_LEVELS,s.level)}${schSelect('field_of_study','Área de estudo',SCH_FIELDS,s.field_of_study)}${schSelect('language','Idioma',SCH_LANGUAGES,s.language)}<label>Comparticipação (%)<input name="coverage_percent" type="number" min="1" max="100" value="${esc(s.coverage_percent||'')}" required></label><label>Prazo<input name="deadline" type="date" min="${today}" value="${esc(s.deadline||'')}" required></label><label>Descrição<textarea name="description" required>${esc(s.description||'')}</textarea></label><label>Estado<select name="status"><option value="published" ${s.status==='published'?'selected':''}>Publicada</option><option value="draft" ${s.status==='draft'?'selected':''}>Rascunho</option><option value="suspended" ${s.status==='suspended'?'selected':''}>Suspensa</option></select></label><button class="btn">Guardar</button>`,async d=>{await api('admin_scholarship_save',d);await loadList();adminPage('scholarships');});}
function mentorEdit(m){modal(`<h2>Editar mentor</h2><input type="hidden" name="id" value="${m.id}"><label>Nome<input name="name" value="${esc(m.name)}" required></label><label>Contacto<input name="phone" value="${esc(m.phone||'')}"></label><label>País<input name="country" value="${esc(m.country||'')}"></label>${[['biography','Biografia'],['education','Formação'],['experience','Experiência'],['countries','Países de experiência'],['fields','Áreas'],['levels','Níveis'],['languages','Idiomas'],['specialties','Especialidades'],['availability','Disponibilidade']].map(([k,l])=>`<label>${l}<textarea name="${k}">${esc(m[k]||'')}</textarea></label>`).join('')}<button class="btn">Guardar</button>`,async d=>{await api('admin_mentor_update',d);adminPage('mentors');});}
async function mentorPage(tab='requests'){if(state.user?.role!=='mentor')return;const e=$('#mentorPanel');e.hidden=false;e.scrollIntoView({behavior:'smooth'});const d=await api('mentor_requests');const requests=d.items;e.innerHTML=`<h2>Painel do mentor</h2><div class="tabs"><button class="btn" data-mtab="requests">Solicitações</button><button class="btn ghost" data-mtab="students">Meus estudantes</button><button class="btn ghost" data-mtab="profile">Meu perfil</button></div><div id="mentorContent"></div>`;const c=$('#mentorContent');e.querySelectorAll('[data-mtab]').forEach(b=>b.onclick=()=>mentorPage(b.dataset.mtab));if(tab==='profile'){const r=await api('mentor_profile');const p=r.profile||{};c.innerHTML=`<h3>${esc(p.name)}</h3><p>${esc(p.biography||'')}</p><p>Formação: ${esc(p.education||'')}</p><p>Experiência: ${esc(p.experience||'')}</p><p>Especialidades: ${esc(p.specialties||p.fields||'')}</p><p>Países: ${esc(p.countries||'')} · Idiomas: ${esc(p.languages||'')} · Disponibilidade: ${esc(p.availability||'')}</p>`;}else{const rows=requests.filter(x=>tab==='students'?x.status==='accepted':x.status==='pending');c.innerHTML=rows.map(x=>`<article class="rowitem"><b>${esc(x.student_name)}</b> · ${esc(x.education||'')} · ${esc(x.scholarship_title||'Sem bolsa associada')} · ${esc(x.status)}<p>${esc(x.initial_message||'')}</p>${x.status==='pending'?`<button class="btn" data-dec="accepted" data-id="${x.id}">Aceitar</button><button class="btn ghost" data-dec="rejected" data-id="${x.id}">Recusar</button>`:`<button class="btn" data-chat="${x.id}">Abrir conversa</button>`}</article>`).join('')||'<p>Sem solicitações nesta secção.</p>';c.onclick=async x=>{const b=x.target.closest('[data-dec],[data-chat]');if(!b)return;if(b.dataset.dec){await api('mentor_decide',{connection_id:+b.dataset.id,decision:b.dataset.dec});mentorPage(tab);}else openChat(+b.dataset.chat);};}}
let chatPoll;
async function openChat(id){clearInterval(chatPoll);const j=await api('mentor_chat',null,'&connection_id='+id);const render=items=>items.map(m=>`<p><b>${esc(m.sender_name)}</b> · ${esc(m.created_at)}<br>${esc(m.message)}</p>`).join('')||'Sem mensagens.';modal(`<h2>Conversa</h2><div id="chatlog" class="chatlog">${render(j.items)}</div>${j.read_only?'<p class="meta">Modo de leitura.</p>':`<label>Mensagem<textarea name="message" required maxlength="5000"></textarea></label><button class="btn">Enviar</button>`}<button class="btn ghost" value="cancel" formnovalidate>Fechar</button>`,async d=>{await api('mentor_chat',{connection_id:id,message:d.message});setTimeout(()=>openChat(id),0);});if(!j.read_only)chatPoll=setInterval(async()=>{if(!$('#dlg').open){clearInterval(chatPoll);return;}try{const fresh=await api('mentor_chat',null,'&connection_id='+id);const log=$('#chatlog');if(log)log.innerHTML=render(fresh.items);}catch{}},5000);}
async function loadInbox(){if(!state.user)return;const d=await api('notifications');const e=$('#inbox');e.hidden=false;e.scrollIntoView({behavior:'smooth'});e.innerHTML=`<h2>Notificações (${d.unread} não lidas)</h2><button class="btn ghost" id="readAll">Marcar todas como lidas</button>${d.items.map(n=>`<article class="rowitem ${n.is_read?'':'unread'}"><b>${esc(n.type)}</b> · ${esc(n.created_at)}<p>${esc(n.content)}</p>${!n.is_read?`<button class="btn ghost" data-read="${n.id}">Marcar lida</button>`:''}<button class="btn ghost" data-ndel="${n.id}">Eliminar</button></article>`).join('')||'<p>Sem notificações.</p>'}`;e.onclick=async x=>{if(x.target.id==='readAll')await api('notifications_read_all',{});if(x.target.dataset.read)await api('notification_read',{id:+x.target.dataset.read});if(x.target.dataset.ndel)await api('notification_delete',{id:+x.target.dataset.ndel});loadInbox();};}
async function loadAccount(){if(!state.user)return;const e=$('#account');e.hidden=false;const [p,a,s]=await Promise.all([api('profile'),api('my_applications'),api('subscription')]);e.innerHTML=`<h2>A minha área</h2><div class="tabs"><button class="btn" data-stab="profile">Perfil</button><button class="btn ghost" data-stab="applications">Candidaturas (${a.items.length})</button><button class="btn ghost" data-stab="subscription">Subscrição</button><button class="btn ghost" data-stab="mentors">Mentores</button><button class="btn ghost" data-stab="saved">Guardadas</button></div><div id="studentContent"></div>`;const c=$('#studentContent');e.querySelectorAll('[data-stab]').forEach(b=>b.onclick=()=>studentTab(b.dataset.stab,p.user,a.items,s));await studentTab('profile',p.user,a.items,s);}
async function studentTab(tab,u,apps,sub){const c=$('#studentContent');if(tab==='profile'){c.innerHTML=`<form id="profileForm" class="formgrid"><label>Nome completo<input name="name" value="${esc(u.name)}" required></label><label>Email<input value="${esc(u.email)}" disabled></label>${[['phone','Telefone'],['country','País'],['city','Cidade'],['birth_date','Data de nascimento'],['institution','Instituição'],['education','Formação'],['academic_level','Nível académico']].map(([k,l])=>`<label>${l}<input name="${k}" value="${esc(u[k]||'')}" ${k==='birth_date'?'type="date"':''}></label>`).join('')}<button class="btn">Guardar perfil</button></form>`;$('#profileForm').onsubmit=async e=>{e.preventDefault();await api('profile',Object.fromEntries(new FormData(e.target)));toast('Perfil actualizado.');};}
if(tab==='applications'){c.innerHTML=apps.map(a=>`<article class="rowitem"><b>${esc(a.title)}</b> · ${esc(a.institution)} · ${esc(a.country)} · prazo ${esc(a.deadline)} · ${esc(a.status)} · ${esc(a.created_at)} <button class="btn ghost" data-appdetail="${a.id}">Detalhes e histórico</button>${['submetida','em_analise'].includes(a.status)?`<button class="btn ghost" data-withdraw="${a.id}">Retirar candidatura</button>`:''}</article>`).join('')||'<p>Ainda não te candidataste a nenhuma bolsa.</p>';c.onclick=async e=>{const w=e.target.closest('[data-withdraw]');if(w&&confirm('Retirar esta candidatura?')){await api('application_withdraw',{id:+w.dataset.withdraw});loadAccount();return;}const b=e.target.closest('[data-appdetail]');if(!b)return;const d=await api('application_detail',null,'&id='+b.dataset.appdetail);modal(`<h2>${esc(d.item.title)}</h2><p>${esc(d.item.institution)} · ${esc(d.item.country)} · prazo ${esc(d.item.deadline)}</p><p>Estado: ${esc(d.item.status)}</p><p>${esc(d.item.motivation)}</p><h3>Histórico</h3>${d.history.map(h=>`<p>${esc(h.created_at)} · ${esc(h.changed_by||'Sistema')} · ${esc(h.old_status||'—')} → ${esc(h.new_status)}</p>`).join('')||'<p>Sem alterações registadas.</p>'}<button class="btn ghost" value="cancel" formnovalidate>Fechar</button>`,async()=>{});};}if(tab==='subscription')c.innerHTML=`<p>Plano: <b>${esc(u.plan)}</b> · Estado: <b>${esc(u.subscription_status||'expired')}</b> · Início: ${esc(u.premium_started_at||'—')} · Expira: ${esc(u.premium_until||'—')}</p><h3>Pagamentos</h3>${table(sub.payments,['amount','reference','payment_method','status','created_at'])}<p>Premium demonstrativo; não há cobrança financeira real.</p>`;
if(tab==='mentors'){const own=await api('my_mentorships');const links=own.items;c.innerHTML=links.map(x=>`<article class="rowitem"><b>${esc(x.mentor_name)}</b> · ${esc(x.status)} · ${esc(x.specialties||'')}<p>${esc(x.mentor_education||'')} · ${esc(x.experience||'')}</p>${x.status==='pending'?`<button class="btn ghost" data-cancel-mentor="${x.id}">Cancelar pedido</button>`:x.status==='accepted'?`<button class="btn" data-chat="${x.id}">Abrir conversa</button><button class="btn ghost" data-end-mentor="${x.id}">Terminar ligação</button>`:''}</article>`).join('')||'<p>Ainda não tens pedido de mentoria.</p>';if(u.plan!=='premium')c.innerHTML='<p>O Premium activo é necessário para escolher mentores.</p>'+c.innerHTML+'<button class="btn" id="buyPremium">Activar Premium</button>';else{const sh=await api('scholarships');c.innerHTML+=`<h3>Mentores disponíveis</h3><label>Recomendar para uma bolsa<select id="mentorScholarship"><option value="">Ver todos</option>${sh.items.map(x=>`<option value="${x.id}">${esc(x.title)} · ${esc(x.country)} · ${esc(x.level)}</option>`).join('')}</select></label><div id="mentorOptions"></div>`;const show=async id=>{const d=await api('mentor_list',null,id?'&scholarship_id='+id:'');$('#mentorOptions').innerHTML=d.blocked?'<p>Já tens um pedido pendente ou uma ligação activa. Usa a secção acima para acompanhar a ligação.</p>':d.items.map(m=>`<article class="rowitem"><b>${esc(m.name)}</b><p>${esc(m.biography||'')} · Formação: ${esc(m.education||'')} · Experiência: ${esc(m.experience||'')}</p><p>Especialidades: ${esc(m.specialties||m.fields||'')} · Países: ${esc(m.countries||'')} · Idiomas: ${esc(m.languages||'')}</p>${m.match_percent!==null?`<p>Compatibilidade: ${m.match_percent}% · Critérios coincidentes: ${esc(m.match_reasons.join(', ')||'nenhum')}</p>`:''}<button class="btn" data-choose-mentor="${m.id}" data-scholarship="${id}">Solicitar ligação</button>
<form class="mentor-request" data-mentor-form="${m.id}" data-scholarship="${id}" hidden><label>Área de mentoria *<select name="mentoring_area" required><option value="">Escolhe uma área…</option>${(multiValue(m.specialties||m.fields).length?multiValue(m.specialties||m.fields):MENTOR_SPECIALTIES).map(a=>`<option>${esc(a)}</option>`).join('')}</select></label><label>Mensagem para o mentor *<textarea name="message" rows="4" maxlength="2000" required placeholder="Apresenta-te e explica em que precisas de ajuda."></textarea></label><small class="fieldhint">Mínimo de 10 caracteres · <span data-count>0</span>/2000. O botão ativa quando escolheres a área e escreveres a mensagem.</small><div class="err" role="alert"></div><div class="row"><button type="button" class="btn ghost" data-cancel-req>Cancelar</button><button class="btn" disabled>Enviar pedido</button></div></form></article>`).join('')||'<p>Não há mentores disponíveis neste momento.</p>';};const pre=String(state.preMentor||'');if(pre)$('#mentorScholarship').value=pre;await show(pre);state.preMentor=null;$('#mentorScholarship').onchange=e=>show(e.target.value);}
c.onclick=async e=>{const chat=e.target.closest('[data-chat]'),end=e.target.closest('[data-end-mentor]'),cancel=e.target.closest('[data-cancel-mentor]'),choose=e.target.closest('[data-choose-mentor]');if(chat)openChat(+chat.dataset.chat);if(end&&confirm('Terminar esta ligação de mentoria?')){await api('mentor_end',{connection_id:+end.dataset.endMentor});studentTab(tab,u,apps,sub);}if(cancel){await api('mentor_cancel',{connection_id:+cancel.dataset.cancelMentor});studentTab(tab,u,apps,sub);}if(choose){const f=c.querySelector('[data-mentor-form="'+choose.dataset.chooseMentor+'"]');c.querySelectorAll('[data-mentor-form]').forEach(x=>{if(x!==f)x.hidden=true;});f.hidden=!f.hidden;if(!f.hidden)f.querySelector('select').focus();}if(e.target.closest('[data-cancel-req]'))e.target.closest('form').hidden=true;};const chk=f=>{f.querySelector('button.btn:not(.ghost)').disabled=!(f.mentoring_area.value&&f.message.value.trim().length>=10);f.querySelector('[data-count]').textContent=f.message.value.length;};
c.oninput=e=>{const f=e.target.closest('[data-mentor-form]');if(f)chk(f);};
c.onsubmit=async e=>{const f=e.target.closest('[data-mentor-form]');if(!f)return;e.preventDefault();const b=f.querySelector('button.btn:not(.ghost)'),er=f.querySelector('.err');b.disabled=true;b.textContent='A enviar…';er.textContent='';try{await api('mentor_request',{mentor_id:+f.dataset.mentorForm,scholarship_id:+f.dataset.scholarship||null,mentoring_area:f.mentoring_area.value,message:f.message.value});toast('Pedido enviado ao mentor. Vais ser notificado quando ele responder.');studentTab(tab,u,apps,sub);}catch(x){er.textContent=x.message;b.textContent='Enviar pedido';chk(f);}};
$('#buyPremium')?.addEventListener('click',upgradeDlg);}
if(tab==='saved'){const d=await api('saved',null);c.innerHTML=d.items.map(s=>`<article class="rowitem"><b>${esc(s.title)}</b> · ${esc(s.institution)} · ${esc(s.country)} <button class="btn ghost" data-unsave="${s.id}">Remover</button></article>`).join('')||'<p>Sem bolsas guardadas.</p>';c.onclick=async e=>{const b=e.target.closest('[data-unsave]');if(b){await api('saved',{scholarship_id:+b.dataset.unsave});studentTab(tab,u,apps,sub);}};}}

function enhanceMentorCreateForm() {
  const form=$('#mentorCreate');if(!form||form.dataset.optionsReady)return;
  const singles=[['country','País do mentor',MENTOR_COUNTRIES],['education','Formação académica',MENTOR_EDUCATION]];
  for(const [name,label,options] of singles){
    const old=form.querySelector(`[name="${name}"]`);if(!old)continue;
    const selected=old.value;const template=document.createElement('template');template.innerHTML=mentorSelect(name,label,options,selected).trim();old.closest('label').replaceWith(template.content.firstElementChild);
  }
  const groups=[
    ['countries','Países de experiência',MENTOR_COUNTRIES,false],
    ['fields','Áreas de formação',MENTOR_FIELDS,true],
    ['levels','Níveis académicos',MENTOR_LEVELS,true],
    ['languages','Idiomas',MENTOR_LANGUAGES,true],
    ['availability','Disponibilidade',MENTOR_AVAILABILITY,true],
  ];
  for(const [name,label,options,required] of groups){
    const old=form.querySelector(`[name="${name}"]`);if(!old)continue;
    const template=document.createElement('template');template.innerHTML=mentorChoiceGroup(name,label,options,old.value,required).trim();old.closest('label').replaceWith(template.content.firstElementChild);
  }
  const submit=form.querySelector('button[type="submit"],button:not([type])');
  if(submit){const template=document.createElement('template');template.innerHTML=mentorChoiceGroup('specialties','Especialidades',MENTOR_SPECIALTIES,'',true).trim();submit.before(template.content.firstElementChild);}
  form.dataset.optionsReady='true';
}
const mentorCreateObserver=new MutationObserver(enhanceMentorCreateForm);
mentorCreateObserver.observe($('#admin'),{childList:true,subtree:true});
document.addEventListener('submit',async e=>{
  if(e.target.id!=='mentorCreate')return;
  e.preventDefault();e.stopImmediatePropagation();
  const missing=Array.from(e.target.querySelectorAll('[data-required="true"]')).find(g=>!g.querySelector('input:checked'));
  if(missing){toast(`Selecciona pelo menos uma opção em ${missing.dataset.label}.`);return;}
  try{await api('admin_mentor_save',formValues(e.target));e.target.reset();toast('Mentor criado.');adminPage('mentors');}
  catch(err){toast(err.message);}
},true);
async function mentorEdit(m){
  try{
    const {profile:p}=await api('admin_mentor_profile',null,'&id='+m.id);
    modal(`<h2>Editar mentor</h2><input type="hidden" name="id" value="${p.id}"><label>Nome<input name="name" value="${esc(p.name)}" required></label><label>Email<input value="${esc(p.email)}" disabled></label><label>Contacto<input name="phone" value="${esc(p.phone||'')}"></label>${mentorSelect('country','País do mentor',MENTOR_COUNTRIES,p.country||'')}${mentorSelect('education','Formação académica',MENTOR_EDUCATION,p.education||'')}${mentorChoiceGroup('countries','Países de experiência',MENTOR_COUNTRIES,p.countries||'',false)}${mentorChoiceGroup('fields','Áreas de formação',MENTOR_FIELDS,p.fields||'',true)}${mentorChoiceGroup('levels','Níveis académicos',MENTOR_LEVELS,p.levels||'',true)}${mentorChoiceGroup('languages','Idiomas',MENTOR_LANGUAGES,p.languages||'',true)}${mentorChoiceGroup('specialties','Especialidades',MENTOR_SPECIALTIES,p.specialties||'',true)}${mentorChoiceGroup('availability','Disponibilidade',MENTOR_AVAILABILITY,p.availability||'',true)}<label>Biografia<textarea name="biography">${esc(p.biography||'')}</textarea></label><label>Experiência profissional<textarea name="experience">${esc(p.experience||'')}</textarea></label><button class="btn">Guardar</button>`,async d=>{const missing=Array.from($('#dlgForm').querySelectorAll('[data-required="true"]')).find(g=>!g.querySelector('input:checked'));if(missing)throw new Error(`Selecciona pelo menos uma opção em ${missing.dataset.label}.`);await api('admin_mentor_update',d);adminPage('mentors');});
  }catch(err){toast(err.message);}
}

/* ---------- Arranque ---------- */
async function boot() {
  const j = await api('me'); state.user = j.user; state.price = j.price; state.csrf = j.csrf;
  const mentorMode=state.user?.role==='mentor';
  $('.hero').hidden=mentorMode;$('#list').hidden=mentorMode;$('#account').hidden=true;$('#mentorPanel').hidden=!mentorMode;$('#inbox').hidden=true;
  renderNav(); renderPlans(); renderAdmin();
  if(mentorMode){await mentorPage('requests');return;}
  await loadList();
}
document.addEventListener('click', e => {
  const t = e.target.closest('[data-apply],[data-mentor],[data-save],[data-c]'); if (!t) return;
  if (t.dataset.apply) applyDlg(+t.dataset.apply);
  if (t.dataset.mentor) mentorDlg(+t.dataset.mentor);
  if (t.dataset.save) api('saved',{scholarship_id:+t.dataset.save}).then(()=>loadList()).catch(x=>toast(x.message));
  if (t.dataset.c !== undefined) { state.country = t.dataset.c; renderChips(); loadList(); }
});
async function openApplicationDetail(id){const d=await api('application_detail',null,'&id='+id);modal(`<h2>${esc(d.item.title)}</h2><p>${esc(d.item.institution)} · ${esc(d.item.country)} · prazo ${esc(d.item.deadline)}</p><p>Estado: ${esc(d.item.status)}</p><p>${esc(d.item.motivation)}</p><h3>Histórico</h3>${d.history.map(h=>`<p>${esc(h.created_at)} · ${esc(h.changed_by||'Sistema')} · ${esc(h.old_status||'—')} → ${esc(h.new_status)}</p>`).join('')||'<p>Sem alterações registadas.</p>'}<button class="btn ghost" value="cancel" formnovalidate>Fechar</button>`,async()=>{});}
async function openNotification(n){let link=n.link||'';if(!link){const k=n.event_key||'',m=k.match(/application:(\d+)/),s=k.match(/scholarship:(\d+)/),c=k.match(/connection:(\d+)/);link=m?'application:'+m[1]:s?'scholarship:'+s[1]:c?(n.type==='message'?'chat:':'mentorship:')+c[1]:n.type==='subscription'?'subscription':'';}if(link.startsWith('application:'))return openApplicationDetail(+link.split(':')[1]);if(link.startsWith('scholarship:')){const d=await api('scholarship_detail',null,'&id='+(+link.split(':')[1])),s=d.item;return modal(`<h2>${esc(s.title)}</h2><p>${esc(s.institution)} · ${esc(s.country)} · ${esc(s.level)} · prazo ${esc(s.deadline)}</p><p>${esc(s.description)}</p><button class="btn ghost" value="cancel" formnovalidate>Fechar</button>`,async()=>{});}if(link.startsWith('chat:'))return openChat(+link.split(':')[1]);if(link.startsWith('mentor_request:')){await mentorPage('requests');setTimeout(()=>document.querySelector(`[data-id="${+link.split(':')[1]}"]`)?.scrollIntoView({behavior:'smooth',block:'center'}),100);return;}if(link.startsWith('mentorship:')){if(state.user?.role==='mentor'){const d=await api('mentor_requests'),r=d.items.find(x=>+x.id===+link.split(':')[1]);await mentorPage(r?.status==='accepted'?'students':'requests');setTimeout(()=>document.querySelector(`[data-chat="${+link.split(':')[1]}"]`)?.scrollIntoView({behavior:'smooth',block:'center'}),100);}else{await loadAccount();await studentTab('mentors',state.user,[],{});}return;}if(link==='subscription'){document.querySelector('#plans')?.scrollIntoView({behavior:'smooth'});return;}if(link==='mentors')return loadAccount();toast('O destino desta notificação já não está disponível.');}
async function loadInbox(){if(!state.user)return;const d=await api('notifications'),e=$('#inbox');e.hidden=false;e.scrollIntoView({behavior:'smooth'});e.innerHTML=`<h2>Notificações (${d.unread} não lidas)</h2><button class="btn ghost" id="readAll">Marcar todas como lidas</button>${d.items.map(n=>`<article class="rowitem ${n.is_read?'':'unread'}"><b>${esc(n.type)}</b> · ${esc(n.created_at)}<p>${esc(n.content)}</p><button class="btn" data-open-notice="${n.id}">Abrir</button>${!n.is_read?`<button class="btn ghost" data-read="${n.id}">Marcar lida</button>`:''}<button class="btn ghost" data-ndel="${n.id}">Eliminar</button></article>`).join('')||'<p>Sem notificações.</p>'}`;e.onclick=async x=>{const open=x.target.closest('[data-open-notice]'),read=x.target.closest('[data-read]'),del=x.target.closest('[data-ndel]');if(x.target.id==='readAll'){await api('notifications_read_all',{});return loadInbox();}if(read){await api('notification_read',{id:+read.dataset.read});return loadInbox();}if(del){await api('notification_delete',{id:+del.dataset.ndel});return loadInbox();}if(open){const n=d.items.find(y=>+y.id===+open.dataset.openNotice);if(n){if(!n.is_read)await api('notification_read',{id:+n.id});await openNotification(n);}}};}
['fLevel', 'fScope'].forEach(id => $('#' + id).addEventListener('change', loadList));
let tm; $('#q').addEventListener('input', () => { clearTimeout(tm); tm = setTimeout(loadList, 300); });
renderChips(); boot().catch(() => { $('#list').innerHTML = '<p>Não foi possível ligar ao servidor. Confirma que o PHP e o MySQL estão ativos.</p>'; });
