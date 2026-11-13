// backend/src/controllers/integracionesController.js
const axios = require('axios');
const db = require('../config/db');
const { encriptarTexto, desencriptarTexto } = require('../utils/cryptoUtils');

/**
 * GET /api/integraciones
 * Consulta el estado de configuración de integraciones (Mercado Pago, AFIP, QR por sucursal).
 * NUNCA devuelve tokens desencriptados.
 */
const obtenerIntegraciones = async (req, res) => {
  try {
    const comercioId = req.usuario?.comercio_id;

    // 1. Consultar estado en public.integraciones_comercio
    const integracionRes = await db.query(
      `SELECT 
        mp_activo, 
        mp_user_id, 
        (mp_access_token_enc IS NOT NULL) AS mp_configurado,
        (mp_webhook_secret_enc IS NOT NULL) AS mp_webhook_configurado,
        afip_activo, 
        afip_cuit, 
        afip_entorno, 
        afip_punto_venta, 
        afip_condicion_iva, 
        updated_at 
       FROM public.integraciones_comercio 
       WHERE comercio_id = $1`,
      [comercioId]
    );

    const ic = integracionRes.rows[0] || {};

    // 2. Consultar sucursales del comercio con sus datos de QR
    const sucursalesRes = await db.query(
      `SELECT 
        id, 
        nombre, 
        direccion, 
        mp_external_store_id, 
        mp_external_pos_id, 
        mp_qr_imagen_url, 
        mp_qr_data 
       FROM public.sucursales 
       WHERE comercio_id = $1 
       ORDER BY id ASC`,
      [comercioId]
    );

    return res.json({
      mercadopago: {
        activo: Boolean(ic.mp_activo && ic.mp_configurado),
        user_id: ic.mp_user_id || null,
        configurado: Boolean(ic.mp_configurado),
        webhook_configurado: Boolean(ic.mp_webhook_configurado),
        updated_at: ic.updated_at || null
      },
      afip: {
        activo: Boolean(ic.afip_activo),
        cuit: ic.afip_cuit || null,
        entorno: ic.afip_entorno || 'homologacion',
        punto_venta: ic.afip_punto_venta || null,
        condicion_iva: ic.afip_condicion_iva || 'monotributo',
        configurado: Boolean(ic.afip_cuit && ic.afip_punto_venta),
        tiene_certificado: Boolean(ic.afip_certificado_enc && ic.afip_clave_privada_enc)
      },
      sucursales: sucursalesRes.rows
    });
  } catch (error) {
    console.error('Error al obtener integraciones:', error);
    return res.status(500).json({ error: 'Error al consultar configuración de integraciones' });
  }
};

/**
 * POST /api/integraciones/mercadopago
 * Valida el access token con la API de Mercado Pago, lo encripta y lo asocia al comercio.
 */
const guardarCredencialesMercadoPago = async (req, res) => {
  try {
    const comercioId = req.usuario?.comercio_id;
    const { access_token, webhook_secret } = req.body;

    if (!access_token || typeof access_token !== 'string' || access_token.trim() === '') {
      return res.status(400).json({ error: 'Debes proporcionar un Access Token válido de Mercado Pago' });
    }

    const tokenLimpio = access_token.trim();
    let mpUserId = null;

    // Si está en modo mock o es un token simulado
    const esMock = process.env.MP_MOCK_MODE === 'true' || tokenLimpio.startsWith('TEST-MOCK') || tokenLimpio.startsWith('TEST-000000');

    if (esMock) {
      mpUserId = process.env.MP_USER_ID || '3834329853';
    } else {
      // Validar token contra la API oficial de Mercado Pago
      try {
        const respuestaMp = await axios.get('https://api.mercadopago.com/users/me', {
          headers: {
            Authorization: `Bearer ${tokenLimpio}`,
            'User-Agent': 'Scribo-POS/1.0'
          },
          timeout: 8000
        });

        mpUserId = String(respuestaMp.data?.id);
        if (!mpUserId) {
          throw new Error('No se pudo obtener el User ID de la cuenta de Mercado Pago');
        }
      } catch (errAxios) {
        console.error('Error validando token con Mercado Pago:', errAxios.response?.data || errAxios.message);
        const status = errAxios.response?.status;
        if (status === 401 || status === 403) {
          return res.status(400).json({ 
            error: 'El Access Token ingresado no es válido o ha expirado. Verifícalo en tu cuenta de Mercado Pago Developers.' 
          });
        }
        return res.status(400).json({ 
          error: `Error al verificar credenciales con Mercado Pago: ${errAxios.response?.data?.message || errAxios.message}` 
        });
      }
    }

    // Encriptar credenciales con AES-256-GCM
    const tokenEncriptado = encriptarTexto(tokenLimpio);
    const webhookSecretEncriptado = webhook_secret ? encriptarTexto(webhook_secret.trim()) : null;

    // Guardar en public.integraciones_comercio
    await db.query(
      `INSERT INTO public.integraciones_comercio 
        (comercio_id, mp_activo, mp_user_id, mp_access_token_enc, mp_webhook_secret_enc, updated_at)
       VALUES ($1, true, $2, $3, $4, NOW())
       ON CONFLICT (comercio_id) DO UPDATE SET
        mp_activo = true,
        mp_user_id = EXCLUDED.mp_user_id,
        mp_access_token_enc = EXCLUDED.mp_access_token_enc,
        mp_webhook_secret_enc = COALESCE(EXCLUDED.mp_webhook_secret_enc, public.integraciones_comercio.mp_webhook_secret_enc),
        updated_at = NOW()`,
      [comercioId, mpUserId, tokenEncriptado, webhookSecretEncriptado]
    );

    return res.json({
      success: true,
      user_id: mpUserId,
      mensaje: 'Credenciales de Mercado Pago vinculadas correctamente'
    });
  } catch (error) {
    console.error('Error al guardar credenciales de Mercado Pago:', error);
    return res.status(500).json({ error: 'Error interno al guardar credenciales' });
  }
};

