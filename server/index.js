const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const { Server: SocketServer } = require('socket.io');
const bodyParser = require('body-parser');

let prisma = null;

try {
  const { PrismaClient } = require('@prisma/client');
  prisma = new PrismaClient();
} catch (e) {
  console.error('Prisma error:', e.message);
}

const app = express();
const server = http.createServer(app);
const io = new SocketServer(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../public')));

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';

app.locals.prisma = prisma;
app.locals.jwt_secret = JWT_SECRET;
app.locals.io = io;

// Routes
if (prisma) {
  require('./routes/auth')(app);
  require('./routes/team')(app);
  require('./routes/race')(app, io);
}

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

io.on('connection', (socket) => {
  console.log('[Socket] Client connected:', socket.id);
  socket.on('disconnect', () => console.log('[Socket] Client disconnected:', socket.id));
});

server.listen(PORT, () => {
  console.log(`🏁 F1 Manager Tycoon 1970 listening on http://localhost:${PORT}`);
});

process.on('SIGTERM', async () => {
  if (prisma) {
    await prisma.$disconnect();
  }
  process.exit(0);
});
