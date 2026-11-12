// frontend/src/components/SelectorPago.jsx
import { useState, useEffect, useRef } from 'react';
import { formatMoney } from '../utils/formatters';
import {
  esMetodoEfectivo,
  calcularTotalCarrito,
  formatearItemsVenta,
  calcularVuelto
} from '../utils/cartUtils';
import { abrirCajon, imprimirTicket, soportaWebSerial, conectarPuertoSerial } from '../utils/hardwarePos';
import api from '../services/api';
import { toast } from 'sonner';

export function SelectorPago({
  isOpen,
  onClose,
  carrito = [],
  sucursalId,
  sucursales = [],
  metodoInicial = 'efectivo',
  montoRecibidoInicial = '',
  onVentaCompletada
}) {
  const [metodo, setMetodo] = useState(metodoInicial || 'efectivo');
  const [montoRecibido, setMontoRecibido] = useState(montoRecibidoInicial || '');
  const [imprimirComprobante, setImprimirComprobante] = useState(true);
  const [estadoFlujo, setEstadoFlujo] = useState('seleccion');
  const [procesando, setProcesando] = useState(false);
  const [ventaIdActual, setVentaIdActual] = useState(null);
  const [errorMensaje, setErrorMensaje] = useState(null);

  const pollingRef = useRef(null);
  const inputVueltoRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setMetodo(metodoInicial || 'efectivo');
      setMontoRecibido(montoRecibidoInicial || '');
      setEstadoFlujo('seleccion');
      setProcesando(false);
      setErrorMensaje(null);
      setVentaIdActual(null);
    }
  }, [isOpen, metodoInicial, montoRecibidoInicial]);

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  useEffect(() => {
    if (isOpen && estadoFlujo === 'seleccion' && esMetodoEfectivo(metodo)) {
      const timer = setTimeout(() => inputVueltoRef.current?.focus(), 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen, estadoFlujo, metodo]);

  if (!isOpen) return null;

  const sucursalActual = sucursales.find(s => s.id === sucursalId) || {
    id: sucursalId,
    nombre: 'Casa Central',
    direccion: 'Av. Argentina 123'
  };

  // Valores derivados
  const esEfectivo = esMetodoEfectivo(metodo);
  const totalCalculado = calcularTotalCarrito(carrito, metodo);
  const { recibidoNum, esPagoExacto, vuelto, montoInsuficiente, faltante } = calcularVuelto(totalCalculado, montoRecibido);

  const detenerPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  const reiniciarModal = () => {
    detenerPolling();
    setEstadoFlujo('seleccion');
    setProcesando(false);
    setErrorMensaje(null);
    setVentaIdActual(null);
    setMontoRecibido('');
  };

  const handleCancelar = () => {
    reiniciarModal();
    onClose();
  };

  const registrarVentaEnBackend = async (metodoPagoElegido, comprobanteId) => {
    const user = JSON.parse(localStorage.getItem('usuario') || localStorage.getItem('user') || '{}');
    const tipoPagoBackend = metodoPagoElegido === 'efectivo' 
      ? 'efectivo' 
      : (metodoPagoElegido === 'qr' ? 'mercadopago' : 'tarjeta');

    const res = await api.post('/ventas/registrar', {
      sucursalId,
      tipoPago: tipoPagoBackend,
      items: formatearItemsVenta(carrito, metodoPagoElegido),
      usuarioId: user.id
    });
    return res.data;
  };

  const procesarImpresion = async (metodoPagoElegido, comprobanteId) => {
    if (!imprimirComprobante) return;
    try {
      await imprimirTicket({
        sucursal: sucursalActual,
        items: formatearItemsVenta(carrito, metodoPagoElegido),
        total: totalCalculado,
        tipoPago: metodoPagoElegido,
        comprobante: comprobanteId,
        fecha: new Date().toISOString(),
        montoRecibido: metodoPagoElegido === 'efectivo' && !esPagoExacto ? recibidoNum : null,
        vuelto: metodoPagoElegido === 'efectivo' ? vuelto : 0
      });
    } catch {
      // Impresión no bloqueante
    }
  };

  const handleFinalizarFlujo = async (metodoPagoElegido, ventaId) => {
    await registrarVentaEnBackend(metodoPagoElegido, ventaId);
    await procesarImpresion(metodoPagoElegido, ventaId);
  };

  // 1. Efectivo
  const handleCobroEfectivo = async () => {
    if (montoInsuficiente) {
      setErrorMensaje(`Monto insuficiente. Faltan ${formatMoney(faltante)}`);
      return;
    }

    setProcesando(true);
    setErrorMensaje(null);
    const comprobanteId = `EF-${Date.now().toString().slice(-6)}`;

    try {
      await handleFinalizarFlujo('efectivo', comprobanteId);
      await abrirCajon();

      const mensaje = !esPagoExacto && vuelto > 0
        ? `✅ Venta registrada. Vuelto a entregar: ${formatMoney(vuelto)}`
        : '✅ Venta cobrada en efectivo y registrada exitosamente';

      toast.success(mensaje);
      reiniciarModal();
      onVentaCompletada();
    } catch (error) {
      setErrorMensaje(error.response?.data?.error || 'Error al registrar la venta');
      toast.error('❌ Error al procesar la venta en efectivo');
    } finally {
      setProcesando(false);
    }
  };

  // Helper de polling genérico para QR y Posnet
  const iniciarPollingPago = (ventaId, metodoPago, onSuccessMsg) => {
    detenerPolling();
    pollingRef.current = setInterval(async () => {
      try {
        const checkRes = await api.get(`/pagos/estado/${ventaId}`);
        if (checkRes.data?.pagado) {
          detenerPolling();
          setEstadoFlujo('aprobado');
          await handleFinalizarFlujo(metodoPago, ventaId);
          toast.success(onSuccessMsg);
          setTimeout(() => {
            reiniciarModal();
            onVentaCompletada();
          }, 1200);
        } else if (checkRes.data?.estado === 'rechazado') {
          detenerPolling();
          setEstadoFlujo('error');
          setErrorMensaje('La operación fue rechazada.');
          toast.error('❌ Cobro rechazado');
        }
      } catch {
        // Error de red transitorio en polling
      }
    }, 3000);
  };

  // 2. Mercado Pago QR
  const handleIniciarCobroQR = async () => {
    setProcesando(true);
    setErrorMensaje(null);
    const ventaId = `QR-${Date.now().toString().slice(-6)}`;
    setVentaIdActual(ventaId);

    try {
      await api.post('/pagos/mercadopago/qr', {
        ventaId,
        total: totalCalculado,
        sucursalId,
        items: formatearItemsVenta(carrito, 'qr')
      });

      setEstadoFlujo('esperando_qr');
      setProcesando(false);
      iniciarPollingPago(ventaId, 'qr', '✅ ¡Pago QR recibido y venta completada!');
    } catch (error) {
      setProcesando(false);
      setErrorMensaje(error.response?.data?.error || 'No se pudo crear la orden en el QR');
      toast.error('❌ Error comunicándose con Mercado Pago QR');
    }
  };

  const handleSimularPagoQR = async () => {
    if (!ventaIdActual) return;
    try {
      await api.post('/pagos/webhook/mercadopago', { ventaId: ventaIdActual, status: 'approved' });
      toast.info('⚡ Pago simulado enviado al webhook');
    } catch {}
  };

  // 3. Tarjeta Posnet
  const handleIniciarCobroPosnet = async () => {
    setProcesando(true);
    setErrorMensaje(null);
    const ventaId = `POS-${Date.now().toString().slice(-6)}`;
    setVentaIdActual(ventaId);

    try {
      await api.post('/pagos/posnet/cobrar', { ventaId, monto: totalCalculado });
      setEstadoFlujo('esperando_posnet');
      setProcesando(false);
      iniciarPollingPago(ventaId, 'posnet', '✅ ¡Cobro con tarjeta aprobado y venta registrada!');
    } catch (error) {
      setProcesando(false);
      setErrorMensaje(error.response?.data?.error || 'Error al comunicarse con la terminal Posnet');
      toast.error('❌ Error al enviar intención a la terminal Point');
    }
  };

  const handleSimularRespuestaPosnet = async (accion) => {
    if (!ventaIdActual) return;
    try {
      await api.post('/pagos/posnet/simular', { ventaId: ventaIdActual, accion });
      toast.info(`🕹️ Terminal Posnet simulada: ${accion === 'aprobar' ? 'Aprobada' : 'Rechazada'}`);
    } catch {}
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-[#fefcf8] border border-[#e2d8cc] rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
        {/* Cabecera */}
        <div className="px-6 py-4 border-b border-[#e2d8cc] flex items-center justify-between bg-[#fbf8f3]">
          <div>
            <h2 className="text-lg font-black text-[#5a4a3a] flex items-center gap-2">
              💳 Confirmar y Cobrar Venta
            </h2>
            <p className="text-xs text-[#8a7a6a] font-semibold">
              Sucursal: {sucursalActual.nombre} • {carrito.length} {carrito.length === 1 ? 'producto' : 'productos'}
            </p>
          </div>
          <button
            onClick={handleCancelar}
            disabled={procesando}
            className="text-[#8a7a6a] hover:text-[#5a4a3a] text-xl font-bold p-1 rounded-lg hover:bg-[#ede5da] cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Total a Pagar */}
        <div className="bg-[#5a4a3a] text-white px-6 py-4 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#e2d8cc] block">
              Monto Total a Cobrar:
            </span>
            <span className="text-[11px] text-[#e2d8cc]/80 font-medium">
              {esEfectivo ? '🏷️ Tarifa Efectivo' : '💳 Tarifa Tarjeta / MP'}
            </span>
          </div>
          <span className="text-3xl font-black">{formatMoney(totalCalculado)}</span>
        </div>

        {/* Cuerpo */}
        <div className="p-6 space-y-4">
          {errorMensaje && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-bold flex items-center gap-2">
              <span>⚠️</span>
              <span>{errorMensaje}</span>
            </div>
          )}

          {estadoFlujo === 'seleccion' && (
            <>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-[#8a7a6a] block mb-2">
                  Selecciona la opción de pago (excluyentes):
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setMetodo('efectivo')}
                    style={{
                      backgroundColor: metodo === 'efectivo' ? '#5a4a3a' : '#ffffff',
                      color: metodo === 'efectivo' ? '#ffffff' : '#5a4a3a',
                      borderColor: metodo === 'efectivo' ? '#43372b' : '#e2d8cc'
                    }}
                    className="flex flex-col items-center justify-center p-3 border rounded-xl font-bold text-xs shadow-xs cursor-pointer"
                  >
                    <span className="text-2xl mb-1">💵</span>
                    <span>Efectivo</span>
                    <span className="text-[10px] opacity-75 font-normal mt-0.5">Precio Efectivo</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMetodo('qr')}
                    style={{
                      backgroundColor: metodo === 'qr' ? '#5a4a3a' : '#ffffff',
                      color: metodo === 'qr' ? '#ffffff' : '#5a4a3a',
                      borderColor: metodo === 'qr' ? '#43372b' : '#e2d8cc'
                    }}
                    className="flex flex-col items-center justify-center p-3 border rounded-xl font-bold text-xs shadow-xs cursor-pointer"
                  >
                    <span className="text-2xl mb-1">📱</span>
                    <span>Mercado Pago</span>
                    <span className="text-[10px] opacity-75 font-normal mt-0.5">QR Mostrador</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMetodo('posnet')}
                    style={{
                      backgroundColor: metodo === 'posnet' ? '#5a4a3a' : '#ffffff',
                      color: metodo === 'posnet' ? '#ffffff' : '#5a4a3a',
                      borderColor: metodo === 'posnet' ? '#43372b' : '#e2d8cc'
                    }}
                    className="flex flex-col items-center justify-center p-3 border rounded-xl font-bold text-xs shadow-xs cursor-pointer"
                  >
                    <span className="text-2xl mb-1">💳</span>
                    <span>Tarjeta</span>
                    <span className="text-[10px] opacity-75 font-normal mt-0.5">Terminal Point</span>
                  </button>
                </div>
              </div>

              {esEfectivo && (
                <div className="bg-[#f5f0e8] p-4 rounded-xl border border-[#e2d8cc] space-y-3 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between">
                    <label 
                      htmlFor="input-monto-recibido"
                      className="text-xs font-bold uppercase tracking-wider text-[#5a4a3a] flex items-center gap-1.5"
                    >
                      <span>💵</span>
                      <span>Monto recibido / Con cuánto abona:</span>
                    </label>
                    <span className="text-[11px] font-semibold text-[#8a7a6a]">
                      {esPagoExacto ? 'Pago exacto' : `Abona: ${formatMoney(recibidoNum)}`}
                    </span>
                  </div>

                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-black text-base text-[#5a4a3a]">$</span>
                    <input
                      id="input-monto-recibido"
                      ref={inputVueltoRef}
                      type="number"
                      autoFocus
                      step="any"
                      min="0"
                      value={montoRecibido}
                      onChange={(e) => setMontoRecibido(e.target.value)}
                      placeholder={`Monto recibido (Total exacto: ${formatMoney(totalCalculado)})`}
                      className={`w-full pl-8 pr-4 py-2.5 bg-white border rounded-xl text-base font-bold text-[#5a4a3a] focus:outline-none ${
                        montoInsuficiente ? 'border-rose-400 ring-2 ring-rose-200' : 'border-[#e2d8cc] focus:border-[#5a4a3a]'
                      }`}
                    />
                  </div>

                  {montoInsuficiente ? (
                    <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-bold flex items-center justify-between">
                      <span>⚠️ Monto insuficiente</span>
                      <span>Faltan {formatMoney(faltante)}</span>
                    </div>
                  ) : (
                    <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs font-bold flex items-center justify-between">
                      <span>🪙 Vuelto a entregar:</span>
                      <span className="text-base font-black text-emerald-800">{formatMoney(vuelto)}</span>
                    </div>
                  )}

                  <div className="flex items-center flex-wrap gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => setMontoRecibido('')}
                      className="text-[10px] font-bold px-2 py-1 bg-white border border-[#e2d8cc] rounded-lg text-[#5a4a3a] hover:bg-[#ede5da] cursor-pointer"
                    >
                      Pago exacto ($0)
                    </button>
                    {[1000, 2000, 5000, 10000, 20000].filter(b => b > totalCalculado).slice(0, 3).map(billete => (
                      <button
                        key={billete}
                        type="button"
                        onClick={() => setMontoRecibido(String(billete))}
                        className="text-[10px] font-bold px-2 py-1 bg-white border border-[#e2d8cc] rounded-lg text-[#5a4a3a] hover:bg-[#ede5da] cursor-pointer"
                      >
                        Paga con ${billete.toLocaleString('es-AR')}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-[#f5f0e8] p-3.5 rounded-xl border border-[#e2d8cc] flex items-center justify-between">
                <label className="flex items-center gap-2.5 cursor-pointer text-xs font-bold text-[#5a4a3a] select-none">
                  <input
                    type="checkbox"
                    checked={imprimirComprobante}
                    onChange={(e) => setImprimirComprobante(e.target.checked)}
                    className="w-4 h-4 accent-[#5a4a3a] rounded cursor-pointer"
                  />
                  <span>🖨️ Imprimir comprobante / ticket de venta</span>
                </label>
                <span className="text-[10px] text-[#8a7a6a] font-semibold">Térmica 80mm / Serial</span>
              </div>

              {soportaWebSerial() && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => conectarPuertoSerial()}
                    className="text-[11px] font-semibold text-[#8a7a6a] hover:text-[#5a4a3a] cursor-pointer underline"
                  >
                    🔌 Configurar / Vincular puerto serial
                  </button>
                </div>
              )}
            </>
          )}

          {estadoFlujo === 'esperando_qr' && (
            <div className="text-center py-5 space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-amber-100 border border-amber-300 flex items-center justify-center animate-pulse">
                <span className="text-3xl">📱</span>
              </div>
              <div>
                <h3 className="text-base font-black text-[#5a4a3a]">Esperando pago del cliente en mostrador...</h3>
                <p className="text-xs text-[#8a7a6a] mt-1 max-w-sm mx-auto">
                  La orden por <strong className="text-[#5a4a3a]">{formatMoney(totalCalculado)}</strong> está cargada en el QR de la caja.
                </p>
                <p className="text-[11px] font-semibold text-[#8a7a6a] mt-2 flex items-center justify-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                  Consultando estado cada 3 segundos...
                </p>
              </div>
              <div className="pt-2 border-t border-[#e2d8cc]/60">
                <button
                  type="button"
                  onClick={handleSimularPagoQR}
                  className="bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold py-2 px-4 rounded-xl cursor-pointer"
                >
                  ⚡ Simular Pago Aprobado (Test/Dev)
                </button>
              </div>
            </div>
          )}

          {estadoFlujo === 'esperando_posnet' && (
            <div className="text-center py-5 space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-blue-100 border border-blue-300 flex items-center justify-center animate-pulse">
                <span className="text-3xl">💳</span>
              </div>
              <div>
                <h3 className="text-base font-black text-[#5a4a3a]">Esperando respuesta de la terminal Point...</h3>
                <p className="text-xs text-[#8a7a6a] mt-1 max-w-sm mx-auto">
                  Acerque o inserte la tarjeta en la terminal por <strong className="text-[#5a4a3a]">{formatMoney(totalCalculado)}</strong>.
                </p>
                <p className="text-[11px] font-semibold text-[#8a7a6a] mt-2 flex items-center justify-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping"></span>
                  Esperando confirmación cada 3 segundos...
                </p>
              </div>
              <div className="pt-2 border-t border-[#e2d8cc]/60 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => handleSimularRespuestaPosnet('aprobar')}
                  className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-bold py-2 px-3.5 rounded-xl cursor-pointer"
                >
                  ✅ Simular Aprobado
                </button>
                <button
                  type="button"
                  onClick={() => handleSimularRespuestaPosnet('rechazar')}
                  className="bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 text-xs font-bold py-2 px-3.5 rounded-xl cursor-pointer"
                >
                  ❌ Simular Rechazado
                </button>
              </div>
            </div>
          )}

          {estadoFlujo === 'aprobado' && (
            <div className="text-center py-6 space-y-2">
              <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 border border-emerald-300 flex items-center justify-center">
                <span className="text-3xl">✅</span>
              </div>
              <h3 className="text-base font-black text-emerald-800">¡Pago Confirmado y Venta Registrada!</h3>
              <p className="text-xs text-[#8a7a6a]">Cerrando comprobante...</p>
            </div>
          )}

          {estadoFlujo === 'error' && (
            <div className="text-center py-5 space-y-3">
              <div className="w-14 h-14 mx-auto rounded-full bg-rose-100 border border-rose-300 flex items-center justify-center">
                <span className="text-2xl">❌</span>
              </div>
              <h3 className="text-sm font-black text-rose-800">El pago no pudo ser completado</h3>
              <p className="text-xs text-[#8a7a6a]">{errorMensaje || 'Intente nuevamente o elija otro medio de pago.'}</p>
              <button
                type="button"
                onClick={reiniciarModal}
                className="bg-[#5a4a3a] text-white text-xs font-bold py-2 px-5 rounded-xl hover:bg-[#43372b] cursor-pointer"
              >
                Volver a seleccionar método
              </button>
            </div>
          )}
        </div>

        {/* Pie */}
        <div className="px-6 py-4 bg-[#fbf8f3] border-t border-[#e2d8cc] flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleCancelar}
            disabled={procesando || estadoFlujo === 'aprobado'}
            className="px-4 py-2.5 rounded-xl border border-[#e2d8cc] text-xs font-bold text-[#8a7a6a] hover:bg-[#ede5da] cursor-pointer disabled:opacity-50"
          >
            {estadoFlujo === 'seleccion' ? 'Cancelar' : 'Abortar Pago'}
          </button>

          {estadoFlujo === 'seleccion' && (
            <button
              type="button"
              disabled={procesando || (esEfectivo && montoInsuficiente)}
              onClick={() => {
                if (metodo === 'efectivo') handleCobroEfectivo();
                else if (metodo === 'qr') handleIniciarCobroQR();
                else if (metodo === 'posnet') handleIniciarCobroPosnet();
              }}
              style={{ 
                backgroundColor: (esEfectivo && montoInsuficiente) ? '#a89d91' : '#5a4a3a', 
                color: '#ffffff' 
              }}
              className="flex-1 py-3 px-5 rounded-xl text-xs font-black shadow-md hover:bg-[#43372b] cursor-pointer border border-[#43372b] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {procesando ? (
                <>
                  <span className="animate-spin">⏳</span>
                  <span>Procesando...</span>
                </>
              ) : (
                <>
                  <span>
                    {metodo === 'efectivo' && (
                      montoInsuficiente 
                        ? `⚠️ Ingrese al menos ${formatMoney(totalCalculado)}` 
                        : (esPagoExacto ? '💵 Confirmar Cobro (Pago Exacto)' : `💵 Cobrar con Vuelto: ${formatMoney(vuelto)}`)
                    )}
                    {metodo === 'qr' && '📱 Enviar al QR de Mostrador'}
                    {metodo === 'posnet' && '💳 Enviar Intención a Posnet'}
                  </span>
                  <span>({formatMoney(totalCalculado)})</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
