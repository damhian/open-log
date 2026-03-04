import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { dropoffs } from '@/db/schema';

// ---------------------------------------------------------------------------
// Repository Pattern — Data Access Layer
// All read functions MUST filter by rowStatus = '1' (active records only).
// Soft-deleted records (rowStatus = '0') are NEVER returned to the UI.
// ---------------------------------------------------------------------------

/**
 * Fetches all active (non-archived) drop-off records.
 * Archived records (rowStatus = '0') are excluded by design.
 */
export async function getActiveDropoffs() {
  return db
    .select()
    .from(dropoffs)
    .where(eq(dropoffs.rowStatus, '1'))
    .orderBy(dropoffs.createdAt);
}

/**
 * Fetches a single active drop-off record by its ID.
 * Returns `undefined` if the record does not exist or has been soft-deleted.
 */
export async function getActiveDropoffById(id: number) {
  const [record] = await db
    .select()
    .from(dropoffs)
    .where(eq(dropoffs.id, id))
    // Even for a by-ID lookup, enforce the active filter to prevent
    // accidentally exposing soft-deleted records through direct ID access.
    .limit(1);

  // Only return the record if it is active
  if (!record || record.rowStatus !== '1') return undefined;
  return record;
}
