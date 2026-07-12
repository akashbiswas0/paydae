// Paydae frontend — vanilla JS, no libraries.
// Persona comes from the path: /company, /c/alice, /c/bob; "/" shows the picker.

const PERSONAS = {
  company: { name: 'Paydae Inc.', label: 'COMPANY', cls: 'company' },
  alice: { name: 'Alice', label: 'ALICE', cls: 'alice' },
  bob: { name: 'Bob', label: 'BOB', cls: 'bob' },
};

const path = location.pathname;
const persona =
  path === '/company' ? 'company' :
  path === '/c/alice' ? 'alice' :
  path === '/c/bob' ? 'bob' : null;

const app = document.getElementById('app');
let state = null;
let lastHash = '';
let busy = false;

const fmt = (v) => Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const rate = (v) => Number(v).toLocaleString('en-US', { maximumFractionDigits: 2 });
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const who = (partyId) => (partyId || '').split('::')[0].replace('Paydae', '') || partyId;

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => t.classList.add('hidden'), 5000);
}

async function act(action, payload, btn) {
  if (busy) return;
  busy = true;
  if (btn) btn.disabled = true;
  document.querySelectorAll('button[data-act]').forEach((b) => (b.disabled = true));
  try {
    const res = await fetch('/api/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ p: persona, action, payload }),
    });
    const body = await res.json();
    if (!res.ok || body.error) throw new Error(body.error || `HTTP ${res.status}`);
    await refresh(true);
  } catch (err) {
    toast(`Ledger error: ${err.message}`);
  } finally {
    busy = false;
    document.querySelectorAll('button[data-act]').forEach((b) => (b.disabled = false));
  }
}

