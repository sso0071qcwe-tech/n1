// ============================================
// HOUSEKEEPING COMPLIANCE APP
// Production SPA - Glebe House Care Home
// ============================================

const API = '';
const state = { user: null, token: null, view: 'login', tasks: [], issues: [], dashboard: null };


// ============ API CLIENT ============
async function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (state.token) headers['Authorization'] = 'Bearer ' + state.token;
  try {
    const res = await fetch(API + path, { ...opts, headers: { ...headers, ...(opts.headers||{}) } });
    const json = await res.json();
    if (res.status === 401) { doLogout(); return null; }
    if (!res.ok) { toast(json.error || 'Error', 'error'); return null; }
    return json;
  } catch (e) { toast('Network error', 'error'); return null; }
}


// ============ TOAST ============
function toast(msg, type = 'info') {
  const c = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = msg;
  c.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}


// ============ AUTH ============
let pinValue = '';

async function doLogin(pin) {
  const res = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ pin }) });
  if (res) {
    state.token = res.token;
    state.user = res.staff;
    localStorage.setItem('hk_token', res.token);
    localStorage.setItem('hk_user', JSON.stringify(res.staff));
    toast('Welcome, ' + res.staff.name, 'success');
    navigate('tasks');
  }
  return res;
}

function doLogout() {
  state.token = null; state.user = null;
  state.tasks = []; state.issues = []; state.dashboard = null;
  localStorage.removeItem('hk_token');
  localStorage.removeItem('hk_user');
  navigate('login');
}

function restoreSession() {
  const t = localStorage.getItem('hk_token');
  const u = localStorage.getItem('hk_user');
  if (t && u) { state.token = t; state.user = JSON.parse(u); return true; }
  return false;
}


// ============ NAVIGATION ============
async function navigate(view) {
  state.view = view;
  render();
  if (view === 'tasks') await loadTasks();
  else if (view === 'issues') await loadIssues();
  else if (view === 'dashboard') await loadDashboard();
}


// ============ DATA LOADERS ============
async function loadTasks() {
  const data = await api('/api/tasks/today');
  if (data) { state.tasks = data; render(); }
}

async function loadIssues() {
  const data = await api('/api/issues');
  if (data) { state.issues = data; render(); }
}

async function loadDashboard() {
  const data = await api('/api/dashboard/compliance');
  if (data) { state.dashboard = data; render(); }
}


// ============ ACTIONS ============
async function completeTask(id) {
  event && event.stopPropagation();
  const res = await api('/api/tasks/' + id + '/complete', { method: 'POST', body: JSON.stringify({}) });
  if (res) { toast('Task completed!', 'success'); await loadTasks(); }
}

async function completeTaskWithNote(id) {
  const note = document.getElementById('modal-note')?.value || '';
  const res = await api('/api/tasks/' + id + '/complete', { method: 'POST', body: JSON.stringify({ note }) });
  if (res) { toast('Task completed!', 'success'); closeModal(); await loadTasks(); }
}

async function submitIssue() {
  const cat = document.getElementById('issue-cat').value;
  const room = document.getElementById('issue-room').value || null;
  const desc = document.getElementById('issue-desc').value;
  if (!desc) { toast('Description required', 'warning'); return; }
  const res = await api('/api/issues', { method: 'POST', body: JSON.stringify({ category: cat, room_id: room, description: desc }) });
  if (res) { toast('Issue reported!', 'success'); closeModal(); await loadIssues(); }
}

async function changeIssueStatus(id, status) {
  const res = await api('/api/issues/' + id + '/status', { method: 'POST', body: JSON.stringify({ status }) });
  if (res) { toast('Updated!', 'success'); await loadIssues(); }
}


// ============ MODAL ============
function openModal(html) {
  const root = document.getElementById('modal-root');
  root.innerHTML = '<div class="modal-backdrop" onclick="if(event.target===this)closeModal()"><div class="modal-panel">' + html + '</div></div>';
}
function closeModal() { document.getElementById('modal-root').innerHTML = ''; }

