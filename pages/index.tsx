/* eslint-disable no-param-reassign */
import { RefObject, useEffect, useRef, useState } from 'react';

import type { NextPage } from 'next';
import { useMap } from 'react-use';
import Peer from 'simple-peer';
import { io } from 'socket.io-client';

let isScreenSharing = false;

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

// const closeVideoStream = (scVideoRef: RefObject<HTMLVideoElement>) => {
//   const remoteVideo = scVideoRef.current;
//   if (!remoteVideo) return;

//   remoteVideo.srcObject = null;
//   remoteVideo.style.display = 'none';
// };

const Home: NextPage = () => {
  const [socket] = useState(io);
  const [myStream, setMyStream] = useState<MediaStream>();

  const [peers, peersHandler] = useMap<Record<string, Peer.Instance>>();

  const videoRef = useRef<HTMLVideoElement>(null);
  const scVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ audio: true, video: true })
      .then(async (stream) => {
        socket.emit('join-room', 'room');

        setMyStream(stream);
      });
  }, [socket]);

  useEffect(() => {
    if (!myStream) return;

    addVideoStream(videoRef, myStream);

    socket.on('users-in-room', (users: string[]) => {
      console.log(users);
      if (!users) return;

      users.forEach((user) => {
        if (user === socket.id) return;

        const peer = new Peer({
          initiator: true,
          trickle: false,
          stream: myStream,
        });

        peersHandler.set(user as any, peer);
      });
    });

    socket.on('user-joined', (userId) => {
      console.log(userId, 'joined');

      const peer = new Peer({
        initiator: false,
        trickle: false,
        stream: myStream,
      });

      peersHandler.set(userId, peer);
    });

    socket.on('user-signal', (userId, signalReceived) => {
      console.log(userId, 'signal');
      console.log(peersHandler.get(userId));
      peersHandler.get(userId)?.signal(signalReceived);
    });

    socket.on('user-disconnected', (userId) => {
      peersHandler.remove(userId);
    });

    // eslint-disable-next-line consistent-return
    return () => {
      socket.off('users_in_room');
      socket.off('user-joined');
      socket.off('user-signal');
    };
  }, [myStream, socket, peersHandler, peers]);

  useEffect(() => {
    if (!Object.keys(peers).length) return;

    Object.values(peers).forEach((peer) => {
      peer.on('stream', (stream) => {
        addVideoStream(scVideoRef, stream);
      });

      peer.on('signal', (signal) => {
        socket.emit('signal-received', 'room', signal);
      });

      // if (myStream) peer.addStream(myStream);
    });

    // eslint-disable-next-line consistent-return
    return () => {
      Object.values(peers).forEach((peer) => {
        peer.removeAllListeners('stream');

        peer.removeAllListeners('signal');

        // if (myStream) peer.removeStream(myStream);
        console.log(peer);
      });
    };
  }, [myStream, peers, socket]);

  const handleChangeVideo = async () => {
    if (isScreenSharing) {
      const cameraVideo = await navigator.mediaDevices
        .getUserMedia({
          video: true,
        })
        .catch(() => {});

      if (cameraVideo && myStream) {
        cameraVideo.addTrack(myStream.getAudioTracks()[0]);

        setMyStream(cameraVideo);
        isScreenSharing = false;
      }
      return;
    }

    if (navigator.mediaDevices.getDisplayMedia) {
      const screenVideo = await navigator.mediaDevices
        .getDisplayMedia({
          video: true,
        })
        .catch(() => {});

      if (screenVideo && myStream) {
        screenVideo.addTrack(myStream.getAudioTracks()[0]);

        setMyStream(screenVideo);
        isScreenSharing = true;
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
