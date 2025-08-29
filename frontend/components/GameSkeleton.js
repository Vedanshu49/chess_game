
  export default function GameSkeleton() {
  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col lg:flex-row justify-center items-start p-4 gap-6 animate-pulse">
      {/* Left Panel */}
      <div className="w-full lg:w-64 flex-shrink-0 space-y-4">
        <div className="p-3 rounded-lg bg-gray-700 h-48"></div>
      </div>

      {/* Center Panel */}
      <div className="flex-grow flex flex-col items-center">
        <div className="w-full max-w-[75vh] aspect-square bg-gray-700 rounded-lg"></div>
      </div>

      {/* Right Panel */}
      <div className="w-full lg:w-80 flex-shrink-0 flex flex-col gap-4">
        <div className="p-3 rounded-lg bg-gray-700 h-48"></div>
        <div className="bg-gray-800 p-4 rounded-lg h-72"></div>
        <div className="bg-gray-800 p-4 rounded-lg h-48"></div>
      </div>
    </div>
  );
}
