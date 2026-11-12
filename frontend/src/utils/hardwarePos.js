// frontend/src/utils/hardwarePos.js
/**
 * Utilidad de control de hardware POS local:
 * - Comunicación con caja registradora e impresora térmica mediante Web Serial API.
 * - Secuencia ESC/POS de apertura de cajón: [0x1B, 0x70, 0x00, 0x19, 0xFA]
 * - Formateador de tickets y vista de impresión térmica de 80mm como fallback.
 */

// Puerto serial en caché durante la sesión activa
let puertoSerialActivo = null;

// Pulso ESC/POS estándar para apertura de cajón de dinero (Pin 2 / Pin 5 - 25ms ON, 250ms OFF)
export const PULSO_APERTURA_CAJON = new Uint8Array([0x1B, 0x70, 0x00, 0x19, 0xFA]);

/**
 * Comprueba si el navegador actual soporta Web Serial API (Chrome, Edge, Opera en HTTPS o localhost)
 */
export function soportaWebSerial() {
  return typeof navigator !== 'undefined' && 'serial' in navigator;
}

/**
 * Solicita al usuario seleccionar un puerto serial (impresora o gaveta conectada a COM/USB)
 */
export async function conectarPuertoSerial(baudRate = 9600) {
  if (!soportaWebSerial()) {
    console.warn('⚠️ Web Serial API no está soportada en este navegador.');
    return null;
  }

  try {
    const port = await navigator.serial.requestPort();
    await port.open({ baudRate });
    puertoSerialActivo = port;
    console.log('✅ Puerto serial conectado con éxito');
    return port;
  } catch (error) {
    if (error.name !== 'NotFoundError') {
      console.error('❌ Error conectando al puerto serial:', error);
    }
    return null;
  }
}

/**
 * Obtiene el puerto serial activo o busca uno previamente concedido
 */
async function obtenerPuertoSerial() {
  if (puertoSerialActivo && puertoSerialActivo.writable) {
    return puertoSerialActivo;
  }

  if (soportaWebSerial()) {
    try {
      const puertos = await navigator.serial.getPorts();
      if (puertos.length > 0) {
        const port = puertos[0];
        if (!port.readable || !port.writable) {
          await port.open({ baudRate: 9600 });
        }
        puertoSerialActivo = port;
        return port;
      }
    } catch (err) {
      console.warn('⚠️ No se pudo reconectar al puerto serial autorizado:', err.message);
    }
  }

  return null;
}

/**
 * Envía el pulso ESC/POS para abrir la caja registradora.
 * REGLA ESTRICTA: Solo debe invocarse si el método de pago seleccionado es Efectivo.
 */
