import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const migrationsDir = path.join(__dirname, "../migrations");

// Adjust DB_URL for local host execution if needed
let dbUrl = process.env.DB_URL;
if (dbUrl && dbUrl.includes("whatsapp-postgres")) {
  console.log("🔄 Detected Docker internal hostname, switching to localhost for host execution...");
  dbUrl = dbUrl.replace("whatsapp-postgres", "localhost");
}

const pool = new Pool({
  connectionString: dbUrl,
});

async function runMigrations() {
  console.log("📦 Iniciando migrações...");
  console.log("📂 Diretório:", migrationsDir);
  console.log("🔗 DB URL:", dbUrl);

  try {
    const files = fs
      .readdirSync(migrationsDir)
      .filter(file => file.endsWith(".sql"))
      .sort();

    for (const file of files) {
      console.log(`➡️ Executando ${file}`);
      const sql = fs.readFileSync(
        path.join(migrationsDir, file),
        "utf8"
      );
      await pool.query(sql);
    }

    console.log("✅ Migrações concluídas");
    process.exit(0);
  } catch (err) {
    console.error("❌ Erro nas migrações:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigrations();

