export function LeyendaColores() {
  return (
    <div className="flex flex-wrap gap-4 mb-4 p-3 bg-gray-100 rounded-lg">
      <span className="flex items-center gap-2">
        <div className="w-5 h-5 bg-blue-500 rounded"></div>
        <span className="text-sm">≥15 (Alto stock)</span>
      </span>
      <span className="flex items-center gap-2">
        <div className="w-5 h-5 bg-green-500 rounded"></div>
        <span className="text-sm">6-14 (Stock normal)</span>
      </span>
      <span className="flex items-center gap-2">
        <div className="w-5 h-5 bg-yellow-500 rounded"></div>
        <span className="text-sm">1-5 (Stock bajo)</span>
      </span>
      <span className="flex items-center gap-2">
        <div className="w-5 h-5 bg-red-500 rounded"></div>
        <span className="text-sm">0 (Sin stock)</span>
      </span>
    </div>
  );
}