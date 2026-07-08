// Merling Care Limited - Glebe House Care (Nursing) Home
// Housekeeping Checklist System - Production SPA
const API = '';
const state = {
  user: null, token: null, view: 'login',
  rooms: [], todayTasks: [], issues: [], dashboard: null,
  currentRoom: 'room_1', checklistType: 'weekly',
  checklistData: null, periodOffset: 0,
  signOffInProgress: false, // debounce guard for sign-off
  loadRequestId: 0 // race condition guard for checklist loading
};

// ===== API =====
async function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (state.token) headers['Authorization'] = 'Bearer ' + state.token;
  try {
    const res = await fetch(API + path, { ...opts, headers });
    const json = await res.json();
    if (res.status === 401) { doLogout(); return null; }
    if (!res.ok) { toast(json.error || 'Error', 'error'); return null; }
    return json;
  } catch (e) { toast('Network error', 'error'); return null; }
}

// ===== TOAST =====
function toast(msg, type = 'info') {
  const c = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = msg;
  c.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

// ===== UTILITIES =====
function esc(s) { if (!s) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// ===== AUTH =====
let pinValue = '';
async function doLogin(pin) {
  const res = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ pin }) });
  if (res) {
    state.token = res.token; state.user = res.staff;
    localStorage.setItem('hk_token', res.token);
    localStorage.setItem('hk_user', JSON.stringify(res.staff));
    toast('Welcome, ' + res.staff.name, 'success');
    await initApp();
  }
  return res;
}
function doLogout() {
  state.token = null; state.user = null; state.rooms = [];
  state.todayTasks = []; state.issues = []; state.dashboard = null;
  state.checklistData = null;
  localStorage.removeItem('hk_token'); localStorage.removeItem('hk_user');
  navigate('login');
}
function restoreSession() {
  const t = localStorage.getItem('hk_token');
  const u = localStorage.getItem('hk_user');
  if (t && u) { state.token = t; state.user = JSON.parse(u); return true; }
  return false;
}
async function initApp() {
  const rooms = await api('/api/rooms');
  if (rooms) state.rooms = rooms;
  const tasks = await api('/api/tasks/today');
  if (tasks) state.todayTasks = tasks;
  navigate('checklist');
}

// ===== NAVIGATION =====
async function navigate(view) {
  state.view = view;
  render();
  if (view === 'checklist') await loadChecklist();
  else if (view === 'dashboard') await loadDashboard();
  else if (view === 'issues') await loadIssues();
}

// ===== DATA LOADERS =====
async function loadChecklist() {
  const room = state.currentRoom;
  const type = state.checklistType;
  let url = '';
  if (type === 'weekly') {
    const target = getTargetMonth();
    url = '/api/checklists/weekly/' + room + '?month=' + target;
  } else if (type === 'daily') {
    const target = getTargetWeek();
    url = '/api/checklists/daily/' + room + '?week=' + target;
  } else if (type === 'quarterly') {
    const target = getTargetYear();
    url = '/api/checklists/quarterly/' + room + '?year=' + target;
  } else if (type === 'ipc') {
    const target = getTargetWeek();
    url = '/api/checklists/daily/' + room + '?week=' + target + '&ipc=1';
  } else if (type === 'daily-communal') {
    const target = getTargetWeek();
    url = '/api/checklists/daily-communal/' + room + '?week=' + target;
  }
  // Race condition guard: only apply the response if this is still the latest request
  const requestId = ++state.loadRequestId;
  const data = await api(url);
  if (requestId !== state.loadRequestId) return; // stale response, discard
  if (data) {
    // For IPC tab, filter to only IPC-critical tasks client-side
    if (type === 'ipc' && data.tasks) {
      data.tasks = data.tasks.filter(t => t.ipc_critical);
    }
    state.checklistData = data;
    render();
  }
}

async function loadDashboard() {
  const data = await api('/api/dashboard/compliance');
  if (data) { state.dashboard = data; render(); }
}

async function loadIssues() {
  const data = await api('/api/issues');
  if (data) { state.issues = data; render(); }
}

