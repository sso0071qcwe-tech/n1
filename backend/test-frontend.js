import http from 'http';

function req(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const opts = { hostname:'127.0.0.1', port:3000, path, method, headers:{'Content-Type':'application/json'} };
    if (token) opts.headers['Authorization'] = 'Bearer ' + token;
    const r = http.request(opts, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    r.on('error', reject);
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

async function run() {
  console.log('\n=== FRONTEND INTEGRATION TESTS ===\n');
  let pass = 0, fail = 0;

  // 1. Index.html serves new version
  const idx = await req('GET', '/');
  if (idx.body.includes('Inter') && idx.body.includes('Glebe House')) {
    console.log('OK: index.html has Inter font + Glebe House title');
    pass++;
  } else { console.log('FAIL: index.html wrong content'); fail++; }

  // 2. styles.css serves
  const css = await req('GET', '/styles.css');
  if (css.status === 200 && css.body.includes('--primary-600')) {
    console.log('OK: styles.css has design tokens');
    pass++;
  } else { console.log('FAIL: styles.css'); fail++; }

  // 3. app.js serves
  const js = await req('GET', '/app.js');
  if (js.status === 200 && js.body.includes('renderDashboard') && js.body.includes('renderTasks')) {
    console.log('OK: app.js has all render functions');
    pass++;
  } else { console.log('FAIL: app.js missing renders'); fail++; }

  // 4. Login returns correct shape for frontend
  const login = await req('POST', '/api/auth/login', { pin: '1234' });
  const loginData = JSON.parse(login.body);
  if (loginData.token && loginData.staff.id && loginData.staff.name && loginData.staff.role && loginData.staff.initials) {
    console.log('OK: Login response has token + staff {id,name,role,initials}');
    pass++;
  } else { console.log('FAIL: Login shape'); fail++; }

  // 5. Tasks response has all fields frontend needs
  const token = loginData.token;
  const tasks = await req('GET', '/api/tasks/today', null, token);
  const taskData = JSON.parse(tasks.body);
  const t0 = taskData[0];
  if (t0 && t0.id && t0.task_name && t0.room_name && t0.template_name && t0.template_id && t0.status && 'ipc_critical' in t0) {
    console.log('OK: Tasks have all required fields for rendering (' + taskData.length + ' tasks)');
    pass++;
  } else { console.log('FAIL: Task missing fields:', Object.keys(t0||{})); fail++; }

  // 6. Issues response shape
  const issues = await req('GET', '/api/issues', null, token);
  const issueData = JSON.parse(issues.body);
  const i0 = issueData[0];
  if (i0 && i0.id && i0.description && i0.status && i0.category && i0.raised_by_name && i0.room_name) {
    console.log('OK: Issues have all required fields (' + issueData.length + ' issues)');
    pass++;
  } else { console.log('FAIL: Issue missing fields'); fail++; }

  // 7. Dashboard response shape (manager login)
  const mgrLogin = await req('POST', '/api/auth/login', { pin: '6789' });
  const mgrToken = JSON.parse(mgrLogin.body).token;
  const dash = await req('GET', '/api/dashboard/compliance', null, mgrToken);
  const dashData = JSON.parse(dash.body);
  if (dashData.compliance_pct !== undefined && dashData.today && dashData.days && dashData.roomCompliance && dashData.staffPerformance && dashData.ipc) {
    console.log('OK: Dashboard has all sections (compliance=' + dashData.compliance_pct + '%)');
    pass++;
  } else { console.log('FAIL: Dashboard missing sections'); fail++; }

  // 8. Dashboard days array has 7 entries
  if (dashData.days.length === 7 && dashData.days[0].date && dashData.days[0].compliance_pct !== undefined) {
    console.log('OK: 7-day trend data correct');
    pass++;
  } else { console.log('FAIL: Days array'); fail++; }

  // 9. Room compliance has entries
  if (dashData.roomCompliance.length > 0 && dashData.roomCompliance[0].room_name && dashData.roomCompliance[0].compliance_pct !== undefined) {
    console.log('OK: Room compliance heatmap data (' + dashData.roomCompliance.length + ' rooms)');
    pass++;
  } else { console.log('FAIL: roomCompliance'); fail++; }

  // 10. Staff performance has entries
  if (dashData.staffPerformance.length > 0 && dashData.staffPerformance[0].name && dashData.staffPerformance[0].completion_pct !== undefined) {
    console.log('OK: Staff performance data (' + dashData.staffPerformance.length + ' staff)');
    pass++;
  } else { console.log('FAIL: staffPerformance'); fail++; }

  console.log(`\n=== RESULTS: ${pass}/${pass+fail} passed ===\n`);
  process.exit(fail > 0 ? 1 : 0);
}

run();
