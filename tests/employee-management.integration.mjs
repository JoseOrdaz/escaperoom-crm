import test from 'node:test';
import assert from 'node:assert/strict';
const base = process.env.TEST_BASE_URL;
if (!base) throw new Error('TEST_BASE_URL debe apuntar a un entorno aislado con usuarios de prueba');
async function request(path, options = {}) {
  const response = await fetch(`${base}${path}`, { ...options, headers: { ...(options.body ? { 'content-type': 'application/json' } : {}), ...options.headers }, body: options.body ? JSON.stringify(options.body) : undefined });
  let data; try { data = await response.json(); } catch { data = {}; }
  return { response, data };
}
async function login(username, password) {
  const result = await request('/api/auth/login', { method: 'POST', body: { username, password } });
  return { ...result, cookie: result.response.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ') };
}
test('contraseñas y gestión de empleados requieren permisos y conservan el historial', async () => {
  const admin = await login('admin', 'test-only-password');
  const gm = await login('gm', 'test-only-password');
  assert.equal(admin.response.status, 200); assert.equal(gm.response.status, 200);
  const adminHeaders = { cookie: admin.cookie }; const gmHeaders = { cookie: gm.cookie };
  const employee = { name: 'Ana', surname: 'Prueba', email: 'ana@example.test', username: 'ana-test', role: 'game_master', escape: 'Fobia', password: 'initial-test-password' };
  assert.equal((await request('/api/employees', { method: 'POST', headers: gmHeaders, body: employee })).response.status, 403);
  assert.equal((await request('/api/employees', { method: 'POST', headers: { cookie: 'session_user=%7B%22role%22%3A%22admin%22%7D' }, body: employee })).response.status, 401);
  const created = await request('/api/employees', { method: 'POST', headers: adminHeaders, body: employee });
  assert.equal(created.response.status, 200); const id = created.data._id;
  const listed = await request('/api/employees'); assert.ok(listed.data.every((item) => !('password' in item)));
  const existingSession = await login('ana-test', 'initial-test-password');
  assert.equal(existingSession.response.status, 200);
  assert.equal((await request('/api/employees', { method: 'PUT', headers: adminHeaders, body: { ...employee, _id: id, name: 'Ana editada', password: 'updated-test-password' } })).response.status, 200);
  assert.equal((await request('/api/profile', { headers: { cookie: existingSession.cookie } })).response.status, 401);
  assert.equal((await login('ana-test', 'initial-test-password')).response.status, 401);
  assert.equal((await login('ana-test', 'updated-test-password')).response.status, 200);
  assert.equal((await request('/api/employees/checkin', { method: 'POST', headers: adminHeaders, body: { employeeId: id, type: 'in' } })).response.status, 200);
  assert.equal((await request('/api/employees?id=' + id, { method: 'DELETE', headers: gmHeaders })).response.status, 403);
  assert.equal((await request('/api/employees?id=' + id, { method: 'DELETE', headers: adminHeaders })).response.status, 200);
  assert.equal((await login('ana-test', 'updated-test-password')).response.status, 401);
  const history = await request('/api/employees/checkin');
  assert.ok(history.data.all.some((entry) => entry.employeeId === id && entry.employee.name === 'Ana editada'));
  assert.ok(history.data.all.every((entry) => !('password' in entry.employee)));
  assert.equal((await request('/api/profile/password', { method: 'POST', headers: gmHeaders, body: { currentPassword: 'incorrect', newPassword: 'another-test-password' } })).response.status, 400);
  assert.equal((await request('/api/profile/password', { method: 'POST', headers: gmHeaders, body: { currentPassword: 'test-only-password', newPassword: 'another-test-password' } })).response.status, 200);
  assert.equal((await request('/api/profile', { headers: gmHeaders })).response.status, 200);
  assert.equal((await login('gm', 'test-only-password')).response.status, 401);
  assert.equal((await login('gm', 'another-test-password')).response.status, 200);
});