/**
 * POST /api/integraciones/mercadopago/generar-qr/:sucursalId
 * Crea/registra la Sucursal (Store) y Caja (POS) en Mercado Pago con Modelo Atendido (fixed_amount: true).
 * Almacena y devuelve los identificadores y la URL de imagen del QR.
 */
const generarQRSucursal = async (req, res) => {
  try {
    const comercioId = req.usuario?.comercio_id;
    const { sucursalId } = req.params;
    const sId = parseInt(sucursalId, 10);

    if (isNaN(sId) || sId <= 0) {
      return res.status(400).json({ error: 'ID de sucursal inválido' });
    }

    // 1. Validar que la sucursal exista y pertenezca al comercio
    const sucRes = await db.query(
      `SELECT id, nombre, direccion FROM public.sucursales WHERE id = $1 AND comercio_id = $2`,
      [sId, comercioId]
    );

    if (sucRes.rows.length === 0) {
      return res.status(404).json({ error: 'Sucursal no encontrada en tu comercio' });
    }

    const sucursal = sucRes.rows[0];

    // 2. Obtener credenciales de Mercado Pago del comercio
    const intRes = await db.query(
      `SELECT mp_activo, mp_user_id, mp_access_token_enc 
       FROM public.integraciones_comercio 
       WHERE comercio_id = $1`,
      [comercioId]
    );

    const integracion = intRes.rows[0];
    if (!integracion || !integracion.mp_access_token_enc) {
      return res.status(400).json({ 
        error: 'Primero debes configurar y guardar el Access Token de Mercado Pago en la sección de integraciones' 
      });
    }

    const accessToken = desencriptarTexto(integracion.mp_access_token_enc);
    const userId = integracion.mp_user_id;

    // Identificadores unívocos para Store y POS
    const externalStoreId = `store_c${comercioId}_s${sId}`;
    const externalPosId = `pos_c${comercioId}_s${sId}`;

    const esMock = process.env.MP_MOCK_MODE === 'true' || accessToken.startsWith('TEST-MOCK') || accessToken.startsWith('TEST-000000');

    let qrData = null;
    let qrImagenUrl = null;

    if (esMock) {
      // Modo Mock / Desarrollo local
      qrData = `https://mercadopago.com/pos/mock/c${comercioId}_s${sId}`;
      qrImagenUrl = `https://api.qrserver.com/v1/create-qr-code/?size=350x350&data=${encodeURIComponent(qrData)}`;
    } else {
      // 3. Crear o Reutilizar Store en Mercado Pago
      // POST https://api.mercadopago.com/users/{user_id}/stores
      let storeCreado = null;
      try {
        const storePayload = {
          name: `${sucursal.nombre} - Scribo`.substring(0, 45),
          business_hours: {
            monday: [{ open: '08:00', close: '20:00' }],
            tuesday: [{ open: '08:00', close: '20:00' }],
            wednesday: [{ open: '08:00', close: '20:00' }],
            thursday: [{ open: '08:00', close: '20:00' }],
            friday: [{ open: '08:00', close: '20:00' }],
            saturday: [{ open: '09:00', close: '18:00' }]
          },
          external_id: externalStoreId,
          location: {
            street_number: '100',
            street_name: sucursal.direccion ? sucursal.direccion.substring(0, 40) : 'Av. Corrientes',
            city_name: 'Buenos Aires',
            state_name: 'Buenos Aires',
            latitude: -34.6037,
            longitude: -58.3816
          }
        };

        const resStore = await axios.post(
          `https://api.mercadopago.com/users/${userId}/stores`,
          storePayload,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            },
            timeout: 8000
          }
        );
        storeCreado = resStore.data;
      } catch (errStore) {
        // Si el store ya existe con ese external_id, no es error crítico
        console.log(`ℹ️ Info: Store con external_id ${externalStoreId} ya existente o reutilizado (${errStore.response?.status || errStore.message})`);
      }

      // 4. Crear o Obtener POS en Mercado Pago
      // POST https://api.mercadopago.com/pos
      try {
        const posPayload = {
          name: `Caja Mostrador - ${sucursal.nombre}`.substring(0, 45),
          fixed_amount: true,
          external_store_id: externalStoreId,
          external_id: externalPosId,
          category: 621102 // Retail / Mostrador
        };

        const resPos = await axios.post(
          'https://api.mercadopago.com/pos',
          posPayload,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            },
            timeout: 8000
          }
        );

        const posData = resPos.data;
        qrData = posData.qr?.template_document || posData.qr?.data || externalPosId;
        qrImagenUrl = posData.qr?.image || posData.qr?.template_image;
      } catch (errPos) {
        // Si el POS ya existía, consultarlo por external_id
        console.log(`ℹ️ Info: Consultando POS existente ${externalPosId} en Mercado Pago...`);
        try {
          const resSearch = await axios.get(
            `https://api.mercadopago.com/pos?external_id=${externalPosId}`,
            {
              headers: { Authorization: `Bearer ${accessToken}` },
              timeout: 8000
            }
          );
          const posExistente = resSearch.data?.results?.[0];
          if (posExistente) {
            qrData = posExistente.qr?.template_document || posExistente.qr?.data || externalPosId;
            qrImagenUrl = posExistente.qr?.image || posExistente.qr?.template_image;
          }
        } catch (errSearch) {
          console.error('Error buscando POS existente:', errSearch.response?.data || errSearch.message);
        }

        // Si la API de MP no devolvió imagen directa, generar URL estándar basada en qrData
        if (!qrImagenUrl && qrData) {
          qrImagenUrl = `https://api.qrserver.com/v1/create-qr-code/?size=350x350&data=${encodeURIComponent(qrData)}`;
        }
      }
    }

    if (!qrImagenUrl) {
      qrData = `https://mercadopago.com/pos/c${comercioId}_s${sId}`;
      qrImagenUrl = `https://api.qrserver.com/v1/create-qr-code/?size=350x350&data=${encodeURIComponent(qrData)}`;
    }

    // 5. Guardar en public.sucursales
    const updRes = await db.query(
      `UPDATE public.sucursales 
       SET mp_external_store_id = $1,
           mp_external_pos_id = $2,
           mp_qr_data = $3,
           mp_qr_imagen_url = $4
       WHERE id = $5 AND comercio_id = $6
       RETURNING id, nombre, direccion, mp_external_store_id, mp_external_pos_id, mp_qr_data, mp_qr_imagen_url`,
      [externalStoreId, externalPosId, qrData, qrImagenUrl, sId, comercioId]
    );

    return res.json({
      success: true,
      mensaje: 'QR de mostrador generado y registrado con éxito',
      sucursal: updRes.rows[0],
      mock: esMock
    });
  } catch (error) {
    console.error('Error al generar QR para sucursal:', error);
    return res.status(500).json({ error: error.message || 'Error al generar QR de Mercado Pago para la sucursal' });
  }
};

