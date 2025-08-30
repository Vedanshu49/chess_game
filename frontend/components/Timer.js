import React, { useState, useEffect, useRef } from 'react';

export default function Timer({ initialTime = 600, isRunning = false }) {
  const [time, setTime] = useState(initialTime);
  const lastTickRef = useRef(Date.now());
  const intervalRef = useRef(null);

  // Reset timer when initialTime changes
  useEffect(() => {
    setTime(initialTime);
    lastTickRef.current = Date.now();
  }, [initialTime]);

  // Handle timer running state
  useEffect(() => {
    if (isRunning && time > 0) {
      lastTickRef.current = Date.now(); // Reset reference time when starting
      
      intervalRef.current = setInterval(() => {
        const now = Date.now();
        const elapsed = (now - lastTickRef.current) / 1000;
        
        setTime(currentTime => {
          const newTime = Math.max(0, currentTime - elapsed);
          lastTickRef.current = now;
          return newTime;
        });
      }, 100);
      
      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      };
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
  }, [isRunning, time]);

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