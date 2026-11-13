// backend/src/services/afipService.js
const axios = require('axios');
const forge = require('node-forge');
const db = require('../config/db');
const { encriptarTexto, desencriptarTexto } = require('../utils/cryptoUtils');

// URLs oficiales de AFIP / ARCA
const AFIP_URLS = {
  wsaa: {
    homologacion: 'https://wsaahomo.afip.gov.ar/ws/services/LoginCms',
    produccion: 'https://wsaa.afip.gov.ar/ws/services/LoginCms'
  },
  wsfe: {
    homologacion: 'https://wswhomo.afip.gov.ar/wsfev1/service.asmx',
    produccion: 'https://servicios1.afip.gov.ar/wsfev1/service.asmx'
  }
};

/**
 * Genera el XML del Ticket de Requerimiento de Acceso (TRA).
 */
function generarXMLTRA(service = 'wsfe') {
  const now = new Date();
  const genTime = new Date(now.getTime() - 10 * 60 * 1000).toISOString();
  const expTime = new Date(now.getTime() + 10 * 60 * 1000).toISOString();
  const uniqueId = Math.floor(now.getTime() / 1000);

  return `<?xml version="1.0" encoding="UTF-8"?>
<loginTicketRequest version="1.0">
  <header>
    <uniqueId>${uniqueId}</uniqueId>
    <generationTime>${genTime}</generationTime>
    <expirationTime>${expTime}</expirationTime>
  </header>
  <service>${service}</service>
</loginTicketRequest>`;
}

/**
 * Firma el TRA en formato CMS / PKCS#7 SignedData usando node-forge.
 */
