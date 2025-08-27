import React from 'react';

const pieceOrder = ['p', 'n', 'b', 'r', 'q'];

const Piece = ({ piece, color }) => {
  const pieceSymbol = color === 'white' ? piece.toUpperCase() : piece.toLowerCase();
  const imageUrl = `/pieces/${color}_${piece.toLowerCase()}.svg`;
  return <img src={imageUrl} alt={pieceSymbol} className="w-6 h-6" />;
};

export default function CapturedPieces({ captured, color }) {
  const capturedPieces = pieceOrder.flatMap(piece => {
    const count = captured[piece] || 0;
    return Array(count).fill(piece);
  });

  return (
    <div className="flex flex-wrap items-center gap-1 p-2 bg-gray-800 rounded-md">
      <h3 className="text-sm font-semibold text-gray-400 mr-2 capitalize">{color}:</h3>
      {capturedPieces.length > 0 ? (
        capturedPieces.map((piece, index) => (
          <Piece key={index} piece={piece} color={color === 'white' ? 'black' : 'white'} />
        ))
      ) : (
        <p className="text-xs text-gray-500">No pieces captured</p>
      )}
    </div>
  );
}