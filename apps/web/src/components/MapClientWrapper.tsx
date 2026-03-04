'use client';

/**
 * @file apps/web/src/components/MapClientWrapper.tsx
 * @description Thin Client Component wrapper that handles the dynamic import of
 * MapClient with ssr:false.
 *
 * WHY THIS FILE EXISTS:
 * In Next.js App Router, `dynamic(() => ..., { ssr: false })` MUST be called
 * inside a Client Component. Calling it directly in a Server Component (like
 * app/page.tsx) causes a Turbopack build error. This wrapper owns the dynamic
 * call so the Server Component stays clean.
 */

import dynamic from 'next/dynamic';
import type { DashboardPayload } from '@/lib/tps-data';

// ssr: false prevents MapLibre GL JS (a browser-only library) from running
// during server-side rendering, which would throw window/document errors.
const MapClient = dynamic(() => import('@/components/MapClient'), {
  ssr: false,
  loading: () => (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        flexDirection: 'column',
        gap: '16px',
        fontFamily: 'system-ui, sans-serif',
        backgroundColor: '#f9fafb',
        color: '#6b7280',
      }}
    >
      <div style={{ fontSize: '40px' }}>🗺️</div>
      <div style={{ fontSize: '16px', fontWeight: '600' }}>Loading Eco-Log Dashboard…</div>
      <div style={{ fontSize: '13px' }}>Fetching TPS locations and live weather</div>
    </div>
  ),
});

interface MapClientWrapperProps {
  payload: DashboardPayload;
}

export default function MapClientWrapper({ payload }: MapClientWrapperProps) {
  return <MapClient payload={payload} />;
}
