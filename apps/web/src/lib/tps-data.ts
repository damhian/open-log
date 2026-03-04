/**
 * @file src/lib/tps-data.ts
 * @description Server-side orchestration layer for Phase 3.
 * Fetches active drop-off records via the DAL, groups them by TPS location,
 * merges in live weather data, and returns a single unified payload to
 * Server Components. This file MUST remain server-only.
 */

import { getActiveDropoffs } from '@/db/queries/dropoffs';
import { getPalangkarayaWeather, type WeatherData } from '@/lib/weather';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Aggregated data for a single TPS (Tempat Pembuangan Sampah) location.
 * Calculated by summing all active drop-off records for that location.
 */
export type TpsLocationSummary = {
  /** The name of the TPS site */
  tpsName: string;
  /** Total weight of all active (non-archived) drop-offs in kg */
  totalWeightKg: number;
  /** Number of active drop-off entries logged at this TPS */
  dropoffCount: number;
  /**
   * Capacity status derived from totalWeightKg.
   * Thresholds are intentionally kept simple for the MVP:
   * - 'normal'   : < 1000 kg
   * - 'high'     : 1000–1999 kg  → amber warning on map marker
   * - 'critical' : >= 2000 kg    → red warning on map marker
   */
  capacityStatus: 'normal' | 'high' | 'critical';
  /** The most recent drop-off timestamp at this location */
  lastDropoffAt: Date;
  /**
   * Geographic coordinates sourced directly from the database.
   * Null for records inserted before the longitude/latitude columns were added.
   * MapClient skips rendering a marker when either value is null.
   */
  longitude: number | null;
  latitude: number | null;
};

/**
 * The unified payload passed from a Server Component down to Client Components.
 * Contains both the aggregated TPS data and the live weather for Palangkaraya.
 */
export type DashboardPayload = {
  tpsLocations: TpsLocationSummary[];
  weather: WeatherData;
  /** ISO timestamp of when this payload was assembled on the server */
  generatedAt: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function deriveCapacityStatus(
  totalWeightKg: number
): TpsLocationSummary['capacityStatus'] {
  if (totalWeightKg >= 2000) return 'critical';
  if (totalWeightKg >= 1000) return 'high';
  return 'normal';
}

// ---------------------------------------------------------------------------
// Main orchestration function — SERVER ONLY
// ---------------------------------------------------------------------------

/**
 * Assembles the full dashboard payload for a Server Component.
 *
 * Execution order (both are fired in parallel via Promise.all for speed):
 *   1. `getActiveDropoffs()`   → DAL query; returns only rowStatus='1' records
 *   2. `getPalangkarayaWeather()` → Open-Meteo API fetch with cache: 'no-store'
 *
 * The results are then merged: drop-offs are grouped by `tpsName` to compute
 * per-location capacity, and the shared weather data is attached to the root.
 *
 * @example
 * // In a Server Component (e.g., app/page.tsx):
 * const payload = await getDashboardPayload();
 * return <MapClient tpsLocations={payload.tpsLocations} weather={payload.weather} />;
 */
export async function getDashboardPayload(): Promise<DashboardPayload> {
  // Fire both async operations in parallel — no dependency between them
  const [activeDropoffs, weather] = await Promise.all([
    getActiveDropoffs(),
    getPalangkarayaWeather(),
  ]);

  // Group drop-offs by tpsName to build per-location summaries
  const locationMap = new Map<string, TpsLocationSummary>();

  for (const record of activeDropoffs) {
    const existing = locationMap.get(record.tpsName);
    // weightKg is returned as a string by Drizzle (numeric column) — parse it
    const weight = parseFloat(record.weightKg ?? '0');

    if (existing) {
      existing.totalWeightKg += weight;
      existing.dropoffCount += 1;
      // Keep the most recent drop-off timestamp
      if (record.createdAt > existing.lastDropoffAt) {
        existing.lastDropoffAt = record.createdAt;
      }
      // Recalculate status now that weight has changed
      existing.capacityStatus = deriveCapacityStatus(existing.totalWeightKg);
      // Backfill coords from a later record if the first one had null coords
      if (existing.longitude === null && record.longitude != null) {
        existing.longitude = parseFloat(record.longitude);
        existing.latitude = record.latitude != null ? parseFloat(record.latitude) : null;
      }
    } else {
      locationMap.set(record.tpsName, {
        tpsName: record.tpsName,
        totalWeightKg: weight,
        dropoffCount: 1,
        capacityStatus: deriveCapacityStatus(weight),
        lastDropoffAt: record.createdAt,
        // Drizzle returns numeric columns as strings — parse to number
        longitude: record.longitude != null ? parseFloat(record.longitude) : null,
        latitude: record.latitude != null ? parseFloat(record.latitude) : null,
      });
    }
  }

  // Convert Map → sorted array (highest weight first, so critical sites appear first)
  const tpsLocations = Array.from(locationMap.values()).sort(
    (a, b) => b.totalWeightKg - a.totalWeightKg
  );

  return {
    tpsLocations,
    weather,
    generatedAt: new Date().toISOString(),
  };
}