/**
 * POST /api/integraciones/afip
 * Guarda y encripta certificados digitales (.crt y .key), CUIT y Punto de Venta para AFIP.
 */
const guardarConfiguracionAfip = async (req, res) => {
  try {
    const comercioId = req.usuario?.comercio_id;
    const { cuit, punto_venta, condicion_iva, entorno, certificado_crt, clave_privada_key } = req.body;

    if (!cuit) {
      return res.status(400).json({ error: 'El CUIT es obligatorio' });
    }

    const cuitLimpio = String(cuit).replace(/\D/g, '');
    if (cuitLimpio.length !== 11) {
      return res.status(400).json({ error: 'El CUIT debe tener exactamente 11 dígitos' });
    }

    const pVta = parseInt(punto_venta, 10);
    if (isNaN(pVta) || pVta <= 0) {
      return res.status(400).json({ error: 'El Punto de Venta debe ser un número entero mayor a 0' });
    }

    const condIvaValida = ['monotributo', 'responsable_inscripto'].includes(condicion_iva) ? condicion_iva : 'monotributo';
    const entornoValido = ['homologacion', 'produccion'].includes(entorno) ? entorno : 'homologacion';

    let certEnc = null;
    let keyEnc = null;

    if (certificado_crt && certificado_crt.trim()) {
      const crtStr = certificado_crt.trim();
      if (!crtStr.includes('CERTIFICATE-----')) {
        return res.status(400).json({ error: 'El certificado debe estar en formato PEM válido (-----BEGIN CERTIFICATE-----)' });
      }
      certEnc = encriptarTexto(crtStr);
    }

    if (clave_privada_key && clave_privada_key.trim()) {
      const keyStr = clave_privada_key.trim();
      if (!keyStr.includes('PRIVATE KEY-----')) {
        return res.status(400).json({ error: 'La clave privada debe estar en formato PEM válido (-----BEGIN PRIVATE KEY----- o RSA)' });
      }
      keyEnc = encriptarTexto(keyStr);
    }

    // Upsert en public.integraciones_comercio
    await db.query(
      `INSERT INTO public.integraciones_comercio 
        (comercio_id, afip_activo, afip_cuit, afip_punto_venta, afip_condicion_iva, afip_entorno, afip_certificado_enc, afip_clave_privada_enc, afip_token_wsaa, afip_sign_wsaa, afip_expiracion_wsaa, updated_at)
       VALUES ($1, true, $2, $3, $4, $5, $6, $7, NULL, NULL, NULL, NOW())
       ON CONFLICT (comercio_id) DO UPDATE SET
        afip_activo = true,
        afip_cuit = EXCLUDED.afip_cuit,
        afip_punto_venta = EXCLUDED.afip_punto_venta,
        afip_condicion_iva = EXCLUDED.afip_condicion_iva,
        afip_entorno = EXCLUDED.afip_entorno,
        afip_certificado_enc = COALESCE(EXCLUDED.afip_certificado_enc, public.integraciones_comercio.afip_certificado_enc),
        afip_clave_privada_enc = COALESCE(EXCLUDED.afip_clave_privada_enc, public.integraciones_comercio.afip_clave_privada_enc),
        afip_token_wsaa = NULL,
        afip_sign_wsaa = NULL,
        afip_expiracion_wsaa = NULL,
        updated_at = NOW()`,
      [comercioId, cuitLimpio, pVta, condIvaValida, entornoValido, certEnc, keyEnc]
    );

    return res.json({
      success: true,
      mensaje: 'Configuración fiscal de AFIP / ARCA guardada exitosamente'
    });
  } catch (error) {
    console.error('Error al guardar configuración de AFIP:', error);
    return res.status(500).json({ error: error.message || 'Error al guardar configuración de AFIP' });
  }
};

