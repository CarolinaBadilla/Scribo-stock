export const getStockColor = (stock) => {
  if (stock >= 15) return 'bg-blue-500 text-white';
  if (stock >= 6 && stock <= 14) return 'bg-green-500 text-white';
  if (stock >= 1 && stock <= 5) return 'bg-yellow-500 text-black';
  if (stock === 0) return 'bg-red-500 text-white';
  return 'bg-gray-300';
};

export const getStockLabel = (stock) => {
  if (stock >= 15) return 'Alto stock';
  if (stock >= 6) return 'Stock normal';
  if (stock >= 1) return 'Stock bajo';
  return 'Sin stock';
};

export const getStockStatus = (stock) => {
  if (stock >= 15) return { color: 'azul', label: 'Alto stock', bg: 'bg-blue-500' };
  if (stock >= 6) return { color: 'verde', label: 'Stock normal', bg: 'bg-green-500' };
  if (stock >= 1) return { color: 'amarillo', label: 'Stock bajo', bg: 'bg-yellow-500' };
  return { color: 'rojo', label: 'Sin stock', bg: 'bg-red-500' };
};