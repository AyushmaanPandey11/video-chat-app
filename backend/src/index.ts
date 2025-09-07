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
const PORT = 8080;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Health check available at http://localhost:${PORT}/health`);
});

// Error handling for server
server.on("error", (error) => {
  console.error("Server error:", error.message);
});
