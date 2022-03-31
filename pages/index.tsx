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
    if (peer) return;

    navigator.mediaDevices
      .getUserMedia({ audio: true, video: true })
      .then(async (stream) => {
        if (navigator.mediaDevices.getDisplayMedia) {
          const videoStream = await navigator.mediaDevices
            .getDisplayMedia({
              video: true,
            })
            .catch(() => {});

          if (videoStream) {
            stream.removeTrack(stream.getVideoTracks()[0]);
            stream.addTrack(videoStream.getVideoTracks()[0]);
          }
        }

        import('peerjs').then(({ default: Peer }) => {
          const newPeer = new Peer(socket.id, {
            host: '/',
            port: 3000,

            path: 'peerjs',
          });

          setPeer(newPeer);

          setMyStream(stream);
        });
      });
  }, [peer, socket.id]);

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
    peer?.on('open', () => socket.emit('join-room', 'room'));

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
  }, [callsHandler, myStream, peer, socket]);

  return (
    <div className="flex h-full w-full">
      <video muted ref={videoRef} className="w-1/2" />
      <video ref={scVideoRef} className="hidden w-1/2" />
    </div>
  );
};

export default Home;
