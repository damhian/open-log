/**
 * @file apps/web/app/page.tsx
 * @description Root Server Component — fetches the unified dashboard payload
 * server-side and passes it to the Client Component tree.
 *
 * Architecture rules enforced here:
 * - NO "use client" directive.
 * - NO direct use of `dynamic()` — that lives in MapClientWrapper.tsx (Client Component).
 * - All data fetching is server-side via getDashboardPayload().
 */

import type { Metadata } from 'next';
import MapClientWrapper from '../src/components/MapClientWrapper';
import { getDashboardPayload, type DashboardPayload } from '../src/lib/tps-data';

export const metadata: Metadata = {
  title: 'Eco-Log — Smart TPS Dashboard | Palangkaraya',
  description:
    'Real-time waste drop-off monitoring and TPS capacity dashboard for Palangkaraya, Kalimantan Tengah.',
};

export default async function HomePage() {
  let payload: DashboardPayload;

  try {
    payload = await getDashboardPayload();
  } catch (error) {
    console.error('[HomePage] getDashboardPayload failed:', error);
    return (
      <main className="flex flex-col items-center justify-center h-screen gap-3 font-sans text-center p-5">
        <div className="text-[48px]">⚠️</div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
          Dashboard Unavailable
        </h1>
        <p className="text-gray-500 dark:text-gray-400 max-w-[400px]">
          Could not load TPS data or weather information. Please check your
          database connection and try again.
        </p>
      </main>
    );
  }

  return (
    <main className="h-screen overflow-hidden">
      {/*
        MapClientWrapper ("use client") owns the dynamic import with ssr:false.
        The payload is serialised and passed as a prop to the client tree.
      */}
      <MapClientWrapper payload={payload} />
    </main>
  );
}
