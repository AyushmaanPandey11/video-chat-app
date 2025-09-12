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
    if (videoRef && videoRef.current && username === "") {
      getStreamData();
    }
  }, [getStreamData, username]);

  // Conditional Rendering logic
  if (username) {
    return (
      <Lobby
        name={username}
        localAudioTrack={audioTrack}
        locaVideoTrack={videoTrack}
        setUsername={setUsername}
      />
    );
  }

  return (
    <div>
      <div className="flex flex-col mx-auto justify-center mt-10 items-center space-y-5">
        <label className="text-center  mt-5 sm:mt-0 2xl:mt-3">
          Oh Hey Man! Just Put any name and go to lobby.
        </label>
        <video
          className="flex justify-center w-full h-[40vh] sm:w-[500px] sm:h-[375px] rounded-2xl border-2 border-purple-700 rotate-y-180 mx-auto object-cover"
          autoPlay
          ref={videoRef}
        />
        <div className="flex flex-row space-x-10 w-[500px] justify-center">
          <label className="m-2 p-2">Enter Your name</label>
          <input
            type="text"
            className="border-purple-700 border-2 rounded-md m-2 p-2"
            onChange={(e) => (nameRef.current = e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (!nameRef.current) {
                  alert("Hey Come on Man. Just put a name!");
                  return;
                }
                setUsername(nameRef.current);
              }
            }}
          />
        </div>
        <button
          onClick={(e) => {
            e.preventDefault();
            if (!nameRef.current) {
              alert("Please enter your name");
              return;
            }
            setUsername(nameRef.current);
          }}
          className="flex justify-center bg-purple-500"
        >
          Join Lobby
        </button>
      </div>
    </div>
  );
};

export default LandingPage;
