import { useEffect, useState } from "react";
import { Socket } from "socket.io-client";
import { DefaultEventsMap } from "socket.io/dist/typed-events";

interface CountdownProps {
  // Time in seconds
  time: number;
  isCounting: boolean;
  socket: React.MutableRefObject<Socket<DefaultEventsMap, DefaultEventsMap> | undefined>;
  color: 'WHITE' | 'BLACK';

}

function Countdown(props: CountdownProps) {
  const { time, isCounting, socket, color } = props;
  const [countState, setCountState] = useState(time);

  useEffect(() => {
    if(countState === 0){
      socket.current?.emit("TIMEDOUT", color);
    }
  }, [color, countState, socket]);

  useEffect(() => {
      const handler = () => {
          setCountState((count) => count > 0 ? count - 1 : 0);
      };

      const timeout = isCounting
          ? setInterval(handler, 1000)
          : null;

      return () => {
        if(timeout)
          clearInterval(timeout);
      };
  }, [isCounting, setCountState]);

  useEffect(() => {
      setCountState(time);
  }, [time, isCounting, setCountState]);

  return (
      <div>
          <span>{Math.floor(countState / 60)}</span>
          <span>:</span>
          <span>{String(countState % 60).padStart(2, '0')}</span>
      </div>
  );
}

export default Countdown;