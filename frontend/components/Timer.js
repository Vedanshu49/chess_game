import React, { useState, useEffect } from 'react';

export default function Timer({ initialTime, isRunning }) {
  const [time, setTime] = useState(initialTime);

  useEffect(() => {
    let interval = null;
    if (isRunning) {
      interval = setInterval(() => {
        setTime(time => (time > 0 ? Math.floor(time - 1) : 0));
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isRunning]);

  useEffect(() => {
    setTime(initialTime);
  }, [initialTime]);

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="bg-panel p-4 rounded-md text-center shadow-lg">
      <h3 className="text-lg font-semibold text-text mb-2">Timer</h3>
      <div className="text-4xl font-mono text-text">{formatTime(time)}</div>
    </div>
  );
}