import { memo, useCallback, useEffect, useRef, useState } from "react";
import type { MessageBody } from "../types";

const Lobby = memo(
  ({
    name,
    localAudioTrack,
    locaVideoTrack,
  }: {
    name: string;
    localAudioTrack: MediaStreamTrack | null;
    locaVideoTrack: MediaStreamTrack | null;
  }) => {
    const socket = useRef<WebSocket | null>(null);
    const [otherUsername, setOtherUsername] = useState("");
    const [lobby, setLobby] = useState(true);
    const [peerConnection, setPeerConnection] =
      useState<null | RTCPeerConnection>(null);
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const remoteAudioRef = useRef<HTMLAudioElement>(null);
    const [queuedCandidates, setQueuedCandidates] = useState<RTCIceCandidate[]>(
      []
    );

    const cleanupPeerConnections = useCallback(() => {
      setPeerConnection((pc) => {
        pc?.close();
        return null;
      });
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = null;
      }
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = null;
      }
    }, []);

    useEffect(() => {
      if (!name) return;
      const ws = new WebSocket("wss://video-chat-app-backend-ws.onrender.com");
      // const ws = new WebSocket("ws://localhost:8080");
      socket.current = ws;
      ws.onopen = () => {
        console.log("WebSocket connection established");
      };
      ws.onmessage = async (event) => {
        if (event.data === "lobby") {
          setLobby(true);
          cleanupPeerConnections();
          return;
        }
        if (event.data === "peer-disconnected") {
          setLobby(true);
          if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
          if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
          setOtherUsername("");
          alert(`${otherUsername} has disconnected`);
        } else {
          const parsedMessage: MessageBody = JSON.parse(event.data);
          console.log(parsedMessage);
          if (parsedMessage.type === "send-offer") {
            setLobby(false);
            cleanupPeerConnections();
            const roomId = parsedMessage.payload.roomId;
            const pc = new RTCPeerConnection({
              iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
            });

            const remoteStream = new MediaStream();
            if (remoteVideoRef.current) {
              remoteVideoRef.current.srcObject = remoteStream;
            }
            if (remoteAudioRef.current) {
              remoteAudioRef.current.srcObject = remoteStream;
            }

            pc.ontrack = (e) => {
              console.log("Received remote track:", e.track.kind);
              console.log("Event details:", e);

              const { track } = e;
              if (remoteStream) {
                remoteStream.addTrack(track);

                // If it's a video track, make sure it's connected to video element
                if (track.kind === "video" && remoteVideoRef.current) {
                  remoteVideoRef.current.srcObject = remoteStream;
                  remoteVideoRef.current
                    .play()
                    .catch((error) =>
                      console.error("Error playing remote video:", error)
                    );
                }

                // If it's an audio track, make sure it's connected to audio element
                if (track.kind === "audio" && remoteAudioRef.current) {
                  remoteAudioRef.current.srcObject = remoteStream;
                  remoteAudioRef.current
                    .play()
                    .catch((error) =>
                      console.error("Error playing remote audio:", error)
                    );
                }
              }
            };

            pc.onnegotiationneeded = async () => {
              const sdp = await pc.createOffer();
              await pc.setLocalDescription(sdp);
              ws.send(
                JSON.stringify({
                  type: "offer",
                  payload: {
                    sdp,
                    roomId,
                    name,
                  },
                })
              );
            };

            pc.onicecandidate = async (e) => {
              if (e.candidate) {
                ws.send(
                  JSON.stringify({
                    type: "add-ice-candidate",
                    payload: {
                      candidate: e.candidate,
                      roomId: roomId,
                      userType: "sender",
                    },
                  })
                );
              }
            };
            setPeerConnection(pc);
            if (localAudioTrack) {
              pc.addTrack(localAudioTrack);
            }
            if (locaVideoTrack) {
              pc.addTrack(locaVideoTrack);
            }
          } else if (parsedMessage.type === "wait-for-offer") {
            setLobby(true);
          } else if (parsedMessage.type === "offer") {
            setLobby(false);
            cleanupPeerConnections();
            const {
              sdp: remoteSdp,
              roomId,
              name: senderName,
            } = parsedMessage.payload;
            setOtherUsername(senderName);
            if (!remoteSdp) {
              return;
            }
            const pc = new RTCPeerConnection({
              iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
            });
            const remoteStream = new MediaStream();
            if (remoteVideoRef.current) {
              remoteVideoRef.current.srcObject = remoteStream;
            }
            if (remoteAudioRef.current) {
              remoteAudioRef.current.srcObject = remoteStream;
            }

            pc.ontrack = (e) => {
              const { track } = e;
              if (remoteStream) {
                remoteStream.addTrack(track);

                // If it's a video track, make sure it's connected to video element
                if (track.kind === "video" && remoteVideoRef.current) {
                  remoteVideoRef.current.srcObject = remoteStream;
                  remoteVideoRef.current
                    .play()
                    .catch((error) =>
                      console.error("Error playing remote video:", error)
                    );
                }

                // If it's an audio track, make sure it's connected to audio element
                if (track.kind === "audio" && remoteAudioRef.current) {
                  remoteAudioRef.current.srcObject = remoteStream;
                  remoteAudioRef.current
                    .play()
                    .catch((error) =>
                      console.error("Error playing remote audio:", error)
                    );
                }
              }
            };

            pc.onicecandidate = async (e) => {
              if (!e.candidate) {
                return;
              }
              console.log("on ice candidate on receiving side");
              if (e.candidate) {
                ws.send(
                  JSON.stringify({
                    type: "add-ice-candidate",
                    payload: {
                      candidate: e.candidate,
                      userType: "receiver",
                      roomId,
                    },
                  })
                );
              }
            };
            setPeerConnection(pc);
            if (localAudioTrack) {
              pc.addTrack(localAudioTrack);
            }
            if (locaVideoTrack) {
              pc.addTrack(locaVideoTrack);
            }

            await pc.setRemoteDescription(remoteSdp);
            const sdp = await pc.createAnswer();
            await pc.setLocalDescription(sdp);

            queuedCandidates.forEach((candidate) => {
              pc.addIceCandidate(candidate);
            });
            setQueuedCandidates([]);

            ws.send(
              JSON.stringify({
                type: "answer",
                payload: {
                  roomId,
                  sdp,
                  name,
                },
              })
            );
          } else if (parsedMessage.type === "answer") {
            setLobby(false);
            const { sdp: remoteSdp, name } = parsedMessage.payload;
            setOtherUsername(name);
            if (!remoteSdp) {
              return;
            }
            setPeerConnection((pc) => {
              if (!pc) {
                console.error("receiving pc connection not exist");
                return null;
              }
              pc.setRemoteDescription(remoteSdp);
              return pc;
            });
          } else if (parsedMessage.type === "add-ice-candidate") {
            const { candidate } = parsedMessage.payload;
            if (!candidate) return;
            const iceCandidate = new RTCIceCandidate(candidate);

            setPeerConnection((pc) => {
              if (pc && pc.remoteDescription) {
                pc.addIceCandidate(iceCandidate);
              } else {
                setQueuedCandidates((prev) => [...prev, iceCandidate]);
              }
              return pc;
            });
          }
        }
      };
      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        alert("WebSocket connection failed");
      };

      ws.onclose = () => {
        console.log("WebSocket connection closed");
        setLobby(false);
      };
      return () => {
        ws.close();
      };
    }, [locaVideoTrack, localAudioTrack, name, cleanupPeerConnections]);

    useEffect(() => {
      if (localVideoRef.current && locaVideoTrack) {
        const stream = new MediaStream();
        stream.addTrack(locaVideoTrack);
        if (localAudioTrack) {
          stream.addTrack(localAudioTrack);
        }
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.play().catch((err) => {
          console.error("Error playing local Video: ", err);
        });
      }
    }, [locaVideoTrack, localAudioTrack]);

    return (
      <div className="flex flex-row justify-center items-center min-h-screen gap-8 mx-auto w-10/12">
        <div className="flex flex-col w-4/12">
          <div className="relative">
            {name && (
              <h1 className="absolute top-2 left-2 text-sm font-bold text-white bg-purple-600 bg-opacity-50 px-2 py-1 rounded">
                {name}
              </h1>
            )}
            <video
              autoPlay
              muted
              className="h-[500px] w-full object-cover rounded-lg rotate-y-180"
              ref={localVideoRef}
            />
          </div>
        </div>
        <div className="flex flex-col w-7/12 relative">
          {otherUsername && (
            <h1 className="absolute top-2 left-2 text-sm font-bold text-white bg-purple-600 bg-opacity-50 px-2 py-1 rounded">
              {otherUsername}
            </h1>
          )}
          {lobby && !remoteVideoRef.current?.srcObject && (
            <p className="absolute inset-0 flex items-center justify-center text-lg font-medium text-white bg-gray-400/50 rounded-lg">
              Waiting in lobby to connect with others
              <span className="inline-flex ml-2">
                <span className="[animation:wave_0.8s_ease-in-out_infinite]">
                  .
                </span>
                <span className="[animation:wave_0.8s_ease-in-out_infinite_0.2s]">
                  .
                </span>
                <span className="[animation:wave_0.8s_ease-in-out_infinite_0.4s]">
                  .
                </span>
              </span>
            </p>
          )}
          <video
            autoPlay
            muted
            className="h-[500px] w-full object-cover rounded-lg"
            ref={remoteVideoRef}
          />
          <audio autoPlay ref={remoteAudioRef} className="hidden" />
        </div>
      </div>
    );
  }
);

export default Lobby;
