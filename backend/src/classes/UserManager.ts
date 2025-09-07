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

  removeUser(userSocket: WebSocket) {
    const user = this.users.find((x) => x.socket === userSocket);
    if (user) {
      this.users = this.users.filter((x) => x.socket !== userSocket);
      this.queue = this.queue.filter((x) => x !== user.id);
    }
    return user;
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
      if (id1) this.queue.push(id1);
      if (id2) this.queue.push(id2);
      return;
    }

    this.roomManager.createRoom(user1, user2);
    this.matchAndClearQueue();
  }

  initEventHandlers(socket: WebSocket, userSocketId: string) {
    socket.on("message", (data: any) => {
      const message = JSON.parse(data);
      const userObj = this.users.find((user) => user.id === userSocketId);
      if (!userObj) {
        return;
      }
      const type = message.type;
      switch (type) {
        case "offer":
          userObj.name = message.payload.name;
          this.roomManager.userOffer(
            message.payload.roomId,
            message.payload.sdp,
            userSocketId
          );
          break;
        case "answer":
          userObj.name = message.payload.name;
          this.roomManager.userAnswer(
            message.payload.roomId,
            message.payload.sdp,
            userSocketId
          );
          break;
        case "add-ice-candidate":
          this.roomManager.userIceCandidate(
            message.payload.roomId,
            message.payload.candidate,
            userSocketId,
            message.payload.userType
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
