/* eslint-disable no-console */
import { createServer } from 'http';

import express from 'express';
import next, { NextApiHandler } from 'next';
import { Server } from 'socket.io';

const port = parseInt(process.env.PORT || '3000', 10);
const dev = process.env.NODE_ENV !== 'production';
const nextApp = next({ dev });
const nextHandler: NextApiHandler = nextApp.getRequestHandler();

nextApp.prepare().then(async () => {
  const app = express();
  const server = createServer(app);

  const io = new Server(server);

  io.on('connection', (socket) => {
    console.log('connected to socket.io');

    socket.on('join-room', (roomId: string) => {
      socket.join(roomId);

      const usersInRoom = io.sockets.adapter.rooms.get(roomId);

      if (!usersInRoom) return;

      io.to(socket.id).emit('users-in-room', [...usersInRoom.keys()]);

      console.log('joined');
      socket.broadcast.to(roomId).emit('user-joined', socket.id);
    });

    socket.on('signal-received', (roomId: string, signal: any) => {
      socket.broadcast.to(roomId).emit('user-signal', socket.id, signal);
    });

    socket.on('disconnecting', () => {
      const roomId = [...socket.rooms][1];
      console.log('socketroom', [...socket.rooms][1]);
      socket.broadcast.to(roomId).emit('user-disconnected', socket.id);
    });
  });

  app.all('*', (req: any, res: any) => nextHandler(req, res));

  server.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`);
  });
});
