const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on('connect', () => {
  console.log('✅ Conectado exitosamente a PostgreSQL (Local/VPS)');
});

pool.on('error', (err) => {
  console.error('❌ Error inesperado en el pool de PostgreSQL:', err);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};