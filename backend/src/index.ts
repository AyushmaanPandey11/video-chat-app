import { WebSocketServer, WebSocket } from "ws";

const wss = new WebSocketServer({ port: 8080 });

let senderSocket: WebSocket | null = null;
let receiverSocket: WebSocket | null = null;

wss.on("connection", (userSocket) => {
  userSocket.on("error", console.error);
  userSocket.on("message", (data: any) => {
    const message = JSON.parse(data);
    const type = message.type;
    switch (type) {
      case "sender":
        senderSocket = userSocket;
        break;
      case "receiver":
        receiverSocket = userSocket;
        break;
      case "createOffer":
        if (userSocket !== senderSocket) {
          return;
        }
        receiverSocket?.send(
          JSON.stringify({ type: "createOffer", sdp: message.sdp })
        );
        break;
      case "createAnswer":
        if (userSocket !== receiverSocket) {
          return;
        }
        senderSocket?.send(
          JSON.stringify({ type: "createAnswer", sdp: message.sdp })
        );
        break;
      case "iceCandidate":
        if (userSocket === senderSocket) {
          receiverSocket?.send(
            JSON.stringify({
              type: "iceCandidate",
              candidate: message.candidate,
            })
          );
        } else if (userSocket === receiverSocket) {
          senderSocket?.send(
            JSON.stringify({
              type: "iceCandidate",
              candidate: message.candidate,
            })
          );
        }
        break;
      default:
        break;
    }
  });
});