function firmarTRAPkcs7(traXml, certPem, keyPem) {
  try {
    const pki = forge.pki;
    const cert = pki.certificateFromPem(certPem);
    const key = pki.privateKeyFromPem(keyPem);

    const p7 = forge.pkcs7.createSignedData();
    p7.content = forge.util.createBuffer(traXml, 'utf8');
    p7.addCertificate(cert);
    p7.addSigner({
      key: key,
      certificate: cert,
      digestAlgorithm: forge.pki.oids.sha256,
      authenticatedAttributes: [
        { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
        { type: forge.pki.oids.messageDigest },
        { type: forge.pki.oids.signingTime, value: new Date() }
      ]
    });

    p7.sign();
    const derBytes = forge.asn1.toDer(p7.toAsn1()).getBytes();
    return Buffer.from(derBytes, 'binary').toString('base64');
  } catch (error) {
    console.error('Error firmando TRA con certificados:', error);
    throw new Error(`Error criptográfico al firmar con certificado y clave privada: ${error.message}`);
  }
}

/**
 * Obtiene el Ticket de Acceso (WSAA) para un comercio, usando caché en BD si no ha expirado.
 */
async function obtenerTicketAcceso(comercioId) {
  const cId = parseInt(comercioId, 10);

  const res = await db.query(
    `SELECT 
      afip_activo, 
      afip_entorno, 
      afip_cuit, 
      afip_punto_venta, 
      afip_condicion_iva, 
      afip_certificado_enc, 
      afip_clave_privada_enc, 
      afip_token_wsaa, 
      afip_sign_wsaa, 
      afip_expiracion_wsaa 
     FROM public.integraciones_comercio 
     WHERE comercio_id = $1`,
    [cId]
  );

  const config = res.rows[0];
  if (!config) {
    throw new Error('El comercio no tiene configuración de AFIP registrada');
  }

  const entorno = config.afip_entorno || 'homologacion';
  const cuit = config.afip_cuit ? String(config.afip_cuit).replace(/\D/g, '') : null;
  const puntoVenta = config.afip_punto_venta ? parseInt(config.afip_punto_venta, 10) : 1;
  const condicionIva = config.afip_condicion_iva || 'monotributo';

  // Si está activo el modo mock o no hay certificados reales aún
  const isMock = process.env.AFIP_MOCK_MODE === 'true' || !config.afip_certificado_enc;

  if (isMock) {
    return {
      token: 'MOCK_TOKEN_AFIP_' + Date.now(),
      sign: 'MOCK_SIGN_AFIP_' + Date.now(),
      cuit: cuit || '20123456789',
      puntoVenta,
      condicionIva,
      entorno,
      mock: true
    };
  }

  // 1. Revisar caché en BD con margen de seguridad de 10 minutos
  if (
    config.afip_token_wsaa &&
    config.afip_sign_wsaa &&
    config.afip_expiracion_wsaa &&
    new Date(config.afip_expiracion_wsaa) > new Date(Date.now() + 10 * 60 * 1000)
  ) {
    return {
      token: config.afip_token_wsaa,
      sign: config.afip_sign_wsaa,
      cuit,
      puntoVenta,
      condicionIva,
      entorno,
      mock: false
    };
  }

  // 2. Si expiró o no existe, desencriptar certificados
  const certPem = desencriptarTexto(config.afip_certificado_enc);
  const keyPem = desencriptarTexto(config.afip_clave_privada_enc);

  if (!certPem || !keyPem) {
    throw new Error('Certificado o clave privada de AFIP no encontrados');
  }

  // 3. Generar y firmar TRA
  const traXml = generarXMLTRA('wsfe');
  const cmsBase64 = firmarTRAPkcs7(traXml, certPem, keyPem);

  // 4. Enviar a WSAA
  const wsaaUrl = AFIP_URLS.wsaa[entorno] || AFIP_URLS.wsaa.homologacion;
  const soapPayload = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:wsaa="https://wsaa.afip.gov.ar/ws/services/LoginCms">
  <soapenv:Header/>
  <soapenv:Body>
    <wsaa:loginCms>
      <wsaa:in0>${cmsBase64}</wsaa:in0>
    </wsaa:loginCms>
  </soapenv:Body>
</soapenv:Envelope>`;

  let wsaaRes;
  try {
    wsaaRes = await axios.post(wsaaUrl, soapPayload, {
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        SOAPAction: 'https://wsaa.afip.gov.ar/ws/services/LoginCms'
      },
      timeout: 10000
    });
  } catch (errAxios) {
    const errorBody = errAxios.response?.data || errAxios.message;
    console.error('Error invocando WSAA de AFIP:', errorBody);
    throw new Error(`Fallo de comunicación con WSAA de AFIP: ${errAxios.response?.statusText || errAxios.message}`);
  }

  // 5. Parsear respuesta SOAP
  const dataStr = String(wsaaRes.data);
  const tokenMatch = dataStr.match(/<token>(.*?)<\/token>/);
  const signMatch = dataStr.match(/<sign>(.*?)<\/sign>/);
  const expMatch = dataStr.match(/<expirationTime>(.*?)<\/expirationTime>/);

  if (!tokenMatch || !signMatch) {
    throw new Error(`WSAA rechazó la solicitud de Ticket de Acceso: ${dataStr}`);
  }

  const token = tokenMatch[1];
  const sign = signMatch[1];
  const expTime = expMatch ? new Date(expMatch[1]) : new Date(Date.now() + 11 * 60 * 60 * 1000);

  // 6. Guardar en BD para reusar durante las próximas 11-12 horas
  await db.query(
    `UPDATE public.integraciones_comercio 
     SET afip_token_wsaa = $1, 
         afip_sign_wsaa = $2, 
         afip_expiracion_wsaa = $3, 
         updated_at = NOW() 
     WHERE comercio_id = $4`,
    [token, sign, expTime.toISOString(), cId]
  );

  return {
    token,
    sign,
    cuit,
    puntoVenta,
    condicionIva,
    entorno,
    mock: false
  };
}

/**
 * Consulta el estado de los servidores de AFIP (FEDummy).
 */
async function consultarFEDummy(entorno = 'homologacion') {
  const url = AFIP_URLS.wsfe[entorno] || AFIP_URLS.wsfe.homologacion;
  const soapXml = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <FEDummy xmlns="http://ar.gov.afip.dif.FEV1/" />
  </soap:Body>
</soap:Envelope>`;

  const res = await axios.post(url, soapXml, {
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      SOAPAction: '"http://ar.gov.afip.dif.FEV1/FEDummy"'
    },
    timeout: 8000
  });

  const bodyStr = String(res.data);
  const appServer = bodyStr.match(/<AppServer>(.*?)<\/AppServer>/)?.[1] || 'OK';
  const dbServer = bodyStr.match(/<DbServer>(.*?)<\/DbServer>/)?.[1] || 'OK';
  const authServer = bodyStr.match(/<AuthServer>(.*?)<\/AuthServer>/)?.[1] || 'OK';

  return { appServer, dbServer, authServer };
}