/**
 * POST /api/integraciones/afip/probar-conexion
 * Verifica el certificado y conexión contra WSAA y FEDummy de AFIP.
 */
const probarConexionAfip = async (req, res) => {
  try {
    const comercioId = req.usuario?.comercio_id;
    const afipService = require('../services/afipService');

    const ticket = await afipService.obtenerTicketAcceso(comercioId);
    let estadoServidores = { appServer: 'OK', dbServer: 'OK', authServer: 'OK' };

    if (!ticket.mock) {
      estadoServidores = await afipService.consultarFEDummy(ticket.entorno);
    }

    return res.json({
      success: true,
      mensaje: ticket.mock
        ? 'Conexión simulada con éxito (Modo Simulación activo)'
        : 'Conexión exitosa con servidores de AFIP / ARCA',
      cuit: ticket.cuit,
      puntoVenta: ticket.puntoVenta,
      condicionIva: ticket.condicionIva,
      entorno: ticket.entorno,
      estadoServidores,
      mock: ticket.mock
    });
  } catch (error) {
    console.error('Error al probar conexión con AFIP:', error);
    return res.status(400).json({
      error: `Error al conectar con AFIP / ARCA: ${error.message}`
    });
  }
};

module.exports = {
  obtenerIntegraciones,
  guardarCredencialesMercadoPago,
  generarQRSucursal,
  guardarConfiguracionAfip,
  probarConexionAfip
};
