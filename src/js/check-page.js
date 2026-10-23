import { createChecker, sha1Hex, mapLimit, LookupError } from '../core/hibp.js';

const checker = createChecker();
const MAX_LINES = 2000;

// ---- Single check ----------------------------------------------------------

const form = document.querySelector('[data-check-form]');
const input = form.querySelector('[data-check-input]');
const btn = form.querySelector('[data-check-btn]');
const reveal = form.querySelector('[data-reveal]');
const result = document.querySelector('[data-result]');
const kPassword = document.querySelector('[data-k-password]');
const kHash = document.querySelector('[data-k-hash]');
const kSent = document.querySelector('[data-k-sent]');

function showResult(kind, title, body) {
  result.hidden = false;
  result.className = `result is-${kind}`;
  result.querySelector('[data-result-title]').textContent = title;
  result.querySelector('[data-result-body]').textContent = body;
}

function plural(n, word) {
  return `${n.toLocaleString()} ${word}${n === 1 ? '' : 's'}`;
}

let diagramToken = 0;
async function updateDiagram() {
  const pw = input.value;
  const token = ++diagramToken;
  if (!pw) {
    kPassword.textContent = 'Type a password above';
    kHash.textContent = '…';
    kSent.textContent = '…';
    return;
  }
  const hash = await sha1Hex(pw);
  if (token !== diagramToken) return;
  kPassword.textContent = input.type === 'password' ? '•'.repeat(Math.min(pw.length, 40)) : pw;
  kHash.textContent = '';
  const sent = document.createElement('span');
  sent.className = 'sent';
  sent.textContent = hash.slice(0, 5);
  const kept = document.createElement('span');
  kept.className = 'kept';
  kept.textContent = hash.slice(5);
  kHash.append(sent, kept);
  kSent.textContent = `${hash.slice(0, 5)}  (the other 35 characters stay on your device)`;
}

input.addEventListener('input', () => {
  updateDiagram();
  result.hidden = true;
});

reveal.addEventListener('click', () => {
  const show = input.type === 'password';
  input.type = show ? 'text' : 'password';
  reveal.setAttribute('aria-pressed', String(show));
  reveal.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
  updateDiagram();
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const pw = input.value;
  if (!pw) {
    showResult('error', 'Enter a password first', 'Type or paste the password you want to check.');
    input.focus();
    return;
  }
  btn.disabled = true;
  btn.textContent = 'Checking…';
  try {
    const count = await checker.check(pw);
    if (count > 0) {
      showResult('exposed', `Found in ${plural(count, 'breach record')}`,
        'This password has leaked. Stop using it on every account where you use it, starting with email and banking. Attackers try leaked passwords first.');
    } else {
      showResult('clean', 'Not found in known breaches',
        'This password isn’t in the Have I Been Pwned database. That doesn’t make it strong; a short or predictable password can still be guessed.');
    }
  } catch (err) {
    const offline = err instanceof LookupError;
    showResult('error', 'Couldn’t complete the check',
      offline ? 'Have I Been Pwned didn’t respond. Check your internet connection, or a blocker that may stop requests to api.pwnedpasswords.com, then try again.'
        : String(err.message || err));
  } finally {
    btn.disabled = false;
    btn.textContent = 'Check password';
  }
});

// ---- Bulk audit ------------------------------------------------------------

const fileInput = document.querySelector('[data-audit-file]');
const drop = document.querySelector('[data-drop]');
const summary = document.querySelector('[data-audit-summary]');
const wrap = document.querySelector('[data-audit-wrap]');
const tbody = document.querySelector('[data-audit-body]');

function maskStart(pw) {
  const first = [...pw].slice(0, 2).join('');
  return `${first}${'•'.repeat(Math.max(1, Math.min(pw.length - 2, 10)))}`;
}

async function audit(file) {
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) {
    summary.hidden = false;
    summary.textContent = 'That file is over 2 MB. Split it into smaller files.';
    return;
  }
  const text = await file.text();
  const entries = text.split(/\r?\n/)
    .map((line, i) => ({ line: i + 1, pw: line.replace(/\s+$/, '') }))
    .filter((e) => e.pw.length > 0);

  tbody.textContent = '';
  summary.hidden = false;
  if (entries.length === 0) {
    wrap.hidden = true;
    summary.textContent = 'No passwords found in that file. It should have one password per line.';
    return;
  }
  const truncated = entries.length > MAX_LINES;
  const work = entries.slice(0, MAX_LINES);
  wrap.hidden = false;

  const rows = work.map((e) => {
    const tr = document.createElement('tr');
    const tdLine = document.createElement('td');
    tdLine.className = 'num';
    tdLine.textContent = String(e.line);
    const tdPw = document.createElement('td');
    tdPw.className = 'num';
    tdPw.textContent = maskStart(e.pw);
    const tdRes = document.createElement('td');
    tdRes.textContent = 'Waiting…';
    tr.append(tdLine, tdPw, tdRes);
    tbody.appendChild(tr);
    return tdRes;
  });

  let exposed = 0, clean = 0, failed = 0;
  const report = (done) => {
    summary.textContent = `Checked ${done.toLocaleString()} of ${work.length.toLocaleString()}: ${exposed} exposed, ${clean} not found${failed ? `, ${failed} couldn’t be checked` : ''}.${truncated ? ` Only the first ${MAX_LINES.toLocaleString()} lines were checked.` : ''}`;
  };
  report(0);

  await mapLimit(work, 4, async (e) => {
    try { return { count: await checker.check(e.pw) }; } catch (err) { return { error: err }; }
  }, (done, _total, i, r) => {
    const td = rows[i];
    if (r.error) {
      failed++;
      td.className = 'status-error';
      td.textContent = 'Couldn’t check';
    } else if (r.count > 0) {
      exposed++;
      td.className = 'status-exposed';
      td.textContent = `Exposed (${r.count.toLocaleString()})`;
    } else {
      clean++;
      td.className = 'status-clean';
      td.textContent = 'Not found';
    }
    report(done);
  });
  fileInput.value = '';
}

fileInput.addEventListener('change', () => audit(fileInput.files[0]));
['dragenter', 'dragover'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add('is-over'); }));
['dragleave', 'drop'].forEach((t) => drop.addEventListener(t, () => drop.classList.remove('is-over')));
drop.addEventListener('drop', (e) => {
  e.preventDefault();
  audit(e.dataTransfer.files[0]);
});
