import { pgTable, serial, text, numeric, timestamp, char, pgEnum } from 'drizzle-orm/pg-core';

export const wasteTypeEnum = pgEnum('waste_type', [
  'organic',
  'recyclable',
  'hazardous',
  'residual/non-recyclable',
  'specialty/other'
]);

export const dropoffs = pgTable('dropoffs', {
  id: serial('id').primaryKey(),
  tpsName: text('tps_name').notNull(),
  sourceName: text('source_name').notNull(),
  wasteType: wasteTypeEnum('waste_type').notNull(),
  otherWasteDetails: text('other_waste_details'),
  weightKg: numeric('weight_kg').notNull(),
  rowStatus: char('row_status', { length: 1 }).default('1').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  // Soft-delete audit trail: null = active record, timestamp = deleted record
  deletedAt: timestamp('deleted_at'),
  // Geographic coordinates — stored per-record so the map requires no static registry.
  // Nullable for backwards compatibility with records inserted before this column was added.
  longitude: numeric('longitude'),
  latitude: numeric('latitude'),
});
