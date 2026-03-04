import { db } from './index';
import { sql } from 'drizzle-orm';

async function main() {
  try {
    console.log("Testing database connection...");
    const result = await db.execute(sql`SELECT 1 as test_success`);
    console.log("Connection successful! Drizzle DB is connected.", result);
  } catch (error) {
    console.error("Connection failed:", error);
  }
}

main();