function openTaskModal(id) {
  const t = state.tasks.find(x => x.id === id);
  if (!t || t.status !== 'pending') return;
  openModal(
    '<div class="modal-head"><h3>' + esc(t.task_name) + '</h3><button class="modal-close" onclick="closeModal()">&#10005;</button></div>' +
    '<p style="font-size:0.85rem;color:var(--slate-600);margin-bottom:4px"><strong>Room:</strong> ' + esc(t.room_name) + '</p>' +
    '<p style="font-size:0.85rem;color:var(--slate-600);margin-bottom:4px"><strong>Checklist:</strong> ' + esc(t.template_name) + '</p>' +
    (t.time_slot ? '<p style="font-size:0.85rem;color:var(--slate-600);margin-bottom:4px"><strong>Slot:</strong> ' + t.time_slot + '</p>' : '') +
    (t.ipc_critical ? '<p style="font-size:0.85rem;color:var(--purple-600);font-weight:600;margin-bottom:12px">&#9888; IPC Critical</p>' : '<div style="height:12px"></div>') +
    '<div class="form-group"><label class="form-label">Note (optional)</label><textarea class="form-textarea" id="modal-note" placeholder="Add a note..."></textarea></div>' +
    '<div style="display:flex;gap:8px"><button class="btn btn-success btn-block btn-lg" onclick="completeTaskWithNote(\'' + id + '\')">&#10003; Mark Done</button>' +
    '<button class="btn btn-warning" onclick="closeModal();openIssueModal(\'' + (t.room_id||'') + '\')">&#9888; Flag</button></div>'
  );
}

function openIssueModal(roomId) {
  openModal(
    '<div class="modal-head"><h3>Report Issue</h3><button class="modal-close" onclick="closeModal()">&#10005;</button></div>' +
    '<div class="form-group"><label class="form-label">Category</label><select class="form-select" id="issue-cat"><option value="damage">Damage</option><option value="stock_out">Stock Out</option><option value="access_issue">Access Issue</option></select></div>' +
    '<div class="form-group"><label class="form-label">Room/Area</label><input class="form-input" id="issue-room" value="' + (roomId||'') + '" placeholder="e.g. room_3"></div>' +
    '<div class="form-group"><label class="form-label">Description</label><textarea class="form-textarea" id="issue-desc" placeholder="Describe the issue..."></textarea></div>' +
    '<button class="btn btn-primary btn-block btn-lg" onclick="submitIssue()">Submit Issue</button>'
  );
}


// ============ RENDER: LOGIN ============
function renderLogin() {
  return '<div class="login-page"><div class="login-card">' +
    '<div class="login-brand"><div class="login-brand-icon">&#127968;</div><h1>Glebe House</h1><p>Housekeeping Compliance System</p></div>' +
    '<div class="pin-dots"><div class="pin-dot" id="d0"></div><div class="pin-dot" id="d1"></div><div class="pin-dot" id="d2"></div><div class="pin-dot" id="d3"></div></div>' +
    '<div class="pin-grid">' +
    [1,2,3,4,5,6,7,8,9].map(n => '<button class="pin-btn" onclick="pinKey(\'' + n + '\')">' + n + '</button>').join('') +
    '<button class="pin-btn fn" onclick="pinClear()">Clear</button>' +
    '<button class="pin-btn" onclick="pinKey(\'0\')">0</button>' +
    '<button class="pin-btn fn" onclick="pinBack()">&#9003;</button>' +
    '</div>' +
    '<div class="login-error" id="pin-error"></div>' +
    '<div class="login-hint">Demo PINs: 1234 (Staff) &bull; 5678 (Supervisor) &bull; 6789 (Manager)</div>' +
    '</div></div>';
}

function pinKey(d) {
  if (pinValue.length >= 4) return;
  pinValue += d;
  updateDots();
  if (pinValue.length === 4) {
    setTimeout(async () => {
      const ok = await doLogin(pinValue);
      if (!ok) {
        const el = document.getElementById('pin-error');
        if (el) el.textContent = 'Invalid PIN. Try again.';
        pinValue = '';
        updateDots();
      }
    }, 250);
  }
}
function pinClear() { pinValue = ''; updateDots(); const e = document.getElementById('pin-error'); if(e) e.textContent=''; }
function pinBack() { pinValue = pinValue.slice(0,-1); updateDots(); }
function updateDots() { for(let i=0;i<4;i++){const el=document.getElementById('d'+i);if(el)el.className='pin-dot'+(i<pinValue.length?' active':'');} }


