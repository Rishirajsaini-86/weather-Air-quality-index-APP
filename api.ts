import { City, WeatherData, AQIData } from "./types";

export async function searchCities(query: string): Promise<City[]> {
  if (!query || query.trim().length < 2) return [];
  try {
    const res = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
        query
      )}&count=8&language=en&format=json`
    );
    if (!res.ok) throw new Error("Failed to fetch cities");
    const data = await res.json();
    return data.results || [];
  } catch (error) {
    console.error("Geocoding error:", error);
    return [];
  }
}

export async function getWeatherData(lat: number, lng: number): Promise<WeatherData | null> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,rain,showers,snowfall,weather_code,wind_speed_10m&hourly=temperature_2m,relative_humidity_2m,precipitation_probability,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,uv_index_max,precipitation_probability_max&timezone=auto`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to fetch weather data");
    const data = await res.json();
    return data;
  } catch (error) {
    console.error("Weather fetch error:", error);
    return null;
  }
}

export async function getAQIData(lat: number, lng: number): Promise<AQIData | null> {
  try {
    const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lng}&current=us_aqi,pm2_5,pm10,nitrogen_dioxide,ozone,sulphur_dioxide,carbon_monoxide&hourly=us_aqi,pm2_5,pm10&timezone=auto`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to fetch AQI data");
    const data = await res.json();
    return data;
  } catch (error) {
    console.error("AQI fetch error:", error);
    return null;
  }
}

export async function reverseGeocode(lat: number, lng: number): Promise<City> {
  const defaultCity: City = {
    name: "My Location",
    latitude: lat,
    longitude: lng,
    country: "Detected Area",
    country_code: "LOC"
  };

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10`
    );
    if (!res.ok) return defaultCity;
    const data = await res.json();
    
    const address = data.address || {};
    const cityName = address.city || address.town || address.village || address.suburb || address.county || "My Location";
    const country = address.country || "Detected Area";
    const country_code = address.country_code ? address.country_code.toUpperCase() : "LOC";
    const state = address.state || "";

    return {
      name: cityName,
      latitude: lat,
      longitude: lng,
      country: country,
      country_code: country_code,
      admin1: state
    };
  } catch (error) {
    console.error("Reverse geocoding error:", error);
    return defaultCity;
  }
}

