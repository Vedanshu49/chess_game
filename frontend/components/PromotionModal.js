import React from 'react';

export default function PromotionModal({ onSelectPromotion, color }) {
  const pieces = ['q', 'r', 'b', 'n']; // Queen, Rook, Bishop, Knight

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
      <div className="bg-panel p-6 rounded-lg shadow-lg text-text text-center">
        <h3 className="text-xl font-bold mb-4">Promote Pawn to:</h3>
        <div className="flex justify-center space-x-4">
          {pieces.map(piece => (
            <button
              key={piece}
              className="p-3 bg-[#222222] hover:bg-muted rounded-md transition-colors"
              onClick={() => onSelectPromotion(piece)}
            >
              <img
                src={`/pieces/${color === 'w' ? 'white' : 'black'}_${piece}.svg`}
                alt={piece}
                className="w-12 h-12"
              />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}