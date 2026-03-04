import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';

// The ! indicates that we assert DATABASE_URL is provided in .env.local
const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle({ client: sql });
