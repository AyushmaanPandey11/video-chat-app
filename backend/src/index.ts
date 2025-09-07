import { WebSocketServer } from "ws";
import { createServer } from "http";
import { UserManager } from "./classes/UserManager";
import { RoomManager } from "./classes/RoomManager";
import express from "express";

const app = express();
const server = createServer(app);

app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

const wss = new WebSocketServer({ server });

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
