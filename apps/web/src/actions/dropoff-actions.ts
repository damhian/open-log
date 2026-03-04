'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { dropoffs } from '@/db/schema';

// ---------------------------------------------------------------------------
// Server Actions — Dropoff Mutations
// All database mutations are performed server-side only.
// These actions revalidate the relevant cache path after each mutation
// so the UI reflects changes immediately without a full page reload.
// ---------------------------------------------------------------------------

export type NewDropoffInput = {
  tpsName: string;
  sourceName: string;
  wasteType:
    | 'organic'
    | 'recyclable'
    | 'hazardous'
    | 'residual/non-recyclable'
    | 'specialty/other';
  otherWasteDetails?: string;
  weightKg: string; // numeric columns in Drizzle/Neon are passed as strings
};

/**
 * Server Action: Log a new waste drop-off record.
 * Inserts a new active record (rowStatus defaults to '1' in the schema).
 */
export async function createDropoff(input: NewDropoffInput) {
  await db.insert(dropoffs).values({
    tpsName: input.tpsName,
    sourceName: input.sourceName,
    wasteType: input.wasteType,
    otherWasteDetails: input.otherWasteDetails ?? null,
    weightKg: input.weightKg,
    // rowStatus defaults to '1' (active) — no need to set it explicitly
  });

  // Revalidate the dashboard route so the new record appears immediately
  revalidatePath('/');
}

/**
 * Server Action: Soft-delete a drop-off record by ID.
 * Sets rowStatus to '0' and stamps deletedAt with the current timestamp.
 * The original record is NEVER removed from the database (strict audit trail).
 */
export async function softDeleteDropoff(id: number) {
  const now = new Date();

  await db
    .update(dropoffs)
    .set({
      rowStatus: '0',
      deletedAt: now,
      updatedAt: now,
    })
    .where(eq(dropoffs.id, id));

  // Revalidate so the archived record disappears from the UI immediately
  revalidatePath('/');
}