// ============ RENDER: APP SHELL ============
function shell(content) {
  const u = state.user;
  const isManager = ['supervisor','manager','auditor'].includes(u?.role);
  const v = state.view;
  return '<div class="app-layout">' +
    '<header class="app-topbar"><div class="topbar-left"><span>&#127968;</span><h1>Glebe House</h1></div>' +
    '<div class="topbar-right"><div class="topbar-user"><div class="topbar-avatar">' + esc(u?.initials||'?') + '</div><div><div class="topbar-name">' + esc(u?.name||'') + '</div><div class="topbar-role">' + esc(u?.role||'') + '</div></div></div>' +
    '<button class="btn-logout" onclick="doLogout()">Logout</button></div></header>' +
    '<nav class="app-nav">' +
    navBtn('tasks', '&#128203;', 'Tasks', v) +
    navBtn('issues', '&#9888;', 'Issues', v) +
    (isManager ? navBtn('dashboard', '&#128202;', 'Dashboard', v) : '') +
    navBtn('history', '&#128340;', 'History', v) +
    '</nav>' +
    '<main class="app-content">' + content + '</main></div>';
}

function navBtn(id, icon, label, active) {
  return '<button class="nav-btn' + (active===id?' active':'') + '" onclick="navigate(\'' + id + '\')">' +
    '<span class="nav-icon">' + icon + '</span><span class="nav-label">' + label + '</span></button>';
}


// ============ RENDER: TASKS ============
function renderTasks() {
  const tasks = state.tasks;
  if (!tasks.length) return shell('<div class="empty-state"><div class="empty-icon">&#10024;</div><div class="empty-text">Loading tasks...</div></div>');

  // Group by template
  const groups = {};
  tasks.forEach(t => {
    if (!groups[t.template_id]) groups[t.template_id] = { name: t.template_name, icon: tplIcon(t.template_id), tasks: [] };
    groups[t.template_id].tasks.push(t);
  });

  let html = '<div class="page-header"><div><h2>Today\'s Tasks</h2><div class="page-subtitle">' + new Date().toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'}) + '</div></div></div>';

  Object.entries(groups).forEach(([tid, g]) => {
    const done = g.tasks.filter(t => t.status==='done'||t.status==='excused').length;
    html += '<div class="section"><div class="section-title"><span class="icon">' + g.icon + '</span><h3>' + esc(g.name) + '</h3><span class="section-count">' + done + '/' + g.tasks.length + '</span></div>';

    // Sub-group by room
    const byRoom = {};
    g.tasks.forEach(t => { const k = t.room_id||'_home'; if(!byRoom[k]) byRoom[k]={name:t.room_name,tasks:[]}; byRoom[k].tasks.push(t); });

    Object.entries(byRoom).forEach(([rid, rm]) => {
      const rd = rm.tasks.filter(t=>t.status==='done'||t.status==='excused').length;
      const pct = Math.round(rd/rm.tasks.length*100);
      const cls = pct>=80?'high':pct>=50?'mid':'low';
      html += '<div class="room-group"><div class="room-header" onclick="toggleRoom(\'' + rid + '\')">' +
        '<h4>' + esc(rm.name) + '</h4><div class="room-progress"><div class="progress-bar"><div class="progress-fill ' + cls + '" style="width:' + pct + '%"></div></div><span class="room-pct">' + pct + '%</span></div></div>';
      html += '<div class="room-tasks" id="rt-' + rid + '">';
      html += '<div class="task-list">';
      rm.tasks.forEach(t => { html += taskCard(t); });
      html += '</div></div></div>';
    });
    html += '</div>';
  });

  return shell(html);
}


function taskCard(t) {
  const cls = t.ipc_critical ? 'ipc' : 'status-' + t.status;
  return '<div class="task-item ' + cls + '" onclick="openTaskModal(\'' + t.id + '\')">' +
    '<div class="task-checkbox">' + (t.status==='done'?'&#10003;':'') + '</div>' +
    '<div class="task-body"><div class="task-name">' + esc(t.task_name) + '</div>' +
    '<div class="task-meta">' +
    (t.time_slot ? '<span class="badge badge-' + t.time_slot.toLowerCase() + '">' + t.time_slot + '</span>' : '') +
    (t.ipc_critical ? '<span class="badge badge-ipc">IPC</span>' : '') +
    (t.status==='done'&&t.completed_at ? '<span>' + fmtTime(t.completed_at) + '</span>' : '') +
    '</div></div>' +
    '<div class="task-action">' +
    (t.status==='pending' ? '<button class="btn btn-success btn-sm" onclick="completeTask(\'' + t.id + '\')">Done</button>' : '') +
    (t.status==='done' ? '<span class="badge badge-done">Done</span>' : '') +
    (t.status==='missed' ? '<span class="badge badge-missed">Missed</span>' : '') +
    (t.status==='excused' ? '<span class="badge badge-excused">Excused</span>' : '') +
    '</div></div>';
}

