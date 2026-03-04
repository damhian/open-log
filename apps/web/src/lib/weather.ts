/**
 * @file src/lib/weather.ts
 * @description Server-side utility for fetching real-time weather data from
 * the free Open-Meteo API. This file must NEVER be imported inside a
 * Client Component or a file marked `"use client"`.
 *
 * Palangkaraya coordinates: Lat -2.2083, Lng 113.9160
 * Open-Meteo docs: https://open-meteo.com/en/docs
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WeatherData = {
  /** Temperature at 2m height in degrees Celsius */
  temperature_2m: number;
  /** Apparent (feels-like) temperature in degrees Celsius */
  apparent_temperature: number;
  /** Current precipitation in mm (rain + showers + snowfall) */
  precipitation: number;
  /** Rain specifically (mm) — useful for flood/waste overflow warnings */
  rain: number;
  /** Wind speed at 10m height in km/h */
  wind_speed_10m: number;
  /** WMO weather interpretation code — see https://open-meteo.com/en/docs#weathervariables */
  weather_code: number;
  /** Human-readable label derived from the WMO weather code */
  weather_label: string;
  /** True if conditions are severe enough to trigger a site warning */
  hasWeatherWarning: boolean;
};

// ---------------------------------------------------------------------------
// WMO Weather Code → Label mapping (subset relevant to waste site operations)
// Full list: https://open-meteo.com/en/docs#weathervariables
// ---------------------------------------------------------------------------
function getWeatherLabel(code: number): string {
  if (code === 0) return 'Clear sky';
  if (code <= 2) return 'Partly cloudy';
  if (code === 3) return 'Overcast';
  if (code <= 49) return 'Foggy';
  if (code <= 57) return 'Drizzle';
  if (code <= 67) return 'Rain';
  if (code <= 77) return 'Snow';
  if (code <= 82) return 'Rain showers';
  if (code <= 86) return 'Snow showers';
  if (code <= 99) return 'Thunderstorm ⚠️';
  return 'Unknown';
}

/**
 * Determines if weather conditions should trigger a warning banner
 * on the TPS dashboard (e.g., heavy rain can affect waste collection routes).
 */
function shouldWarn(code: number, rain: number): boolean {
  const isThunderstorm = code >= 80 && code <= 99;
  const isHeavyRain = rain >= 7.5; // mm — moderate-to-heavy threshold
  return isThunderstorm || isHeavyRain;
}

// ---------------------------------------------------------------------------
// API Response Shape (Open-Meteo current weather response)
// ---------------------------------------------------------------------------
type OpenMeteoResponse = {
  current: {
    temperature_2m: number;
    apparent_temperature: number;
    precipitation: number;
    rain: number;
    wind_speed_10m: number;
    weather_code: number;
  };
};

// ---------------------------------------------------------------------------
// Main fetch function — SERVER ONLY
// ---------------------------------------------------------------------------

/**
 * Fetches real-time weather data for Palangkaraya from the Open-Meteo API.
 *
 * - No API key required.
 * - Uses `cache: 'no-store'` so each server render gets fresh data.
 * - Throws a descriptive error on network or parse failure, which should be
 *   caught by the calling Server Component using try/catch.
 *
 * @example
 * // Inside a Server Component (e.g., app/page.tsx):
 * const weather = await getPalangkarayaWeather();
 */
export async function getWeatherForLocation(
  lat: number,
  lng: number
): Promise<WeatherData> {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    current: [
      'temperature_2m',
      'apparent_temperature',
      'precipitation',
      'rain',
      'wind_speed_10m',
      'weather_code',
    ].join(','),
    timezone: 'Asia/Jakarta', // WIB (UTC+7) — Palangkaraya, Kalimantan Tengah
    wind_speed_unit: 'kmh',
  });

  const url = `https://api.open-meteo.com/v1/forecast?${params.toString()}`;

  const response = await fetch(url, {
    // Always fetch fresh weather — never serve a stale cached response
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(
      `Open-Meteo API error: ${response.status} ${response.statusText}`
    );
  }

  const data: OpenMeteoResponse = await response.json() as OpenMeteoResponse;
  const current = data.current;

  return {
    temperature_2m: current.temperature_2m,
    apparent_temperature: current.apparent_temperature,
    precipitation: current.precipitation,
    rain: current.rain,
    wind_speed_10m: current.wind_speed_10m,
    weather_code: current.weather_code,
    weather_label: getWeatherLabel(current.weather_code),
    hasWeatherWarning: shouldWarn(current.weather_code, current.rain),
  };
}

/**
 * Legacy wrapper for initial server-side fetch (Palangkaraya center).
 */
export async function getPalangkarayaWeather(): Promise<WeatherData> {
  return getWeatherForLocation(-2.2083, 113.916);
}
