/* eslint-disable no-param-reassign */
import { RefObject, useEffect, useRef, useState } from 'react';

import type { NextPage } from 'next';
import type Peer from 'peerjs';
import { useList } from 'react-use';
import { io } from 'socket.io-client';

const addVideoStream = (
  scVideoRef: RefObject<HTMLVideoElement>,
  stream: MediaStream
) => {
  const video = scVideoRef.current;
  if (!video) return;

  video.srcObject = stream;
  video.style.display = 'block';
  video.addEventListener('loadedmetadata', () => {
    video.play();
  });
};

const closeVideoStream = (scVideoRef: RefObject<HTMLVideoElement>) => {
  const remoteVideo = scVideoRef.current;
  if (!remoteVideo) return;

  remoteVideo.srcObject = null;
  remoteVideo.style.display = 'none';
};

const Home: NextPage = () => {
  const [socket] = useState(io);
  const [peer, setPeer] = useState<Peer>();
  const [myStream, setMyStream] = useState<MediaStream>();

  const [calls, callsHandler] = useList<Peer.MediaConnection>();

  const videoRef = useRef<HTMLVideoElement>(null);
  const scVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        import('peerjs').then(({ default: Peer }) => {
          const newPeer = new Peer(socket.id, {
            host: '/',
            port: 3000,

            path: 'peerjs',
          });

          if (peer?.id !== newPeer.id) {
            setPeer(newPeer);
          }

          setMyStream(stream);
        });
      });

    peer?.on('open', () => socket.emit('join-room', 'room'));
  }, [peer, socket]);

  useEffect(() => {
    if (!myStream || !peer) return;

    addVideoStream(videoRef, myStream);

    socket.on('user-connected', (userId) => {
      const call = peer.call(userId, myStream);
      if (!call) return;

      callsHandler.push(call);

      call.on('stream', (remoteStream) => {
        addVideoStream(scVideoRef, remoteStream);
      });

      call.on('close', () => {
        closeVideoStream(scVideoRef);
      });
    });

    socket.on('user-disconnected', (userId) => {
      calls.find((call) => call.peer === userId)?.close();
      callsHandler.filter((call) => call.peer !== userId);
    });

    // eslint-disable-next-line consistent-return
    return () => {
      socket.off('user-connected');
      socket.off('user-disconnected');
    };
  }, [calls, callsHandler, myStream, peer, socket]);

  useEffect(() => {
    const handlePeerCall = (call: Peer.MediaConnection) => {
      call.answer(myStream);
      callsHandler.push(call);

      call.on('stream', (remoteStream) => {
        addVideoStream(scVideoRef, remoteStream);
      });

      call.on('close', () => closeVideoStream(scVideoRef));
    };

    peer?.on('call', handlePeerCall);

    return () => {
      peer?.off('call', handlePeerCall);
    };
  }, [callsHandler, myStream, peer]);

  return (
    <div className="flex h-full w-full items-center justify-center">
      <video muted ref={videoRef} />
      <video ref={scVideoRef} />
    </div>
  );
};

export default Home;
