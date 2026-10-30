const API = 'api/index.php';
const COUNTRIES = ['Brasil','Estados Unidos','Portugal','Itália','Roménia'];
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const state = { user: null, price: 0, country: '', applied: [], items: [] };

async function api(action, data, qs = '') {
  const r = await fetch(`${API}?action=${action}${qs}`, data
    ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) } : {});
  const j = await r.json();
  if (!r.ok) throw Object.assign(new Error(j.error || 'Erro inesperado.'), { status: r.status });
  return j;
}
function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('on'); setTimeout(() => t.classList.remove('on'), 2800); }
const money = n => Number(n).toLocaleString('pt-PT') + ' Kz';
const fmtDate = d => new Date(d + 'T00:00').toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' });

function modal(html, onSubmit) {
  const f = $('#dlgForm'); f.innerHTML = html + '<div class="err" id="err"></div>';
  f.onsubmit = async e => {
    if (e.submitter?.value === 'cancel') return;
    e.preventDefault();
    try { await onSubmit(Object.fromEntries(new FormData(f))); $('#dlg').close(); }
    catch (x) { $('#err').textContent = x.message; }
  };
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
  modal(`<h2>Entrar</h2><label>Email<input name="email" type="email" required autocomplete="email"></label>
    <label>Palavra-passe<input name="password" type="password" required autocomplete="current-password"></label>
    <div class="row"><button class="btn ghost" value="cancel" formnovalidate>Cancelar</button><button class="btn">Entrar</button></div>`,
    async d => { state.user = (await api('login', d)).user; await boot(); toast('Bem-vindo de volta.'); });
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
  state.items = j.items; state.applied = j.applied;
  $('#list').innerHTML = j.items.length ? j.items.map(card).join('')
    : '<p>Nenhuma bolsa aberta com estes filtros. Remove um filtro para ver mais resultados.</p>';
}
function card(s) {
  const done = state.applied.includes(+s.id), prem = state.user?.plan === 'premium';
  return `<article class="card">
    <div><h3>${esc(s.title)}</h3>
      <div class="meta">${esc(s.institution)} · ${esc(s.country)} · ${esc(s.level)}</div>
      <p>${esc(s.description)}</p></div>
    <div class="cov"><b>${s.coverage_percent}%</b><small>comparticipado</small><div class="bar"><i style="width:${s.coverage_percent}%"></i></div></div>
    <div class="actions">
      <span class="tag">${s.scope === 'interna' ? 'Interna' : 'Externa'}</span><span class="tag">Até ${fmtDate(s.deadline)}</span>
      <button class="btn" data-apply="${s.id}" ${done ? 'disabled' : ''}>${done ? 'Candidatura enviada' : 'Candidatar-me'}</button>
      <button class="btn ghost" data-mentor="${s.id}">${prem ? 'Pedir mentoria' : 'Mentoria (premium)'}</button>
    </div></article>`;
}
function applyDlg(id) {
  if (!state.user) return registerDlg();
  const s = state.items.find(x => +x.id === id);
  modal(`<h2>${esc(s.title)}</h2><label>Carta de motivação<textarea name="motivation" rows="6" minlength="30" required placeholder="Porque mereces esta bolsa e o que vais estudar."></textarea></label>
    <div class="row"><button class="btn ghost" value="cancel" formnovalidate>Cancelar</button><button class="btn">Enviar candidatura</button></div>`,
    async d => { await api('apply', { scholarship_id: id, motivation: d.motivation }); await loadList(); toast('Candidatura enviada.'); });
}
function mentorDlg(id) {
  if (!state.user) return registerDlg();
  if (state.user.plan !== 'premium') return upgradeDlg();
  modal(`<h2>Mentoria direta</h2><label>Em que precisas de ajuda?<textarea name="message" rows="5" minlength="10" required placeholder="Ex.: rever a minha carta, preparar a entrevista, escolher o curso."></textarea></label>
    <div class="row"><button class="btn ghost" value="cancel" formnovalidate>Cancelar</button><button class="btn">Pedir atendimento</button></div>`,
    async d => { await api('mentorship', { scholarship_id: id, message: d.message }); toast('Pedido enviado. O mentor entrará em contacto.'); });
}

/* ---------- Planos ---------- */
function renderPlans() {
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
  modal(`<h2>Plano premium</h2><p>${money(state.price)} por 30 dias, com mentoria direta incluída.</p>
    <p class="meta">Pagamento em modo de demonstração: nenhuma cobrança real é feita.</p>
    <div class="row"><button class="btn ghost" value="cancel" formnovalidate>Cancelar</button><button class="btn sun">Pagar e ativar</button></div>`,
    async () => { const j = await api('upgrade', {}); state.user = j.user; await boot(); toast('Premium ativo. Ref. ' + j.reference); });
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

/* ---------- Arranque ---------- */
async function boot() {
  const j = await api('me'); state.user = j.user; state.price = j.price;
  $('#account').hidden = true;
  renderNav(); renderPlans(); renderAdmin(); await loadList();
}
document.addEventListener('click', e => {
  const t = e.target.closest('[data-apply],[data-mentor],[data-c]'); if (!t) return;
  if (t.dataset.apply) applyDlg(+t.dataset.apply);
  if (t.dataset.mentor) mentorDlg(+t.dataset.mentor);
  if (t.dataset.c !== undefined) { state.country = t.dataset.c; renderChips(); loadList(); }
});
['fLevel', 'fScope'].forEach(id => $('#' + id).addEventListener('change', loadList));
let tm; $('#q').addEventListener('input', () => { clearTimeout(tm); tm = setTimeout(loadList, 300); });
renderChips(); boot().catch(() => { $('#list').innerHTML = '<p>Não foi possível ligar ao servidor. Confirma que o PHP e o MySQL estão ativos.</p>'; });
