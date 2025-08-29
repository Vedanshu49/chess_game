import React, { useEffect, useRef } from 'react';

export default function MoveList({ history }) {
  const movesEndRef = useRef(null);

  const scrollToBottom = () => {
    movesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  useEffect(() => {
    scrollToBottom();
  }, [history]);

  // Group moves into pairs
  const movePairs = [];
  for (let i = 0; i < history.length; i += 2) {
    movePairs.push([history[i], history[i + 1]]);
  }

  return (
    <div className="bg-gray-800 p-4 rounded-lg shadow-inner h-72 overflow-y-auto">
      <h3 className="text-lg font-bold text-white mb-2">Move History</h3>
      <div className="grid grid-cols-[auto_1fr_1fr] gap-x-4 text-sm font-mono">
        {movePairs.map((pair, index) => (
          <React.Fragment key={index}>
            <div className="text-gray-400 text-right">{index + 1}.</div>
            <div className={`px-2 py-0.5 rounded ${pair[0] ? 'hover:bg-gray-700' : ''}`}>{pair[0]?.san}</div>
            <div className={`px-2 py-0.5 rounded ${pair[1] ? 'hover:bg-gray-700' : ''}`}>{pair[1]?.san}</div>
          </React.Fragment>
        ))}
        <div ref={movesEndRef} />
      </div>
    </div>
  );
}