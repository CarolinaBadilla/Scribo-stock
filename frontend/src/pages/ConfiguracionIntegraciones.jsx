// src/pages/ConfiguracionIntegraciones.jsx
import { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

export function ConfiguracionIntegraciones() {
  const { usuario } = useAuth();
  const esAdmin = usuario?.rol === 'jefe' || usuario?.rol === 'DUENO';

  const [loading, setLoading] = useState(true);
  const [guardandoMP, setGuardandoMP] = useState(false);
  const [generandoQRId, setGenerandoQRId] = useState(null);

  // Estados de AFIP
  const [guardandoAFIP, setGuardandoAFIP] = useState(false);
  const [probandoAFIP, setProbandoAFIP] = useState(false);
  const [resultadoTestAFIP, setResultadoTestAFIP] = useState(null);

  const [cuitAFIP, setCuitAFIP] = useState('');
  const [puntoVentaAFIP, setPuntoVentaAFIP] = useState('1');
  const [condicionIvaAFIP, setCondicionIvaAFIP] = useState('monotributo');
  const [entornoAFIP, setEntornoAFIP] = useState('homologacion');
  const [certificadoCrt, setCertificadoCrt] = useState('');
  const [clavePrivadaKey, setClavePrivadaKey] = useState('');
  const [nombreArchivoCrt, setNombreArchivoCrt] = useState('');
  const [nombreArchivoKey, setNombreArchivoKey] = useState('');

  const [integraciones, setIntegraciones] = useState({
    mercadopago: { activo: false, user_id: null, configurado: false },
    afip: { activo: false, cuit: null, entorno: 'homologacion', punto_venta: 1, condicion_iva: 'monotributo' },
    sucursales: []
  });

  // Formulario Mercado Pago
  const [accessToken, setAccessToken] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [mostrarToken, setMostrarToken] = useState(false);

  // Modal para ver / imprimir cartel QR
  const [sucursalQRModal, setSucursalQRModal] = useState(null);

  const cargarDatos = async () => {
    setLoading(true);
    try {
      const res = await api.get('/integraciones');
      setIntegraciones(res.data);
      if (res.data?.afip) {
        setCuitAFIP(res.data.afip.cuit || '');
        setPuntoVentaAFIP(String(res.data.afip.punto_venta || '1'));
        setCondicionIvaAFIP(res.data.afip.condicion_iva || 'monotributo');
        setEntornoAFIP(res.data.afip.entorno || 'homologacion');
      }
    } catch (err) {
      console.error('Error al cargar integraciones:', err);
      toast.error('❌ Error al cargar la configuración de integraciones');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  const handleGuardarMP = async (e) => {
    e.preventDefault();
    if (!accessToken.trim()) {
      toast.warning('Ingresa un Access Token de Mercado Pago');
      return;
    }

    setGuardandoMP(true);
    try {
      const res = await api.post('/integraciones/mercadopago', {
        access_token: accessToken.trim(),
        webhook_secret: webhookSecret.trim() || undefined
      });

      toast.success(`✅ ${res.data?.mensaje || 'Mercado Pago conectado exitosamente'}`);
      setAccessToken('');
      setWebhookSecret('');
      await cargarDatos();
    } catch (err) {
      console.error('Error al conectar Mercado Pago:', err);
      const msg = err.response?.data?.error || err.message || 'Error al validar credenciales';
      toast.error(`❌ ${msg}`);
    } finally {
      setGuardandoMP(false);
    }
  };

  const handleCargarArchivoCrt = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setNombreArchivoCrt(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      setCertificadoCrt(String(event.target?.result || ''));
      toast.info(`📄 Archivo ${file.name} cargado`);
    };
    reader.readAsText(file);
  };

  const handleCargarArchivoKey = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setNombreArchivoKey(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      setClavePrivadaKey(String(event.target?.result || ''));
      toast.info(`🔑 Archivo ${file.name} cargado`);
    };
    reader.readAsText(file);
  };

  const handleGuardarAFIP = async (e) => {
    e.preventDefault();
    if (!cuitAFIP.trim()) {
      toast.warning('Ingresa el CUIT de la empresa');
      return;
    }

    setGuardandoAFIP(true);
    try {
      const payload = {
        cuit: cuitAFIP.replace(/\D/g, ''),
        punto_venta: parseInt(puntoVentaAFIP, 10) || 1,
        condicion_iva: condicionIvaAFIP,
        entorno: entornoAFIP,
        certificado_crt: certificadoCrt.trim() || undefined,
        clave_privada_key: clavePrivadaKey.trim() || undefined
      };

      const res = await api.post('/integraciones/afip', payload);
      toast.success(`✅ ${res.data?.mensaje || 'Configuración de AFIP guardada con éxito'}`);
      setCertificadoCrt('');
      setClavePrivadaKey('');
      setNombreArchivoCrt('');
      setNombreArchivoKey('');
      await cargarDatos();
    } catch (err) {
      console.error('Error al guardar AFIP:', err);
      const msg = err.response?.data?.error || err.message || 'Error al guardar AFIP';
      toast.error(`❌ ${msg}`);
    } finally {
      setGuardandoAFIP(false);
    }
  };

  const handleProbarConexionAFIP = async () => {
    setProbandoAFIP(true);
    setResultadoTestAFIP(null);
    try {
      const res = await api.post('/integraciones/afip/probar-conexion');
      setResultadoTestAFIP(res.data);
      toast.success(`✅ ${res.data?.mensaje || 'Conexión verificada con AFIP'}`);
    } catch (err) {
      console.error('Error probando conexión AFIP:', err);
      const msg = err.response?.data?.error || err.message || 'Error al conectar con AFIP';
      toast.error(`❌ ${msg}`);
      setResultadoTestAFIP({ error: msg });
    } finally {
      setProbandoAFIP(false);
    }
  };

  const handleGenerarQR = async (sucursal) => {
    setGenerandoQRId(sucursal.id);
    try {
      const res = await api.post(`/integraciones/mercadopago/generar-qr/${sucursal.id}`);
      toast.success(`✅ ${res.data?.mensaje || 'QR generado correctamente'}`);
      
      const sucursalActualizada = res.data?.sucursal;
      setIntegraciones(prev => ({
        ...prev,
        sucursales: prev.sucursales.map(s => s.id === sucursal.id ? { ...s, ...sucursalActualizada } : s)
      }));

      setSucursalQRModal(sucursalActualizada || sucursal);
    } catch (err) {
      console.error('Error al generar QR:', err);
      const msg = err.response?.data?.error || err.message || 'Error al generar QR para la sucursal';
      toast.error(`❌ ${msg}`);
    } finally {
      setGenerandoQRId(null);
    }
  };

  const imprimirCartel = () => {
    window.print();
  };

  if (!esAdmin) {
    return (
      <div className="w-full max-w-4xl mx-auto p-6 bg-white rounded-2xl border border-[#e2d8cc] text-center space-y-3">
        <span className="text-4xl">🔒</span>
        <h2 className="text-xl font-bold text-[#5a4a3a]">Acceso Restringido</h2>
        <p className="text-sm text-[#8a7a6a]">
          Solo los administradores o dueños del comercio pueden configurar credenciales e integraciones.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      
      {/* Encabezado */}
      <div className="bg-[#fefcf8] px-6 py-5 rounded-2xl border border-[#e2d8cc] shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#5a4a3a] tracking-tight">⚙️ Configuración de Integraciones</h1>
          <p className="text-xs font-bold text-[#8a7a6a] mt-0.5">
            Vincula Mercado Pago (QR de Mostrador) y Facturación Electrónica AFIP / ARCA (CAE) por comercio
          </p>
        </div>
        <button
          type="button"
          onClick={cargarDatos}
          disabled={loading}
          className="px-3.5 py-2 rounded-xl border border-[#e2d8cc] bg-white text-xs font-bold text-[#5a4a3a] hover:bg-[#f5f0e8] transition cursor-pointer"
        >
          {loading ? 'Cargando...' : '🔄 Actualizar'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Panel Izquierdo: Mercado Pago & AFIP / ARCA */}
        <div className="lg:col-span-6 space-y-6">
          
          {/* 1. Tarjeta Mercado Pago */}
          <div className="bg-[#fefcf8] rounded-2xl border border-[#e2d8cc] p-6 shadow-xs space-y-5">
            <div className="flex items-center justify-between border-b border-[#e2d8cc] pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#009ee3]/10 border border-[#009ee3]/30 flex items-center justify-center text-xl">
                  💳
                </div>
                <div>
                  <h2 className="text-base font-black text-[#5a4a3a]">Mercado Pago</h2>
                  <p className="text-xs text-[#8a7a6a]">In-Store QR Atendido</p>
                </div>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${integraciones.mercadopago?.activo ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-gray-100 text-gray-700 border border-gray-300'}`}>
                {integraciones.mercadopago?.activo ? '✅ Conectado' : '⚪ Desconectado'}
              </span>
            </div>

            {integraciones.mercadopago?.activo && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs space-y-1 text-emerald-900">
                <p className="font-bold">✓ Cuenta vinculada con éxito</p>
                <p className="text-[11px] text-emerald-800">
                  User ID Mercado Pago: <b className="font-mono">{integraciones.mercadopago?.user_id}</b>
                </p>
              </div>
            )}

            <form onSubmit={handleGuardarMP} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-[#5a4a3a] mb-1">
                  Access Token de Producción (o Pruebas)
                </label>
                <div className="relative">
                  <input
                    type={mostrarToken ? 'text' : 'password'}
                    value={accessToken}
                    onChange={(e) => setAccessToken(e.target.value)}
                    placeholder={integraciones.mercadopago?.configurado ? '•••••••••••••••••••••••••••••••• (Configurado)' : 'APP_USR-xxxxxx o TEST-xxxxxx'}
                    className="w-full px-3.5 py-2.5 bg-white border border-[#e2d8cc] rounded-xl text-xs font-mono font-bold text-[#5a4a3a] focus:outline-none focus:ring-2 focus:ring-[#c9a87b] pr-12"
                    required={!integraciones.mercadopago?.configurado}
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarToken(!mostrarToken)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#8a7a6a] hover:text-[#5a4a3a] font-bold"
                  >
                    {mostrarToken ? 'Ocultar' : 'Ver'}
                  </button>
                </div>
                <span className="text-[11px] text-[#8a7a6a] mt-1 block">
                  Se almacena encriptado con AES-256-GCM para aislar cada comercio.
                </span>
              </div>

              <div>
                <label className="block font-bold text-[#5a4a3a] mb-1">
                  Webhook Secret (Opcional)
                </label>
                <input
                  type="password"
                  value={webhookSecret}
                  onChange={(e) => setWebhookSecret(e.target.value)}
                  placeholder="Clave de firma para validar notificaciones"
                  className="w-full px-3.5 py-2.5 bg-white border border-[#e2d8cc] rounded-xl text-xs font-mono font-bold text-[#5a4a3a] focus:outline-none focus:ring-2 focus:ring-[#c9a87b]"
                />
              </div>

              <button
                type="submit"
                disabled={guardandoMP}
                className="w-full py-2.5 bg-[#5a4a3a] hover:bg-[#43372b] text-white rounded-xl font-bold transition shadow-xs disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
              >
                {guardandoMP ? 'Validando y guardando...' : '💾 Guardar y Conectar con Mercado Pago'}
              </button>
            </form>
          </div>

          {/* 2. Tarjeta AFIP / ARCA (Facturación Electrónica Oficial) */}
          <div className="bg-[#fefcf8] rounded-2xl border border-[#e2d8cc] p-6 shadow-xs space-y-5">
            <div className="flex items-center justify-between border-b border-[#e2d8cc] pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-xl">
                  🏛️
                </div>
                <div>
                  <h2 className="text-base font-black text-[#5a4a3a]">AFIP / ARCA (Facturación Electrónica)</h2>
                  <p className="text-xs text-[#8a7a6a]">Emisión directa con obtención de CAE y QR oficial</p>
                </div>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${integraciones.afip?.activo ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-gray-100 text-gray-700 border border-gray-300'}`}>
                {integraciones.afip?.activo ? '✅ Configurado' : '⚪ Pendiente'}
              </span>
            </div>

            {resultadoTestAFIP && (
              <div className={`p-3.5 rounded-xl text-xs space-y-1 ${resultadoTestAFIP.error ? 'bg-red-50 border border-red-200 text-red-900' : 'bg-emerald-50 border border-emerald-200 text-emerald-900'}`}>
                <p className="font-bold">
                  {resultadoTestAFIP.error ? '❌ Fallo en la prueba de conexión' : '✓ Conexión exitosa con AFIP'}
                </p>
                <p className="text-[11px]">
                  {resultadoTestAFIP.error || `${resultadoTestAFIP.mensaje} · Entorno: ${resultadoTestAFIP.entorno} · PV: ${resultadoTestAFIP.puntoVenta}`}
                </p>
              </div>
            )}

            <form onSubmit={handleGuardarAFIP} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#5a4a3a] mb-1">
                    CUIT del Comercio / Titular
                  </label>
                  <input
                    type="text"
                    value={cuitAFIP}
                    onChange={(e) => setCuitAFIP(e.target.value)}
                    placeholder="20123456789"
                    maxLength={13}
                    className="w-full px-3.5 py-2 bg-white border border-[#e2d8cc] rounded-xl text-xs font-bold text-[#5a4a3a] focus:outline-none focus:ring-2 focus:ring-[#c9a87b]"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#5a4a3a] mb-1">
                    Punto de Venta (PV)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={puntoVentaAFIP}
                    onChange={(e) => setPuntoVentaAFIP(e.target.value)}
                    placeholder="1"
                    className="w-full px-3.5 py-2 bg-white border border-[#e2d8cc] rounded-xl text-xs font-bold text-[#5a4a3a] focus:outline-none focus:ring-2 focus:ring-[#c9a87b]"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#5a4a3a] mb-1">
                    Condición frente al IVA
                  </label>
                  <select
                    value={condicionIvaAFIP}
                    onChange={(e) => setCondicionIvaAFIP(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-[#e2d8cc] rounded-xl text-xs font-bold text-[#5a4a3a] focus:outline-none focus:ring-2 focus:ring-[#c9a87b] cursor-pointer"
                  >
                    <option value="monotributo">Monotributo (Factura C)</option>
                    <option value="responsable_inscripto">Responsable Inscripto (Factura B)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-[#5a4a3a] mb-1">
                    Entorno de AFIP
                  </label>
                  <select
                    value={entornoAFIP}
                    onChange={(e) => setEntornoAFIP(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-[#e2d8cc] rounded-xl text-xs font-bold text-[#5a4a3a] focus:outline-none focus:ring-2 focus:ring-[#c9a87b] cursor-pointer"
                  >
                    <option value="homologacion">Homologación (Pruebas)</option>
                    <option value="produccion">Producción (Real / Fiscal)</option>
                  </select>
                </div>
              </div>

              {/* Carga de archivos .crt y .key */}
              <div className="space-y-3 pt-2 border-t border-[#e2d8cc]/60">
                <p className="font-bold text-[#5a4a3a]">Certificados Digitales (X.509)</p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#8a7a6a] mb-1">
                      Certificado (.crt) {nombreArchivoCrt && `✓ ${nombreArchivoCrt}`}
                    </label>
                    <input
                      type="file"
                      accept=".crt,.pem,.txt"
                      onChange={handleCargarArchivoCrt}
                      className="w-full text-[11px] text-[#8a7a6a] file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-[11px] file:font-bold file:bg-[#f5f0e8] file:text-[#5a4a3a] hover:file:bg-[#e2d8cc] cursor-pointer"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[#8a7a6a] mb-1">
                      Clave Privada (.key) {nombreArchivoKey && `✓ ${nombreArchivoKey}`}
                    </label>
                    <input
                      type="file"
                      accept=".key,.pem,.txt"
                      onChange={handleCargarArchivoKey}
                      className="w-full text-[11px] text-[#8a7a6a] file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-[11px] file:font-bold file:bg-[#f5f0e8] file:text-[#5a4a3a] hover:file:bg-[#e2d8cc] cursor-pointer"
                    />
                  </div>
                </div>
                <span className="text-[10px] text-[#8a7a6a] block">
                  Si no subes archivos nuevos, se conservan los certificados ya guardados encriptados con AES-256.
                </span>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="submit"
                  disabled={guardandoAFIP}
                  className="flex-1 py-2.5 bg-[#5a4a3a] hover:bg-[#43372b] text-white rounded-xl font-bold transition shadow-xs disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {guardandoAFIP ? 'Guardando...' : '💾 Guardar Configuración AFIP'}
                </button>

                <button
                  type="button"
                  onClick={handleProbarConexionAFIP}
                  disabled={probandoAFIP || !integraciones.afip?.cuit}
                  className="px-4 py-2.5 bg-blue-700 hover:bg-blue-800 text-white rounded-xl font-bold transition shadow-xs disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                  title="Prueba el Ticket de Acceso (WSAA) y el estado de servidores de AFIP"
                >
                  {probandoAFIP ? 'Probando...' : '🔍 Probar Conexión'}
                </button>
              </div>
            </form>
          </div>

        </div>

        {/* Panel Derecho: QR Único de Mostrador por Sucursal */}
        <div className="lg:col-span-6 space-y-4">
          <div className="bg-[#fefcf8] rounded-2xl border border-[#e2d8cc] p-6 shadow-xs space-y-4">
            <div>
              <h2 className="text-base font-black text-[#5a4a3a] flex items-center gap-2">
                <span>📍</span>
                <span>Carteles QR de Mostrador por Sucursal</span>
              </h2>
              <p className="text-xs text-[#8a7a6a] mt-0.5">
                Cada sucursal tiene un único cartel QR impreso en su caja. El sistema envía automáticamente el monto exacto de cada venta a ese QR cuando el cajero confirma el cobro.
              </p>
            </div>

            <div className="space-y-3">
              {integraciones.sucursales?.length === 0 ? (
                <p className="text-xs text-[#8a7a6a] italic">No hay sucursales registradas.</p>
              ) : (
                integraciones.sucursales?.map(suc => {
                  const tieneQR = Boolean(suc.mp_qr_imagen_url || suc.mp_external_pos_id);
                  const estaGenerando = generandoQRId === suc.id;

                  return (
                    <div 
                      key={suc.id} 
                      className="p-4 bg-white border border-[#e2d8cc] rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shadow-2xs"
                    >
                      <div>
                        <div className="font-bold text-sm text-[#5a4a3a] flex items-center gap-2">
                          <span>{suc.nombre}</span>
                          {tieneQR ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              QR Activo
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                              Pendiente
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[#8a7a6a] mt-0.5">{suc.direccion || 'Sin dirección'}</p>
                        {suc.mp_external_pos_id && (
                          <p className="text-[10px] font-mono text-[#a89a8a] mt-0.5">
                            Caja POS: {suc.mp_external_pos_id}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        {tieneQR ? (
                          <button
                            type="button"
                            onClick={() => setSucursalQRModal(suc)}
                            className="flex-1 sm:flex-initial px-3.5 py-2 bg-[#5a4a3a] hover:bg-[#43372b] text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <span>🖨️</span>
                            <span>Ver / Imprimir Cartel</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleGenerarQR(suc)}
                            disabled={estaGenerando || !integraciones.mercadopago?.configurado}
                            className="flex-1 sm:flex-initial px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition shadow-xs disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            {estaGenerando ? 'Generando...' : '⚡ Generar QR Único'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

      </div>

      {/* Modal / Cartel Imprimible de QR de Mostrador */}
      {sucursalQRModal && (
        <div className="fixed inset-0 bg-[#5a4a3a]/70 backdrop-blur-xs flex items-center justify-center z-50 p-4 transition-all print:p-0 print:bg-white print:fixed print:inset-0">
          <div className="bg-white rounded-3xl shadow-2xl border border-[#e2d8cc] w-full max-w-md overflow-hidden text-[#5a4a3a] print:border-none print:shadow-none print:w-full print:max-w-none">
            
            <div className="flex justify-between items-center px-6 py-4 border-b border-[#e2d8cc] bg-[#f5f0e8] print:hidden">
              <span className="text-xs font-bold text-[#5a4a3a]">Cartel Oficial de Mostrador</span>
              <button
                type="button"
                onClick={() => setSucursalQRModal(null)}
                className="w-8 h-8 rounded-xl bg-white border border-[#e2d8cc] text-[#8a7a6a] hover:text-[#5a4a3a] flex items-center justify-center font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-8 text-center space-y-5 print:p-12">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-2 bg-[#009ee3]/10 border border-[#009ee3]/30 px-3 py-1 rounded-full text-xs font-black text-[#009ee3]">
                  <span>MERCADO PAGO</span>
                </div>
                <h3 className="text-2xl font-black text-[#5a4a3a] tracking-tight">
                  ¡Pagá acá con QR!
                </h3>
                <p className="text-xs font-bold text-[#8a7a6a]">
                  {sucursalQRModal.nombre} · {usuario?.nombre_comercial || 'Scribo'}
                </p>
              </div>

              <div className="p-4 bg-white border-2 border-[#5a4a3a] rounded-2xl inline-block shadow-md print:shadow-none">
                <img
                  src={sucursalQRModal.mp_qr_imagen_url || `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(sucursalQRModal.mp_qr_data || 'mock')}`}
                  alt="QR de Mercado Pago"
                  className="w-64 h-64 mx-auto object-contain"
                />
              </div>

              <div className="space-y-1.5 text-xs text-[#5a4a3a] bg-[#f5f0e8]/60 p-4 rounded-xl border border-[#e2d8cc] text-left">
                <p className="font-bold">📱 Pasos para el cliente:</p>
                <ol className="list-decimal list-inside space-y-0.5 text-[11px] text-[#8a7a6a]">
                  <li>Abrí la app de <b>Mercado Pago</b> o tu billetera virtual.</li>
                  <li>Escaneá este código QR del mostrador.</li>
                  <li>Confirmá el monto que aparecerá automáticamente en tu celular.</li>
                </ol>
              </div>
            </div>

            <div className="p-5 border-t border-[#e2d8cc] bg-[#f5f0e8]/50 flex gap-3 print:hidden">
              <button
                type="button"
                onClick={imprimirCartel}
                className="flex-1 py-2.5 bg-[#5a4a3a] hover:bg-[#43372b] text-white rounded-xl text-xs font-black transition shadow-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>🖨️</span>
                <span>Imprimir Cartel</span>
              </button>
              <button
                type="button"
                onClick={() => setSucursalQRModal(null)}
                className="px-4 py-2.5 border border-[#e2d8cc] rounded-xl hover:bg-white text-xs font-bold text-[#5a4a3a] transition cursor-pointer"
              >
                Cerrar
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
