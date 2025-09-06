import { WebSocketServer, WebSocket } from "ws";
import { UserManager } from "./classes/UserManager";
import { RoomManager } from "./classes/RoomManager";

const wss = new WebSocketServer({ port: 8080 });

wss.on("connection", (userSocket) => {
  console.log("user connected");
  UserManager.getInstance().addUser("Anonymous", userSocket);
  userSocket.on("close", () => {
    const user = UserManager.getInstance().removeUser(userSocket);
    if (user) {
      RoomManager.getInstance().removeUserFromRoom(user.id);
    }
  });
});
