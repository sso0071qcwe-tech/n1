import { findAll, findById, findWhere, findOneWhere, insert, update, generateId } from './db.js';
import { authenticateStaff, requireAuth, requireRole } from './auth.js';

// Route handler registry
const routes = [];

function route(method, path, handler) {
  // Convert path params like :id to regex
  const paramNames = [];
  const regexStr = path.replace(/:([^/]+)/g, (_, name) => {
    paramNames.push(name);
    return '([^/]+)';
  });
  routes.push({
    method,
    regex: new RegExp(`^${regexStr}$`),
    paramNames,
    handler
  });
}

export function matchRoute(method, pathname) {
  for (const r of routes) {
    if (r.method !== method) continue;
    const match = pathname.match(r.regex);
    if (match) {
      const params = {};
      r.paramNames.forEach((name, i) => {
        params[name] = match[i + 1];
      });
      return { handler: r.handler, params };
    }
  }
  return null;
}

// ==========================================
// AUTH ROUTES
// ==========================================

route('POST', '/api/auth/login', (req, body) => {
  const { pin } = body;
  if (!pin) return { status: 400, data: { error: 'PIN is required' } };
  
  const result = authenticateStaff(pin);
  if (!result) return { status: 401, data: { error: 'Invalid PIN' } };
  
  return { status: 200, data: result };
});

route('GET', '/api/auth/me', (req) => {
  const user = requireAuth(req);
  if (!user) return { status: 401, data: { error: 'Unauthorized' } };
  
  const staff = findById('staff', user.staffId);
  if (!staff) return { status: 404, data: { error: 'Staff not found' } };
  
  return { status: 200, data: { id: staff.id, name: staff.name, initials: staff.initials, role: staff.role } };
});

// ==========================================
// STAFF ROUTES
// ==========================================

route('GET', '/api/staff', (req) => {
  const user = requireAuth(req);
  if (!user) return { status: 401, data: { error: 'Unauthorized' } };
  
  const staff = findAll('staff').map(s => ({
    id: s.id, name: s.name, initials: s.initials, role: s.role, active: s.active
  }));
  return { status: 200, data: staff };
});

// ==========================================
// ROOMS ROUTES
// ==========================================

route('GET', '/api/rooms', (req) => {
  const user = requireAuth(req);
  if (!user) return { status: 401, data: { error: 'Unauthorized' } };
  
  const rooms = findAll('rooms');
  return { status: 200, data: rooms };
});

route('GET', '/api/rooms/:id', (req) => {
  const user = requireAuth(req);
  if (!user) return { status: 401, data: { error: 'Unauthorized' } };
  
  const room = findById('rooms', req.params.id);
  if (!room) return { status: 404, data: { error: 'Room not found' } };
  
  return { status: 200, data: room };
});

// ==========================================
// CHECKLIST TEMPLATES
// ==========================================

route('GET', '/api/templates', (req) => {
  const user = requireAuth(req);
  if (!user) return { status: 401, data: { error: 'Unauthorized' } };
  
  const templates = findAll('checklistTemplates');
  return { status: 200, data: templates };
});

route('GET', '/api/templates/:id', (req) => {
  const user = requireAuth(req);
  if (!user) return { status: 401, data: { error: 'Unauthorized' } };
  
  const template = findById('checklistTemplates', req.params.id);
  if (!template) return { status: 404, data: { error: 'Template not found' } };
  
  const tasks = findWhere('taskDefinitions', td => td.template_id === template.id);
  return { status: 200, data: { ...template, tasks } };
});

// ==========================================
// TASK INSTANCES (Core functionality)
// ==========================================

// Get today's tasks for logged-in staff
route('GET', '/api/tasks/today', (req) => {
  const user = requireAuth(req);
  if (!user) return { status: 401, data: { error: 'Unauthorized' } };
  
  const today = new Date().toISOString().split('T')[0];
  let tasks;
  
  if (user.role === 'housekeeper') {
    tasks = findWhere('taskInstances', t => t.date === today && t.assigned_to === user.staffId);
  } else {
    tasks = findWhere('taskInstances', t => t.date === today);
  }
  
  // Enrich with task definition names and room info
  const enriched = tasks.map(t => {
    const def = findById('taskDefinitions', t.task_definition_id);
    const room = t.room_id ? findById('rooms', t.room_id) : null;
    const template = findById('checklistTemplates', t.template_id);
    return {
      ...t,
      task_name: def?.name || 'Unknown Task',
      room_name: room?.room_number || 'Whole Home',
      room_type: room?.type || 'whole_home',
      template_name: template?.name || 'Unknown Template',
      ipc_critical: def?.ipc_critical || false
    };
  });
  
  return { status: 200, data: enriched };
});