// ===== PERIOD HELPERS =====
function getTargetMonth() {
  const now = new Date();
  now.setMonth(now.getMonth() + state.periodOffset);
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return y + '-' + m;
}
function getTargetWeek() {
  const now = new Date();
  now.setDate(now.getDate() + (state.periodOffset * 7));
  const day = now.getDay();
  const mondayOff = day === 0 ? -6 : 1 - day;
  now.setDate(now.getDate() + mondayOff);
  return now.toISOString().split('T')[0];
}
function getTargetYear() {
  return new Date().getFullYear() + state.periodOffset;
}
function getPeriodLabel() {
  if (state.checklistType === 'weekly') {
    const d = state.checklistData;
    return d ? d.month + ' ' + d.year : getTargetMonth();
  } else if (state.checklistType === 'quarterly') {
    const d = state.checklistData;
    return d ? 'Year ' + d.year : 'Year ' + getTargetYear();
  } else {
    const d = state.checklistData;
    if (d) return formatDateShort(d.weekStart) + ' - ' + formatDateShort(d.weekEnd);
    return 'This Week';
  }
}
function formatDateShort(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}
function changePeriod(dir) {
  state.periodOffset += dir;
  state.checklistData = null;
  render();
  loadChecklist();
}
function resetPeriod() {
  state.periodOffset = 0;
  state.checklistData = null;
  render();
  loadChecklist();
}

// ===== ROOM/TYPE SWITCHING =====
function selectRoom(roomId) {
  state.currentRoom = roomId;
  state.periodOffset = 0;
  state.checklistData = null;
  // Auto-switch type for communal areas
  const room = state.rooms.find(r => r.id === roomId);
  if (room && room.type === 'communal') {
    state.checklistType = 'daily-communal';
  } else if (state.checklistType === 'daily-communal') {
    state.checklistType = 'weekly';
  }
  render();
  loadChecklist();
}
function selectChecklistType(type) {
  state.checklistType = type;
  state.periodOffset = 0;
  state.checklistData = null;
  render();
  loadChecklist();
}

// ===== TASK COMPLETION =====
function getCurrentWeekNumber() {
  const now = new Date();
  return Math.ceil(now.getDate() / 7);
}
function getTodayStr() {
  return new Date().toISOString().split('T')[0];
}
function isCurrentPeriod() { return state.periodOffset === 0; }

async function signOffTask(taskDefId, periodKey) {
  // Debounce guard: prevent double-tap
  if (state.signOffInProgress) return;
  state.signOffInProgress = true;
  try {
    // Find matching today task instance
    const today = getTodayStr();
    const matching = state.todayTasks.filter(t =>
      t.task_definition_id === taskDefId &&
      t.room_id === state.currentRoom &&
      t.date === today &&
      t.status === 'pending'
    );
    if (matching.length === 0) {
      toast('No pending task found for today', 'warning');
      return;
    }
    const taskInstance = matching[0];
    const res = await api('/api/tasks/' + taskInstance.id + '/complete', {
      method: 'POST', body: JSON.stringify({})
    });
    if (res) {
      toast('Signed off!', 'success');
      // Refresh
      const tasks = await api('/api/tasks/today');
      if (tasks) state.todayTasks = tasks;
      await loadChecklist();
    }
  } finally {
    state.signOffInProgress = false;
  }
}

// ===== PIN PAD =====
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
        pinValue = ''; updateDots();
      }
    }, 250);
  }
}
function pinClear() { pinValue = ''; updateDots(); const e = document.getElementById('pin-error'); if(e) e.textContent=''; }
function pinBack() { pinValue = pinValue.slice(0,-1); updateDots(); }
function updateDots() { for(let i=0;i<4;i++){const el=document.getElementById('d'+i);if(el)el.className='pin-dot'+(i<pinValue.length?' active':'');} }

// ===== MODAL =====
function openModal(html) {
  document.getElementById('modal-root').innerHTML = '<div class="modal-backdrop" onclick="if(event.target===this)closeModal()"><div class="modal-panel" style="position:relative">' + html + '</div></div>';
}
function closeModal() { document.getElementById('modal-root').innerHTML = ''; }

// ===== ISSUE SUBMISSION =====
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
function openIssueModal() {
  const roomOpts = state.rooms.map(r => '<option value="' + r.id + '">' + esc(r.room_number) + '</option>').join('');
  openModal(
    '<h3 class="modal-title">Report Issue</h3>' +
    '<div class="form-group"><label class="form-label">Category</label><select class="form-select" id="issue-cat"><option value="damage">Damage</option><option value="stock_out">Stock Out</option><option value="access_issue">Access Issue</option></select></div>' +
    '<div class="form-group"><label class="form-label">Room/Area</label><select class="form-select" id="issue-room"><option value="">Select...</option>' + roomOpts + '</select></div>' +
    '<div class="form-group"><label class="form-label">Description</label><textarea class="form-textarea" id="issue-desc" placeholder="Describe the issue..."></textarea></div>' +
    '<button class="btn btn-primary btn-block" onclick="submitIssue()">Submit Issue</button>'
  );
}

