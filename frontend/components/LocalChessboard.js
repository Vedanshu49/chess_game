import dynamic from 'next/dynamic';

const Chessboard = dynamic(() => import('chessboardjsx'), {
  ssr: false,
  loading: () => <div className="text-center text-gray-400">Loading board...</div>,
});

export default function LocalChessboard({ fen, onMove }) {
  // The width of the board is responsive, taking full width of its container.
  // The aspect ratio is maintained by the container in the GamePage.
  return (
    <div className="w-full h-full">
      <Chessboard
        position={fen}
        onDrop={onMove}
        draggable={true}
        width="100%"
        boardStyle={{
          borderRadius: '5px',
          boxShadow: `0 5px 15px rgba(0, 0, 0, 0.5)`,
        }}
      />
    </div>
  );
}