// Get tasks for a specific date
route('GET', '/api/tasks/date/:date', (req) => {
  const user = requireAuth(req);
  if (!user) return { status: 401, data: { error: 'Unauthorized' } };
  
  const tasks = findWhere('taskInstances', t => t.date === req.params.date);
  
  const enriched = tasks.map(t => {
    const def = findById('taskDefinitions', t.task_definition_id);
    const room = t.room_id ? findById('rooms', t.room_id) : null;
    const staff = t.completed_by ? findById('staff', t.completed_by) : null;
    return {
      ...t,
      task_name: def?.name || 'Unknown Task',
      room_name: room?.room_number || 'Whole Home',
      room_type: room?.type || 'whole_home',
      completed_by_name: staff?.name || null,
      ipc_critical: def?.ipc_critical || false
    };
  });
  
  return { status: 200, data: enriched };
});

// Complete a task
route('POST', '/api/tasks/:id/complete', (req, body) => {
  const user = requireAuth(req);
  if (!user) return { status: 401, data: { error: 'Unauthorized' } };
  
  const task = findById('taskInstances', req.params.id);
  if (!task) return { status: 404, data: { error: 'Task not found' } };
  
  if (task.status === 'done') {
    return { status: 400, data: { error: 'Task already completed' } };
  }
  
  const updated = update('taskInstances', req.params.id, {
    status: 'done',
    completed_by: user.staffId,
    completed_at: new Date().toISOString(),
    note: body.note || null,
    photo_url: body.photo_url || null
  });
  
  // Audit log entry
  insert('auditLog', {
    action: 'task_completed',
    staff_id: user.staffId,
    target_id: req.params.id,
    details: JSON.stringify({ note: body.note }),
    timestamp: new Date().toISOString()
  });
  
  return { status: 200, data: updated };
});

// Mark task as excused (supervisor+ only)
route('POST', '/api/tasks/:id/excuse', (req, body) => {
  const user = requireAuth(req);
  if (!user) return { status: 401, data: { error: 'Unauthorized' } };
  if (!requireRole(user, 'supervisor', 'manager')) {
    return { status: 403, data: { error: 'Only supervisors and managers can excuse tasks' } };
  }
  
  const task = findById('taskInstances', req.params.id);
  if (!task) return { status: 404, data: { error: 'Task not found' } };
  
  const updated = update('taskInstances', req.params.id, {
    status: 'excused',
    note: body.reason || 'Excused by supervisor'
  });
  
  insert('auditLog', {
    action: 'task_excused',
    staff_id: user.staffId,
    target_id: req.params.id,
    details: JSON.stringify({ reason: body.reason }),
    timestamp: new Date().toISOString()
  });
  
  return { status: 200, data: updated };
});

// ==========================================
// ISSUES/FLAGS
// ==========================================

route('GET', '/api/issues', (req) => {
  const user = requireAuth(req);
  if (!user) return { status: 401, data: { error: 'Unauthorized' } };
  
  const issues = findAll('issues');
  const enriched = issues.map(i => {
    const raisedBy = findById('staff', i.raised_by);
    const routedTo = i.routed_to ? findById('staff', i.routed_to) : null;
    const room = i.room_id ? findById('rooms', i.room_id) : null;
    return {
      ...i,
      raised_by_name: raisedBy?.name || 'Unknown',
      routed_to_name: routedTo?.name || null,
      room_name: room?.room_number || 'N/A'
    };
  });
  
  return { status: 200, data: enriched };
});

