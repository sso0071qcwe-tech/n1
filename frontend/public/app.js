// ==========================================
// HOUSEKEEPING COMPLIANCE APP - Frontend
// Single Page Application (vanilla JS)
// ==========================================

const API_BASE = '';
let state = {
  user: null,
  token: null,
  currentView: 'login',
  tasks: [],
  issues: [],
  dashboard: null,
  loading: false
};


// ==========================================
// API CLIENT
// ==========================================

async function api(endpoint, options = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (state.token) headers['Authorization'] = `Bearer ${state.token}`;
  
  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: { ...headers, ...options.headers }
  });
  
  const data = await res.json();
  if (res.status === 401) {
    logout();
    return null;
  }
  if (!res.ok) {
    showToast(data.error || 'Something went wrong', 'error');
    return null;
  }
  return data;
}


// ==========================================
// TOAST NOTIFICATIONS
// ==========================================

function showToast(message, type = 'info') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}


// ==========================================
// AUTH
// ==========================================

async function login(pin) {
  const result = await api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ pin })
  });
  if (result) {
    state.token = result.token;
    state.user = result.staff;
    localStorage.setItem('token', result.token);
    localStorage.setItem('user', JSON.stringify(result.staff));
    navigateTo('tasks');
  }
  return result;
}

function logout() {
  state.token = null;
  state.user = null;
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  navigateTo('login');
}

function restoreSession() {
  const token = localStorage.getItem('token');
  const user = localStorage.getItem('user');
  if (token && user) {
    state.token = token;
    state.user = JSON.parse(user);
    return true;
  }
  return false;
}


// ==========================================
// NAVIGATION
// ==========================================

function navigateTo(view) {
  state.currentView = view;
  render();
  if (view === 'tasks') loadTasks();
  if (view === 'dashboard') loadDashboard();
  if (view === 'issues') loadIssues();
}


// ==========================================
// DATA LOADING
// ==========================================

async function loadTasks() {
  const data = await api('/api/tasks/today');
  if (data) {
    state.tasks = data;
    render();
  }
}

async function loadDashboard() {
  const data = await api('/api/dashboard/compliance');
  if (data) {
    state.dashboard = data;
    render();
  }
}

async function loadIssues() {
  const data = await api('/api/issues');
  if (data) {
    state.issues = data;
    render();
  }
}

async function completeTask(taskId) {
  const result = await api(`/api/tasks/${taskId}/complete`, {
    method: 'POST',
    body: JSON.stringify({})
  });
  if (result) {
    showToast('Task completed!', 'success');
    loadTasks();
  }
}

async function submitIssue(issueData) {
  const result = await api('/api/issues', {
    method: 'POST',
    body: JSON.stringify(issueData)
  });
  if (result) {
    showToast('Issue reported!', 'success');
    closeModal();
    loadIssues();
  }
}

async function updateIssueStatus(issueId, status) {
  const result = await api(`/api/issues/${issueId}/status`, {
    method: 'POST',
    body: JSON.stringify({ status })
  });
  if (result) {
    showToast('Issue updated!', 'success');
    loadIssues();
  }
}


// ==========================================
// MODAL SYSTEM
// ==========================================

function showModal(content) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.onclick = (e) => { if (e.target === overlay) closeModal(); };
  overlay.innerHTML = `<div class="modal">${content}</div>`;
  document.body.appendChild(overlay);
}

function closeModal() {
  const overlay = document.querySelector('.modal-overlay');
  if (overlay) overlay.remove();
}


// ==========================================
// RENDER - LOGIN SCREEN
// ==========================================

function renderLogin() {
  return `
    <div class="login-screen">
      <div class="login-card">
        <div class="login-logo">🏠</div>
        <div class="login-title">Glebe House</div>
        <div class="login-subtitle">Housekeeping Compliance System</div>
        <div class="pin-display">
          <div class="pin-dot" id="dot0"></div>
          <div class="pin-dot" id="dot1"></div>
          <div class="pin-dot" id="dot2"></div>
          <div class="pin-dot" id="dot3"></div>
        </div>
        <div class="pin-pad">
          <button class="pin-key" onclick="pinPress('1')">1</button>
          <button class="pin-key" onclick="pinPress('2')">2</button>
          <button class="pin-key" onclick="pinPress('3')">3</button>
          <button class="pin-key" onclick="pinPress('4')">4</button>
          <button class="pin-key" onclick="pinPress('5')">5</button>
          <button class="pin-key" onclick="pinPress('6')">6</button>
          <button class="pin-key" onclick="pinPress('7')">7</button>
          <button class="pin-key" onclick="pinPress('8')">8</button>
          <button class="pin-key" onclick="pinPress('9')">9</button>
          <button class="pin-key action" onclick="pinClear()">Clear</button>
          <button class="pin-key" onclick="pinPress('0')">0</button>
          <button class="pin-key action" onclick="pinBackspace()">&#9003;</button>
        </div>
        <div class="login-error" id="loginError"></div>
      </div>
    </div>
  `;
}

