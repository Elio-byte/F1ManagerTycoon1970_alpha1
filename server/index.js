import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import { Server as SocketServer } from 'socket.io';
import bodyParser from 'body-parser';
import { PrismaClient } from '@prisma/client';
import { registerRoutes } from './routes/auth.js';
import { raceRoutes } from './routes/race.js';
import { teamRoutes } from './routes/team.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new SocketServer(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../public')));

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret';

app.locals.prisma = prisma;
app.locals.jwt_secret = JWT_SECRET;
app.locals.io = io;

registerRoutes(app);
raceRoutes(app, io);
teamRoutes(app);

io.on('connection', (socket) => {
  console.log('[Socket] Client connected:', socket.id);
  socket.on('disconnect', () => console.log('[Socket] Client disconnected:', socket.id));
});

server.listen(PORT, () => {
  console.log(`🏁 F1 Manager Tycoon 1970 listening on http://localhost:${PORT}`);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