export async function abrirCajon() {
  console.log('⚡ [Hardware POS] Disparando pulso de apertura de gaveta de dinero...');

  try {
    const port = await obtenerPuertoSerial();

    if (port && port.writable) {
      const writer = port.writable.getWriter();
      try {
        await writer.write(PULSO_APERTURA_CAJON);
        console.log('✅ Pulso ESC/POS enviado al puerto serial:', Array.from(PULSO_APERTURA_CAJON));
      } finally {
        writer.releaseLock();
      }
      return { success: true, hardware: 'serial' };
    } else {
      console.info(
        'ℹ️ [Hardware POS - Modo Simulación] Pulso de apertura ejecutado (Sin puerto serial activo):',
        Array.from(PULSO_APERTURA_CAJON)
      );
      return { success: true, hardware: 'simulado' };
    }
  } catch (error) {
    console.warn('⚠️ No se pudo enviar el pulso al puerto serial (operación no bloqueante):', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Construye el buffer binario en formato ESC/POS para impresión directa por puerto serie
 */
function construirComandosEscPosTicket({ sucursal, items, total, tipoPago, comprobante, fecha }) {
  const encoder = new TextEncoder();
  const chunks = [];

  const addBytes = (bytes) => chunks.push(new Uint8Array(bytes));
  const addText = (text) => chunks.push(encoder.encode(text));
  const addLine = (text = '') => chunks.push(encoder.encode(text + '\n'));

  // Inicializar impresora
  addBytes([0x1B, 0x40]); // ESC @

  // Centrado y texto en negrita para el encabezado
  addBytes([0x1B, 0x61, 0x01]); // ESC a 1 (Centrado)
  addBytes([0x1B, 0x45, 0x01]); // ESC E 1 (Negrita ON)
  addLine('SCRIBO POS');
  addLine(sucursal?.nombre || 'Casa Central');
  addBytes([0x1B, 0x45, 0x00]); // ESC E 0 (Negrita OFF)

  if (sucursal?.direccion) {
    addLine(sucursal.direccion);
  }
  addLine('TICKET DE VENTA');
  addLine('------------------------------------------');

  // Alineación izquierda para los datos de comprobante
  addBytes([0x1B, 0x61, 0x00]); // ESC a 0 (Izquierda)
  addLine(`Comprobante: ${comprobante || 'T-0001'}`);
  addLine(`Fecha: ${fecha ? new Date(fecha).toLocaleString('es-AR') : new Date().toLocaleString('es-AR')}`);
  addLine('------------------------------------------');
  addLine('CANT  DESCRIPCION                    SUBTOTAL');
  addLine('------------------------------------------');

  // Detalle de ítems
  items.forEach(item => {
    const cant = `${item.cantidad}x`.padEnd(5, ' ');
    const desc = (item.nombre || 'Item').substring(0, 22).padEnd(23, ' ');
    const precio = item.precioUnitario ?? item.precio_unitario ?? (tipoPago === 'efectivo' ? item.precioEfectivo : item.precioTarjeta) ?? 0;
    const subtotal = Number(precio * (item.cantidad || 1) * (1 - (item.descuento || 0) / 100));
    const subtotalStr = `$ ${subtotal.toLocaleString('es-AR')}`.padStart(12, ' ');
    addLine(`${cant}${desc}${subtotalStr}`);
    if (item.descuento && item.descuento > 0) {
      addLine(`      (Desc: ${item.descuento}%)`);
    }
  });

  addLine('------------------------------------------');
  // Total destacado
  addBytes([0x1B, 0x61, 0x02]); // ESC a 2 (Derecha)
  addBytes([0x1B, 0x45, 0x01]); // Negrita
  addLine(`TOTAL: $ ${Number(total).toLocaleString('es-AR')}`);
  addBytes([0x1B, 0x45, 0x00]); // Negrita OFF

  // Forma de pago y pie
  addBytes([0x1B, 0x61, 0x01]); // Centrado
  addLine('------------------------------------------');
  addLine(`Forma de Pago: ${(tipoPago || 'Efectivo').toUpperCase()}`);
  addLine('');
  addLine('¡Gracias por su compra!');
  addLine('Conserve este comprobante');
  addLine('');
  addLine('');
  addLine('');

  // Corte de papel parcial
  addBytes([0x1D, 0x56, 0x42, 0x00]); // GS V 66 0

  // Unificar todos los Uint8Array
  const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

/**
 * Fallback de impresión térmica de 80mm usando iframe oculto y CSS de página de rollo
 */
export function imprimirTicketTermico80mm(datos) {
  const { sucursal, items = [], total = 0, tipoPago = 'Efectivo', comprobante, fecha } = datos;

  const fechaFormateada = fecha
    ? new Date(fecha).toLocaleString('es-AR')
    : new Date().toLocaleString('es-AR');

  const nombrePago = (() => {
    switch (tipoPago) {
      case 'efectivo': return 'EFECTIVO';
      case 'mercadopago':
      case 'qr': return 'MERCADO PAGO (QR)';
      case 'tarjeta':
      case 'posnet': return 'TARJETA (POSNET)';
      default: return tipoPago.toUpperCase();
    }
  })();

  const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="utf-8">
      <title>Ticket de Venta</title>
      <style>
        @page {
          size: 80mm auto;
          margin: 0;
        }
        @media print {
          html, body {
            width: 76mm;
            margin: 0;
            padding: 0;
            background: #fff;
            color: #000;
          }
        }
        body {
          font-family: 'Courier New', Courier, monospace;
          font-size: 12px;
          line-height: 1.25;
          width: 76mm;
          margin: 0 auto;
          padding: 8px 6px;
          box-sizing: border-box;
          color: #000;
        }
        .center { text-align: center; }
        .right { text-align: right; }
        .bold { font-weight: bold; }
        .divider {
          border-top: 1px dashed #000;
          margin: 6px 0;
        }
        .header-title {
          font-size: 15px;
          font-weight: bold;
          letter-spacing: 1px;
        }
        .item-row {
          display: flex;
          justify-content: space-between;
          margin: 2px 0;
        }
        .item-name {
          flex: 1;
          word-break: break-word;
          padding-right: 4px;
        }
        .total-row {
          font-size: 14px;
          font-weight: bold;
          display: flex;
          justify-content: space-between;
          margin: 4px 0;
        }
        .footer {
          margin-top: 8px;
          font-size: 11px;
        }
      </style>
    </head>
    <body>
      <div class="center">
        <div class="header-title">SCRIBO POS</div>
        <div class="bold">${sucursal?.nombre || 'Casa Central'}</div>
        <div>${sucursal?.direccion || 'Av. Argentina 123'}</div>
        <div style="font-size: 10px; margin-top: 2px;">COMPROBANTE NO FISCAL</div>
      </div>

      <div class="divider"></div>

      <div>
        <div><span class="bold">Ticket:</span> ${comprobante || 'TK-' + Date.now().toString().slice(-6)}</div>
        <div><span class="bold">Fecha:</span> ${fechaFormateada}</div>
      </div>

      <div class="divider"></div>

      <div class="bold item-row" style="font-size: 11px;">
        <span>DETALLE</span>
        <span>SUBTOTAL</span>
      </div>
      <div class="divider"></div>

      ${items.map(item => {
        const cant = item.cantidad || 1;
        const precio = item.precioUnitario ?? item.precio_unitario ?? (tipoPago === 'efectivo' ? (item.precio_efectivo || item.precioEfectivo) : (item.precio_tarjeta || item.precioTarjeta)) ?? 0;
        const subtotal = cant * precio * (1 - (item.descuento || 0) / 100);
        return `
          <div class="item-row">
            <div class="item-name">${cant}x ${item.nombre}</div>
            <div class="right">$ ${subtotal.toLocaleString('es-AR')}</div>
          </div>
          ${item.descuento > 0 ? `<div style="font-size: 10px; color: #333;">(Descuento: ${item.descuento}%)</div>` : ''}
        `;
      }).join('')}

      <div class="divider"></div>

      <div class="total-row">
        <span>TOTAL:</span>
        <span>$ ${Number(total).toLocaleString('es-AR')}</span>
      </div>

      <div class="divider"></div>

      <div>
        <div><span class="bold">Forma de Pago:</span> ${nombrePago}</div>
        ${tipoPago === 'efectivo' && datos.montoRecibido ? `
          <div><span class="bold">Abonó con:</span> $ ${Number(datos.montoRecibido).toLocaleString('es-AR')}</div>
          <div><span class="bold">Vuelto:</span> $ ${Number(datos.vuelto || 0).toLocaleString('es-AR')}</div>
        ` : ''}
      </div>

      <div class="divider"></div>

      <div class="center footer">
        <div>¡Gracias por su compra!</div>
        <div>Librería Scribo</div>
      </div>
    </body>
    </html>
  `;

  // Creamos un iframe invisible para aislar la impresión del POS
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(html);
  doc.close();

  iframe.contentWindow.focus();
  setTimeout(() => {
    iframe.contentWindow.print();
    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 1000);
  }, 250);
}

/**
 * Función principal de impresión:
 * - Si hay impresora serial conectada, envía comandos ESC/POS binarios.
 * - Si no hay puerto serial, genera la vista de impresión térmica de 80mm como fallback.
 */
export async function imprimirTicket(datosVenta) {
  try {
    const port = await obtenerPuertoSerial();

    if (port && port.writable) {
      console.log('🖨️ Imprimiendo comprobante por Web Serial (ESC/POS)...');
      const escPosData = construirComandosEscPosTicket(datosVenta);
      const writer = port.writable.getWriter();
      try {
        await writer.write(escPosData);
        console.log('✅ Ticket impreso correctamente por puerto serie');
        return { success: true, metodo: 'serial' };
      } finally {
        writer.releaseLock();
      }
    } else {
      console.log('📄 Generando impresión térmica de 80mm (fallback navegador)...');
      imprimirTicketTermico80mm(datosVenta);
      return { success: true, metodo: 'fallback_80mm' };
    }
  } catch (error) {
    console.warn('⚠️ Falla en puerto serial, recurriendo a impresión térmica 80mm:', error.message);
    imprimirTicketTermico80mm(datosVenta);
    return { success: true, metodo: 'fallback_80mm' };
  }
}
