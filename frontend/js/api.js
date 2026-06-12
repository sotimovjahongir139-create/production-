const BASE = '/api';

function authHeader() {
  const token = localStorage.getItem('token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

async function request(path) {
  const res = await fetch(BASE + path, { headers: authHeader() });
  if (res.status === 401) {
    localStorage.removeItem('token');
    location.reload();
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err  = new Error(body.error || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

async function login(username, password) {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || 'Login failed');
  return body;
}

async function getCards(period)    { return request(`/cards?period=${period}`); }
async function getProducts(period) { return request(`/products?period=${period}`); }
async function getSklad(period)    { return request(`/sklad?period=${period}`); }
async function getWip()            { return request('/wip'); }

window.API = { login, getCards, getProducts, getSklad, getWip };