function tplIcon(id) {
  const m = {'tpl_daily_room':'&#128716;','tpl_daily_communal':'&#128715;','tpl_door_handles':'&#128682;','tpl_weekly_room':'&#128197;','tpl_quarterly_deep':'&#128467;'};
  return m[id]||'&#128203;';
}

function toggleRoom(id) {
  const el = document.getElementById('rt-' + id);
  if (el) el.classList.toggle('open');
}


// ============ RENDER: ISSUES ============
function renderIssues() {
  const issues = state.issues;
  const canManage = ['supervisor','manager','maintenance'].includes(state.user?.role);

  let html = '<div class="page-header"><div><h2>Issues & Flags</h2><div class="page-subtitle">' + issues.length + ' total issues</div></div>' +
    '<button class="btn btn-primary btn-sm" onclick="openIssueModal()">+ Report</button></div>';

  html += '<div class="tabs"><button class="tab-btn active" onclick="filterIssues(\'all\',this)">All</button>' +
    '<button class="tab-btn" onclick="filterIssues(\'open\',this)">Open</button>' +
    '<button class="tab-btn" onclick="filterIssues(\'in_progress\',this)">In Progress</button>' +
    '<button class="tab-btn" onclick="filterIssues(\'resolved\',this)">Resolved</button></div>';

  if (!issues.length) {
    html += '<div class="empty-state"><div class="empty-icon">&#9989;</div><div class="empty-text">No issues reported</div></div>';
  } else {
    const sorted = [...issues].sort((a,b) => (b.created_at||'').localeCompare(a.created_at||''));
    sorted.forEach(i => {
      html += '<div class="issue-card status-' + i.status + '" data-status="' + i.status + '">' +
        '<div class="issue-top"><span class="badge badge-' + (i.status==='open'?'missed':i.status==='in_progress'?'pending':'done') + '">' + i.status.replace('_',' ') + '</span>' +
        '<span class="badge">' + esc(i.category) + '</span></div>' +
        '<div class="issue-desc">' + esc(i.description) + '</div>' +
        '<div class="issue-footer"><span>&#128205; ' + esc(i.room_name||'N/A') + '</span><span>By ' + esc(i.raised_by_name) + '</span><span>' + fmtDate(i.created_at) + '</span>' +
        (i.routed_to_name ? '<span>&#8594; ' + esc(i.routed_to_name) + '</span>' : '') + '</div>';
      if (canManage && i.status !== 'resolved') {
        html += '<div class="issue-actions">' +
          (i.status==='open' ? '<button class="btn btn-warning btn-sm" onclick="changeIssueStatus(\'' + i.id + '\',\'in_progress\')">Start</button>' : '') +
          '<button class="btn btn-success btn-sm" onclick="changeIssueStatus(\'' + i.id + '\',\'resolved\')">Resolve</button></div>';
      }
      html += '</div>';
    });
  }
  return shell(html);
}

function filterIssues(status, btn) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('.issue-card').forEach(c => {
    c.style.display = (status==='all' || c.dataset.status===status) ? '' : 'none';
  });
}