// ===== RENDER: LOGIN =====
function renderLogin() {
  return '<div class="login-page"><div class="login-card">' +
    '<div class="login-brand"><div class="login-brand-icon">&#127968;</div>' +
    '<h1>Merling Care Limited</h1><h2>Glebe House Care (Nursing) Home</h2>' +
    '<p>Housekeeping Checklist System</p></div>' +
    '<div class="pin-dots"><div class="pin-dot" id="d0"></div><div class="pin-dot" id="d1"></div><div class="pin-dot" id="d2"></div><div class="pin-dot" id="d3"></div></div>' +
    '<div class="pin-grid">' +
    [1,2,3,4,5,6,7,8,9].map(n => '<button class="pin-btn" onclick="pinKey(\'' + n + '\')">' + n + '</button>').join('') +
    '<button class="pin-btn fn" onclick="pinClear()">Clear</button>' +
    '<button class="pin-btn" onclick="pinKey(\'0\')">0</button>' +
    '<button class="pin-btn fn" onclick="pinBack()">&#9003;</button></div>' +
    '<div class="login-error" id="pin-error"></div>' +
    '<div class="login-hint">Staff PINs: 1234 (HS) | 2345 (RT) | 5678 (SM) | 6789 (JC)</div>' +
    '</div></div>';
}

// ===== RENDER: APP SHELL =====
function renderShell(content) {
  const u = state.user;
  const isManager = ['supervisor','manager','auditor'].includes(u?.role);
  const v = state.view;
  return '<div class="app-shell">' +
    '<header class="app-header"><div class="header-top">' +
    '<div class="header-brand"><h1>Merling Care Limited - Glebe House Care (Nursing) Home</h1>' +
    '<h2>Digital Housekeeping Checklist System</h2></div>' +
    '<div class="header-user"><div class="header-user-info"><div class="header-user-name">' + esc(u?.name) + '</div>' +
    '<div class="header-user-role">' + esc(u?.role) + '</div></div>' +
    '<div class="header-avatar">' + esc(u?.initials) + '</div>' +
    '<button class="btn-logout" onclick="doLogout()">Logout</button></div>' +
    '</div></header>' +
    '<nav class="nav-tabs">' +
    navTab('checklist', 'Checklists', v) +
    (isManager ? navTab('dashboard', 'Dashboard', v) : '') +
    navTab('issues', 'Issues', v) +
    '</nav>' +
    '<main class="app-main">' + content + '</main></div>';
}
function navTab(id, label, active) {
  return '<button class="nav-tab' + (active===id?' active':'') + '" onclick="navigate(\'' + id + '\')">' + label + '</button>';
}

