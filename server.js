const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const { Server } = require('socket.io');
const RaceEngine = require('./raceEngine');

const USERS_FILE = path.join(__dirname, 'users.json');
function readUsers() {
  try {
    return JSON.parse(fs.readFileSync(USERS_FILE));
  } catch (e) {
    return [];
  }
}
function writeUsers(u) { fs.writeFileSync(USERS_FILE, JSON.stringify(u, null, 2)); }

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';

// Register endpoint - stores user in users.json and prints verification URL to console
app.post('/api/register', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });
  const users = readUsers();
  if (users.find(u => u.email === email)) return res.status(400).json({ error: 'email already registered' });
  const hash = await bcrypt.hash(password, 10);
  const user = { id: Date.now().toString(), email, passwordHash: hash, verified: false, lang: 'en' };
  users.push(user);
  writeUsers(users);

  const token = jwt.sign({ email }, JWT_SECRET, { expiresIn: '1d' });
  const verifyUrl = `http://localhost:3000/api/verify?token=${token}`;
  console.log(`VERIFICATION URL for ${email}: ${verifyUrl}`);

  res.json({ message: 'Registered (demo). Check server console for verification link.' });
});

app.get('/api/verify', (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).send('token required');
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const users = readUsers();
    const user = users.find(u => u.email === payload.email);
    if (user) {
      user.verified = true;
      writeUsers(users);
      return res.send('Email verified. You may close this window and log in from the game.');
    }
    return res.status(400).send('User not found');
  } catch (err) {
    return res.status(400).send('Invalid or expired token');
  }
});

// Minimal login that returns a JWT (no refresh tokens here)
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  const users = readUsers();
  const user = users.find(u => u.email === email);
  if (!user) return res.status(400).json({ error: 'invalid credentials' });
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(400).json({ error: 'invalid credentials' });
  if (!user.verified) return res.status(400).json({ error: 'email not verified' });
  const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token });
});

let currentEngine = null;

app.post('/api/start-race', (req, res) => {
  // For demo we accept optional param lapCount
  const lapCount = parseInt(String(req.body.lapCount || 6), 10);
  // Prepare a few demo cars (player + AI)
  const demoCars = [
    { id: 'player-car', team: 'Player Team', currentReliability: 90, aggression: 0.6, progress: 0, lap: 0, status: 'running' },
    { id: 'ai-1', team: 'LotusAI', currentReliability: 85, aggression: 0.5, progress: 0, lap: 0, status: 'running' },
    { id: 'ai-2', team: 'McLarenAI', currentReliability: 88, aggression: 0.55, progress: 0, lap: 0, status: 'running' }
  ];

  if (currentEngine) {
    currentEngine.stop();
    currentEngine = null;
  }
  currentEngine = new RaceEngine(demoCars, lapCount);

  currentEngine.on('event', ev => {
    io.emit('race:event', ev);
  });
  currentEngine.on('lapComplete', state => {
    io.emit('race:lap', state);
  });
  currentEngine.on('raceEnd', result => {
    io.emit('race:end', result);
    currentEngine = null;
  });

  currentEngine.startRace();
  res.json({ message: 'Race started', lapCount });
});

// Simple API to get users (demo)
app.get('/api/users', (req, res) => {
  res.json(readUsers());
});

io.on('connection', socket => {
  console.log('socket connected', socket.id);
  socket.on('disconnect', () => console.log('socket disconnected', socket.id));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}`));