route('POST', '/api/issues', (req, body) => {
  const user = requireAuth(req);
  if (!user) return { status: 401, data: { error: 'Unauthorized' } };
  
  const { room_id, category, description, photo_url } = body;
  if (!category || !description) {
    return { status: 400, data: { error: 'Category and description are required' } };
  }
  
  // Auto-route: damage -> maintenance, stock_out/access_issue -> supervisor
  let routed_to = null;
  if (category === 'damage') {
    const maint = findOneWhere('staff', s => s.role === 'maintenance' && s.active);
    routed_to = maint?.id || null;
  } else {
    const sup = findOneWhere('staff', s => s.role === 'supervisor' && s.active);
    routed_to = sup?.id || null;
  }
  
  const issue = insert('issues', {
    home_id: user.homeId,
    room_id: room_id || null,
    raised_by: user.staffId,
    category,
    description,
    photo_url: photo_url || null,
    routed_to,
    status: 'open'
  });
  
  insert('auditLog', {
    action: 'issue_raised',
    staff_id: user.staffId,
    target_id: issue.id,
    details: JSON.stringify({ category, description }),
    timestamp: new Date().toISOString()
  });
  
  return { status: 201, data: issue };
});

route('POST', '/api/issues/:id/status', (req, body) => {
  const user = requireAuth(req);
  if (!user) return { status: 401, data: { error: 'Unauthorized' } };
  
  const issue = findById('issues', req.params.id);
  if (!issue) return { status: 404, data: { error: 'Issue not found' } };
  
  const { status } = body;
  if (!['open', 'in_progress', 'resolved'].includes(status)) {
    return { status: 400, data: { error: 'Invalid status' } };
  }
  
  const updates = { status };
  if (status === 'resolved') updates.resolved_at = new Date().toISOString();
  
  const updated = update('issues', req.params.id, updates);
  
  insert('auditLog', {
    action: 'issue_status_changed',
    staff_id: user.staffId,
    target_id: req.params.id,
    details: JSON.stringify({ new_status: status }),
    timestamp: new Date().toISOString()
  });
  
  return { status: 200, data: updated };
});

// ==========================================
// DASHBOARD / COMPLIANCE STATS
// ==========================================

route('GET', '/api/dashboard/compliance', (req) => {
  const user = requireAuth(req);
  if (!user) return { status: 401, data: { error: 'Unauthorized' } };
  if (!requireRole(user, 'supervisor', 'manager', 'auditor')) {
    return { status: 403, data: { error: 'Access denied' } };
  }
  
  const today = new Date().toISOString().split('T')[0];
  const allToday = findWhere('taskInstances', t => t.date === today);
  
  const totalToday = allToday.length;
  const doneToday = allToday.filter(t => t.status === 'done').length;
  const pendingToday = allToday.filter(t => t.status === 'pending').length;
  const missedToday = allToday.filter(t => t.status === 'missed').length;
  const excusedToday = allToday.filter(t => t.status === 'excused').length;
  
  // Last 7 days breakdown
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const dayTasks = findWhere('taskInstances', t => t.date === dateStr);
    days.push({
      date: dateStr,
      total: dayTasks.length,
      done: dayTasks.filter(t => t.status === 'done').length,
      missed: dayTasks.filter(t => t.status === 'missed').length,
      pending: dayTasks.filter(t => t.status === 'pending').length,
      compliance_pct: dayTasks.length > 0 ? Math.round((dayTasks.filter(t => t.status === 'done' || t.status === 'excused').length / dayTasks.length) * 100) : 0
    });
  }
  
  // Per-room compliance for today
  const rooms = findAll('rooms');
  const roomCompliance = rooms.map(room => {
    const roomTasks = allToday.filter(t => t.room_id === room.id);
    const done = roomTasks.filter(t => t.status === 'done' || t.status === 'excused').length;
    return {
      room_id: room.id,
      room_name: room.room_number,
      room_type: room.type,
      total: roomTasks.length,
      done,
      compliance_pct: roomTasks.length > 0 ? Math.round((done / roomTasks.length) * 100) : 100
    };
  }).filter(r => r.total > 0);
  
  // IPC compliance (door handles)
  const ipcTasks = allToday.filter(t => t.template_id === 'tpl_door_handles');
  const ipcDone = ipcTasks.filter(t => t.status === 'done').length;
  
  // Staff performance
  const staffList = findAll('staff').filter(s => s.role === 'housekeeper');
  const staffPerformance = staffList.map(s => {
    const staffTasks = allToday.filter(t => t.assigned_to === s.id);
    const completed = staffTasks.filter(t => t.status === 'done').length;
    return {
      staff_id: s.id,
      name: s.name,
      initials: s.initials,
      total_assigned: staffTasks.length,
      completed,
      completion_pct: staffTasks.length > 0 ? Math.round((completed / staffTasks.length) * 100) : 0
    };
  });
  
  return {
    status: 200,
    data: {
      today: { total: totalToday, done: doneToday, pending: pendingToday, missed: missedToday, excused: excusedToday },
      compliance_pct: totalToday > 0 ? Math.round(((doneToday + excusedToday) / totalToday) * 100) : 100,
      ipc: { total: ipcTasks.length, done: ipcDone, compliance_pct: ipcTasks.length > 0 ? Math.round((ipcDone / ipcTasks.length) * 100) : 100 },
      days,
      roomCompliance,
      staffPerformance,
      openIssues: findWhere('issues', i => i.status !== 'resolved').length
    }
  };
});

