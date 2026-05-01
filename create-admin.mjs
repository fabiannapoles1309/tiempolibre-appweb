import pg from './node_modules/.pnpm/pg@8.20.0/node_modules/pg/lib/index.js';
const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

await pool.query(
  `INSERT INTO users (email, name, password_hash, role, must_change_password) 
   VALUES ($1, $2, $3, $4, $5) 
   ON CONFLICT (email) DO NOTHING RETURNING id`,
  [
    'bryan.becerra@tiempolibre.com',
    'Bryan Becerra',
    '$2b$10$E7wrKvL.gLvPFAbx.PJ6LuOEG7C/WSL524MKS6tFyYqPvTaLBELou',
    'MARKETING',
    true
  ]
).then(r => { console.log('Usuario creado:', r.rows); })
  .catch(e => { console.error('Error:', e.message); })
  .finally(() => pool.end());