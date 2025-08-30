import React from 'react';

// This component now only knows how to format and display seconds.
const formatTime = (seconds) => {
    if (isNaN(seconds) || seconds < 0) seconds = 0;
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

export default function Timer({ player, timeLeft, isActive }) {
    const activeClass = isActive ? 'bg-green-500 text-white' : 'bg-gray-700 text-gray-300';

  return (
    <div className="bg-panel p-4 rounded-md text-center shadow-lg">
      <h3 className="text-lg font-semibold text-text mb-2">Timer</h3>
      <div className="text-3xl font-mono text-text">{formatTime(time)}</div>
    </div>
  );
}