// Overdue tasks
route('GET', '/api/dashboard/overdue', (req) => {
  const user = requireAuth(req);
  if (!user) return { status: 401, data: { error: 'Unauthorized' } };
  
  const today = new Date().toISOString().split('T')[0];
  const overdue = findWhere('taskInstances', t => t.status === 'pending' && t.date < today);
  const todayPending = findWhere('taskInstances', t => t.status === 'pending' && t.date === today);
  
  const enriched = [...overdue, ...todayPending].map(t => {
    const def = findById('taskDefinitions', t.task_definition_id);
    const room = t.room_id ? findById('rooms', t.room_id) : null;
    const assignedStaff = findById('staff', t.assigned_to);
    return {
      ...t,
      task_name: def?.name || 'Unknown',
      room_name: room?.room_number || 'Whole Home',
      assigned_to_name: assignedStaff?.name || 'Unassigned',
      ipc_critical: def?.ipc_critical || false
    };
  });
  
  return { status: 200, data: enriched };
});

// Audit trail
route('GET', '/api/audit', (req) => {
  const user = requireAuth(req);
  if (!user) return { status: 401, data: { error: 'Unauthorized' } };
  if (!requireRole(user, 'manager', 'auditor')) {
    return { status: 403, data: { error: 'Access denied' } };
  }
  
  const logs = findAll('auditLog').sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 100);
  const enriched = logs.map(l => {
    const staff = findById('staff', l.staff_id);
    return { ...l, staff_name: staff?.name || 'Unknown' };
  });
  
  return { status: 200, data: enriched };
});

// Export (CQC-ready report data)
route('GET', '/api/reports/export', (req) => {
  const user = requireAuth(req);
  if (!user) return { status: 401, data: { error: 'Unauthorized' } };
  if (!requireRole(user, 'manager', 'auditor')) {
    return { status: 403, data: { error: 'Access denied' } };
  }
  
  // Get date range from query params (default last 7 days)
  const endDate = req.query.end || new Date().toISOString().split('T')[0];
  const startDate = req.query.start || (() => { const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().split('T')[0]; })();
  
  const tasks = findWhere('taskInstances', t => t.date >= startDate && t.date <= endDate);
  
  const report = tasks.map(t => {
    const def = findById('taskDefinitions', t.task_definition_id);
    const room = t.room_id ? findById('rooms', t.room_id) : null;
    const staff = t.completed_by ? findById('staff', t.completed_by) : null;
    const template = findById('checklistTemplates', t.template_id);
    return {
      date: t.date,
      template: template?.name || '',
      room: room?.room_number || 'Whole Home',
      task: def?.name || '',
      status: t.status,
      completed_by: staff?.name || '',
      completed_at: t.completed_at || '',
      note: t.note || '',
      ipc_critical: def?.ipc_critical || false
    };
  });
  
  return { status: 200, data: { startDate, endDate, totalTasks: report.length, report } };
});

// ==========================================
// CHECKLIST GRID ENDPOINTS
// ==========================================

