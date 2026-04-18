import { useState, useRef, useEffect } from 'react';

export function EscanerInput({ onProductoEncontrado, placeholder, autoFocus = true }) {
  const [codigo, setCodigo] = useState('');
  const [buscando, setBuscando] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (autoFocus) {
      inputRef.current?.focus();
    }
  }, [autoFocus]);

  const handleKeyDown = async (e) => {
    if (e.key === 'Enter' && codigo.trim()) {
      setBuscando(true);
      try {
        await onProductoEncontrado(codigo);
        setCodigo('');
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setBuscando(false);
        inputRef.current?.focus();
      }
    }
  };

  return (
    <div className="bg-yellow-100 p-6 rounded-lg">
      <label className="block text-lg font-bold mb-2">
        📷 Escanea el código de barras:
      </label>
      <input
        ref={inputRef}
        type="text"
        value={codigo}
        onChange={(e) => setCodigo(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder || "Acerca el producto al escáner..."}
        className="w-full p-4 text-2xl border-2 rounded font-mono"
        disabled={buscando}
        autoFocus={autoFocus}
      />
      {buscando && <p className="mt-2 text-blue-500">Buscando producto...</p>}
      <p className="text-sm text-gray-600 mt-2">
        💡 El escáner escribe el código y presiona Enter automáticamente
      </p>
    </div>
  );
}