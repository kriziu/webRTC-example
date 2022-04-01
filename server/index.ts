/* eslint-disable no-console */
import { createServer } from 'http';

import express from 'express';
import next, { NextApiHandler } from 'next';
import { ExpressPeerServer } from 'peer';
import { Server } from 'socket.io';

const port = parseInt(process.env.PORT || '3000', 10);
const dev = process.env.NODE_ENV !== 'production';
const nextApp = next({ dev });
const nextHandler: NextApiHandler = nextApp.getRequestHandler();

nextApp.prepare().then(async () => {
  const app = express();
  const server = createServer(app);

  const io = new Server(server);

  const peerServer = ExpressPeerServer(server);

  // peerServer.on('connection', () => console.log('connected to webRTC'));

  app.use('/peerjs', peerServer);

  // app.get('/hello', async (_, res) => {
  //   res.send('Hello World');
  // });

  io.on('connection', (socket) => {
    console.log('connected to socket.io');
    socket.emit('status', 'Hello from Socket.io');

    socket.on('join-room', (roomId: string) => {
      socket.join(roomId);
      console.log('socketid', socket.id);

      socket.broadcast.to(roomId).emit('user-connected', socket.id);
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
