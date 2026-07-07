import http from 'http';

function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: '127.0.0.1',
      port: 3000,
      path,
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (token) options.headers['Authorization'] = `Bearer ${token}`;
    
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runTests() {
  console.log('\n=== HOUSEKEEPING APP API TESTS ===\n');
  let passed = 0;
  let failed = 0;
  let token = null;

  // Test 1: Login with valid PIN
  try {
    const res = await request('POST', '/api/auth/login', { pin: '1234' });
    if (res.status === 200 && res.data.token && res.data.staff.name === 'Hannah Smith') {
      console.log('✓ Login with valid PIN (housekeeper)');
      token = res.data.token;
      passed++;
    } else {
      console.log('✗ Login with valid PIN', res);
      failed++;
    }
  } catch (e) { console.log('✗ Login with valid PIN:', e.message); failed++; }

  // Test 2: Login with invalid PIN
  try {
    const res = await request('POST', '/api/auth/login', { pin: '0000' });
    if (res.status === 401) {
      console.log('✓ Login with invalid PIN returns 401');
      passed++;
    } else {
      console.log('✗ Invalid PIN should return 401, got', res.status);
      failed++;
    }
  } catch (e) { console.log('✗ Invalid PIN:', e.message); failed++; }

  // Test 3: Get today's tasks (authenticated)
  try {
    const res = await request('GET', '/api/tasks/today', null, token);
    if (res.status === 200 && Array.isArray(res.data) && res.data.length > 0) {
      console.log(`✓ Get today's tasks: ${res.data.length} tasks returned`);
      passed++;
    } else {
      console.log('✗ Get tasks failed:', res.status, Array.isArray(res.data) ? res.data.length : 'not array');
      failed++;
    }
  } catch (e) { console.log('✗ Get tasks:', e.message); failed++; }

  // Test 4: Unauthenticated request
  try {
    const res = await request('GET', '/api/tasks/today');
    if (res.status === 401) {
      console.log('✓ Unauthenticated request returns 401');
      passed++;
    } else {
      console.log('✗ Should return 401, got', res.status);
      failed++;
    }
  } catch (e) { console.log('✗ Auth check:', e.message); failed++; }

  // Test 5: Complete a task
  try {
    const tasksRes = await request('GET', '/api/tasks/today', null, token);
    const pendingTask = tasksRes.data.find(t => t.status === 'pending');
    if (pendingTask) {
      const res = await request('POST', `/api/tasks/${pendingTask.id}/complete`, { note: 'Test note' }, token);
      if (res.status === 200 && res.data.status === 'done') {
        console.log('✓ Complete a task');
        passed++;
      } else {
        console.log('✗ Complete task:', res.status, res.data);
        failed++;
      }
    } else {
      console.log('⚠ No pending tasks to test completion (all done)');
      passed++;
    }
  } catch (e) { console.log('✗ Complete task:', e.message); failed++; }

  // Test 6: Get rooms
  try {
    const res = await request('GET', '/api/rooms', null, token);
    if (res.status === 200 && Array.isArray(res.data) && res.data.length === 25) {
      console.log(`✓ Get rooms: ${res.data.length} rooms/areas`);
      passed++;
    } else {
      console.log('✗ Get rooms:', res.status, res.data?.length);
      failed++;
    }
  } catch (e) { console.log('✗ Get rooms:', e.message); failed++; }

  // Test 7: Get staff
  try {
    const res = await request('GET', '/api/staff', null, token);
    if (res.status === 200 && Array.isArray(res.data) && res.data.length === 8) {
      console.log(`✓ Get staff: ${res.data.length} staff members`);
      passed++;
    } else {
      console.log('✗ Get staff:', res.status, res.data?.length);
      failed++;
    }
  } catch (e) { console.log('✗ Get staff:', e.message); failed++; }

  // Test 8: Get templates
  try {
    const res = await request('GET', '/api/templates', null, token);
    if (res.status === 200 && Array.isArray(res.data) && res.data.length === 5) {
      console.log(`✓ Get templates: ${res.data.length} checklist templates`);
      passed++;
    } else {
      console.log('✗ Get templates:', res.status, res.data?.length);
      failed++;
    }
  } catch (e) { console.log('✗ Get templates:', e.message); failed++; }

  // Test 9: Create an issue
  try {
    const res = await request('POST', '/api/issues', {
      category: 'damage',
      room_id: 'room_5',
      description: 'Broken window handle in room 5'
    }, token);
    if (res.status === 201 && res.data.status === 'open') {
      console.log('✓ Create issue: routed to', res.data.routed_to);
      passed++;
    } else {
      console.log('✗ Create issue:', res.status, res.data);
      failed++;
    }
  } catch (e) { console.log('✗ Create issue:', e.message); failed++; }

  // Test 10: Get issues
  try {
    const res = await request('GET', '/api/issues', null, token);
    if (res.status === 200 && Array.isArray(res.data) && res.data.length >= 3) {
      console.log(`✓ Get issues: ${res.data.length} issues (incl. new one)`);
      passed++;
    } else {
      console.log('✗ Get issues:', res.status, res.data?.length);
      failed++;
    }
  } catch (e) { console.log('✗ Get issues:', e.message); failed++; }

  // Test 11: Manager login + dashboard
  try {
    const loginRes = await request('POST', '/api/auth/login', { pin: '6789' });
    const mgrToken = loginRes.data.token;
    const res = await request('GET', '/api/dashboard/compliance', null, mgrToken);
    if (res.status === 200 && res.data.compliance_pct !== undefined && res.data.days.length === 7) {
      console.log(`✓ Dashboard: ${res.data.compliance_pct}% compliance, ${res.data.today.total} tasks today`);
      passed++;
    } else {
      console.log('✗ Dashboard:', res.status, res.data);
      failed++;
    }
  } catch (e) { console.log('✗ Dashboard:', e.message); failed++; }

  // Test 12: Housekeeper can't access dashboard
  try {
    const res = await request('GET', '/api/dashboard/compliance', null, token);
    if (res.status === 403) {
      console.log('✓ Housekeeper denied dashboard access (403)');
      passed++;
    } else {
      console.log('✗ Should deny housekeeper dashboard, got', res.status);
      failed++;
    }
  } catch (e) { console.log('✗ RBAC check:', e.message); failed++; }

  // Test 13: Get audit trail (manager only)
  try {
    const loginRes = await request('POST', '/api/auth/login', { pin: '6789' });
    const mgrToken = loginRes.data.token;
    const res = await request('GET', '/api/audit', null, mgrToken);
    if (res.status === 200 && Array.isArray(res.data) && res.data.length > 0) {
      console.log(`✓ Audit trail: ${res.data.length} entries`);
      passed++;
    } else {
      console.log('✗ Audit trail:', res.status, res.data?.length);
      failed++;
    }
  } catch (e) { console.log('✗ Audit trail:', e.message); failed++; }

  // Test 14: Static file serving (index.html)
  try {
    const res = await request('GET', '/');
    if (res.status === 200 && typeof res.data === 'string' && res.data.includes('Housekeeping')) {
      console.log('✓ Static file serving (index.html)');
      passed++;
    } else {
      console.log('✗ Static serving:', res.status, typeof res.data);
      failed++;
    }
  } catch (e) { console.log('✗ Static serving:', e.message); failed++; }

  // Test 15: Export report (manager)
  try {
    const loginRes = await request('POST', '/api/auth/login', { pin: '6789' });
    const mgrToken = loginRes.data.token;
    const res = await request('GET', '/api/reports/export', null, mgrToken);
    if (res.status === 200 && res.data.report && res.data.totalTasks > 0) {
      console.log(`✓ Export report: ${res.data.totalTasks} tasks in date range`);
      passed++;
    } else {
      console.log('✗ Export:', res.status, res.data);
      failed++;
    }
  } catch (e) { console.log('✗ Export:', e.message); failed++; }

  console.log(`\n=== RESULTS: ${passed} passed, ${failed} failed out of ${passed + failed} tests ===\n`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
