// backend/src/utils/cryptoUtils.js
const crypto = require('crypto');

/**
 * Obtiene la clave de encriptación de 32 bytes (256 bits) para AES-256-GCM.
 * Si no está definida en desarrollo, usa un fallback controlado y advierte por consola.
 */
function getEncryptionKey() {
  let keyStr = process.env.ENCRYPTION_KEY;

  if (!keyStr) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('FATAL: ENCRYPTION_KEY no está configurada en las variables de entorno de producción');
    }
    console.warn('⚠️ [cryptoUtils] ENCRYPTION_KEY no está definida en .env. Usando clave de desarrollo por defecto.');
    keyStr = 'scribo_aes_256_gcm_fallback_key_dev_2026!';
  }

  // Deriva exactamente 32 bytes usando SHA-256
  return crypto.createHash('sha256').update(keyStr).digest();
}

/**
 * Encripta un texto en claro usando AES-256-GCM.
 * Retorna string en formato 'ivHex:authTagHex:encryptedHex'.
 */
function encriptarTexto(texto) {
  if (texto === null || texto === undefined || texto === '') {
    return null;
  }

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12); // 12 bytes es el estándar recomendado para GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  let encrypted = cipher.update(String(texto), 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag().toString('hex');
  const ivHex = iv.toString('hex');

  return `${ivHex}:${authTag}:${encrypted}`;
}

/**
 * Desencripta un string en formato 'ivHex:authTagHex:encryptedHex' usando AES-256-GCM.
 */
function desencriptarTexto(hash) {
  if (!hash) {
    return null;
  }

  const partes = String(hash).split(':');
  if (partes.length !== 3) {
    throw new Error('Formato de texto encriptado inválido (se esperaba iv:authTag:encrypted)');
  }

  const [ivHex, authTagHex, encryptedHex] = partes;
  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

module.exports = {
  encriptarTexto,
  desencriptarTexto
};
