const API_URL = window.location.origin;

const translations = {
  en: {
    title: 'F1 Manager Tycoon 1970-1980',
    language: 'Language',
    email: 'Email',
    password: 'Password',
    register: 'Register',
    login: 'Login',
    logout: 'Logout',
    createTeam: 'Create Team',
    teamName: 'Team Name',
    color: 'Color',
    startRace: 'Start Race',
    circuitName: 'Circuit Name',
    raceMap: 'Race Map',
    leaderboard: 'Leaderboard',
    events: 'Race Events',
    position: 'Position',
    reliability: 'Reliability',
    status: 'Status',
    push: 'Push (aggressive)',
    conserve: 'Conserve (save engine)',
    pit: 'Pit Now',
    lap: 'Lap',
    raceFinished: 'Race Finished!',
    mechanical: 'Mechanical failure',
    puncture: 'Puncture',
    engineBlow: 'Engine blowout'
  },
  es: {
    title: 'F1 Gerente Tycoon 1970-1980',
    language: 'Idioma',
    email: 'Correo',
    password: 'Contraseña',
    register: 'Registrarse',
    login: 'Iniciar sesión',
    logout: 'Cerrar sesión',
    createTeam: 'Crear Equipo',
    teamName: 'Nombre del Equipo',
    color: 'Color',
    startRace: 'Iniciar Carrera',
    circuitName: 'Nombre del Circuito',
    raceMap: 'Mapa de Carrera',
    leaderboard: 'Clasificación',
    events: 'Eventos de Carrera',
    position: 'Posición',
    reliability: 'Confiabilidad',
    status: 'Estado',
    push: 'Presionar (agresivo)',
    conserve: 'Conservar (ahorrar motor)',
    pit: 'Boxear Ahora',
    lap: 'Vuelta',
    raceFinished: '¡Carrera Terminada!',
    mechanical: 'Falla mecánica',
    puncture: 'Pinchazo',
    engineBlow: 'Motor reventado'
  }
};

let currentLang = localStorage.getItem('lang') || 'en';
let token = localStorage.getItem('token');
let userId = localStorage.getItem('userId');
let teamId = localStorage.getItem('teamId');
let carId = localStorage.getItem('carId');
let raceActive = false;
let raceData = { cars: [] };
const socket = io();

function t(key) {
  return translations[currentLang][key] || key;
}

function changeLang(lang) {
  currentLang = lang;
  localStorage.setItem('lang', lang);
  render();
}

async function register() {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  try {
    const res = await fetch(API_URL + '/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password, language: currentLang })
    });
    const json = await res.json();
    if (json.token) {
      token = json.token;
      userId = json.user.id;
      localStorage.setItem('token', token);
      localStorage.setItem('userId', userId);
      render();
    } else {
      alert(json.error);
    }
  } catch (e) {
    alert('Error: ' + e.message);
  }
}

