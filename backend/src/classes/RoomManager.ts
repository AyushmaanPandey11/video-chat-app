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

    user1.socket.send(
      JSON.stringify({
        type: "send-offer",
        payload: { roomId },
      })
    );

    user2.socket.send(
      JSON.stringify({
        type: "wait-for-offer",
        payload: { roomId },
      })
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
        payload: {
          sdp,
          roomId,
        },
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
        payload: {
          sdp,
          roomId,
        },
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
        payload: {
          candidate,
          userType,
        },
      })
    );
  }

  removeUserFromRoom(userId: string) {
    for (const [roomId, room] of this.rooms.entries()) {
      if (room.user1.id === userId || room.user2.id === userId) {
        const otherUser = room.user1.id === userId ? room.user2 : room.user1;
        otherUser.socket.send(
          JSON.stringify({
            type: "peer-disconnected",
            payload: {
              roomId,
              message: `User ${userId} has disconnected`,
            },
          })
        );
        otherUser.socket.send("lobby");
        this.rooms.delete(roomId);
        console.log(
          `Room ${roomId} removed due to user ${userId} disconnection`
        );
        return;
      }
    }
    console.warn(`No room found for user ${userId}`);
  }

  generateId() {
    return GLOBAL_ROOM_ID++;
  }
}
