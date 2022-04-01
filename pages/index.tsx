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
  const [port, setPort] = useState(443);
  const [socket] = useState(io);
  const [peer, setPeer] = useState<Peer>();
  const [myStream, setMyStream] = useState<MediaStream>();
  const [cameraTrack, setCameraTrack] = useState<MediaStreamTrack>();

  const [calls, callsHandler] = useList<Peer.MediaConnection>();

  const videoRef = useRef<HTMLVideoElement>(null);
  const scVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    socket.on('port', (portFromServer) => setPort(portFromServer));

    return () => {
      socket.off('port');
    };
  });

  useEffect(() => {
    console.log('peer', peer);
    console.log('port', port);
    if (peer) return;

    navigator.mediaDevices
      .getUserMedia({ audio: true, video: true })
      .then(async (stream) => {
        import('peerjs').then(({ default: Peer }) => {
          const newPeer = new Peer(socket.id, {
            host: '/',
            port,
            path: 'peerjs',
          });

          setPeer(newPeer);
          setCameraTrack(stream.getVideoTracks()[0]);
          setMyStream(stream);
        });
      });
  }, [peer, port, socket.id]);

  useEffect(() => {
    if (!myStream || !peer) return;

    addVideoStream(videoRef, myStream);

    socket.on('user-connected', (userId) => {
      console.log('userid', userId);
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
      console.log('answer', call);
      call.answer(myStream);
      callsHandler.push(call);

      call.on('stream', (remoteStream) => {
        addVideoStream(scVideoRef, remoteStream);
      });

      call.on('close', () => closeVideoStream(scVideoRef));
    };
    peer?.on('call', handlePeerCall);

    peer?.on('open', () => {
      socket.emit('join-room', 'room');
      console.log('open');
    });

    peer?.on('disconnected', () => {
      peer?.reconnect();
      console.log('reconnected');
    });
    return () => {
      peer?.off('call', handlePeerCall);
    };
  }, [callsHandler, myStream, peer, socket]);

  useEffect(() => {
    calls.forEach((call) => {
      if (!myStream) return;

      const audioTrack = myStream?.getAudioTracks()[0];
      const videoTrack = myStream?.getVideoTracks()[0];

      call.peerConnection.getSenders()[0].replaceTrack(audioTrack);
      call.peerConnection.getSenders()[1].replaceTrack(videoTrack);
    });
  }, [myStream, calls, cameraTrack]);

  const handleChangeVideo = async () => {
    if (!cameraTrack) {
      const cameraVideo = await navigator.mediaDevices
        .getUserMedia({
          video: true,
        })
        .catch(() => {});

      if (cameraVideo && myStream) {
        const tempStream = myStream;
        tempStream.removeTrack(tempStream.getVideoTracks()[0]);
        tempStream.addTrack(cameraVideo.getVideoTracks()[0]);

        setMyStream(tempStream);
        setCameraTrack(cameraVideo.getVideoTracks()[0]);
      }
      return;
    }

    if (navigator.mediaDevices.getDisplayMedia) {
      const videoStream = await navigator.mediaDevices
        .getDisplayMedia({
          video: true,
        })
        .catch(() => {});

      if (videoStream && myStream) {
        const tempStream = myStream;
        tempStream.removeTrack(tempStream.getVideoTracks()[0]);
        tempStream.addTrack(videoStream.getVideoTracks()[0]);

        setMyStream(tempStream);
        setCameraTrack(undefined);
      }
    }
  };

  return (
    <>
      <div className="flex w-full">
        <video muted ref={videoRef} className="w-1/2" />
        <video ref={scVideoRef} className="hidden w-1/2" />
      </div>
      <button
        className="rounded-md bg-blue-500 py-2 px-4 text-white hover:bg-blue-600 active:bg-blue-400"
        onClick={handleChangeVideo}
      >
        Change video
      </button>
    </>
  );
};

export default Home;
