'use client';

/**
 * @file apps/web/src/components/MapClient.tsx
 * @description Client Component — interactive map using mapcn (shadcn/ui map extension).
 * Imports <Map>, <MapMarker>, <MarkerContent>, <MarkerLabel>, <MarkerPopup>,
 * and <MapControls> from the locally-owned @/components/ui/map component.
 *
 * Architecture boundary (enforced):
 *   Server Component (app/page.tsx)
 *     → getDashboardPayload()  [lib/tps-data.ts — server-only]
 *     → <MapClient payload={payload} />  ← YOU ARE HERE ("use client")
 */

import {
  Map, type MapViewport, type MapRef,
  MapControls,
  MapMarker,
  MarkerContent,
  MarkerLabel,
  MarkerPopup,
} from '@/components/ui/map';
import type { DashboardPayload, TpsLocationSummary } from '@/lib/tps-data';
import { useEffect, useRef, useState } from 'react';
import { fetchDynamicWeather } from '@/actions/weather-actions';

// Palangkaraya city centre — initial map viewport [Lng, Lat]
const PALANGKARAYA_LNG = 113.916;
const PALANGKARAYA_LAT = -2.2083;


// ---------------------------------------------------------------------------
// Capacity → Tailwind colour classes (matches UI/UX spec: green/yellow/red)
// ---------------------------------------------------------------------------
const CAPACITY_DOT_CLASS: Record<TpsLocationSummary['capacityStatus'], string> = {
  normal:   'bg-green-500',
  high:     'bg-yellow-400',
  critical: 'bg-red-500',
};

const CAPACITY_RING_CLASS: Record<TpsLocationSummary['capacityStatus'], string> = {
  normal:   'ring-green-300',
  high:     'ring-yellow-300',
  critical: 'ring-red-400',
};

const CAPACITY_TEXT_CLASS: Record<TpsLocationSummary['capacityStatus'], string> = {
  normal:   'text-green-700',
  high:     'text-yellow-700',
  critical: 'text-red-700',
};

