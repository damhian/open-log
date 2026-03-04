import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';

// The ! indicates that we assert DATABASE_URL is provided in .env.local
const connectionString = process.env.DATABASE_URL || 'postgresql://dummy:dummy@localhost/dummy';

const sql = neon(connectionString);
export const db = drizzle({ client: sql });
