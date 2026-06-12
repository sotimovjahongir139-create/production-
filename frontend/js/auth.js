function getToken()       { return localStorage.getItem('token'); }
function setToken(t)      { localStorage.setItem('token', t); }
function clearToken()     { localStorage.removeItem('token'); }
function isLoggedIn()     { return !!getToken(); }

async function handleLogin(e) {
  e.preventDefault();
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
  const errEl    = document.getElementById('login-error');
  errEl.textContent = '';

  try {
    const { token } = await API.login(username, password);
    setToken(token);
    showApp();
  } catch (err) {
    errEl.textContent = 'Login yoki parol noto\'g\'ri';
  }
}

function handleLogout() {
  clearToken();
  showLogin();
}

function showLogin() {
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('app-screen').style.display   = 'none';
}

function showApp() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app-screen').style.display   = 'flex';
  window.APP.init();
}

window.AUTH = { getToken, isLoggedIn, handleLogin, handleLogout, showLogin, showApp };