const CAPACITY_LABEL: Record<TpsLocationSummary['capacityStatus'], string> = {
  normal:   'Normal',
  high:     'High ⚠️',
  critical: 'Critical 🔴',
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface MapClientProps {
  payload: DashboardPayload;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function MapClient({ payload }: MapClientProps) {
  const { tpsLocations, weather: initialWeather } = payload;
  const [localWeather, setLocalWeather] = useState(initialWeather);

  const styles = {
    default: undefined,
    openstreetmap: "https://tiles.openfreemap.org/styles/bright",
    openstreetmap3d: "https://tiles.openfreemap.org/styles/liberty",
  };

  type StyleKey = keyof typeof styles;

  const mapRef = useRef<MapRef>(null);
  const [style, setStyle] = useState<StyleKey>("default");
  const selectedStyle = styles[style];
  const is3D = style === "openstreetmap3d";

  useEffect(() => {
    mapRef.current?.easeTo({ pitch: is3D ? 60 : 0, duration: 500 });
  }, [is3D]);

  const [viewport, setViewport] = useState<MapViewport>({
    center: [PALANGKARAYA_LNG, PALANGKARAYA_LAT],
    zoom: 12,
    bearing: 0,
    pitch: 0,
  });

  useEffect(() => {
    // Debounce the API call by 1000ms after the viewport center stops changing
    const timer = setTimeout(async () => {
      const [lng, lat] = viewport.center;
      const newWeather = await fetchDynamicWeather(lat, lng);
      if (newWeather) {
        setLocalWeather(newWeather);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [viewport.center]);


  return (
    <div className="flex flex-col h-screen font-sans">

      {/* ─── Weather Warning Banner ────────────────────────────────────────
          Displayed prominently when hasWeatherWarning is true.
          Intentionally uses a bold red to ensure it cannot be missed.
      ─────────────────────────────────────────────────────────────────── */}
      {localWeather.hasWeatherWarning && (
        <div className="flex items-center gap-3 bg-red-900 text-red-50 px-5 py-3 text-sm font-semibold z-20">
          <span className="text-xl shrink-0">⚠️</span>
          <span>
            WEATHER ALERT — Location: {localWeather.weather_label}.{' '}
            Rainfall: {localWeather.rain.toFixed(1)} mm. Verify TPS routes before dispatching.
          </span>
        </div>
      )}

      {/* ─── Header ───────────────────────────────────────────────────────── */}
      <div className="flex justify-between items-center bg-green-900 text-white px-5 py-3 z-10 shrink-0">
        <div>
          <h1 className="text-lg font-bold leading-tight">
            🗺️ Eco-Log — Smart TPS Dashboard
          </h1>
          <p className="text-xs text-green-200 mt-0.5">Palangkaraya, Kalimantan Tengah</p>
        </div>
        <div className="text-right">
          <div className="text-xl font-semibold">{localWeather.weather_label}</div>
          <div className="text-2xl font-bold">{localWeather.temperature_2m.toFixed(1)}°C</div>
          <div className="text-[11px] text-green-300">
            Feels {localWeather.apparent_temperature.toFixed(1)}°C · Wind {localWeather.wind_speed_10m.toFixed(0)} km/h
          </div>
        </div>
      </div>

      {/* ─── Map area ─────────────────────────────────────────────────────── */}
      <div className="relative flex-1 overflow-hidden">

        {/* ── Capacity legend ─────────────────────────────────────────────── */}
        <div className="absolute top-3 left-3 z-10 bg-white/95 rounded-lg shadow-md px-4 py-3 text-sm">
          <p className="font-bold mb-2 text-gray-800">TPS Capacity</p>
          {(Object.entries(CAPACITY_DOT_CLASS) as [TpsLocationSummary['capacityStatus'], string][]).map(
            ([status, dotClass]) => (
              <div key={status} className="flex items-center gap-2 mb-1">
                <div className={`size-3 rounded-full border-2 border-white shadow-sm ${dotClass}`} />
                <span className="text-gray-700">{CAPACITY_LABEL[status]}</span>
              </div>
            )
          )}
          <p className="text-[11px] text-gray-400 mt-2 border-t border-gray-100 pt-2">
            {tpsLocations.length} active site{tpsLocations.length !== 1 ? 's' : ''} · Click marker for details
          </p>
        </div>

        {/* ── mapcn <Map> component ───────────────────────────────────────── */}
        <Map
          className="w-full h-full"
          ref={mapRef}
          viewport={viewport}
          onViewportChange={setViewport}
          styles={
            selectedStyle ?  {light: selectedStyle, dark: selectedStyle} : undefined
          }
        >
          {/* ── Map Controls (zoom + compass) ──────────────────────────── */}
          <MapControls position="bottom-right" showZoom showCompass />

          {/* ── TPS Markers ────────────────────────────────────────────── */}
          {tpsLocations.map((tps) => {
            // Coordinates come from the DB — skip records with no location data
            if (tps.longitude == null || tps.latitude == null) return null;

            return (
              <MapMarker key={tps.tpsName} longitude={tps.longitude} latitude={tps.latitude}>
                {/* Marker visual — coloured dot with ring */}
                <MarkerContent>
                  <div
                    className={[
                      'size-4 rounded-full border-2 border-white shadow-md',
                      'ring-2 ring-offset-1 cursor-pointer',
                      CAPACITY_DOT_CLASS[tps.capacityStatus],
                      CAPACITY_RING_CLASS[tps.capacityStatus],
                    ].join(' ')}
                  />
                </MarkerContent>

                {/* Hover label — TPS name above the marker */}
                <MarkerLabel position="top">
                  <span className="bg-white/90 text-gray-800 text-[10px] font-medium px-1.5 py-0.5 rounded shadow-sm">
                    {tps.tpsName}
                  </span>
                </MarkerLabel>

                {/* Click popup — full TPS summary */}
                <MarkerPopup closeButton>
                  <div className="min-w-[220px] font-sans">
                    <h3 className="font-bold text-sm mb-2">{tps.tpsName}</h3>
                    <table className="w-full text-xs border-collapse">
                      <tbody>
                        <tr>
                          <td className="py-0.5 text-gray-500 pr-3">Status</td>
                          <td className={`py-0.5 font-semibold ${CAPACITY_TEXT_CLASS[tps.capacityStatus]}`}>
                            {CAPACITY_LABEL[tps.capacityStatus]}
                          </td>
                        </tr>
                        <tr>
                          <td className="py-0.5 text-gray-500 pr-3">Total Weight</td>
                          <td className="py-0.5 font-semibold">
                            {tps.totalWeightKg.toFixed(1)} kg
                          </td>
                        </tr>
                        <tr>
                          <td className="py-0.5 text-gray-500 pr-3">Drop-offs</td>
                          <td className="py-0.5">{tps.dropoffCount} entries</td>
                        </tr>
                        <tr>
                          <td className="py-0.5 text-gray-500 pr-3">Last Drop-off</td>
                          <td className="py-0.5">
                            {new Date(tps.lastDropoffAt).toLocaleString('id-ID', {
                              timeZone: 'Asia/Jakarta',
                            })}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </MarkerPopup>
              </MapMarker>
            );
          })}
        </Map>
        <div className="absolute top-8 right-2 z-10">
          <select
            value={style}
            onChange={(e) => setStyle(e.target.value as StyleKey)}
            className="bg-background text-foreground border rounded-md px-2 py-1 text-sm shadow"
          >
            <option value="default">Default (Carto)</option>
            <option value="openstreetmap">OpenStreetMap</option>
            <option value="openstreetmap3d">OpenStreetMap 3D</option>
          </select>
        </div>
        
        <div className="absolute bottom-3 right-10 z-10 flex flex-wrap gap-x-3 gap-y-1 text-xs font-mono bg-background/80 backdrop-blur px-2 py-1.5 rounded border">
          <span>
            <span className="text-muted-foreground">lng:</span>{" "}
            {viewport.center[0].toFixed(3)}
          </span>
          <span>
            <span className="text-muted-foreground">lat:</span>{" "}
            {viewport.center[1].toFixed(3)}
          </span>
          <span>
            <span className="text-muted-foreground">zoom:</span>{" "}
            {viewport.zoom.toFixed(1)}
          </span>
          <span>
            <span className="text-muted-foreground">bearing:</span>{" "}
            {viewport.bearing.toFixed(1)}°
          </span>
          <span>
            <span className="text-muted-foreground">pitch:</span>{" "}
            {viewport.pitch.toFixed(1)}°
          </span>
        </div>
      </div>

      {/* ─── Footer status bar ────────────────────────────────────────────── */}
      <div className="flex justify-between items-center bg-gray-50 border-t border-gray-200 px-5 py-1.5 text-[11px] text-gray-400 shrink-0">
        <span>
          Data as of{' '}
          {new Date(payload.generatedAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB
        </span>
        <span>
          Precipitation: {localWeather.precipitation.toFixed(1)} mm · Rain: {localWeather.rain.toFixed(1)} mm
        </span>
      </div>
    </div>
  );
}