async function login() {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  try {
    const res = await fetch(API_URL + '/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const json = await res.json();
    if (json.token) {
      token = json.token;
      userId = json.user.id;
      localStorage.setItem('token', token);
      localStorage.setItem('userId', userId);
      render();
    } else {
      alert(json.error);
    }
  } catch (e) {
    alert('Error: ' + e.message);
  }
}

async function createTeam() {
  const name = document.getElementById('teamName').value;
  const colorPrimary = document.getElementById('colorPrimary').value;
  try {
    const res = await fetch(API_URL + '/api/team/create', {
      method: 'POST',
      headers: {
        'authorization': 'Bearer ' + token,
        'content-type': 'application/json'
      },
      body: JSON.stringify({ name, colorPrimary, colorSecondary: '#FFFFFF', year: 1975 })
    });
    const json = await res.json();
    if (json.team) {
      teamId = json.team.id;
      carId = json.car.id;
      localStorage.setItem('teamId', teamId);
      localStorage.setItem('carId', carId);
      render();
    } else {
      alert(json.error);
    }
  } catch (e) {
    alert('Error: ' + e.message);
  }
}

async function startRace() {
  const circuitName = document.getElementById('circuitName').value || 'Monaco';
  try {
    const res = await fetch(API_URL + '/api/race/start', {
      method: 'POST',
      headers: {
        'authorization': 'Bearer ' + token,
        'content-type': 'application/json'
      },
      body: JSON.stringify({ carId, circuitName, year: 1975 })
    });
    const json = await res.json();
    if (json.raceId) {
      raceActive = true;
      raceData = { cars: [], events: [], lap: 0, raceId: json.raceId };
      render();
    } else {
      alert(json.error);
    }
  } catch (e) {
    alert('Error: ' + e.message);
  }
}

async function makeDecision(decision) {
  try {
    await fetch(API_URL + '/api/race/' + raceData.raceId + '/decision', {
      method: 'POST',
      headers: {
        'authorization': 'Bearer ' + token,
        'content-type': 'application/json'
      },
      body: JSON.stringify({ decision })
    });
  } catch (e) {
    console.error(e);
  }
}

socket.on('race:lap', (data) => {
  raceData.lap = data.lap;
  raceData.cars = data.cars;
  render();
});

socket.on('race:event', (data) => {
  if (!raceData.events) raceData.events = [];
  const eventMsg = `Lap ${data.lap}: ${data.team} - ${t(data.type)}`;
  raceData.events.unshift(eventMsg);
  if (raceData.events.length > 10) raceData.events.pop();
  render();
});

socket.on('race:end', (data) => {
  raceActive = false;
  raceData.cars = data.cars;
  render();
});

function render() {
  const root = document.getElementById('root');
  
  let html = `
    <div class="container">
      <header>
        <h1>${t('title')}</h1>
        <div>
          <label>${t('language')}:</label>
          <select onchange="changeLang(this.value)" value="${currentLang}">
            <option value="en">English</option>
            <option value="es">Español</option>
          </select>
        </div>
      </header>
  `;

  if (!token) {
    html += `
      <div class="card">
        <h2>${t('login')}</h2>
        <div class="form-group">
          <label>${t('email')}</label>
          <input type="email" id="email" placeholder="test@example.com" />
        </div>
        <div class="form-group">
          <label>${t('password')}</label>
          <input type="password" id="password" placeholder="password" />
        </div>
        <button onclick="login()">${t('login')}</button>
        <button onclick="register()" style="background:#00aa00;">${t('register')}</button>
      </div>
    `;
  } else if (!teamId) {
    html += `
      <div class="card">
        <h2>${t('createTeam')}</h2>
        <div class="form-group">
          <label>${t('teamName')}</label>
          <input type="text" id="teamName" placeholder="My F1 Team" />
        </div>
        <div class="form-group">
          <label>${t('color')}</label>
          <input type="color" id="colorPrimary" value="#FF0000" />
        </div>
        <button onclick="createTeam()">${t('createTeam')}</button>
        <button onclick="() => { token=null; localStorage.clear(); render(); }">${t('logout')}</button>
      </div>
    `;
  } else if (!raceActive) {
    html += `
      <div class="card">
        <h2>${t('startRace')}</h2>
        <div class="form-group">
          <label>${t('circuitName')}</label>
          <input type="text" id="circuitName" placeholder="Monaco" />
        </div>
        <button onclick="startRace()" style="width:100%;">${t('startRace')}</button>
        <button onclick="() => { teamId=null; carId=null; localStorage.clear(); render(); }" style="width:100%; background:#888;">${t('logout')}</button>
      </div>
    `;
  } else {
    html += `
      <div class="card">
        <h2>Lap ${raceData.lap || 0}</h2>
        <svg class="race-map" viewBox="0 0 1000 200" preserveAspectRatio="none">
          <path d="M20 100 Q 200 20 400 100 T 980 100" stroke="#888" stroke-width="6" fill="none" />
        `;
        if (raceData.cars) {
          raceData.cars.forEach((car, i) => {
            const x = 20 + (i * 100) % 900;
            const y = 80 + Math.sin(i) * 40;
            html += `<circle cx="${x}" cy="${y}" r="8" fill="#${Math.floor(Math.random()*16777215).toString(16)}" />`;
          });
        }
        html += `</svg>
        <ul class="leaderboard">
          ${raceData.cars ? raceData.cars.map(c => `
            <li>
              <strong>${c.position}. ${c.team}</strong>
              <span>${c.reliability}% | ${c.status}</span>
            </li>
          `).join('') : ''}
        </ul>
        <div class="decision-buttons">
          <button onclick="makeDecision('push')">${t('push')}</button>
          <button onclick="makeDecision('conserve')">${t('conserve')}</button>
          <button onclick="makeDecision('pit')">${t('pit')}</button>
        </div>
        <h3>${t('events')}</h3>
        <div class="event-log">
          ${raceData.events ? raceData.events.map(e => `<div class="event">${e}</div>`).join('') : ''}
        </div>
      </div>
    `;
  }

  html += `</div>`;
  root.innerHTML = html;
}

render();
