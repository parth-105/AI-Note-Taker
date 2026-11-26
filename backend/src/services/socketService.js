const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const config = require('../config');
const Participant = require('../models/participant.model');

let io = null;

function initSockets(server) {
  io = new Server(server, {
    cors: { origin: '*' },
    pingInterval: 25000,
    pingTimeout: 20000,
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication required'));
    try {
      socket.user = jwt.verify(token, config.jwtSecret);
      return next();
    } catch (err) {
      return next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`[socket] connected ${socket.id} user=${socket.user.sub}`);

    socket.on('lecture:join', async ({ lectureId }, cb) => {
      try {
        await Participant.findOneAndUpdate(
          { lectureId, studentId: socket.user.sub },
          { lastActiveAt: new Date() },
          { upsert: true, new: true }
        );
        await socket.join(`room:${lectureId}`);
        socket.lectureId = lectureId;
        io.to(`room:${lectureId}`).emit('student:joined', {
          lectureId,
          studentId: socket.user.sub,
        });
        cb?.({ ok: true });
      } catch (err) {
        cb?.({ ok: false, message: err.message });
      }
    });

    socket.on('lecture:leave', () => {
      if (socket.lectureId) socket.leave(`room:${socket.lectureId}`);
    });

    socket.on('participant:ping', async ({ lectureId }) => {
      await Participant.updateOne(
        { lectureId, studentId: socket.user.sub },
        { $set: { lastActiveAt: new Date() } }
      );
    });

    socket.on('disconnect', () => {
      console.log(`[socket] disconnected ${socket.id}`);
    });
  });

  return io;
}



function getIo() {
  if (!io) return { to: () => ({ emit: () => {} }), emit: () => {} };
  return io;
}

function debouncedEmit(room, event, payload, ms = 800, key = event) {
  if (!io) return;
  const map = (debouncedEmit._map ||= new Map());
  const k = `${room}:${key}`;
  if (map.has(k)) clearTimeout(map.get(k));
  map.set(
    k,
    setTimeout(() => {
      map.delete(k);
      io.to(room).emit(event, payload);
    }, ms)
  );
}

module.exports = { initSockets, getIo, debouncedEmit };
