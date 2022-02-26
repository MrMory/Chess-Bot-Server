import { useEffect, useState } from "react";

interface CountdownProps {
  // Time in seconds
  time: number;
  isCounting: boolean;
}

function Countdown({ time, isCounting }: CountdownProps) {
  const [countState, setCountState] = useState(time);
  console.log('Time: ', time);

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
  }, [time, setCountState]);

  return (
      <div>
          <span>{Math.floor(countState / 60)}</span>
          <span>:</span>
          <span>{String(countState % 60).padStart(2, '0')}</span>
      </div>
  );
}

export default Countdown;