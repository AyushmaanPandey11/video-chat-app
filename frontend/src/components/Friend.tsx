import { memo, useEffect, useState } from "react";
import type { MessageBody } from "../types";

const Friend = memo(
  ({
    name,
    audioTrack,
    videoTrack,
  }: {
    name: string;
    audioTrack: MediaStreamTrack | null;
    videoTrack: MediaStreamTrack | null;
  }) => {
    const [socket, setSocket] = useState<WebSocket | null>(null);
    const [lobby, setLobby] = useState(true);
    const [sendingPc, setSendingPc] = useState<null | RTCPeerConnection>(null);
    const [receivingPc, setReceivingPc] = useState<null | RTCPeerConnection>(
      null
    );

    useEffect(() => {
      const ws = new WebSocket("ws://localhost:8080");
      ws.onmessage = async (event) => {
        if (event.data === "lobby") {
          setLobby(true);
        } else {
          const parsedMessage: MessageBody = JSON.parse(event.data);
          if (parsedMessage.type === "send-offer") {
            setLobby(false);
            const roomId = parsedMessage.payload.roomId;
            const pc = new RTCPeerConnection();
            setSendingPc(pc);
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
                    sdp: sdp,
                    roomId: roomId,
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
                      sdp: sendingPc,
                      roomId: roomId,
                    },
                  })
                );
              }
            };
          } else if (parsedMessage.type === "offer") {
            const { sdp: remoteSdp, roomId } = parsedMessage.payload;
            if (!remoteSdp) {
              return;
            }
            setLobby(false);
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
                  console.error("receicng pc nout found");
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
      setSocket(ws);
    }, [name, videoTrack, audioTrack, sendingPc]);

    return (
      <div>
        <h1>hi ${name}</h1>
      </div>
    );
  }
);

export default Friend;
