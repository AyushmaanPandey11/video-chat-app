export interface MessageBody {
  type:
    | "send-offer"
    | "offer"
    | "answer"
    | "add-ice-candidate"
    | "peer-disconnected";
  payload: {
    sdp?: RTCSessionDescriptionInit;
    roomId?: string;
    candidate?: RTCIceCandidateInit;
    userType: "sender" | "receiver";
    message?: string;
  };
}
