import React from 'react';
import { memo } from 'react';

const formatTime = (seconds) => {
    if (typeof seconds !== 'number' || isNaN(seconds) || seconds < 0) {
        seconds = 0;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
};

const Timer = memo(({ player, timeLeft, isActive }) => {
    const activeClass = isActive 
        ? 'bg-green-600 text-white' 
        : 'bg-gray-700 text-gray-300';

    return (
        <div className="timer-container">
            <div className={`p-4 rounded-lg transition-colors duration-300 ${activeClass}`}>
                <div className="flex items-center gap-2 mb-2">
                    <div className="font-semibold">{player?.username || 'Player'}</div>
                    {player?.rating && (
                        <div className="text-sm opacity-75">({player.rating})</div>
                    )}
                </div>
                <div className="text-3xl font-mono tracking-wider">
                    {formatTime(timeLeft)}
                </div>
            </div>
        </div>
    );
});

Timer.displayName = 'Timer';

export default Timer;
}