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
      // const ws = new WebSocket("ws://localhost:8080");
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
            const pc = new RTCPeerConnection({
              iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
            });

            const remoteStream = new MediaStream();
            if (remoteVideoRef.current) {
              remoteVideoRef.current.srcObject = remoteStream;
            }

            pc.ontrack = (e) => {
              console.log("Received remote track:", e.track.kind);
              console.log("Event details:", e);

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

            const stream = new MediaStream();
            if (remoteVideoRef.current) {
              remoteVideoRef.current.srcObject = stream;
            }

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
        localVideoRef.current.srcObject = new MediaStream([locaVideoTrack]);
        localVideoRef.current.play().catch((err) => {
          console.error("Error playing local Video: ", err);
        });
      }
    }, [locaVideoTrack]);

    return (
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          marginBottom: "10px",
          paddingBottom: "40px",
          marginRight: "50px",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginBottom: "10px",
            paddingBottom: "40px",
            marginRight: "50px",
          }}
        >
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
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                marginBottom: "10px",
                paddingBottom: "40px",
              }}
            >
              <video
                autoPlay
                muted
                height={500}
                width={400}
                ref={localVideoRef}
              />
              {lobby ? "Waiting in lobby to connect with others" : null}
            </div>
          </div>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginBottom: "10px",
            paddingBottom: "40px",
          }}
        >
          {otherUsername && <h1>Friend: {otherUsername}</h1>}
          <video
            autoPlay
            playsInline
            height={500}
            width={600}
            ref={remoteVideoRef}
          />
        </div>
      </div>
    );
  }
);

export default Lobby;
