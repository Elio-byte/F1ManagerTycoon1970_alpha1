// Minimal client-side logic: registration, language toggle, socket handling

// Translations (very small subset)
const resources = {
  en: {
    translation: {
      "title": "F1 CEO 1970–1980 (Alpha)",
      "register_title": "Register (demo)",
      "register_button": "Register",
      "start_race": "Start Demo Race",
      "event_engine": "{{team}} has a mechanical failure! Reliability -{{amount}}",
      "event_lap": "Lap {{lap}} complete"
    }
  },
  es: {
    translation: {
      "title": "F1 CEO 1970–1980 (Alfa)",
      "register_title": "Registrar (demo)",
      "register_button": "Registrar",
      "start_race": "Iniciar Carrera Demo",
      "event_engine": "¡{{team}} tiene una falla mecánica! Fiabilidad -{{amount}}",
      "event_lap": "Vuelta {{lap}} completada"
    }
  }
};

i18next.init({ lng: 'en', resources }, (err, t) => {
  if (err) return console.error(err);
  updateTexts();
});

function updateTexts() {
  document.getElementById('title').textContent = i18next.t('title');
  document.getElementById('auth-title').textContent = i18next.t('register_title');
  document.getElementById('register-btn').textContent = i18next.t('register_button');
  document.getElementById('start-race').textContent = i18next.t('start_race');
}

document.getElementById('lang').addEventListener('change', (e) => {
  const lng = e.target.value;
  i18next.changeLanguage(lng, updateTexts);
});

// Register flow (demo)
const form = document.getElementById('register-form');
const msg = document.getElementById('register-msg');
form.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  try {
    const r = await fetch('/api/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) });
    const j = await r.json();
    msg.textContent = j.message || JSON.stringify(j);
  } catch (e) {
    msg.textContent = 'Error';
  }
});

// Socket and race UI
const socket = io();
const svg = document.getElementById('map');
const track = document.getElementById('track');
const trackLength = track.getTotalLength ? track.getTotalLength() : null;
const markers = {};

function ensureMarker(carId, team) {
  if (markers[carId]) return markers[carId];
  const ns = 'http://www.w3.org/2000/svg';
  const circle = document.createElementNS(ns, 'circle');
  circle.setAttribute('r', '8');
  circle.setAttribute('class', 'car-marker');
  circle.setAttribute('fill', '#'+Math.floor(Math.random()*16777215).toString(16));
  svg.appendChild(circle);
  markers[carId] = circle;
  return circle;
}

function placeMarkerOnTrack(marker, percent) {
  if (!trackLength) return;
  const len = trackLength;
  const pt = track.getPointAtLength(len * Math.max(0, Math.min(1, percent)));
  marker.setAttribute('cx', pt.x);
  marker.setAttribute('cy', pt.y);
}

socket.on('connect', () => console.log('connected to server')); 
socket.on('race:lap', data => {
  // data: { lap, cars: [ { id, team, reliability, status } ] }
  const evBox = document.getElementById('events');
  const p = document.createElement('div');
  p.textContent = i18next.t('event_lap', { lap: data.lap });
  evBox.prepend(p);
  // update markers randomly for demo
  data.cars.forEach((c, idx) => {
    const marker = ensureMarker(c.id, c.team);
    const percent = Math.random(); // in demo engine we don't send progress; randomize to show movement
    placeMarkerOnTrack(marker, percent);
  });
});

socket.on('race:event', ev => {
  const evBox = document.getElementById('events');
  const p = document.createElement('div');
  if (ev.type === 'mechanical') {
    p.textContent = i18next.t('event_engine', { team: ev.team, amount: ev.reliabilityHit });
  } else {
    p.textContent = JSON.stringify(ev);
  }
  evBox.prepend(p);
});

socket.on('race:end', res => {
  const evBox = document.getElementById('events');
  const p = document.createElement('div');
  p.textContent = 'Race finished (demo)';
  evBox.prepend(p);
});

// Start race button
document.getElementById('start-race').addEventListener('click', async () => {
  await fetch('/api/start-race', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ lapCount: 6 }) });
});