// ============ RENDER: DASHBOARD ============
function renderDashboard() {
  const d = state.dashboard;
  if (!d) return shell('<div class="empty-state"><div class="empty-icon">&#128202;</div><div class="empty-text">Loading dashboard...</div></div>');

  const cc = d.compliance_pct>=80?'green':d.compliance_pct>=50?'amber':'red';
  const ic = d.ipc.compliance_pct>=80?'green':d.ipc.compliance_pct>=50?'amber':'red';

  let html = '<div class="page-header"><h2>Compliance Dashboard</h2></div>';

  // Stats
  html += '<div class="stats-grid">' +
    statCard(d.compliance_pct + '%', "Today's Compliance", 'stat-' + cc) +
    statCard(d.today.done, 'Completed', 'stat-blue') +
    statCard(d.today.pending, 'Pending', 'stat-amber') +
    statCard(d.ipc.compliance_pct + '%', 'IPC Compliance', 'stat-' + ic) +
    '</div>';

  // 7-day chart
  html += '<div class="card"><div class="card-title">7-Day Trend</div><div class="chart-bars">';
  const max = Math.max(...d.days.map(x=>x.total), 1);
  d.days.forEach(day => {
    const h = Math.max((day.done/max)*100, 4);
    const cls = day.compliance_pct>=80?'high':day.compliance_pct>=50?'mid':'low';
    const lbl = new Date(day.date+'T12:00:00').toLocaleDateString('en-GB',{weekday:'short'});
    html += '<div class="chart-col"><div class="chart-val">' + day.compliance_pct + '%</div><div class="chart-bar-wrap"><div class="chart-bar ' + cls + '" style="height:' + h + '%"></div></div><div class="chart-label">' + lbl + '</div></div>';
  });
  html += '</div></div>';

  // Room heatmap
  html += '<div class="card"><div class="card-title">Room Compliance</div><div class="heatmap-grid">';
  d.roomCompliance.forEach(r => {
    const cls = r.compliance_pct>=80?'high':r.compliance_pct>=50?'mid':r.compliance_pct>0?'low':'none';
    const name = r.room_name.length > 5 ? r.room_name.substring(0,4) : r.room_name;
    html += '<div class="heatmap-cell ' + cls + '">' + r.compliance_pct + '%<div class="room-label">' + esc(name) + '</div></div>';
  });
  html += '</div></div>';

  // Staff table
  html += '<div class="card"><div class="card-title">Staff Performance</div><table class="data-table"><thead><tr><th>Staff</th><th>Assigned</th><th>Done</th><th>Rate</th></tr></thead><tbody>';
  d.staffPerformance.forEach(s => {
    const cls = s.completion_pct>=80?'green':s.completion_pct>=50?'amber':'red';
    html += '<tr><td><strong>' + esc(s.name) + '</strong> (' + esc(s.initials) + ')</td><td>' + s.total_assigned + '</td><td>' + s.completed + '</td><td style="color:var(--' + cls + '-600);font-weight:700">' + s.completion_pct + '%</td></tr>';
  });
  html += '</tbody></table></div>';

  // Open issues
  html += statCard(d.openIssues, 'Open Issues', d.openIssues>0?'stat-red':'stat-green');

  return shell(html);
}

function statCard(val, label, cls) {
  return '<div class="stat-card ' + (cls||'') + '"><div class="value">' + val + '</div><div class="label">' + label + '</div></div>';
}


// ============ RENDER: HISTORY ============
function renderHistory() {
  const done = state.tasks.filter(t => t.status === 'done');
  let html = '<div class="page-header"><h2>My History</h2><div class="page-subtitle">Completed today</div></div>';

  if (!done.length) {
    html += '<div class="empty-state"><div class="empty-icon">&#128221;</div><div class="empty-text">No completed tasks yet today</div></div>';
  } else {
    html += '<div class="task-list">';
    done.forEach(t => {
      html += '<div class="task-item status-done">' +
        '<div class="task-checkbox">&#10003;</div>' +
        '<div class="task-body"><div class="task-name">' + esc(t.task_name) + '</div>' +
        '<div class="task-meta"><span>' + esc(t.room_name) + '</span>' +
        (t.completed_at ? '<span>' + fmtTime(t.completed_at) + '</span>' : '') +
        (t.note ? '<span>&#128172; ' + esc(t.note) + '</span>' : '') +
        '</div></div><span class="badge badge-done">Done</span></div>';
    });
    html += '</div>';
  }
  return shell(html);
}


// ============ UTILITIES ============
function esc(s) { if (!s) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function fmtTime(iso) { try { return new Date(iso).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}); } catch { return ''; } }
function fmtDate(iso) { try { return new Date(iso).toLocaleDateString('en-GB',{day:'numeric',month:'short'}); } catch { return ''; } }

// ============ MAIN RENDER ============
function render() {
  const app = document.getElementById('app');
  switch(state.view) {
    case 'login': app.innerHTML = renderLogin(); pinValue = ''; break;
    case 'tasks': app.innerHTML = renderTasks(); break;
    case 'issues': app.innerHTML = renderIssues(); break;
    case 'dashboard': app.innerHTML = renderDashboard(); break;
    case 'history': app.innerHTML = renderHistory(); break;
    default: app.innerHTML = renderLogin();
  }
}

// ============ INIT ============
document.addEventListener('DOMContentLoaded', () => {
  if (restoreSession()) { navigate('tasks'); }
  else { navigate('login'); }
});