let pinValue = '';

function pinPress(digit) {
  if (pinValue.length >= 4) return;
  pinValue += digit;
  updatePinDots();
  if (pinValue.length === 4) {
    setTimeout(async () => {
      const result = await login(pinValue);
      if (!result) {
        document.getElementById('loginError').textContent = 'Invalid PIN. Try again.';
        pinValue = '';
        updatePinDots();
      }
    }, 200);
  }
}

function pinClear() {
  pinValue = '';
  updatePinDots();
  const err = document.getElementById('loginError');
  if (err) err.textContent = '';
}

function pinBackspace() {
  pinValue = pinValue.slice(0, -1);
  updatePinDots();
}

function updatePinDots() {
  for (let i = 0; i < 4; i++) {
    const dot = document.getElementById(`dot${i}`);
    if (dot) dot.className = `pin-dot ${i < pinValue.length ? 'filled' : ''}`;
  }
}


// ==========================================
// RENDER - APP SHELL (Header + Nav)
// ==========================================

function renderAppShell(content) {
  const isManager = ['supervisor', 'manager', 'auditor'].includes(state.user?.role);
  
  return `
    <div class="app-header">
      <h1>🏠 Glebe House</h1>
      <div class="header-user">
        <div class="header-avatar">${state.user?.initials || '?'}</div>
        <button class="header-logout" onclick="logout()">Logout</button>
      </div>
    </div>
    <nav class="bottom-nav">
      <button class="nav-item ${state.currentView === 'tasks' ? 'active' : ''}" onclick="navigateTo('tasks')">
        <span class="nav-icon">📋</span>
        <span>Tasks</span>
      </button>
      <button class="nav-item ${state.currentView === 'issues' ? 'active' : ''}" onclick="navigateTo('issues')">
        <span class="nav-icon">⚠️</span>
        <span>Issues</span>
      </button>
      ${isManager ? `
      <button class="nav-item ${state.currentView === 'dashboard' ? 'active' : ''}" onclick="navigateTo('dashboard')">
        <span class="nav-icon">📊</span>
        <span>Dashboard</span>
      </button>
      ` : ''}
      <button class="nav-item ${state.currentView === 'history' ? 'active' : ''}" onclick="navigateTo('history')">
        <span class="nav-icon">🕐</span>
        <span>History</span>
      </button>
    </nav>
    <div class="content">
      ${content}
    </div>
  `;
}


// ==========================================
// RENDER - TASKS VIEW (Staff)
// ==========================================

function renderTasks() {
  if (!state.tasks.length) {
    return renderAppShell(`
      <div class="empty-state">
        <div class="empty-state-icon">✨</div>
        <div class="empty-state-text">No tasks assigned for today</div>
      </div>
    `);
  }

  // Group tasks by template/category
  const grouped = {};
  state.tasks.forEach(t => {
    const key = t.template_id;
    if (!grouped[key]) grouped[key] = { name: t.template_name, tasks: [], icon: getTemplateIcon(key) };
    grouped[key].tasks.push(t);
  });

  // Further group room tasks by room
  let html = '';
  
  Object.entries(grouped).forEach(([templateId, group]) => {
    const total = group.tasks.length;
    const done = group.tasks.filter(t => t.status === 'done' || t.status === 'excused').length;
    
    html += `
      <div class="section-header">
        <span class="section-icon">${group.icon}</span>
        <span class="section-title">${group.name}</span>
        <span class="section-badge">${done}/${total}</span>
      </div>
    `;

    // Group by room within template
    const byRoom = {};
    group.tasks.forEach(t => {
      const roomKey = t.room_id || 'whole_home';
      if (!byRoom[roomKey]) byRoom[roomKey] = { name: t.room_name, tasks: [] };
      byRoom[roomKey].tasks.push(t);
    });

    Object.entries(byRoom).forEach(([roomId, room]) => {
      const roomDone = room.tasks.filter(t => t.status === 'done' || t.status === 'excused').length;
      const roomTotal = room.tasks.length;
      const pct = Math.round((roomDone / roomTotal) * 100);
      const color = pct >= 80 ? 'green' : pct >= 50 ? 'amber' : 'red';

      html += `<div class="room-group">`;
      html += `
        <div class="room-group-header" onclick="toggleRoom('${roomId}')">
          <h3>${room.name}</h3>
          <div class="room-progress">
            <div class="progress-bar"><div class="progress-fill ${color}" style="width:${pct}%"></div></div>
            <span class="progress-text">${roomDone}/${roomTotal}</span>
          </div>
        </div>
      `;
      html += `<div class="room-tasks" id="room-${roomId}">`;
      room.tasks.forEach(t => {
        const statusClass = t.ipc_critical ? 'ipc' : t.status;
        html += `
          <div class="task-card ${statusClass}" onclick="handleTaskClick('${t.id}', '${t.status}')">
            <div class="task-check">${t.status === 'done' ? '✓' : ''}</div>
            <div class="task-info">
              <div class="task-name">${t.task_name}</div>
              <div class="task-meta">
                ${t.time_slot ? `<span class="badge-ipc task-badge">${t.time_slot}</span> ` : ''}
                ${t.ipc_critical ? '<span class="badge-ipc task-badge">IPC</span> ' : ''}
                ${t.completed_at ? `Done at ${new Date(t.completed_at).toLocaleTimeString('en-GB', {hour:'2-digit',minute:'2-digit'})}` : ''}
              </div>
            </div>
            ${t.status === 'pending' ? '<button class="btn btn-success btn-sm" onclick="event.stopPropagation();completeTask(\''+t.id+'\')">Done</button>' : ''}
            ${t.status === 'done' ? '<span class="task-badge badge-done">Done</span>' : ''}
            ${t.status === 'missed' ? '<span class="task-badge badge-missed">Missed</span>' : ''}
          </div>
        `;
      });
      html += `</div></div>`;
    });
  });

  return renderAppShell(html);
}

