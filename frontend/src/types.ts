export type MessageBody =
  | {
      type: "send-offer";
      payload: {
        roomId: string;
      };
    }
  | {
      type: "wait-for-offer";
      payload: {
        roomId: string;
      };
    }
  | {
      type: "offer";
      payload: {
        sdp: RTCSessionDescription;
        roomId: string;
      };
    }
  | {
      type: "answer";
      payload: {
        sdp: RTCSessionDescription;
        roomId: string;
      };
    }
  | {
      type: "add-ice-candidate";
      payload: {
        userType: "sender" | "receiver";
        candidate: RTCIceCandidate;
        roomId: string;
      };
    }
  | {
      type: "peer-disconnected";
      payload: {
        message: string;
        roomId: string;
      };
    };
