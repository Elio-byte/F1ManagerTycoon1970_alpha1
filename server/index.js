const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const { Server: SocketServer } = require('socket.io');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const EventEmitter = require('events');

// Try to load the real RaceEngine; if it fails, provide a safe fallback so races always work
let RaceEngine;
try {
  RaceEngine = require('./engine/raceEngine');
  console.log('[Server] Loaded engine/raceEngine');
} catch (e) {
  console.warn('[Server] Failed to load engine/raceEngine, using fallback engine. Error:', String(e));

  // Minimal fallback RaceEngine implementation that simulates laps/events
  RaceEngine = class FallbackRaceEngine extends EventEmitter {
    constructor(cars = [], laps = 10, seed = Date.now()) {
      super();
      this.cars = JSON.parse(JSON.stringify(cars));
      this.laps = laps;
      this.currentLap = 0;
      this.interval = null;
      this.seed = seed;
    }

    start() {
      if (this.interval) return;
      this.interval = setInterval(() => {
        this.currentLap += 1;
        // simple deterministic-ish movement
        this.cars.forEach((c, idx) => {
          // reduce reliability slowly
          c.currentReliability = Math.max(0, (c.currentReliability || c.reliability || 80) - Math.random() * 1.5);
          // random status
          if (Math.random() < 0.02) c.status = 'retired';
        });
        // sort by reliability as a simple proxy for position
        this.cars.sort((a, b) => (b.currentReliability || 0) - (a.currentReliability || 0));
        this.cars.forEach((c, i) => c.position = i + 1);

        this.emit('lap', { lap: this.currentLap, cars: this.cars.map(c => ({ id: c.id, team: c.team, position: c.position, reliability: Math.round(c.currentReliability), status: c.status })) });

        // occasional event
        if (Math.random() < 0.25) {
          const idx = Math.floor(Math.random() * this.cars.length);
          const event = { lap: this.currentLap, team: this.cars[idx].team, type: Math.random() < 0.5 ? 'Overtake' : 'Mechanical' };
          this.emit('event', event);
        }

        if (this.currentLap >= this.laps) {
          clearInterval(this.interval);
          this.interval = null;
          this.emit('end', { cars: this.cars.map(c => ({ id: c.id, team: c.team, position: c.position, reliability: Math.round(c.currentReliability), status: c.status })) });
        }
      }, 1200);
    }

    applyDecision(decision) {
      // decisions slightly affect all cars as a demo
      if (!decision) return;
      this.cars.forEach(c => {
        if (decision === 'push') c.currentReliability = Math.max(0, (c.currentReliability || 80) - Math.random() * 2 - 1);
        if (decision === 'conserve') c.currentReliability = Math.min(100, (c.currentReliability || 80) + Math.random() * 0.8);
        if (decision === 'pit' && Math.random() < 0.9) c.status = 'pitting';
      });
    }
  };
}

// HOTFIX: This server runs entirely in-memory (no Prisma/@prisma/client required)
// Ensures the service starts reliably on Render free instances without running prisma generate

const app = express();
const server = http.createServer(app);
const io = new SocketServer(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_in_production';

// In-memory storage
const users = [];
const teams = [];
const activeRaces = new Map();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Middleware
function verifyToken(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.id;
    req.userEmail = payload.email;
    next();
  } catch (e) {
    console.warn('Token verify failed', String(e));
    res.status(401).json({ error: 'Invalid token' });
  }
}

// ========== AUTH ROUTES (in-memory) ==========
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, language } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });

    if (users.find(u => u.email === email)) {
      return res.status(400).json({ error: 'email already registered' });
    }

    const hash = await bcrypt.hash(password, 10);
    const user = {
      id: 'user_' + Date.now() + '_' + Math.random().toString(36).slice(2),
      email,
      passwordHash: hash,
      language: language || 'en',
      verified: true,
      createdAt: new Date()
    };
    users.push(user);

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, email: user.email, language: user.language } });
  } catch (e) {
    console.error('Register error:', e);
    res.status(500).json({ error: 'Registration failed', detail: String(e) });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = users.find(u => u.email === email);
    if (!user) return res.status(400).json({ error: 'invalid credentials' });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(400).json({ error: 'invalid credentials' });

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, email: user.email, language: user.language } });
  } catch (e) {
    console.error('Login error:', e);
    res.status(500).json({ error: 'Login failed', detail: String(e) });
  }
});

// ========== TEAM ROUTES (in-memory) ==========
app.post('/api/team/create', verifyToken, (req, res) => {
  try {
    const { name, colorPrimary, year } = req.body;
    const teamId = 'team_' + Date.now() + '_' + Math.random().toString(36).slice(2);
    const team = {
      id: teamId,
      userId: req.userId,
      name,
      colorPrimary: colorPrimary || '#FF0000',
      colorSecondary: '#FFFFFF',
      createdAt: new Date()
    };
    teams.push(team);

    const carId = 'car_' + Date.now() + '_' + Math.random().toString(36).slice(2);
    const car = {
      id: carId,
      teamId,
      year: year || 1975,
      currentReliability: 85
    };

    res.json({ team, car });
  } catch (e) {
    res.status(500).json({ error: 'Failed to create team', detail: String(e) });
  }
});

