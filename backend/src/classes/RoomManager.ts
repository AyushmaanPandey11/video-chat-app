import { User } from "./UserManager";

let GLOBAL_ROOM_ID = 1;

interface Room {
  user1: User;
  user2: User;
}

export class RoomManager {
  private static instance: RoomManager;
  private rooms: Map<string, Room>;

  constructor() {
    this.rooms = new Map<string, Room>();
  }

  static getInstance() {
    if (!this.instance) {
      this.instance = new RoomManager();
    }
    return this.instance;
  }

  createRoom(user1: User, user2: User) {
    const roomId = this.generateId();
    this.rooms.set(roomId.toString(), {
      user1,
      user2,
    });

    [user1, user2].forEach((user) =>
      user.socket.send(
        JSON.stringify({
          type: "send-offer",
          roomId,
        })
      )
    );
  }

  userOffer(roomId: string, sdp: any, senderSocketId: string) {
    const room = this.rooms.get(roomId);
    if (!room) {
      return;
    }
    const receivingUser =
      room.user1.id === senderSocketId ? room.user2 : room.user1;
    receivingUser.socket.send(
      JSON.stringify({
        type: "offer",
        sdp,
        roomId,
      })
    );
  }

  userAnswer(roomId: string, sdp: any, senderSocketId: string) {
    const room = this.rooms.get(roomId);
    if (!room) {
      return;
    }
    const receivingUser =
      room.user1.id === senderSocketId ? room.user2 : room.user1;
    receivingUser.socket.send(
      JSON.stringify({
        type: "answer",
        sdp,
        roomId,
      })
    );
  }

  userIceCandidate(
    roomId: string,
    candidate: any,
    senderSocketId: string,
    userType: "sender" | "receiver"
  ) {
    const room = this.rooms.get(roomId);
    if (!room) {
      return;
    }
    const receivingUser =
      room.user1.id === senderSocketId ? room.user2 : room.user1;
    receivingUser.socket.send(
      JSON.stringify({
        type: "add-ice-candidate",
        candidate,
        userType,
      })
    );
  }

  generateId() {
    return GLOBAL_ROOM_ID++;
  }
}
