const { Pool } = require('pg');

async function createRecurringTaskTable() {
  const pool = new Pool({
    connectionString: 'postgresql://neondb_owner:npg_kcE2bSsPK8or@ep-floral-king-a149zf0s-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=verify-full&channel_binding=require'
  });

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "RecurringTask" (
        "id" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "title" TEXT NOT NULL,
        "category" TEXT NOT NULL,
        "defaultDuration" INTEGER NOT NULL,
        "daysOfWeek" INTEGER[] NOT NULL,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('✅ RecurringTask table created successfully');
  } catch (error) {
    console.error('❌ Error creating RecurringTask table:', error);
  } finally {
    await pool.end();
  }
}

createRecurringTaskTable();
