import { useState } from 'react';
import { supabase } from '../services/supabase';

export function ModalAgregarProducto({ onClose, onAgregar }) {
  const [tipo, setTipo] = useState('libro');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    codigo_barras: '',
    nombre: '',
    autor: '',
    editorial: '',
    colegio: '',
    talle: '',
    color: '',
    precio_compra: 0,
    precio_efectivo: 0,
    precio_tarjeta: 0
  });

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!formData.codigo_barras) {
      setError('El código de barras es obligatorio');
      setLoading(false);
      return;
    }
    
    if (!formData.nombre) {
      setError('El nombre es obligatorio');
      setLoading(false);
      return;
    }
    
    if (formData.precio_efectivo <= 0) {
      setError('El precio efectivo debe ser mayor a 0');
      setLoading(false);
      return;
    }

    try {
      let result;
      let productoId;
      let tipoProducto;
      
      if (tipo === 'libro') {
        const { data, error } = await supabase
          .from('libros')
          .insert({
            codigo_barras: formData.codigo_barras,
            titulo: formData.nombre,
            autor: formData.autor || null,
            editorial: formData.editorial || null,
            precio_compra: parseFloat(formData.precio_compra) || 0,
            precio_efectivo: parseFloat(formData.precio_efectivo),
            precio_tarjeta: parseFloat(formData.precio_tarjeta) || parseFloat(formData.precio_efectivo)
          })
          .select();
        
        if (error) throw error;
        productoId = data[0].id;
        tipoProducto = 'libro';
      } else {
        const ganancia = parseFloat(formData.precio_efectivo) - (parseFloat(formData.precio_compra) || 0);
        
        const { data, error } = await supabase
          .from('ropa')
          .insert({
            codigo_barras: formData.codigo_barras,
            nombre: formData.nombre,
            colegio: formData.colegio,
            talle: formData.talle || null,
            color: formData.color || null,
            precio_compra: parseFloat(formData.precio_compra) || 0,
            precio_efectivo: parseFloat(formData.precio_efectivo),
            precio_tarjeta: parseFloat(formData.precio_tarjeta) || parseFloat(formData.precio_efectivo),
            ganancia: ganancia
          })
          .select();
        
        if (error) throw error;
        productoId = data[0].id;
        tipoProducto = 'ropa';
      }

      // Obtener sucursales
      const { data: sucursales, error: sucError } = await supabase
        .from('sucursales')
        .select('id');
      
      if (sucError) throw sucError;
      
      // Crear stock para cada sucursal
      for (const sucursal of sucursales) {
        await supabase
          .from('stock')
          .insert({
            tipo_producto: tipoProducto,
            producto_id: productoId,
            sucursal_id: sucursal.id,
            cantidad: 0,
            stock_minimo: 5
          });
      }

      alert('✅ Producto agregado correctamente');
      onAgregar();
      onClose();
    } catch (error) {
      console.error('Error:', error);
      setError(error.message || 'Error al agregar producto');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-[#5a4a3a] bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-full overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">➕ Agregar Producto</h2>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">&times;</button>
          </div>
          
          {error && (
            <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-bold mb-1">Tipo</label>
              <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="w-full p-2 border rounded-lg">
                <option value="libro">📚 Libro</option>
                <option value="ropa">👕 Ropa</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-bold mb-1">Código de barras *</label>
              <input type="text" name="codigo_barras" value={formData.codigo_barras} onChange={handleChange} className="w-full p-2 border rounded-lg" required />
            </div>
            
            <div>
              <label className="block text-sm font-bold mb-1">Nombre *</label>
              <input type="text" name="nombre" value={formData.nombre} onChange={handleChange} className="w-full p-2 border rounded-lg" required />
            </div>
            
            {tipo === 'libro' ? (
              <>
                <div><label className="block text-sm font-bold mb-1">Autor</label><input type="text" name="autor" value={formData.autor} onChange={handleChange} className="w-full p-2 border rounded-lg" /></div>
                <div><label className="block text-sm font-bold mb-1">Editorial</label><input type="text" name="editorial" value={formData.editorial} onChange={handleChange} className="w-full p-2 border rounded-lg" /></div>
              </>
            ) : (
              <>
                <div><label className="block text-sm font-bold mb-1">Colegio *</label><input type="text" name="colegio" value={formData.colegio} onChange={handleChange} className="w-full p-2 border rounded-lg" required /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-sm font-bold mb-1">Talle</label><input type="text" name="talle" value={formData.talle} onChange={handleChange} className="w-full p-2 border rounded-lg" /></div>
                  <div><label className="block text-sm font-bold mb-1">Color</label><input type="text" name="color" value={formData.color} onChange={handleChange} className="w-full p-2 border rounded-lg" /></div>
                </div>
              </>
            )}
            
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-sm font-bold mb-1">Precio compra</label><input type="number" name="precio_compra" value={formData.precio_compra} onChange={handleChange} className="w-full p-2 border rounded-lg" step="0.01" /></div>
              <div><label className="block text-sm font-bold mb-1">Precio Efectivo *</label><input type="number" name="precio_efectivo" value={formData.precio_efectivo} onChange={handleChange} className="w-full p-2 border rounded-lg" required step="0.01" /></div>
            </div>
            
            <div><label className="block text-sm font-bold mb-1">Precio Tarjeta</label><input type="number" name="precio_tarjeta" value={formData.precio_tarjeta} onChange={handleChange} className="w-full p-2 border rounded-lg" step="0.01" /></div>
            
            <div className="mt-6 pt-4 border-t border-[#e2d8cc]">
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-2 border border-[#e2d8cc] rounded-lg hover:bg-[#ede5d9] transition text-[#5a4a3a] text-sm font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-[#c9a87b] text-white py-2 rounded-lg hover:bg-[#a8865d] transition disabled:opacity-50 text-sm font-medium"
                >
                  {loading ? 'Agregando...' : '✅ Agregar producto'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}