// GET /api/checklists/weekly/:roomId - Weekly tasks grid (W1-W5) for a room in a given month
route('GET', '/api/checklists/weekly/:roomId', (req) => {
  const user = requireAuth(req);
  if (!user) return { status: 401, data: { error: 'Unauthorized' } };

  const room = findById('rooms', req.params.roomId);
  if (!room) return { status: 404, data: { error: 'Room not found' } };

  // Determine target month from query param or use current month
  let year, month;
  if (req.query.month && /^\d{4}-\d{2}$/.test(req.query.month)) {
    const parts = req.query.month.split('-');
    year = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10) - 1; // 0-indexed
  } else {
    const now = new Date();
    year = now.getFullYear();
    month = now.getMonth();
  }

  // Build date range for the month
  const startDate = new Date(year, month, 1);
  const endDate = new Date(year, month + 1, 0); // last day of month
  const startStr = startDate.toISOString().split('T')[0];
  const endStr = endDate.toISOString().split('T')[0];

  // Get all weekly task instances for this room in this month
  const instances = findWhere('taskInstances', t =>
    t.template_id === 'tpl_weekly_room' &&
    t.room_id === req.params.roomId &&
    t.date >= startStr &&
    t.date <= endStr
  );

  // Get task definitions for weekly room template
  const taskDefs = findWhere('taskDefinitions', td => td.template_id === 'tpl_weekly_room')
    .sort((a, b) => a.order - b.order);

  // Build grid: each task has w1-w5 slots
  const tasks = taskDefs.map(def => {
    const taskInstances = instances.filter(i => i.task_definition_id === def.id);
    const weekSlots = { w1: null, w2: null, w3: null, w4: null, w5: null };

    taskInstances.forEach(inst => {
      const taskDate = new Date(inst.date + 'T00:00:00');
      const dayOfMonth = taskDate.getDate();
      const weekNum = Math.ceil(dayOfMonth / 7); // week 1 = days 1-7, week 2 = days 8-14, etc.
      const weekKey = `w${weekNum}`;
      if (weekKey in weekSlots) {
        const staff = inst.completed_by ? findById('staff', inst.completed_by) : null;
        weekSlots[weekKey] = {
          done: inst.status === 'done',
          initials: staff?.initials || null,
          date: inst.date,
          status: inst.status
        };
      }
    });

    return {
      id: def.id,
      name: def.name,
      order: def.order,
      ...weekSlots
    };
  });

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

  return {
    status: 200,
    data: {
      room: { id: room.id, room_number: room.room_number, type: room.type },
      month: monthNames[month],
      month_number: month + 1,
      year,
      tasks
    }
  };
});

// GET /api/checklists/quarterly/:roomId - Quarterly deep clean grid for a room by year
route('GET', '/api/checklists/quarterly/:roomId', (req) => {
  const user = requireAuth(req);
  if (!user) return { status: 401, data: { error: 'Unauthorized' } };

  const room = findById('rooms', req.params.roomId);
  if (!room) return { status: 404, data: { error: 'Room not found' } };

  // Determine target year from query param or use current year
  let year;
  if (req.query.year && /^\d{4}$/.test(req.query.year)) {
    year = parseInt(req.query.year, 10);
  } else {
    year = new Date().getFullYear();
  }

  const startStr = `${year}-01-01`;
  const endStr = `${year}-12-31`;

  // Get all quarterly task instances for this room in this year
  const instances = findWhere('taskInstances', t =>
    t.template_id === 'tpl_quarterly_deep' &&
    t.room_id === req.params.roomId &&
    t.date >= startStr &&
    t.date <= endStr
  );

  // Get task definitions for quarterly template
  const taskDefs = findWhere('taskDefinitions', td => td.template_id === 'tpl_quarterly_deep')
    .sort((a, b) => a.order - b.order);

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // Build grid: each task has entries array showing which months have data
  const tasks = taskDefs.map(def => {
    const taskInstances = instances.filter(i => i.task_definition_id === def.id);
    const entries = [];

    taskInstances.forEach(inst => {
      const taskDate = new Date(inst.date + 'T00:00:00');
      const monthIdx = taskDate.getMonth();
      const staff = inst.completed_by ? findById('staff', inst.completed_by) : null;
      entries.push({
        month: monthNames[monthIdx],
        month_number: monthIdx + 1,
        done: inst.status === 'done',
        initials: staff?.initials || null,
        date: inst.date,
        status: inst.status
      });
    });

    // Sort entries by month
    entries.sort((a, b) => a.month_number - b.month_number);

    return {
      id: def.id,
      name: def.name,
      order: def.order,
      entries
    };
  });

  return {
    status: 200,
    data: {
      room: { id: room.id, room_number: room.room_number, type: room.type },
      year,
      tasks
    }
  };
});

