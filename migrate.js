const { Client } = require("pg");
const client = new Client({
  connectionString: "postgresql://neondb_owner:npg_LF2O8sAhyzCp@ep-falling-cake-amnvoxzu-pooler.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require"
});
async function run() {
  await client.connect();
  await client.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type VARCHAR(48) NOT NULL,
      title TEXT NOT NULL,
      body TEXT,
      link VARCHAR(255),
      is_read BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS notifications_user_unread_idx 
    ON notifications(user_id, is_read, created_at)
  `);
  console.log("Tabla notifications creada exitosamente");
  await client.end();
}
run().catch(e => { console.error(e.message); process.exit(1); });