// ===== RENDER: CHECKLIST VIEW =====
function renderChecklist() {
  const room = state.rooms.find(r => r.id === state.currentRoom);
  const isCommunal = room && room.type === 'communal';
  const type = state.checklistType;

  // Title based on type
  let title = '';
  if (type === 'weekly') title = 'Weekly Housekeeping Check List of the Resident Room';
  else if (type === 'daily' || type === 'daily-communal') title = 'Daily Housekeeping Check List';
  else if (type === 'quarterly') title = '3-Monthly Deep Clean Check List';
  else if (type === 'ipc') title = 'IPC - Door Handles & Handrails';

  let html = '<div class="checklist-view">';
  // Checklist header
  html += '<div class="checklist-header"><div class="checklist-title">' + esc(title) + '</div>';
  html += '<div class="checklist-subtitle">Room: ' + esc(room?.room_number || '') + ' | ' + getPeriodLabel() + '</div></div>';

  // Room selector
  html += '<div class="room-selector"><label>Room:</label><select class="room-select" onchange="selectRoom(this.value)">';
  const residentRooms = state.rooms.filter(r => r.type === 'resident');
  const communalRooms = state.rooms.filter(r => r.type === 'communal');
  html += '<optgroup label="Resident Rooms">';
  residentRooms.forEach(r => {
    html += '<option value="' + r.id + '"' + (r.id === state.currentRoom ? ' selected' : '') + '>Room ' + esc(r.room_number) + '</option>';
  });
  html += '</optgroup><optgroup label="Communal Areas">';
  communalRooms.forEach(r => {
    html += '<option value="' + r.id + '"' + (r.id === state.currentRoom ? ' selected' : '') + '>' + esc(r.room_number) + '</option>';
  });
  html += '</optgroup></select></div>';

  // Checklist type tabs
  html += '<div class="checklist-tabs">';
  if (!isCommunal) {
    html += checklistTab('weekly', 'Weekly', type);
    html += checklistTab('daily', 'Daily', type);
    html += checklistTab('quarterly', '3-Monthly', type);
    html += checklistTab('ipc', 'IPC', type);
  } else {
    html += checklistTab('daily-communal', 'Daily', type);
    html += checklistTab('ipc', 'IPC', type);
  }
  html += '</div>';

  // Period navigation
  html += '<div class="period-nav">';
  html += '<button class="period-nav-btn" onclick="changePeriod(-1)">&larr;</button>';
  html += '<span class="period-label">' + getPeriodLabel() + '</span>';
  if (state.periodOffset < 0) html += '<button class="period-nav-btn" onclick="resetPeriod()">Today</button>';
  html += '<button class="period-nav-btn" onclick="changePeriod(1)">&rarr;</button></div>';

  // Table
  html += '<div class="table-container">';
  if (!state.checklistData) {
    html += '<div style="padding:40px;text-align:center;color:#6b7280">Loading checklist data...</div>';
  } else if (type === 'weekly') {
    html += renderWeeklyTable();
  } else if (type === 'daily' || type === 'daily-communal') {
    html += renderDailyTable();
  } else if (type === 'quarterly') {
    html += renderQuarterlyTable();
  } else if (type === 'ipc') {
    html += renderDailyTable();
  }
  html += '</div></div>';
  return renderShell(html);
}
function checklistTab(id, label, active) {
  return '<button class="checklist-tab' + (active===id?' active':'') + '" onclick="selectChecklistType(\'' + id + '\')">' + label + '</button>';
}

// ===== RENDER: WEEKLY TABLE =====
function renderWeeklyTable() {
  const data = state.checklistData;
  if (!data || !data.tasks) return '<div style="padding:20px;text-align:center">No data</div>';
  const today = getTodayStr();
  const currentWeek = isCurrentPeriod() ? getCurrentWeekNumber() : -1;
  // Determine today's day-of-week to show which day the sign-off relates to
  const todayDate = new Date();
  const todayDow = todayDate.getDay(); // 0=Sun, 1=Mon, ...
  let html = '<table class="checklist-table"><thead><tr>';
  html += '<th>Specification</th>';
  for (let w = 1; w <= 5; w++) {
    const isCurrent = w === currentWeek;
    html += '<th class="col-week' + (isCurrent ? ' current-period' : '') + '">W' + w + '</th>';
    html += '<th class="col-sign' + (isCurrent ? ' current-period' : '') + '">Sign</th>';
  }
  html += '</tr></thead><tbody>';
  data.tasks.forEach(task => {
    html += '<tr>';
    html += '<td>' + esc(task.name) + '</td>';
    for (let w = 1; w <= 5; w++) {
      const slot = task['w' + w];
      const isCurrent = w === currentWeek;
      const colClass = isCurrent ? ' current-col' : '';
      if (slot && slot.done) {
        html += '<td class="cell-done' + colClass + '">&#10003;</td>';
        html += '<td class="cell-initials' + colClass + '">' + esc(slot.initials) + '</td>';
      } else if (isCurrent && isCurrentPeriod() && slot && slot.date === today) {
        // Only interactive if this week slot has a task instance for TODAY
        html += '<td class="cell-interactive' + colClass + '" onclick="signOffTask(\'' + task.id + '\',\'w' + w + '\')" title="Tap to sign off today\'s task">&#9744;</td>';
        html += '<td class="' + colClass + '"></td>';
      } else if (slot && slot.status === 'missed') {
        html += '<td class="cell-missed' + colClass + '">&#10007;</td>';
        html += '<td class="' + colClass + '"></td>';
      } else if (isCurrent && isCurrentPeriod()) {
        // Current week but not today's slot - show as non-interactive pending
        html += '<td class="cell-pending' + colClass + '" title="Available on scheduled day only">&#8211;</td>';
        html += '<td class="' + colClass + '"></td>';
      } else {
        html += '<td class="cell-pending' + colClass + '"></td>';
        html += '<td class="' + colClass + '"></td>';
      }
    }
    html += '</tr>';
  });
  html += '</tbody></table>';
  return html;
}

