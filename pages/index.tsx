import { useEffect } from 'react';

import type { NextPage } from 'next';
import { useMap } from 'react-use';
import Peer from 'simple-peer';
import { io } from 'socket.io-client';

const socket = io();
let now = Date.now();
let counter = 0;

const Home: NextPage = () => {
  const [peers, peersHandler] = useMap<Record<string, Peer.Instance>>();

  useEffect(() => {
    socket.emit('join-room', 'room');
  }, []);

  useEffect(() => {
    socket.on('users-in-room', (users: string[]) => {
      users.forEach((user) => {
        if (user === socket.id) return;

        const peer = new Peer({
          initiator: true,
          trickle: false,
        });

        peersHandler.set(user as any, peer);
      });
    });

    socket.on('user-joined', (userId) => {
      const peer = new Peer({
        initiator: false,
        trickle: false,
      });

      peersHandler.set(userId, peer);
    });

    socket.on('user-signal', (userId, signalReceived) => {
      peersHandler.get(userId)?.signal(signalReceived);
    });

    socket.on('user-disconnected', (userId) => {
      peersHandler.remove(userId);
    });

    return () => {
      socket.off('users_in_room');
      socket.off('user-joined');
      socket.off('user-signal');
      socket.off('user-disconnected');
    };
  }, [peersHandler, peers]);

  useEffect(() => {
    if (!Object.keys(peers).length) return;

    Object.keys(peers).forEach((userId) => {
      const peer = peersHandler.get(userId);

      peer.on('signal', (signal) =>
        socket.emit('signal-received', signal, userId)
      );

      peer.on('connect', () => {
        now = Date.now();
        counter = 0;

        setInterval(() => {
          if (peer.destroyed) return;
          peer.send(JSON.stringify({ message: 'hello' }));
        }, 1000 / 128);
      });

      peer.on('data', (_) => {
        // const { message } = JSON.parse(data.toString());
        const time = Date.now() - now;
        if (time < 1000) {
          counter += 1;
          // eslint-disable-next-line no-console
          console.log(counter, time);
        }

        // console.log(message);
      });
    });

    // eslint-disable-next-line consistent-return
    return () => {
      Object.values(peers).forEach((peer) => {
        peer.removeAllListeners('signal');
        peer.removeAllListeners('data');
      });
    };
  }, [peers, peersHandler]);

  return <></>;
};

export default Home;