/**
 * Consulta el último número de comprobante autorizado en AFIP (FECompUltimoAutorizado).
 */
async function obtenerUltimoComprobante({ token, sign, cuit, puntoVenta, tipoComprobante, entorno = 'homologacion' }) {
  const url = AFIP_URLS.wsfe[entorno] || AFIP_URLS.wsfe.homologacion;
  const soapXml = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <FECompUltimoAutorizado xmlns="http://ar.gov.afip.dif.FEV1/">
      <Auth>
        <Token>${token}</Token>
        <Sign>${sign}</Sign>
        <Cuit>${cuit}</Cuit>
      </Auth>
      <PtoVta>${puntoVenta}</PtoVta>
      <CbteTipo>${tipoComprobante}</CbteTipo>
    </FECompUltimoAutorizado>
  </soap:Body>
</soap:Envelope>`;

  const res = await axios.post(url, soapXml, {
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      SOAPAction: '"http://ar.gov.afip.dif.FEV1/FECompUltimoAutorizado"'
    },
    timeout: 8000
  });

  const bodyStr = String(res.data);
  const cbteMatch = bodyStr.match(/<CbteNro>(.*?)<\/CbteNro>/);
  if (!cbteMatch) {
    const errorMsg = bodyStr.match(/<Msg>(.*?)<\/Msg>/)?.[1] || 'Error al consultar último comprobante';
    throw new Error(`AFIP WSFEv1: ${errorMsg}`);
  }

  return parseInt(cbteMatch[1], 10);
}

/**
 * Construye la URL del QR reglamentario oficial de AFIP según especificación técnica.
 * https://www.afip.gob.ar/fe/qr/?p=Base64(JSON)
 */
function construirURLQRAfip({ cuit, puntoVenta, tipoComprobante, numeroComprobante, total, fecha, docTipo = 99, docNro = '0', cae }) {
  const fechaStr = fecha ? String(fecha).substring(0, 10) : new Date().toISOString().substring(0, 10);
  const docLimpio = docNro ? String(docNro).replace(/\D/g, '') : '0';

  const datosQR = {
    ver: 1,
    fecha: fechaStr,
    cuit: Number(cuit),
    ptoVta: Number(puntoVenta),
    tipoCmp: Number(tipoComprobante),
    nroCmp: Number(numeroComprobante),
    importe: Number(total),
    moneda: 'PES',
    ctz: 1,
    tipoDocRec: Number(docTipo || 99),
    nroDocRec: Number(docLimpio || 0),
    tipoCodAut: 'E',
    codAut: Number(cae)
  };

  const jsonStr = JSON.stringify(datosQR);
  const base64Str = Buffer.from(jsonStr).toString('base64');
  return `https://www.afip.gob.ar/fe/qr/?p=${base64Str}`;
}

/**
 * Emite una factura electrónica oficial (Factura B o Factura C) y obtiene el CAE ante AFIP / ARCA.
 */