// ===== RENDER: DAILY TABLE =====
function renderDailyTable() {
  const data = state.checklistData;
  if (!data || !data.tasks) return '<div style="padding:20px;text-align:center">No data</div>';
  const today = getTodayStr();
  const dayNames = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  let html = '<table class="checklist-table"><thead><tr>';
  html += '<th>Specification</th>';
  dayNames.forEach((day, idx) => {
    const dayDate = data.tasks[0]?.days[idx]?.date || '';
    const isToday = dayDate === today;
    html += '<th class="col-day' + (isToday ? ' current-period' : '') + '">' + day + '</th>';
    html += '<th class="col-sign' + (isToday ? ' current-period' : '') + '">Sign</th>';
  });
  html += '</tr></thead><tbody>';
  data.tasks.forEach(task => {
    html += '<tr><td>' + esc(task.name) + '</td>';
    task.days.forEach((day, idx) => {
      const isToday = day.date === today;
      const colClass = isToday ? ' current-col' : '';
      if (day.done) {
        html += '<td class="cell-done' + colClass + '">&#10003;</td>';
        html += '<td class="cell-initials' + colClass + '">' + esc(day.initials) + '</td>';
      } else if (isToday && isCurrentPeriod()) {
        // Only today's cell is interactive, regardless of period offset
        html += '<td class="cell-interactive' + colClass + '" onclick="signOffTask(\'' + task.id + '\',\'' + day.date + '\')" title="Tap to sign off">&#9744;</td>';
        html += '<td class="' + colClass + '"></td>';
      } else if (day.status === 'missed') {
        html += '<td class="cell-missed' + colClass + '">&#10007;</td>';
        html += '<td class="' + colClass + '"></td>';
      } else {
        html += '<td class="cell-pending' + colClass + '"></td>';
        html += '<td class="' + colClass + '"></td>';
      }
    });
    html += '</tr>';
  });
  html += '</tbody></table>';
  return html;
}

// ===== RENDER: QUARTERLY TABLE =====
function renderQuarterlyTable() {
  const data = state.checklistData;
  if (!data || !data.tasks) return '<div style="padding:20px;text-align:center">No data</div>';
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const quarterMonths = [0, 3, 6, 9];
  const currentMonth = new Date().getMonth();
  let html = '<table class="checklist-table"><thead><tr>';
  html += '<th>Specification</th>';
  quarterMonths.forEach(m => {
    const isCurrent = m === currentMonth || (m <= currentMonth && m + 3 > currentMonth);
    html += '<th class="col-week' + (isCurrent && isCurrentPeriod() ? ' current-period' : '') + '">' + months[m] + '</th>';
    html += '<th class="col-sign' + (isCurrent && isCurrentPeriod() ? ' current-period' : '') + '">Sign</th>';
  });
  html += '</tr></thead><tbody>';
  data.tasks.forEach(task => {
    html += '<tr><td>' + esc(task.name) + '</td>';
    quarterMonths.forEach(m => {
      const entry = task.entries.find(e => e.month_number === m + 1);
      const isCurrent = (m <= currentMonth && m + 3 > currentMonth) && isCurrentPeriod();
      const colClass = isCurrent ? ' current-col' : '';
      if (entry && entry.done) {
        html += '<td class="cell-done' + colClass + '">&#10003;</td>';
        html += '<td class="cell-initials' + colClass + '">' + esc(entry.initials) + '</td>';
      } else if (entry && entry.status === 'missed') {
        html += '<td class="cell-missed' + colClass + '">&#10007;</td>';
        html += '<td class="' + colClass + '"></td>';
      } else {
        html += '<td class="cell-pending' + colClass + '"></td>';
        html += '<td class="' + colClass + '"></td>';
      }
    });
    html += '</tr>';
  });
  html += '</tbody></table>';
  return html;
}

