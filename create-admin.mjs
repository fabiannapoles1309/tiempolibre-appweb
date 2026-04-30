import pg from './node_modules/.pnpm/pg@8.20.0/node_modules/pg/lib/index.js';
const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

await pool.query('UPDATE users SET name = $1 WHERE id = $2', ['Juan Ignacio Garcia', 22])
  .then(r => { console.log('Actualizado:', r.rowCount); })
  .catch(e => { console.error('Error:', e.message); })
  .finally(() => pool.end());