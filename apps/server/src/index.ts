import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from '@npl-auction/types';
import lobbyRoutes from './routes/lobby';

const app = express();
const httpServer = createServer(app);

const CLIENT_URL = process.env.CLIENT_URL ?? 'http://localhost:3000';
const PORT = parseInt(process.env.PORT ?? '3001', 10);

// ─── Middleware ───────────────────────────────────────────────────────────────

app.use(cors({ origin: CLIENT_URL, credentials: true }));
app.use(express.json());

// ─── Socket.io ───────────────────────────────────────────────────────────────

export const io = new Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>(httpServer, {
  cors: {
    origin: CLIENT_URL,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

io.on('connection', (socket) => {
  console.log(`[socket] connected: ${socket.id}`);

  socket.on('disconnect', (reason) => {
    console.log(`[socket] disconnected: ${socket.id} — ${reason}`);
  });
});

// ─── Routes ──────────────────────────────────────────────────────────────────

app.use('/lobby', lobbyRoutes);

// ─── Health check ────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

// ─── Start ───────────────────────────────────────────────────────────────────

const server = httpServer.listen(PORT, () => {
  console.log(`[server] listening on port ${PORT}`);
  console.log(`[server] CORS origin: ${CLIENT_URL}`);
});

// ─── Graceful shutdown ───────────────────────────────────────────────────────

function shutdown(signal: string): void {
  console.log(`[server] ${signal} received — shutting down`);
  io.close(() => {
    server.close(() => {
      console.log('[server] closed');
      process.exit(0);
    });
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