// GET /api/checklists/daily/:roomId - Daily tasks grid (Mon-Sun) for a room for current week
route('GET', '/api/checklists/daily/:roomId', (req) => {
  const user = requireAuth(req);
  if (!user) return { status: 401, data: { error: 'Unauthorized' } };

  const room = findById('rooms', req.params.roomId);
  if (!room) return { status: 404, data: { error: 'Room not found' } };

  // Determine the week: use ?week=YYYY-MM-DD (Monday) or default to current week
  let weekStart;
  if (req.query.week && /^\d{4}-\d{2}-\d{2}$/.test(req.query.week)) {
    weekStart = new Date(req.query.week + 'T00:00:00');
  } else {
    // Find Monday of current week
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, ...
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    weekStart = new Date(now);
    weekStart.setDate(now.getDate() + mondayOffset);
  }
  weekStart.setHours(0, 0, 0, 0);

  // Build 7 days starting from Monday
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const weekDates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    weekDates.push(d.toISOString().split('T')[0]);
  }

  const startStr = weekDates[0];
  const endStr = weekDates[6];

  // Get all daily room task instances for this room in this week
  const instances = findWhere('taskInstances', t =>
    t.template_id === 'tpl_daily_room' &&
    t.room_id === req.params.roomId &&
    t.date >= startStr &&
    t.date <= endStr
  );

  // Get task definitions for daily room template
  const taskDefs = findWhere('taskDefinitions', td => td.template_id === 'tpl_daily_room')
    .sort((a, b) => a.order - b.order);

  // Build grid: each task has days array (Mon-Sun)
  const tasks = taskDefs.map(def => {
    const taskInstances = instances.filter(i => i.task_definition_id === def.id);
    const days = weekDates.map((dateStr, idx) => {
      const inst = taskInstances.find(i => i.date === dateStr);
      const staff = inst?.completed_by ? findById('staff', inst.completed_by) : null;
      return {
        day: dayNames[idx],
        date: dateStr,
        done: inst ? inst.status === 'done' : false,
        initials: staff?.initials || null,
        status: inst?.status || null
      };
    });

    return {
      id: def.id,
      name: def.name,
      order: def.order,
      ipc_critical: def.ipc_critical || false,
      days
    };
  });

  return {
    status: 200,
    data: {
      room: { id: room.id, room_number: room.room_number, type: room.type },
      weekStart: startStr,
      weekEnd: endStr,
      tasks
    }
  };
});

// GET /api/checklists/daily-communal/:areaId - Daily tasks grid (Mon-Sun) for a communal area
route('GET', '/api/checklists/daily-communal/:areaId', (req) => {
  const user = requireAuth(req);
  if (!user) return { status: 401, data: { error: 'Unauthorized' } };

  const room = findById('rooms', req.params.areaId);
  if (!room) return { status: 404, data: { error: 'Room not found' } };

  // Determine the week: use ?week=YYYY-MM-DD (Monday) or default to current week
  let weekStart;
  if (req.query.week && /^\d{4}-\d{2}-\d{2}$/.test(req.query.week)) {
    weekStart = new Date(req.query.week + 'T00:00:00');
  } else {
    // Find Monday of current week
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, ...
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    weekStart = new Date(now);
    weekStart.setDate(now.getDate() + mondayOffset);
  }
  weekStart.setHours(0, 0, 0, 0);

  // Build 7 days starting from Monday
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const weekDates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    weekDates.push(d.toISOString().split('T')[0]);
  }

  const startStr = weekDates[0];
  const endStr = weekDates[6];

  // Get all daily communal task instances for this area in this week
  const instances = findWhere('taskInstances', t =>
    t.template_id === 'tpl_daily_communal' &&
    t.room_id === req.params.areaId &&
    t.date >= startStr &&
    t.date <= endStr
  );

  // Get task definitions for daily communal template
  const taskDefs = findWhere('taskDefinitions', td => td.template_id === 'tpl_daily_communal')
    .sort((a, b) => a.order - b.order);

  // Build grid: each task has days array (Mon-Sun)
  const tasks = taskDefs.map(def => {
    const taskInstances = instances.filter(i => i.task_definition_id === def.id);
    const days = weekDates.map((dateStr, idx) => {
      const inst = taskInstances.find(i => i.date === dateStr);
      const staff = inst?.completed_by ? findById('staff', inst.completed_by) : null;
      return {
        day: dayNames[idx],
        date: dateStr,
        done: inst ? inst.status === 'done' : false,
        initials: staff?.initials || null,
        status: inst?.status || null
      };
    });

    return {
      id: def.id,
      name: def.name,
      order: def.order,
      days
    };
  });

  return {
    status: 200,
    data: {
      room: { id: room.id, room_number: room.room_number, type: room.type },
      weekStart: startStr,
      weekEnd: endStr,
      tasks
    }
  };
});

export { routes };
