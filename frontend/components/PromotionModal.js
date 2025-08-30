import React, { useState } from 'react';
import toast from 'react-hot-toast';

export default function PromotionModal({ onSelectPromotion = null, onSelect = null, color }) {
  const pieces = ['q', 'r', 'b', 'n']; // Queen, Rook, Bishop, Knight
  const pieceNames = {
    q: 'Queen',
    r: 'Rook',
    b: 'Bishop',
    n: 'Knight'
  };

  const [processing, setProcessing] = useState(false);

  const handler = onSelectPromotion || onSelect || (async () => {});

  const handleClick = async (piece) => {
    if (processing) return;
    console.log('Promotion piece selected:', piece);
    setProcessing(true);
    try {
      // Allow parent handler to be async and await it
      await handler(piece);
    } catch (error) {
      console.error('Error in promotion handler:', error);
      try { toast.error('Failed to promote pawn. Please try again.'); } catch (e) { /* ignore toast errors */ }
    } finally {
      setProcessing(false);
    }
  };

  // keyboard support: q, r, b, n
  React.useEffect(() => {
    const onKey = (e) => {
      const key = e.key.toLowerCase();
      if (['q','r','b','n'].includes(key)) {
        handleClick(key);
      } else if (key === 'escape') {
        // allow cancel
        if (!processing) {
          setProcessing(true);
          Promise.resolve(handler(null)).finally(() => setProcessing(false));
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [processing]);

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-[9999]"
      style={{ pointerEvents: 'auto' }}
      tabIndex={0}
      aria-modal="true"
      role="dialog"
      onClick={() => {
        if (!processing) {
          setProcessing(true);
          Promise.resolve(handler(null)).finally(() => setProcessing(false));
        }
      }}
    >
      <div className="bg-panel p-8 rounded-xl shadow-2xl text-text text-center relative min-w-[300px]">
        <h3 className="text-2xl font-bold mb-6">Promote Pawn to:</h3>
        <div className="flex justify-center gap-6">
            {pieces.map(piece => (
            <button
              key={piece}
              className={`p-3 bg-[#222222] hover:bg-muted rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-accent flex flex-col items-center ${processing ? 'opacity-60 cursor-wait' : ''}`}
              onClick={(e) => { e.stopPropagation(); handleClick(piece); }}
              tabIndex={0}
              aria-label={`Promote to ${piece}`}
              disabled={processing}
            >
              <img
                src={`/pieces/${color === 'w' ? 'white' : 'black'}_${piece}.svg`}
                alt={piece}
                className="w-14 h-14 pointer-events-none"
              />
              <span className="mt-2 text-sm capitalize">{pieceNames[piece]}</span>
            </button>
          ))}
        </div>
        <p className="mt-4 text-muted text-sm">Click a piece to promote your pawn.</p>
      </div>
    </div>
  );
}

const getPieceName = (pieceCode) => {
  switch (pieceCode) {
    case 'q': return 'Queen';
    case 'r': return 'Rook';
    case 'b': return 'Bishop';
    case 'n': return 'Knight';
    default: return '';
  }
};