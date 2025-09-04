import { WebSocket } from "ws";
import { RoomManager } from "./RoomManager";

export interface User {
  id: string;
  name: string;
  socket: WebSocket;
}

export class UserManager {
  private static instance: UserManager;
  private users: User[];
  private queue: string[];
  private roomManager: RoomManager;

  constructor() {
    this.queue = [];
    this.users = [];
    this.roomManager = RoomManager.getInstance();
  }

  static getInstance() {
    if (!this.instance) {
      this.instance = new UserManager();
    }
    return this.instance;
  }

  addUser(name: string, socket: WebSocket) {
    const id = this.getRandomId();
    this.users.push({
      name: name,
      socket: socket,
      id: id,
    });
    this.queue.push(id);
    socket.send("lobby");
    this.matchAndClearQueue();
    this.initEventHandlers(socket, id);
  }

  matchAndClearQueue() {
    if (this.queue.length < 2) {
      return;
    }
    // current userid
    const id1 = this.queue.pop();
    // last usersid we are pairing with
    const id2 = this.queue.pop();

    const user1 = this.users.find((u) => u.id === id1);
    const user2 = this.users.find((u) => u.id === id2);
    if (!user1 || !user2) {
      return;
    }

    this.roomManager.createRoom(user1, user2);
    this.matchAndClearQueue();
  }

  initEventHandlers(socket: WebSocket, userSocketId: string) {
    socket.on("message", (data: any) => {
      const message = JSON.parse(data);
      const type = message.type;
      switch (type) {
        case "offer":
          this.roomManager.userOffer(message.roomId, message.sdp, userSocketId);
          break;
        case "answer":
          this.roomManager.userOffer(message.roomId, message.sdp, userSocketId);
          break;
        case "add-ice-candidate":
          this.roomManager.userIceCandidate(
            message.roomId,
            message.candidate,
            userSocketId,
            message.userType
          );
          break;

        default:
          break;
      }
    });
  }

  getRandomId() {
    return (
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15)
    );
  }
}
