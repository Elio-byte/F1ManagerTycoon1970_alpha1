const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const { Server: SocketServer } = require('socket.io');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const RaceEngine = require('./engine/raceEngine');

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
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.id;
    req.userEmail = payload.email;
    next();
  } catch (e) {
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
    res.status(500).json({ error: 'Registration failed' });
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
    res.status(500).json({ error: 'Login failed' });
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
    res.status(500).json({ error: 'Failed to create team' });
  }
});

app.get('/api/team/:userId', (req, res) => {
  try {
    const userTeams = teams.filter(t => t.userId === req.params.userId);
    res.json({ teams: userTeams });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
});

// ========== RACE ROUTES (in-memory) ==========
app.post('/api/race/start', verifyToken, (req, res) => {
  try {
    const { carId, circuitName, year } = req.body;
    const userId = req.userId;

    const raceId = 'race_' + Date.now() + '_' + Math.random().toString(36).slice(2);

    // Simple demo cars (player + 3 AI)
    const demoCars = [
      { id: carId, team: 'Player Team', currentReliability: 85, aggression: 0.5, status: 'running' },
      { id: 'ai_1_' + raceId, team: 'Ferrari AI', currentReliability: 82, aggression: 0.6, status: 'running' },
      { id: 'ai_2_' + raceId, team: 'McLaren AI', currentReliability: 80, aggression: 0.55, status: 'running' },
      { id: 'ai_3_' + raceId, team: 'Lotus AI', currentReliability: 78, aggression: 0.7, status: 'running' }
    ];

    const engine = new RaceEngine(demoCars, 20, raceSeed());
    activeRaces.set(raceId, { engine, userId, carId, circuitName });

    engine.on('lap', (data) => {
      io.emit('race:lap', { raceId, ...data });
    });

    engine.on('event', (data) => {
      io.emit('race:event', { raceId, ...data });
    });

    engine.on('end', (result) => {
      io.emit('race:end', { raceId, ...result });
      activeRaces.delete(raceId);
    });

    engine.start();
    res.json({ raceId, circuitName, laps: 20 });
  } catch (e) {
    console.error('Race start error:', e);
    res.status(500).json({ error: 'Failed to start race' });
  }
});

app.post('/api/race/:raceId/decision', verifyToken, (req, res) => {
  const { decision } = req.body;
  const data = activeRaces.get(req.params.raceId);
  if (data) {
    data.engine.applyDecision(decision);
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Race not found' });
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
