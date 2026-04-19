/**
 * PostgreSQL connection via pg.
 * On EC2 the DB_* env vars are populated by the deploy script from Secrets Manager.
 * Locally you can set them in .env or leave them unset (the app works without DB).
 */
const { Pool } = require("pg");

let pool = null;

function getPool() {
  if (!pool && process.env.DB_HOST) {
    pool = new Pool({
      host:     process.env.DB_HOST,
      port:     parseInt(process.env.DB_PORT || "5432"),
      database: process.env.DB_NAME || "ailearning",
      user:     process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      ssl:      { rejectUnauthorized: false },
      max: 5,
    });
    pool.on("error", (err) => console.error("PG pool error:", err.message));
  }
  return pool;
}

/** Run once at startup to create the files table if it doesn't exist. */
async function initDb() {
  const p = getPool();
  if (!p) return;
  await p.query(`
    CREATE TABLE IF NOT EXISTS uploaded_files (
      id          SERIAL PRIMARY KEY,
      s3_key      TEXT        NOT NULL UNIQUE,
      name        TEXT        NOT NULL,
      size        BIGINT      NOT NULL,
      mime_type   TEXT,
      uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  console.log("DB: table ready");
}

/** Insert a file record. Silently skips if DB is not configured. */
async function insertFile({ key, name, size, mimeType }) {
  const p = getPool();
  if (!p) return;
  await p.query(
    `INSERT INTO uploaded_files (s3_key, name, size, mime_type)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (s3_key) DO NOTHING`,
    [key, name, size, mimeType]
  );
}

/** Delete a file record by S3 key. */
async function deleteFile(key) {
  const p = getPool();
  if (!p) return;
  await p.query("DELETE FROM uploaded_files WHERE s3_key = $1", [key]);
}

/** List all file records ordered by upload time desc. */
async function listFiles() {
  const p = getPool();
  if (!p) return null;
  const { rows } = await p.query(
    "SELECT s3_key AS key, name, size, mime_type AS \"mimeType\", uploaded_at AS \"uploadedAt\" FROM uploaded_files ORDER BY uploaded_at DESC"
  );
  return rows;
}

module.exports = { initDb, insertFile, deleteFile, listFiles };
