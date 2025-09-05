import { useCallback, useEffect, useRef, useState } from "react";
import Friend from "./Friend";

const LandingPage = () => {
  const usernameRef = useRef<string>("");
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

  return (
    <div>
      <>
        <video autoPlay ref={videoRef}></video>
        <input
          type="text"
          onChange={(e) => (usernameRef.current = e.target.value)}
        />
      </>
      <Friend
        name={usernameRef.current}
        audioTrack={audioTrack}
        videoTrack={videoTrack}
      />
    </div>
  );
};

export default LandingPage;
