import React from 'react';

export default function MoveList({ history }) {
  console.log("MoveList history:", history); // ADD THIS LINE
  return (
    <div className="bg-gray-800 p-4 rounded-md h-64 overflow-y-auto">
      <h3 className="text-lg font-semibold text-white mb-2">Moves</h3>
      <ol className="list-decimal list-inside text-gray-300">
        {history.map((move, index) => (
          <li key={index} className={`px-2 py-1 ${index % 2 === 0 ? 'bg-gray-700' : ''}`}>
            <span className="font-mono">{move}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}