// ===== RENDER: DASHBOARD =====
function renderDashboard() {
  const d = state.dashboard;
  if (!d) return renderShell('<div class="dashboard-view"><div style="padding:40px;text-align:center;color:#6b7280">Loading dashboard...</div></div>');
  let html = '<div class="dashboard-view">';
  html += '<h2 class="dashboard-title">Compliance Dashboard</h2>';
  const cc = d.compliance_pct >= 80 ? 'green' : d.compliance_pct >= 50 ? 'amber' : 'red';
  html += '<div class="stats-row">';
  html += statCard(d.compliance_pct + '%', 'Compliance', 'stat-' + cc);
  html += statCard(d.today.done, 'Completed', 'stat-green');
  html += statCard(d.today.pending, 'Pending', 'stat-amber');
  html += statCard(d.ipc.compliance_pct + '%', 'IPC', 'stat-primary');
  html += '</div>';
  html += '<div class="dash-card"><div class="dash-card-title">7-Day Trend</div><div class="chart-container">';
  const max = Math.max(...d.days.map(x => x.total), 1);
  d.days.forEach(day => {
    const h = Math.max((day.done / max) * 100, 4);
    const cls = day.compliance_pct >= 80 ? 'high' : day.compliance_pct >= 50 ? 'mid' : 'low';
    const lbl = new Date(day.date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short' });
    html += '<div class="chart-bar-col"><div class="chart-val">' + day.compliance_pct + '%</div><div class="chart-bar-wrap"><div class="chart-bar ' + cls + '" style="height:' + h + '%"></div></div><div class="chart-lbl">' + lbl + '</div></div>';
  });
  html += '</div></div>';
  html += '<div class="dash-card"><div class="dash-card-title">Room Compliance</div><div class="room-grid">';
  d.roomCompliance.forEach(r => {
    const cls = r.compliance_pct >= 80 ? 'high' : r.compliance_pct >= 50 ? 'mid' : r.compliance_pct > 0 ? 'low' : 'none';
    html += '<div class="room-cell ' + cls + '">' + r.compliance_pct + '%<div class="room-cell-name">' + esc(r.room_name) + '</div></div>';
  });
  html += '</div></div>';
  html += '<div class="dash-card"><div class="dash-card-title">Staff Performance</div><table class="staff-table"><thead><tr><th>Staff</th><th>Done</th><th>Total</th><th>Rate</th></tr></thead><tbody>';
  d.staffPerformance.forEach(s => {
    html += '<tr><td>' + esc(s.name) + ' (' + esc(s.initials) + ')</td><td>' + s.completed + '</td><td>' + s.total_assigned + '</td><td style="color:' + (s.completion_pct >= 80 ? 'var(--green-600)' : 'var(--red-600)') + '">' + s.completion_pct + '%</td></tr>';
  });
  html += '</tbody></table></div></div>';
  return renderShell(html);
}
function statCard(val, label, cls) {
  return '<div class="stat-card ' + cls + '"><div class="stat-value">' + val + '</div><div class="stat-label">' + label + '</div></div>';
}

// ===== RENDER: ISSUES =====
function renderIssues() {
  const issues = state.issues;
  const canManage = ['supervisor','manager','maintenance'].includes(state.user?.role);
  let html = '<div class="issues-view">';
  html += '<div class="issues-header"><h2>Issues & Flags</h2><button class="btn btn-primary btn-sm" onclick="openIssueModal()">+ Report</button></div>';
  if (!issues.length) {
    html += '<div style="padding:40px;text-align:center;color:#6b7280">No issues reported</div>';
  } else {
    issues.forEach(i => {
      const badgeCls = i.status === 'open' ? 'issue-badge-open' : i.status === 'in_progress' ? 'issue-badge-progress' : 'issue-badge-resolved';
      html += '<div class="issue-card status-' + i.status + '">';
      html += '<div class="issue-top"><span class="issue-badge ' + badgeCls + '">' + i.status.replace('_', ' ') + '</span></div>';
      html += '<div class="issue-desc">' + esc(i.description) + '</div>';
      html += '<div class="issue-meta"><span>Room: ' + esc(i.room_name || 'N/A') + '</span><span>By: ' + esc(i.raised_by_name) + '</span></div>';
      if (canManage && i.status !== 'resolved') {
        html += '<div class="issue-actions">';
        if (i.status === 'open') html += '<button class="btn btn-warning btn-sm" onclick="changeIssueStatus(\'' + i.id + '\',\'in_progress\')">Start</button>';
        html += '<button class="btn btn-success btn-sm" onclick="changeIssueStatus(\'' + i.id + '\',\'resolved\')">Resolve</button></div>';
      }
      html += '</div>';
    });
  }
  html += '</div>';
  return renderShell(html);
}

// ===== MAIN RENDER =====
function render() {
  const app = document.getElementById('app');
  switch (state.view) {
    case 'login': app.innerHTML = renderLogin(); pinValue = ''; break;
    case 'checklist': app.innerHTML = renderChecklist(); break;
    case 'dashboard': app.innerHTML = renderDashboard(); break;
    case 'issues': app.innerHTML = renderIssues(); break;
    default: app.innerHTML = renderLogin();
  }
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', async () => {
  if (restoreSession()) {
    await initApp();
  } else {
    navigate('login');
  }
});
