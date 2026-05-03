import pg from 'pg';
const { Client } = pg;
const DB = 'postgresql://neondb_owner:npg_LF2O8sAhyzCp@ep-falling-cake-amnvoxzu-pooler.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require';
const c = new Client({ connectionString: DB });
c.connect()
  .then(() => c.query('SELECT unnest(enum_range(NULL::"Role")) as role'))
  .then(r => { console.log('ROLES:', r.rows); return c.end(); })
  .catch(e => { console.log('ERROR:', e.message); c.end(); });