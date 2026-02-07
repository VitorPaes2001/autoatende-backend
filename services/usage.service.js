const db = require('../src/db/pool');

class UsageService {
  async ensureRow(companyId) {
    await db.query(
      `
      INSERT INTO usage_counters (company_id)
      VALUES ($1)
      ON CONFLICT (company_id) DO NOTHING
      `,
      [companyId]
    );
  }

  async incrementConversation(companyId) {
    await this.ensureRow(companyId);

    const { rows } = await db.query(
      `
      UPDATE usage_counters
      SET conversations_used = conversations_used + 1,
          updated_at = NOW()
      WHERE company_id = $1
      RETURNING conversations_used
      `,
      [companyId]
    );

    return rows[0].conversations_used;
  }
}

module.exports = new UsageService();