app.get('/api/team/:userId', (req, res) => {
  try {
    const userTeams = teams.filter(t => t.userId === req.params.userId);
    res.json({ teams: userTeams });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch teams', detail: String(e) });
  }
});

// ========== RACE ROUTES (in-memory) ==========
app.post('/api/race/start', verifyToken, (req, res) => {
  try {
    console.log('[Race start] incoming body:', JSON.stringify(req.body));
    const { carId: providedCarId, circuitName, year } = req.body || {};
    const userId = req.userId;

    const raceId = 'race_' + Date.now() + '_' + Math.random().toString(36).slice(2);

    // If no carId provided, create a temporary player car id so server logic doesn't break
    const playerCarId = providedCarId || 'player_' + raceId;

    // Simple demo cars (player + 3 AI). Player car uses playerCarId.
    const demoCars = [
      { id: playerCarId, team: 'Player Team', position: 1, reliability: 85, currentReliability: 85, aggression: 0.5, status: 'running' },
      { id: 'ai_1_' + raceId, team: 'Ferrari AI', position: 2, reliability: 82, currentReliability: 82, aggression: 0.6, status: 'running' },
      { id: 'ai_2_' + raceId, team: 'McLaren AI', position: 3, reliability: 80, currentReliability: 80, aggression: 0.55, status: 'running' },
      { id: 'ai_3_' + raceId, team: 'Lotus AI', position: 4, reliability: 78, currentReliability: 78, aggression: 0.7, status: 'running' }
    ];

    // Create the engine and wire up events
    const engine = new RaceEngine(demoCars, 20, Math.floor(Math.random() * 1000000));
    activeRaces.set(raceId, { engine, userId, carId: playerCarId, circuitName });

    engine.on('lap', (data) => {
      try {
        io.emit('race:lap', { raceId, ...data });
      } catch (e) { console.error('Emit race:lap error', e); }
    });

    engine.on('event', (data) => {
      try {
        io.emit('race:event', { raceId, ...data });
      } catch (e) { console.error('Emit race:event error', e); }
    });

    engine.on('end', (result) => {
      try {
        io.emit('race:end', { raceId, ...result });
      } catch (e) { console.error('Emit race:end error', e); }
      activeRaces.delete(raceId);
    });

    // start engine (defensive)
    try {
      engine.start();
    } catch (e) {
      console.error('Engine start failed', e);
      activeRaces.delete(raceId);
      return res.status(500).json({ error: 'Failed to start engine', detail: String(e) });
    }

    res.json({ raceId, circuitName: circuitName || 'Unknown', laps: 20, carId: playerCarId });
  } catch (e) {
    console.error('Race start error:', e);
    res.status(500).json({ error: 'Failed to start race', detail: String(e) });
  }
});

app.get('/debug/active-races', (req, res) => {
  const list = Array.from(activeRaces.entries()).map(([id, v]) => ({ id, userId: v.userId, carId: v.carId, circuitName: v.circuitName }));
  res.json({ count: list.length, races: list });
});

app.post('/api/race/:raceId/decision', verifyToken, (req, res) => {
  try {
    const { decision } = req.body || {};
    const data = activeRaces.get(req.params.raceId);
    if (data) {
      try {
        data.engine.applyDecision(decision);
        res.json({ success: true });
      } catch (e) {
        console.error('Apply decision failed', e);
        res.status(500).json({ error: 'Failed to apply decision', detail: String(e) });
      }
    } else {
      res.status(404).json({ error: 'Race not found' });
    }
  } catch (e) {
    console.error('Decision handler error', e);
    res.status(500).json({ error: 'Decision failed', detail: String(e) });
  }
});

// ========== HEALTH CHECK ==========
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Lightweight landing for slow connections
app.get('/lite', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/lite.html'));
});

// ========== SOCKET.IO ==========
io.on('connection', (socket) => {
  console.log('[Socket] Client connected:', socket.id);
  socket.on('disconnect', () => console.log('[Socket] Client disconnected:', socket.id));
});

function raceSeed() {
  return Math.floor(Math.random() * 1000000);
}

// ========== START SERVER ==========
server.listen(PORT, () => {
  console.log(`🏁 F1 Manager Tycoon 1970 running on port ${PORT}`);
  console.log(`📍 Open: http://localhost:${PORT}`);
});

process.on('SIGTERM', () => {
  console.log('Shutting down...');
  process.exit(0);
});
