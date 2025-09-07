import { memo, useCallback, useEffect, useRef, useState } from "react";
import type { MessageBody } from "../types";

const Lobby = memo(
  ({
    name,
    audioTrack,
    videoTrack,
  }: {
    name: string;
    audioTrack: MediaStreamTrack | null;
    videoTrack: MediaStreamTrack | null;
  }) => {
    const socket = useRef<WebSocket | null>(null);
    const [lobby, setLobby] = useState(true);
    const [sendingPc, setSendingPc] = useState<null | RTCPeerConnection>(null);
    const [receivingPc, setReceivingPc] = useState<null | RTCPeerConnection>(
      null
    );
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);

    const cleanupPeerConnections = useCallback(() => {
      setSendingPc((pc) => {
        pc?.close();
        return null;
      });
      setReceivingPc((pc) => {
        pc?.close();
        return null;
      });
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = null;
      }
    }, []);

    useEffect(() => {
      if (!name) return;
      const ws = new WebSocket("wss://video-chat-app-backend-ws.onrender.com");
      socket.current = ws;
      ws.onopen = () => {
        console.log("WebSocket connection established");
      };
      ws.onmessage = async (event) => {
        if (event.data === "lobby") {
          setLobby(true);
          cleanupPeerConnections();
        } else {
          const parsedMessage: MessageBody = JSON.parse(event.data);
          console.log(parsedMessage);
          if (parsedMessage.type === "send-offer") {
            setLobby(false);
            cleanupPeerConnections();
            const roomId = parsedMessage.payload.roomId;
            const pc = new RTCPeerConnection();
            if (audioTrack) {
              pc.addTrack(audioTrack);
            }
            if (videoTrack) {
              pc.addTrack(videoTrack);
            }
            setSendingPc(pc);

            pc.ontrack = (e) => {
              const { track } = e;
              if (remoteVideoRef.current) {
                const stream =
                  (remoteVideoRef.current.srcObject as MediaStream) ||
                  new MediaStream();
                stream.addTrack(track);
                remoteVideoRef.current.srcObject = stream;
                remoteVideoRef.current
                  .play()
                  .catch((error) =>
                    console.error("Error playing remote video:", error)
                  );
              }
            };

            pc.onnegotiationneeded = async () => {
              const sdp = await pc.createOffer();
              pc.setLocalDescription(sdp);
              ws.send(
                JSON.stringify({
                  type: "offer",
                  payload: {
                    sdp,
                    roomId,
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
                    },
                  })
                );
              }
            };
          } else if (parsedMessage.type === "wait-for-offer") {
            setLobby(false);
            cleanupPeerConnections();
            const roomId = parsedMessage.payload.roomId;
            const pc = new RTCPeerConnection();
            if (audioTrack) pc.addTrack(audioTrack);
            if (videoTrack) pc.addTrack(videoTrack);
            setReceivingPc(pc);

            pc.ontrack = (e) => {
              const { track } = e;
              if (remoteVideoRef.current) {
                const stream =
                  (remoteVideoRef.current.srcObject as MediaStream) ||
                  new MediaStream();
                stream.addTrack(track);
                remoteVideoRef.current.srcObject = stream;
                remoteVideoRef.current
                  .play()
                  .catch((error) =>
                    console.error("Error playing remote video:", error)
                  );
              }
            };

            pc.onicecandidate = async (e) => {
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
          } else if (parsedMessage.type === "offer") {
            setLobby(false);
            cleanupPeerConnections();
            const { sdp: remoteSdp, roomId } = parsedMessage.payload;
            if (!remoteSdp) {
              return;
            }
            const pc = new RTCPeerConnection();
            await pc.setRemoteDescription(remoteSdp);
            const sdp = await pc.createAnswer();
            pc.setLocalDescription(sdp);
            setReceivingPc(pc);
            ws.send(
              JSON.stringify({
                type: "answer",
                payload: {
                  roomId,
                  sdp,
                },
              })
            );

            pc.ontrack = (e) => {
              const { track } = e;
              if (remoteVideoRef.current) {
                const stream =
                  (remoteVideoRef.current.srcObject as MediaStream) ||
                  new MediaStream();
                stream?.addTrack(track);
                remoteVideoRef.current.srcObject = stream;
                remoteVideoRef.current
                  .play()
                  .catch((error) =>
                    console.error("Error playing remote video:", error)
                  );
              }
            };

            pc.onicecandidate = async (e) => {
              if (!e.candidate) {
                return;
              }
              console.log("omn ice candidate on receiving seide");
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
          } else if (parsedMessage.type === "answer") {
            setLobby(false);
            const { sdp: remoteSdp } = parsedMessage.payload;
            if (!remoteSdp) {
              return;
            }
            setSendingPc((pc) => {
              pc?.setRemoteDescription(remoteSdp);
              return pc;
            });
          } else if (parsedMessage.type === "add-ice-candidate") {
            setLobby(false);
            const { userType, candidate } = parsedMessage.payload;
            if (userType === "sender") {
              setReceivingPc((pc) => {
                if (!pc) {
                  console.error("receiving pc not found");
                } else {
                  console.log(pc.ontrack);
                }
                pc?.addIceCandidate(candidate);
                return pc;
              });
            } else {
              setSendingPc((pc) => {
                if (!pc) {
                  console.error(`sending pc not found`);
                } else {
                  console.log(pc.ontrack);
                }
                pc?.addIceCandidate(candidate);
                return pc;
              });
            }
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
    }, [videoTrack, audioTrack, name, cleanupPeerConnections]);

    useEffect(() => {
      if (localVideoRef.current && videoTrack) {
        localVideoRef.current.srcObject = new MediaStream([videoTrack]);
        localVideoRef.current.play().catch((err) => {
          console.error("Error playing local Video: ", err);
        });
      }
    }, [videoTrack]);

    return (
      <div>
        {name && <h1>hi {name}</h1>}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginBottom: "10px",
            paddingBottom: "40px",
          }}
        >
          <video autoPlay muted width={500} ref={localVideoRef} />
          {lobby ? "Waiting in lobby to connect with others" : null}
          <video autoPlay playsInline width={800} ref={remoteVideoRef} />
        </div>
      </div>
    );
  }
);

export default Lobby;
