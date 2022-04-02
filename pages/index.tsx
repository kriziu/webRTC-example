import { useEffect, useRef, useState } from 'react';

import type { NextPage } from 'next';
import { useMap } from 'react-use';
import Peer from 'simple-peer';
import { io } from 'socket.io-client';

let isScreenSharing = false;

const Home: NextPage = () => {
  const [socket] = useState(io);
  const [myStream, setMyStream] = useState<MediaStream>();

  const [peers, peersHandler] = useMap<Record<string, Peer.Instance>>();
  const [streams, streamsHandler] = useMap<Record<string, MediaStream>>();

  const myVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ audio: true, video: true })
      .then(async (stream) => {
        socket.emit('join-room', 'room');

        setMyStream(stream);
      });
  }, [socket]);

  useEffect(() => {
    const node = myVideoRef.current;
    if (node && myStream) {
      node.srcObject = myStream;
      node.addEventListener('loadedmetadata', () => {
        node.play();
      });
    }
  }, [myStream]);

  useEffect(() => {
    if (!myStream) return;

    socket.on('users-in-room', (users: string[]) => {
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
      const peer = new Peer({
        initiator: false,
        trickle: false,
        stream: myStream,
      });

      peersHandler.set(userId, peer);
    });

    socket.on('user-signal', (userId, signalReceived) => {
      peersHandler.get(userId)?.signal(signalReceived);
    });

    socket.on('user-disconnected', (userId) => {
      peersHandler.remove(userId);
      streamsHandler.remove(userId);
    });

    // eslint-disable-next-line consistent-return
    return () => {
      socket.off('users_in_room');
      socket.off('user-joined');
      socket.off('user-signal');
      socket.off('user-disconnected');
    };
  }, [myStream, socket, peersHandler, peers, streamsHandler]);

  useEffect(() => {
    if (!Object.keys(peers).length) return;

    Object.keys(peers).forEach((userId) => {
      peersHandler.get(userId).on('stream', (stream) => {
        streamsHandler.set(userId, stream);
      });

      peersHandler
        .get(userId)
        .on('signal', (signal) =>
          socket.emit('signal-received', signal, userId)
        );
    });

    // eslint-disable-next-line consistent-return
    return () => {
      Object.values(peers).forEach((peer) => {
        peer.removeAllListeners('stream');
        peer.removeAllListeners('signal');
      });
    };
  }, [myStream, peers, peersHandler, socket, streamsHandler]);

  const handleChangeStreams = (newStream: MediaStream) => {
    Object.values(peers).forEach((peer) => {
      if (myStream) {
        peer.removeStream(myStream);
        peer.addStream(newStream);
      }
    });

    isScreenSharing = !isScreenSharing;
    setMyStream(newStream);
  };

  const handleChangeVideo = () => {
    if (isScreenSharing) {
      navigator.mediaDevices
        .getUserMedia({
          audio: true,
          video: true,
        })
        .then((stream) => {
          if (myStream) {
            myStream.getTracks().forEach((track) => track.stop());
            handleChangeStreams(stream);
          }
        })
        .catch(() => {});
    } else if (navigator.mediaDevices.getDisplayMedia) {
      navigator.mediaDevices
        .getDisplayMedia({
          video: true,
        })
        .then((stream) => {
          if (myStream) {
            stream.addTrack(myStream.getAudioTracks()[0]);

            stream.getVideoTracks()[0].addEventListener('ended', () => {
              navigator.mediaDevices
                .getUserMedia({
                  video: true,
                  audio: true,
                })
                .then((newStream) => handleChangeStreams(newStream))
                .catch(() => {});
            });

            handleChangeStreams(stream);
          }
        })
        .catch(() => {});
    }
  };

  return (
    <>
      <div className="flex w-full">
        <video muted ref={myVideoRef} className="flex-1" />
        {Object.keys(streams).map((userId) => (
          <video
            key={userId}
            ref={(video) => {
              // eslint-disable-next-line no-param-reassign
              if (video) video.srcObject = streamsHandler.get(userId);
              video?.addEventListener('loadedmetadata', () =>
                video.play().catch(() => {})
              );
            }}
            className="flex-1"
          />
        ))}
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
