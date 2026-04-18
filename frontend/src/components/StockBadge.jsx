import { getStockColor, getStockLabel } from '../utils/stockColors';

export function StockBadge({ stock }) {
  const colorClass = getStockColor(stock);
  const label = getStockLabel(stock);
  
  return (
    <div className={`px-3 py-1 rounded-full text-center font-bold ${colorClass}`}>
      {stock} und
      <span className="text-xs ml-1 opacity-75">({label})</span>
    </div>
  );
}