function getTemplateIcon(templateId) {
  const icons = {
    'tpl_daily_room': '🛏️',
    'tpl_daily_communal': '🛋️',
    'tpl_door_handles': '🚪',
    'tpl_weekly_room': '📅',
    'tpl_quarterly_deep': '🗓️'
  };
  return icons[templateId] || '📋';
}

function toggleRoom(roomId) {
  const el = document.getElementById(`room-${roomId}`);
  if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

function handleTaskClick(taskId, status) {
  if (status === 'pending') {
    showTaskModal(taskId);
  }
}


// ==========================================
// TASK DETAIL MODAL
// ==========================================

function showTaskModal(taskId) {
  const task = state.tasks.find(t => t.id === taskId);
  if (!task) return;

  showModal(`
    <div class="modal-header">
      <h2>${task.task_name}</h2>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div style="margin-bottom:16px;">
      <div class="task-meta" style="font-size:0.9rem;color:var(--gray-600);">
        <p><strong>Room:</strong> ${task.room_name}</p>
        <p><strong>Checklist:</strong> ${task.template_name}</p>
        ${task.time_slot ? `<p><strong>Time Slot:</strong> ${task.time_slot}</p>` : ''}
        ${task.ipc_critical ? '<p style="color:#7c3aed;font-weight:600;">⚠️ IPC Critical Task</p>' : ''}
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Note (optional)</label>
      <textarea class="form-textarea" id="taskNote" placeholder="Add a note..."></textarea>
    </div>
    <div style="display:flex;gap:8px;">
      <button class="btn btn-success btn-block btn-lg" onclick="completeTaskWithNote('${taskId}')">
        ✓ Mark as Done
      </button>
      <button class="btn btn-warning btn-sm" onclick="flagFromTask('${taskId}','${task.room_id || ''}')">
        ⚠️ Flag
      </button>
    </div>
  `);
}

async function completeTaskWithNote(taskId) {
  const note = document.getElementById('taskNote')?.value || '';
  const result = await api(`/api/tasks/${taskId}/complete`, {
    method: 'POST',
    body: JSON.stringify({ note })
  });
  if (result) {
    showToast('Task completed!', 'success');
    closeModal();
    loadTasks();
  }
}

function flagFromTask(taskId, roomId) {
  closeModal();
  showIssueModal(roomId);
}


// ==========================================
// RENDER - ISSUES VIEW
// ==========================================

function renderIssues() {
  const isManager = ['supervisor', 'manager', 'maintenance'].includes(state.user?.role);
  
  let html = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
      <h2>Issues & Flags</h2>
      <button class="btn btn-primary btn-sm" onclick="showIssueModal()">+ Report Issue</button>
    </div>
  `;

  // Tab filter
  html += `
    <div class="tabs">
      <button class="tab active" onclick="filterIssues('all')">All</button>
      <button class="tab" onclick="filterIssues('open')">Open</button>
      <button class="tab" onclick="filterIssues('in_progress')">In Progress</button>
      <button class="tab" onclick="filterIssues('resolved')">Resolved</button>
    </div>
  `;

  if (!state.issues.length) {
    html += `<div class="empty-state"><div class="empty-state-icon">✅</div><div class="empty-state-text">No issues reported</div></div>`;
  } else {
    state.issues.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
    state.issues.forEach(issue => {
      html += `
        <div class="issue-card ${issue.status}" id="issue-${issue.id}">
          <div class="issue-header">
            <span class="issue-category">${issue.category}</span>
            <span class="issue-status ${issue.status}">${issue.status.replace('_', ' ')}</span>
          </div>
          <div class="issue-description">${issue.description}</div>
          <div class="issue-meta">
            ${issue.room_name ? `📍 ${issue.room_name}` : ''} &bull;
            Reported by ${issue.raised_by_name} &bull;
            ${new Date(issue.created_at).toLocaleDateString('en-GB')}
            ${issue.routed_to_name ? ` &bull; Assigned: ${issue.routed_to_name}` : ''}
          </div>
          ${isManager && issue.status !== 'resolved' ? `
            <div style="margin-top:10px;display:flex;gap:8px;">
              ${issue.status === 'open' ? `<button class="btn btn-warning btn-sm" onclick="updateIssueStatus('${issue.id}','in_progress')">Start Work</button>` : ''}
              <button class="btn btn-success btn-sm" onclick="updateIssueStatus('${issue.id}','resolved')">Resolve</button>
            </div>
          ` : ''}
        </div>
      `;
    });
  }

  return renderAppShell(html);
}

function filterIssues(status) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  event.target.classList.add('active');
  document.querySelectorAll('.issue-card').forEach(card => {
    if (status === 'all') { card.style.display = 'block'; }
    else { card.style.display = card.classList.contains(status) ? 'block' : 'none'; }
  });
}


// ==========================================
// ISSUE REPORT MODAL
// ==========================================

function showIssueModal(roomId) {
  showModal(`
    <div class="modal-header">
      <h2>Report an Issue</h2>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="form-group">
      <label class="form-label">Category</label>
      <select class="form-select" id="issueCategory">
        <option value="damage">Damage</option>
        <option value="stock_out">Stock Out</option>
        <option value="access_issue">Access Issue</option>
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Room/Area (optional)</label>
      <input class="form-input" id="issueRoom" value="${roomId || ''}" placeholder="e.g. room_3 or area_lounge">
    </div>
    <div class="form-group">
      <label class="form-label">Description</label>
      <textarea class="form-textarea" id="issueDesc" placeholder="Describe the issue..."></textarea>
    </div>
    <button class="btn btn-primary btn-block btn-lg" onclick="handleIssueSubmit()">
      Submit Issue
    </button>
  `);
}

function handleIssueSubmit() {
  const category = document.getElementById('issueCategory').value;
  const room_id = document.getElementById('issueRoom').value || null;
  const description = document.getElementById('issueDesc').value;
  if (!description) { showToast('Please add a description', 'warning'); return; }
  submitIssue({ category, room_id, description });
}


// ==========================================
// RENDER - DASHBOARD (Manager/Supervisor)
// ==========================================

function renderDashboard() {
  if (!state.dashboard) {
    return renderAppShell(`<div class="empty-state"><div class="empty-state-icon">📊</div><div class="empty-state-text">Loading dashboard...</div></div>`);
  }

  const d = state.dashboard;
  const compColor = d.compliance_pct >= 80 ? 'green' : d.compliance_pct >= 50 ? 'amber' : 'red';
  const ipcColor = d.ipc.compliance_pct >= 80 ? 'green' : d.ipc.compliance_pct >= 50 ? 'amber' : 'red';

  let html = `<h2 style="margin-bottom:16px;">Compliance Dashboard</h2>`;

  // Stats cards
  html += `
    <div class="dashboard-grid">
      <div class="stat-card">
        <div class="stat-value ${compColor}">${d.compliance_pct}%</div>
        <div class="stat-label">Today's Compliance</div>
      </div>
      <div class="stat-card">
        <div class="stat-value blue">${d.today.done}</div>
        <div class="stat-label">Tasks Done</div>
      </div>
      <div class="stat-card">
        <div class="stat-value amber">${d.today.pending}</div>
        <div class="stat-label">Pending</div>
      </div>
      <div class="stat-card">
        <div class="stat-value ${ipcColor}">${d.ipc.compliance_pct}%</div>
        <div class="stat-label">IPC Compliance</div>
      </div>
    </div>
  `;

  // 7-day trend chart
  html += `
    <div class="chart-container">
      <div class="chart-title">7-Day Compliance Trend</div>
      <div class="bar-chart">
  `;
  const maxTasks = Math.max(...d.days.map(day => day.total), 1);
  d.days.forEach(day => {
    const height = Math.max((day.done / maxTasks) * 100, 5);
    const color = day.compliance_pct >= 80 ? 'var(--success)' : day.compliance_pct >= 50 ? 'var(--warning)' : 'var(--danger)';
    const dayLabel = new Date(day.date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short' });
    html += `
      <div class="bar-group">
        <div class="bar-value">${day.compliance_pct}%</div>
        <div style="flex:1;display:flex;align-items:flex-end;width:100%;">
          <div class="bar" style="height:${height}%;background:${color};width:100%;"></div>
        </div>
        <div class="bar-label">${dayLabel}</div>
      </div>
    `;
  });
  html += `</div></div>`;

  // Room compliance heatmap
  html += `
    <div class="heatmap">
      <div class="heatmap-title">Room Compliance (Today)</div>
      <div class="heatmap-grid" style="grid-template-columns:repeat(auto-fill, minmax(60px, 1fr));">
  `;
  d.roomCompliance.forEach(room => {
    const color = room.compliance_pct >= 80 ? 'green' : room.compliance_pct >= 50 ? 'amber' : 'red';
    html += `<div class="heatmap-cell ${color}" title="${room.room_name}: ${room.compliance_pct}%">${room.room_name.length > 4 ? room.room_name.substring(0,3) : room.room_name}<br>${room.compliance_pct}%</div>`;
  });
  html += `</div></div>`;

  // Staff performance table
  html += `
    <div style="margin-top:16px;">
      <h3 style="margin-bottom:12px;">Staff Performance (Today)</h3>
      <table class="data-table">
        <thead><tr><th>Staff</th><th>Assigned</th><th>Completed</th><th>Rate</th></tr></thead>
        <tbody>
  `;
  d.staffPerformance.forEach(s => {
    const color = s.completion_pct >= 80 ? 'green' : s.completion_pct >= 50 ? 'amber' : 'red';
    html += `<tr><td><strong>${s.name}</strong> (${s.initials})</td><td>${s.total_assigned}</td><td>${s.completed}</td><td><span class="stat-value ${color}" style="font-size:1rem;">${s.completion_pct}%</span></td></tr>`;
  });
  html += `</tbody></table></div>`;

  // Open issues count
  html += `
    <div class="stat-card" style="margin-top:16px;">
      <div class="stat-value ${d.openIssues > 0 ? 'red' : 'green'}">${d.openIssues}</div>
      <div class="stat-label">Open Issues</div>
    </div>
  `;

  return renderAppShell(html);
}


// ==========================================
// RENDER - HISTORY VIEW
// ==========================================

function renderHistory() {
  // Show completed tasks from today
  const completedTasks = state.tasks.filter(t => t.status === 'done');
  
  let html = `<h2 style="margin-bottom:16px;">My History (Today)</h2>`;
  
  if (!completedTasks.length) {
    html += `<div class="empty-state"><div class="empty-state-icon">📝</div><div class="empty-state-text">No completed tasks yet today</div></div>`;
  } else {
    completedTasks.forEach(t => {
      html += `
        <div class="task-card done">
          <div class="task-check">✓</div>
          <div class="task-info">
            <div class="task-name">${t.task_name}</div>
            <div class="task-meta">
              ${t.room_name} &bull; 
              ${t.completed_at ? new Date(t.completed_at).toLocaleTimeString('en-GB', {hour:'2-digit',minute:'2-digit'}) : ''}
              ${t.note ? ` &bull; Note: ${t.note}` : ''}
            </div>
          </div>
          <span class="task-badge badge-done">Done</span>
        </div>
      `;
    });
  }

  return renderAppShell(html);
}


// ==========================================
// MAIN RENDER FUNCTION
// ==========================================

function render() {
  const app = document.getElementById('app');
  
  switch (state.currentView) {
    case 'login':
      app.innerHTML = renderLogin();
      pinValue = '';
      break;
    case 'tasks':
      app.innerHTML = renderTasks();
      break;
    case 'issues':
      app.innerHTML = renderIssues();
      break;
    case 'dashboard':
      app.innerHTML = renderDashboard();
      break;
    case 'history':
      app.innerHTML = renderHistory();
      break;
    default:
      app.innerHTML = renderLogin();
  }
}

// ==========================================
// APP INITIALIZATION
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
  if (restoreSession()) {
    navigateTo('tasks');
  } else {
    navigateTo('login');
  }
});
