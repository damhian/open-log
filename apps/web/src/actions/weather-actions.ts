"use server";

import { getWeatherForLocation } from "../lib/weather";

/**
 * Fetches dynamic weather based on viewport center coordinates.
 * This is a Server Action so that the Client Component can request fresh
 * data without exposing API logic or endpoints directly to the browser.
 */
export async function fetchDynamicWeather(lat: number, lng: number) {
  try {
    return await getWeatherForLocation(lat, lng);
  } catch (error) {
    console.error('[fetchDynamicWeather] failed', error);
    // Return null if request fails (client will handle via local state fallback)
    return null;
  }
}
