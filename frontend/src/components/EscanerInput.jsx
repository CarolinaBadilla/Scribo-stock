// src/components/EscanerInput.jsx
import { useState, useRef, useEffect } from 'react';

export function EscanerInput({ onProductoEncontrado, placeholder = "Escanea el código de barras o escríbelo..." }) {
  const [codigo, setCodigo] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!codigo.trim()) return;
    onProductoEncontrado(codigo.trim());
    setCodigo('');
  };

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-2">
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          type="text"
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
          placeholder={placeholder}
          className="w-full px-4 py-3 bg-white border border-[#e2d8cc] rounded-xl text-sm font-bold text-[#5a4a3a] placeholder-[#8a7a6a]/60 focus:outline-none focus:border-[#5a4a3a] shadow-xs"
        />
        <button
          type="submit"
          style={{ backgroundColor: '#5a4a3a', color: '#ffffff' }}
          className="absolute right-2 px-3.5 py-1.5 rounded-lg text-xs font-bold shadow-xs hover:bg-[#43372b] cursor-pointer"
        >
          Buscar ↵
        </button>
      </div>

      <p className="text-xs font-semibold text-[#8a7a6a] flex items-center gap-1.5 px-0.5 pt-0.5">
        <span>💡</span>
        <span>El escáner ingresa el código y presiona Enter automáticamente.</span>
      </p>
    </form>
  );
}