async function refresh(force = false) {
  try {
    const res = await fetch(`/api/state?p=${persona}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const next = await res.json();
    const hash = JSON.stringify(next);
    if (!force && hash === lastHash) return;
    // don't clobber a form mid-typing; the next poll catches up
    const active = document.activeElement;
    if (!force && active && ['INPUT', 'SELECT', 'TEXTAREA'].includes(active.tagName)) return;
    state = next;
    lastHash = hash;
    render();
  } catch (err) {
    console.error('state refresh failed:', err.message);
  }
}

// ---------------------------------------------------------------- rendering

function renderPicker() {
  document.title = 'Paydae — pick a persona';
  app.innerHTML = `
    <div class="picker">
      <h1>Paydae</h1>
      <p>Confidential contractor payroll on Canton. Pick a persona:</p>
      <div class="cards">
        <a class="company" href="/company">Paydae Inc.<small>The company · runs payday</small></a>
        <a class="alice" href="/c/alice">Alice<small>Contractor · Designer</small></a>
        <a class="bob" href="/c/bob">Bob<small>Contractor · Engineer</small></a>
      </div>
    </div>`;
}

const header = (p) => `
  <div class="topbar">
    <div class="logo">Paydae<span>private payroll on Canton</span></div>
    <div class="badge ${p.cls}"><span class="dot"></span>${p.label}</div>
  </div>`;

function renderCompany() {
  const s = state;
  const t = s.treasury;
  const treasuryHtml = t
    ? `<div class="row">
         <div><div class="money">$${fmt(t.balance)}<small>${esc(t.currency)}</small></div>
         <div class="hint">Company treasury</div></div>
       </div>`
    : `<div class="hint">No treasury yet.</div>
       <label>Opening balance (USD)</label>
       <input id="tre-balance" type="number" value="50000">
       <button class="primary" data-act="bootstrapTreasury" id="btn-bootstrap">Bootstrap treasury</button>`;

  const invoices = s.invoices.map((i) => `
    <div class="item">
      <div class="main">
        <div class="title">${esc(who(i.contractor))} — $${fmt(i.amount)}</div>
        <div class="sub">${rate(i.hours)}h · ${esc(i.memo)}</div>
      </div>
      <button class="approve" data-act="approve" data-cid="${esc(i.contractId)}">Approve</button>
    </div>`).join('') || '<div class="empty">No pending invoices.</div>';

  const approved = s.approvedInvoices.map((i) => `
    <div class="item">
      <div class="main">
        <div class="title">${esc(who(i.contractor))} — $${fmt(i.amount)}</div>
        <div class="sub">${rate(i.hours)}h · ${esc(i.memo)}</div>
      </div>
      <span class="chip approved">approved</span>
    </div>`).join('') || '<div class="empty">Nothing approved yet.</div>';

  const agreements = s.agreements.map((a) => `
    <div class="item">
      <div class="main">
        <div class="title">${esc(who(a.contractor))} · ${esc(a.role)}</div>
        <div class="sub">$${rate(a.hourlyRate)}/h ${esc(a.currency)}</div>
      </div>
      <span class="chip paid">active</span>
    </div>`).join('') || '<div class="empty">No active agreements.</div>';

  const proposals = s.proposals.map((p) => `
    <div class="item">
      <div class="main">
        <div class="title">${esc(who(p.contractor))} · ${esc(p.role)}</div>
        <div class="sub">$${rate(p.hourlyRate)}/h ${esc(p.currency)} · awaiting countersign</div>
      </div>
      <span class="chip pending">offered</span>
    </div>`).join('') || '<div class="empty">No open offers.</div>';

  const payments = s.payments.map((p) => `
    <div class="item">
      <div class="main">
        <div class="title">${esc(who(p.contractor))} — $${fmt(p.amount)}</div>
        <div class="sub">${esc(p.memo)}</div>
      </div>
      <span class="chip paid">paid ✓</span>
    </div>`).join('') || '<div class="empty">No payments yet.</div>';

  const total = s.approvedInvoices.reduce((sum, i) => sum + Number(i.amount), 0);

  app.innerHTML = `
    <div class="wrap">
      ${header(PERSONAS.company)}
      <div class="grid2">
        <div class="card">${treasuryHtml}</div>
        <div class="card">
          <h2>Send offer</h2>
          <label>Contractor</label>
          <select id="offer-contractor"><option value="alice">Alice</option><option value="bob">Bob</option></select>
          <label>Role</label>
          <input id="offer-role" placeholder="Designer">
          <label>Hourly rate (USD)</label>
          <input id="offer-rate" type="number" placeholder="70">
          <button class="primary" data-act="propose" id="btn-propose">Send offer</button>
        </div>
      </div>
      <div class="card"><h2>Open offers</h2>${proposals}</div>
      <div class="card"><h2>Agreements</h2>${agreements}</div>
      <div class="card"><h2>Pending invoices</h2>${invoices}</div>
      <div class="card">
        <h2>Approved — ready for payday</h2>${approved}
        <button class="payday" data-act="payAll" ${s.approvedInvoices.length && t ? '' : 'disabled'}>
          ⚡ RUN PAYDAY${total ? ` — $${fmt(total)}` : ''}
        </button>
        <div class="hint">One atomic Canton transaction: every approved invoice paid, treasury debited — or nothing.</div>
      </div>
      <div class="card"><h2>Payments history</h2>${payments}</div>
    </div>`;

  wire();
}

function renderContractor() {
  const s = state;
  const p = PERSONAS[persona];

  const offers = s.proposals.map((o) => `
    <div class="item">
      <div class="main">
        <div class="title">${esc(o.role)} · $${rate(o.hourlyRate)}/h ${esc(o.currency)}</div>
        <div class="sub">Offer from ${esc(who(o.company))}</div>
      </div>
      <button class="sign" data-act="countersign" data-cid="${esc(o.contractId)}">Countersign</button>
    </div>`).join('') || '<div class="empty">No pending offers.</div>';

  const agr = s.agreements[0];
  const agreementHtml = agr ? `
    <div class="item">
      <div class="main">
        <div class="title">${esc(agr.role)} · $${rate(agr.hourlyRate)}/h ${esc(agr.currency)}</div>
        <div class="sub">Active agreement with ${esc(who(agr.company))}</div>
      </div>
      <span class="chip paid">active</span>
    </div>
    <label>Hours</label>
    <input id="inv-hours" type="number" placeholder="40">
    <label>Memo</label>
    <input id="inv-memo" placeholder="June design work">
    <div class="calc" id="inv-calc"></div>
    <button class="primary" data-act="submitInvoice" data-cid="${esc(agr.contractId)}" data-rate="${esc(agr.hourlyRate)}">Submit invoice</button>
  ` : '<div class="empty">No active agreement yet.</div>';

  const invoices = [
    ...s.invoices.map((i) => ({ ...i, status: 'pending' })),
    ...s.approvedInvoices.map((i) => ({ ...i, status: 'approved' })),
  ].map((i) => `
    <div class="item">
      <div class="main">
        <div class="title">$${fmt(i.amount)}</div>
        <div class="sub">${rate(i.hours)}h · ${esc(i.memo)}</div>
      </div>
      <span class="chip ${i.status}">${i.status}</span>
    </div>`).join('') || '<div class="empty">No invoices yet.</div>';

  const payments = s.payments.map((pay) => `
    <div class="item">
      <div class="main">
        <div class="title">$${fmt(pay.amount)}</div>
        <div class="sub">${esc(pay.memo)}</div>
      </div>
      <span class="chip paid">Paid ✓</span>
    </div>`).join('') || '<div class="empty">No payments yet.</div>';

  app.innerHTML = `
    <div class="wrap">
      ${header(p)}
      <div class="card"><h2>Offers</h2>${offers}</div>
      <div class="card"><h2>My agreement</h2>${agreementHtml}</div>
      <div class="card"><h2>My invoices</h2>${invoices}</div>
      <div class="card"><h2>My payments</h2>${payments}</div>
    </div>`;

  wire();
}

function wire() {
  document.querySelectorAll('button[data-act]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const a = btn.dataset.act;
      if (a === 'bootstrapTreasury') {
        act(a, { balance: Number(document.getElementById('tre-balance').value || 50000) }, btn);
      } else if (a === 'propose') {
        const contractor = document.getElementById('offer-contractor').value;
        const role = document.getElementById('offer-role').value.trim();
        const rateV = Number(document.getElementById('offer-rate').value);
        if (!role || !rateV) return toast('Role and hourly rate are required.');
        act(a, { contractor, role, rate: rateV }, btn);
      } else if (a === 'countersign') {
        act(a, { cid: btn.dataset.cid }, btn);
      } else if (a === 'submitInvoice') {
        const hours = Number(document.getElementById('inv-hours').value);
        const memo = document.getElementById('inv-memo').value.trim();
        if (!hours) return toast('Hours are required.');
        act(a, { agreementCid: btn.dataset.cid, hours, memo }, btn);
      } else if (a === 'approve') {
        act(a, { cid: btn.dataset.cid }, btn);
      } else if (a === 'payAll') {
        act(a, {}, btn);
      }
    });
  });

  const hours = document.getElementById('inv-hours');
  if (hours) {
    const btn = document.querySelector('button[data-act="submitInvoice"]');
    const calc = document.getElementById('inv-calc');
    hours.addEventListener('input', () => {
      const h = Number(hours.value);
      calc.textContent = h > 0 ? `= $${fmt(h * Number(btn.dataset.rate))} USD` : '';
    });
  }
}

// ---------------------------------------------------------------- boot

if (!persona) {
  renderPicker();
} else {
  document.title = `Paydae — ${PERSONAS[persona].name}`;
  render = persona === 'company' ? renderCompany : renderContractor;
  refresh(true);
  setInterval(() => refresh(), 2500);
}

var render; // assigned above per persona
