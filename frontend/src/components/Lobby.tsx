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
    const [peerConnection, setPeerConnection] =
      useState<null | RTCPeerConnection>(null);
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
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
    }, []);

    useEffect(() => {
      if (!name) return;
      const ws = new WebSocket("wss://video-chat-app-backend-ws.onrender.com");
      // const ws = new WebSocket("ws:localhost:8080");
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
            setPeerConnection(pc);
            if (audioTrack) {
              pc.addTrack(audioTrack);
            }
            if (videoTrack) {
              pc.addTrack(videoTrack);
            }

            pc.onnegotiationneeded = async () => {
              const sdp = await pc.createOffer();
              pc.setLocalDescription(sdp);
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

            pc.ontrack = (e) => {
              // This is the crucial part for the sender to receive video
              // The same ontrack logic from your "offer" handler goes here.
              const { track } = e;
              if (remoteVideoRef.current) {
                const stream =
                  (remoteVideoRef.current.srcObject as MediaStream) ||
                  new MediaStream();
                stream.addTrack(track);
                remoteVideoRef.current.srcObject = stream;
                remoteVideoRef.current.play();
              }
            };
          } else if (parsedMessage.type === "wait-for-offer") {
            setLobby(true);
          } else if (parsedMessage.type === "offer") {
            setLobby(false);
            cleanupPeerConnections();
            const { sdp: remoteSdp, roomId } = parsedMessage.payload;
            if (!remoteSdp) {
              return;
            }
            const pc = new RTCPeerConnection();
            setPeerConnection(pc);
            pc.setRemoteDescription(remoteSdp);
            const sdp = await pc.createAnswer();
            pc.setLocalDescription(sdp);
            if (audioTrack) {
              pc.addTrack(audioTrack);
            }
            if (videoTrack) {
              pc.addTrack(videoTrack);
            }
            const stream = new MediaStream();
            if (remoteVideoRef.current) {
              remoteVideoRef.current.srcObject = stream;
            }
            queuedCandidates.forEach((candidate) => {
              pc.addIceCandidate(candidate);
            });
            setQueuedCandidates([]);

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

            ws.send(
              JSON.stringify({
                type: "answer",
                payload: {
                  roomId,
                  sdp,
                },
              })
            );
            setTimeout(() => {
              const track1 = pc.getTransceivers()[0].receiver.track;
              const track2 = pc.getTransceivers()[1].receiver.track;
              console.log(track1);
              if (!remoteVideoRef.current) {
                return;
              }
              const stream =
                (remoteVideoRef.current.srcObject as MediaStream) ||
                new MediaStream();
              stream.addTrack(track1);
              stream.addTrack(track2);
              remoteVideoRef.current.srcObject = stream;
              remoteVideoRef.current?.play();
            }, 2000);
          } else if (parsedMessage.type === "answer") {
            setLobby(false);
            const { sdp: remoteSdp } = parsedMessage.payload;
            if (!remoteSdp) {
              return;
            }
            setPeerConnection((pc) => {
              pc?.setRemoteDescription(remoteSdp);
              return pc;
            });
          } else if (parsedMessage.type === "add-ice-candidate") {
            // setLobby(false);
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
            flexDirection: "row",
            marginBottom: "10px",
            paddingBottom: "40px",
            marginRight: "50px",
          }}
        >
          <div>
            <video autoPlay muted width={400} ref={localVideoRef} />
            {lobby ? "Waiting in lobby to connect with others" : null}
          </div>
          <video autoPlay playsInline width={800} ref={remoteVideoRef} />
        </div>
      </div>
    );
  }
);

export default Lobby;
