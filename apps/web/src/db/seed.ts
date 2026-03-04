/**
 * @file apps/web/src/db/seed.ts
 * @description One-shot seed script — inserts 50 realistic dummy drop-off
 * records across 20 Palangkaraya TPS locations.
 * Coordinates are stored per-record in the longitude/latitude columns so the
 * map requires no static registry — they flow through the payload automatically.
 *
 * Run from the apps/web directory:
 *   bun --env-file=.env.local src/db/seed.ts
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { dropoffs } from './schema.js';

// ---------------------------------------------------------------------------
// DB connection (inline — avoids @/ alias issues outside Next.js)
// ---------------------------------------------------------------------------
const sql = neon(process.env.DATABASE_URL!);
const db = drizzle({ client: sql });

// ---------------------------------------------------------------------------
// Coordinate helper
// Palangkaraya urban bounding box:
//   Longitude: 113.8800 → 113.9500
//   Latitude:  -2.2400  → -2.1800
// ---------------------------------------------------------------------------
function randomCoord(): { lng: number; lat: number } {
  const lng = 113.88 + Math.random() * (113.95 - 113.88);
  const lat = -2.24 + Math.random() * (-2.18 - -2.24);
  return {
    lng: parseFloat(lng.toFixed(4)),
    lat: parseFloat(lat.toFixed(4)),
  };
}

// ---------------------------------------------------------------------------
// 20 realistic Palangkaraya TPS names (named after city streets & landmarks)
// ---------------------------------------------------------------------------
const TPS_NAMES = [
  'TPS Tjilik Riwut',
  'TPS Yos Sudarso',
  'TPS Rajawali',
  'TPS Diponegoro',
  'TPS Imam Bonjol',
  'TPS Adonis Samad',
  'TPS S. Parman',
  'TPS RTA Milono',
  'TPS Halmahera',
  'TPS G. Obos',
  'TPS Tambun Bungai',
  'TPS Nusa Indah',
  'TPS Mahir Mahar',
  'TPS Damang Batu',
  'TPS Pierre Tendean',
  'TPS Ahmad Yani',
  'TPS Flores',
  'TPS Sulawesi',
  'TPS Mendawai',
  'TPS Panarung',
] as const;

// Each TPS gets a stable coordinate for the duration of the seed run.
// These are stored directly in the dropoffs rows — no static registry needed in MapClient.tsx.
const TPS_COORDINATES: Record<string, [number, number]> = {};
for (const name of TPS_NAMES) {
  const { lng, lat } = randomCoord();
  TPS_COORDINATES[name] = [lng, lat];
}


// ---------------------------------------------------------------------------
// Waste-type pool
// ---------------------------------------------------------------------------
const WASTE_TYPES = [
  'organic',
  'recyclable',
  'hazardous',
  'residual/non-recyclable',
  'specialty/other',
] as const;

// ---------------------------------------------------------------------------
// Realistic source organisation names in Palangkaraya
// ---------------------------------------------------------------------------
const SOURCE_NAMES = [
  'Kelurahan Pahandut',
  'Kelurahan Jekan Raya',
  'Pasar Besar Palangkaraya',
  'RS Doris Sylvanus',
  'Hotel Dandang Tingang',
  'Universitas Palangkaraya',
  'Mal Palangkaraya',
  'PT Borneo Indah',
  'Kantor Gubernur Kalimantan Tengah',
  'Perumahan Griya Asri',
  'RSUD dr. Murjani',
  'PT Citra Kalimantan',
  'Pasar Kahayan',
  'SD Negeri 2 Palangkaraya',
  'Pertokoan Jalan Yos Sudarso',
  'Kelurahan Bukit Tunggal',
  'PT Agro Nusantara',
  'Kecamatan Sebangau',
  'Puskesmas Panarung',
  'Perumahan Bukit Batu Indah',
];

// ---------------------------------------------------------------------------
// Weight distribution — designed to produce a realistic mix of statuses
// when 50 records are grouped across 20 TPS names (~2–3 records each):
//
//  TPS receiving light records (80–350 kg): likely 'normal' (<1000 kg total)
//  TPS receiving medium records (300–600 kg): likely 'high' (1000–1999 kg)
//  TPS receiving heavy records (500–900 kg): likely 'critical' (≥2000 kg)
//
// We bias the heavy records to cluster on a few TPS names, giving us a
// realistic spread of all three capacity statuses on the map.
// ---------------------------------------------------------------------------

// Assign each TPS a weight "tier" so the resulting totals are varied:
type Tier = 'light' | 'medium' | 'heavy';
const TPS_TIER: Record<string, Tier> = {};
const shuffled = [...TPS_NAMES].sort(() => Math.random() - 0.5);

// 7 critical (heavy), 7 high (medium), 6 normal (light)
shuffled.slice(0, 7).forEach((n) => (TPS_TIER[n] = 'heavy'));
shuffled.slice(7, 14).forEach((n) => (TPS_TIER[n] = 'medium'));
shuffled.slice(14).forEach((n) => (TPS_TIER[n] = 'light'));

function randomWeight(tier: Tier): string {
  let kg: number;
  switch (tier) {
    case 'heavy':
      // 500–900 kg per entry; 3+ records → likely ≥2000 kg total
      kg = 500 + Math.random() * 400;
      break;
    case 'medium':
      // 250–550 kg per entry; 2–3 records → 500–1650 kg total
      kg = 250 + Math.random() * 300;
      break;
    case 'light':
    default:
      // 50–300 kg per entry; 1–3 records → mostly <1000 kg total
      kg = 50 + Math.random() * 250;
      break;
  }
  return kg.toFixed(2);
}

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

// ---------------------------------------------------------------------------
// Generate 50 records
// Strategy: allocate at least 1 record per TPS, then distribute the rest
// randomly with heavier weighting toward heavy-tier TPS.
// ---------------------------------------------------------------------------
type NewRecord = {
  tpsName: string;
  sourceName: string;
  wasteType: (typeof WASTE_TYPES)[number];
  otherWasteDetails: string | null;
  weightKg: string;
  longitude: string; // Drizzle numeric columns expect string input
  latitude: string;
};

const records: NewRecord[] = [];

// Phase 1: guarantee at least 2 records for every TPS
for (const name of TPS_NAMES) {
  const tier = TPS_TIER[name]!;
  const [lng, lat] = TPS_COORDINATES[name]!;
  for (let i = 0; i < 2; i++) {
    const wasteType = pick(WASTE_TYPES);
    records.push({
      tpsName: name,
      sourceName: pick(SOURCE_NAMES),
      wasteType,
      otherWasteDetails:
        wasteType === 'specialty/other'
          ? 'Electronic waste / mixed construction debris'
          : null,
      weightKg: randomWeight(tier),
      longitude: lng.toString(),
      latitude: lat.toString(),
    });
  }
}

// Phase 2: distribute 10 extra records, biased toward heavy-tier TPS
const heavyTps = shuffled.slice(0, 7);
const extraTargets = [...heavyTps, ...heavyTps, pick(shuffled.slice(7, 14))];
for (let i = 0; i < 10; i++) {
  const name = extraTargets[i % extraTargets.length]!;
  const tier = TPS_TIER[name]!;
  const [lng, lat] = TPS_COORDINATES[name]!;
  const wasteType = pick(WASTE_TYPES);
  records.push({
    tpsName: name,
    sourceName: pick(SOURCE_NAMES),
    wasteType,
    otherWasteDetails:
      wasteType === 'specialty/other'
        ? 'Electronic waste / mixed construction debris'
        : null,
    weightKg: randomWeight(tier),
    longitude: lng.toString(),
    latitude: lat.toString(),
  });
}

// Shuffle the final record list so insertion order is random
records.sort(() => Math.random() - 0.5);

// ---------------------------------------------------------------------------
// Insert into Neon PostgreSQL
// ---------------------------------------------------------------------------
async function seed() {
  console.log(`Inserting ${records.length} records into the dropoffs table…\n`);

  try {
    await db.insert(dropoffs).values(records);
    console.log(`✅ Successfully seeded ${records.length} drop-off records.\n`);
  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  }

  // Print capacity preview grouped by TPS
  const grouped: Record<string, number> = {};
  for (const r of records) {
    grouped[r.tpsName] = (grouped[r.tpsName] ?? 0) + parseFloat(r.weightKg);
  }

  console.log('── Capacity preview (what the map should show) ────────────');
  const sorted = Object.entries(grouped).sort(([, a], [, b]) => b - a);
  for (const [name, total] of sorted) {
    const status =
      total >= 2000 ? '🔴 CRITICAL' : total >= 1000 ? '🟡 HIGH' : '🟢 NORMAL';
    console.log(`  ${status.padEnd(14)} ${name.padEnd(26)} ${total.toFixed(1).padStart(8)} kg`);
  }
  console.log('────────────────────────────────────────────────────────────\n');
}

seed();
