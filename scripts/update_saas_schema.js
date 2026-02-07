/**
 * Atualização SaaS Schema
 * - contacts
 * - conversations (extensão, sem quebrar legado)
 * - messages (FK conversation_id)
 */

const { Client } = require('pg');

(async () => {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  await client.connect();

  console.log('🔧 Applying SaaS schema updates...');

  // CONTACTS
  await client.query(`
    CREATE TABLE IF NOT EXISTS contacts (
      id SERIAL PRIMARY KEY,
      company_id INTEGER NOT NULL,
      phone VARCHAR(20) NOT NULL,
      name VARCHAR(255),
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE (company_id, phone)
    );
  `);

  // CONVERSATIONS (não destrutivo)
  await client.query(`
    ALTER TABLE conversations
      ADD COLUMN IF NOT EXISTS company_id INTEGER,
      ADD COLUMN IF NOT EXISTS contact_id INTEGER,
      ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'open',
      ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMP;
  `);

  // MESSAGES
  await client.query(`
    ALTER TABLE messages
      ADD COLUMN IF NOT EXISTS conversation_id INTEGER;
  `);

  console.log('✅ SaaS schema updated successfully');
  await client.end();
})();

