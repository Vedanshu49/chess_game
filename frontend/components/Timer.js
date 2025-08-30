import React, { useState, useEffect } from 'react';

export default function Timer({ initialTime = 600, isRunning = false }) {
  const [time, setTime] = useState(initialTime);
  const [lastUpdate, setLastUpdate] = useState(Date.now());
  const [previousTime, setPreviousTime] = useState(initialTime);

  useEffect(() => {
    let interval = null;
    if (isRunning && time > 0) {
      interval = setInterval(() => {
        const now = Date.now();
        const elapsed = (now - lastUpdate) / 1000;
        setTime(prevTime => {
          const newTime = Math.max(0, prevTime - elapsed);
          return newTime;
        });
        setLastUpdate(now);
      }, 100); // Update more frequently for better accuracy
    } else {
      setLastUpdate(Date.now());
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning, lastUpdate, time]);

  useEffect(() => {
    if (initialTime !== previousTime) {
      setTime(initialTime);
      setLastUpdate(Date.now());
      setPreviousTime(initialTime);
    }
  }, [initialTime, previousTime]);

  const formatTime = (seconds) => {
    const roundedSeconds = Math.floor(seconds);
    const minutes = Math.floor(roundedSeconds / 60);
    const secs = roundedSeconds % 60;
    return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="bg-panel p-4 rounded-md text-center shadow-lg">
      <h3 className="text-lg font-semibold text-text mb-2">Timer</h3>
      <div className="text-3xl font-mono text-text">{formatTime(time)}</div>
    </div>
  );
}