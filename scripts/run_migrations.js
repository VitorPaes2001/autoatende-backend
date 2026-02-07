import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pool from "../src/db/pool.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const migrationsDir = path.join(__dirname, "../migrations");

async function runMigrations() {
  console.log("📦 Iniciando migrações...");
  console.log("📂 Diretório:", migrationsDir);

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
}

runMigrations().catch(err => {
  console.error("❌ Erro nas migrações:", err);
  process.exit(1);
});

