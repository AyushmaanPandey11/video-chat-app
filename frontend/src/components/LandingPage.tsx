import { useCallback, useEffect, useRef, useState } from "react";
import Lobby from "./Lobby";

const LandingPage = () => {
  const [username, setUsername] = useState<string>("");
  const nameRef = useRef<string>("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const [audioTrack, setAudioTrack] = useState<MediaStreamTrack | null>(null);
  const [videoTrack, setVideoTrack] = useState<MediaStreamTrack | null>(null);

  const getStreamData = useCallback(async () => {
    const data = await window.navigator.mediaDevices.getUserMedia({
      audio: true,
      video: true,
    });
    const audioTrack = data.getAudioTracks()[0];
    const videoTrack = data.getVideoTracks()[0];
    setAudioTrack(audioTrack);
    setVideoTrack(videoTrack);
    if (!videoRef.current) {
      return;
    }
    videoRef.current.srcObject = new MediaStream([videoTrack]);
    videoRef.current.play();
  }, []);

  useEffect(() => {
    if (videoRef && videoRef.current) {
      getStreamData();
    }
  }, [getStreamData]);

  // Conditional Rendering logic
  if (username) {
    return (
      <Lobby
        name={username}
        localAudioTrack={audioTrack}
        locaVideoTrack={videoTrack}
      />
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        justifyContent: "space-around",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          marginLeft: "5vw",
          padding: "10px",
          marginRight: "10vw",
        }}
      >
        <video autoPlay width={500} ref={videoRef} />
        <label>Enter Your name</label>
        <input
          type="text"
          onChange={(e) => (nameRef.current = e.target.value)}
        />
        <button
          onClick={(e) => {
            e.preventDefault();
            setUsername(nameRef.current);
          }}
        >
          Join Lobby
        </button>
      </div>
    </div>
  );
};

export default LandingPage;