async function emitirComprobanteVenta(comercioId, { total, sucursalId, clienteDocTipo = 99, clienteDocNro = '0' }) {
  const cId = parseInt(comercioId, 10);
  const authTicket = await obtenerTicketAcceso(cId);

  const { token, sign, cuit, puntoVenta, condicionIva, entorno, mock } = authTicket;

  // Determinar tipo de comprobante: 11 = Factura C (Monotributo), 6 = Factura B (Resp. Inscripto)
  const esRespInscripto = condicionIva === 'responsable_inscripto';
  const tipoComprobante = esRespInscripto ? 6 : 11;

  const totalNum = Number(total);
  const docTipo = Number(clienteDocTipo || 99);
  const docNro = clienteDocNro ? String(clienteDocNro).replace(/\D/g, '') : '0';

  // Fecha actual en formato YYYYMMDD para Argentina
  const ahora = new Date();
  const anio = ahora.getFullYear();
  const mes = String(ahora.getMonth() + 1).padStart(2, '0');
  const dia = String(ahora.getDate()).padStart(2, '0');
  const cbteFch = `${anio}${mes}${dia}`;
  const fechaISO = `${anio}-${mes}-${dia}`;

  // Desglose fiscal según condición de IVA
  let impNeto = totalNum;
  let impIva = 0;

  if (esRespInscripto) {
    impNeto = Math.round((totalNum / 1.21) * 100) / 100;
    impIva = Math.round((totalNum - impNeto) * 100) / 100;
  }

  // =========================================================================
  // MODO MOCK / SIMULACIÓN (Si no hay certs cargados o AFIP_MOCK_MODE=true)
  // =========================================================================
  if (mock) {
    // Buscar el último número emitido en la BD local
    const lastNumRes = await db.query(
      `SELECT COALESCE(MAX(afip_numero_comprobante), 0) AS ultimo 
       FROM public.movimientos 
       WHERE comercio_id = $1 AND afip_punto_venta = $2 AND afip_tipo_comprobante = $3`,
      [cId, puntoVenta, tipoComprobante]
    );

    const siguienteNum = (parseInt(lastNumRes.rows[0]?.ultimo, 10) || 0) + 1;
    const mockCae = `74${String(Date.now()).slice(-10)}92`; // 14 dígitos típicos de CAE
    const vtoAnio = ahora.getFullYear();
    const vtoMes = String(ahora.getMonth() + 1).padStart(2, '0');
    const vtoDia = String(Math.min(ahora.getDate() + 10, 28)).padStart(2, '0');
    const caeVencimiento = `${vtoAnio}-${vtoMes}-${vtoDia}`;

    const qrUrl = construirURLQRAfip({
      cuit,
      puntoVenta,
      tipoComprobante,
      numeroComprobante: siguienteNum,
      total: totalNum,
      fecha: fechaISO,
      docTipo,
      docNro,
      cae: mockCae
    });

    return {
      success: true,
      mock: true,
      tipoComprobante,
      letraComprobante: tipoComprobante === 6 ? 'B' : 'C',
      puntoVenta,
      numeroComprobante: siguienteNum,
      cae: mockCae,
      caeVencimiento,
      qrAfipUrl: qrUrl,
      impTotal: totalNum,
      impNeto,
      impIva,
      cuitEmisor: cuit,
      mensaje: 'Factura electrónica autorizada (Modo Simulación activo)'
    };
  }

  // =========================================================================
  // MODO OFICIAL AFIP WSFEv1
  // =========================================================================
  const ultimoNro = await obtenerUltimoComprobante({
    token,
    sign,
    cuit,
    puntoVenta,
    tipoComprobante,
    entorno
  });
  const siguienteNro = ultimoNro + 1;

  const url = AFIP_URLS.wsfe[entorno] || AFIP_URLS.wsfe.homologacion;

  // Bloque IVA si es Responsable Inscripto (Factura B)
  const bloqueIvaXML = esRespInscripto ? `
      <Iva>
        <AlicIva>
          <Id>5</Id>
          <BaseImp>${impNeto.toFixed(2)}</BaseImp>
          <Importe>${impIva.toFixed(2)}</Importe>
        </AlicIva>
      </Iva>` : '';

  const soapCAERequest = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <FECAESolicitar xmlns="http://ar.gov.afip.dif.FEV1/">
      <Auth>
        <Token>${token}</Token>
        <Sign>${sign}</Sign>
        <Cuit>${cuit}</Cuit>
      </Auth>
      <FeCAEReq>
        <FeCabReq>
          <CantReg>1</CantReg>
          <PtoVta>${puntoVenta}</PtoVta>
          <CbteTipo>${tipoComprobante}</CbteTipo>
        </FeCabReq>
        <FeDetReq>
          <FECAEDetRequest>
            <Concepto>1</Concepto>
            <DocTipo>${docTipo}</DocTipo>
            <DocNro>${docNro}</DocNro>
            <CbteDesde>${siguienteNro}</CbteDesde>
            <CbteHasta>${siguienteNro}</CbteHasta>
            <CbteFch>${cbteFch}</CbteFch>
            <ImpTotal>${totalNum.toFixed(2)}</ImpTotal>
            <ImpTotConc>0.00</ImpTotConc>
            <ImpNeto>${impNeto.toFixed(2)}</ImpNeto>
            <ImpOpEx>0.00</ImpOpEx>
            <ImpTrib>0.00</ImpTrib>
            <ImpIVA>${impIva.toFixed(2)}</ImpIVA>
            <MonId>PES</MonId>
            <MonCotiz>1</MonCotiz>
            ${bloqueIvaXML}
          </FECAEDetRequest>
        </FeDetReq>
      </FeCAEReq>
    </FECAESolicitar>
  </soap:Body>
</soap:Envelope>`;

  const respWsfe = await axios.post(url, soapCAERequest, {
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      SOAPAction: '"http://ar.gov.afip.dif.FEV1/FECAESolicitar"'
    },
    timeout: 12000
  });

  const resStr = String(respWsfe.data);

  // Parsear resultado
  const resultadoMatch = resStr.match(/<Resultado>(.*?)<\/Resultado>/);
  const resultado = resultadoMatch ? resultadoMatch[1] : null;

  if (resultado !== 'A') {
    const errorMsg = resStr.match(/<Msg>(.*?)<\/Msg>/)?.[1] || 'AFIP rechazó la autorización del comprobante';
    throw new Error(`AFIP rechazo FECAESolicitar: ${errorMsg}`);
  }

  const caeMatch = resStr.match(/<CAE>(.*?)<\/CAE>/);
  const caeVtoMatch = resStr.match(/<CAEFchVto>(.*?)<\/CAEFchVto>/);

  if (!caeMatch) {
    throw new Error('AFIP no devolvió el CAE para el comprobante solicitado');
  }

  const cae = caeMatch[1];
  const rawVto = caeVtoMatch ? caeVtoMatch[1] : '';
  const caeVencimiento = rawVto.length === 8 
    ? `${rawVto.substring(0, 4)}-${rawVto.substring(4, 6)}-${rawVto.substring(6, 8)}`
    : fechaISO;

  const qrAfipUrl = construirURLQRAfip({
    cuit,
    puntoVenta,
    tipoComprobante,
    numeroComprobante: siguienteNro,
    total: totalNum,
    fecha: fechaISO,
    docTipo,
    docNro,
    cae
  });

  return {
    success: true,
    mock: false,
    tipoComprobante,
    letraComprobante: tipoComprobante === 6 ? 'B' : 'C',
    puntoVenta,
    numeroComprobante: siguienteNro,
    cae,
    caeVencimiento,
    qrAfipUrl,
    impTotal: totalNum,
    impNeto,
    impIva,
    cuitEmisor: cuit,
    mensaje: 'Factura autorizada exitosamente por AFIP'
  };
}

module.exports = {
  obtenerTicketAcceso,
  consultarFEDummy,
  obtenerUltimoComprobante,
  construirURLQRAfip,
  emitirComprobanteVenta
};
