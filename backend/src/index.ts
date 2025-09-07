import { createServer } from "http";
import { WebSocketServer } from "ws";
import { UserManager } from "./classes/UserManager";
import { RoomManager } from "./classes/RoomManager";

// Create an HTTP server
const server = createServer((req, res) => {
  // Handle /health-check endpoint
  if (req.url === "/health-check" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("ok");
  } else {
    // Handle other requests (optional: return 404 for unknown routes)
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not Found");
  }
});

// Create WebSocket server and attach it to the HTTP server
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

// Start the HTTP server on port 8080
server.listen(8080, () => {
  console.log("Server is running on http://localhost:8080");
  console.log("Health check available at http://localhost:8080/health-check");
});
