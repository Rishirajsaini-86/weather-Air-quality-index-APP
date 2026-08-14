import {
  Sun,
  CloudSun,
  Cloud,
  CloudFog,
  CloudDrizzle,
  CloudRain,
  CloudSnow,
  CloudLightning,
  LucideIcon,
} from "lucide-react";

export interface WeatherCondition {
  label: string;
  icon: LucideIcon;
  color: string;
}

export function getWeatherCondition(code: number): WeatherCondition {
  switch (code) {
    case 0:
      return { label: "Clear Sky", icon: Sun, color: "text-amber-500" };
    case 1:
      return { label: "Mainly Clear", icon: CloudSun, color: "text-amber-400" };
    case 2:
      return { label: "Partly Cloudy", icon: CloudSun, color: "text-blue-300" };
    case 3:
      return { label: "Overcast", icon: Cloud, color: "text-gray-400" };
    case 45:
    case 48:
      return { label: "Foggy", icon: CloudFog, color: "text-stone-400" };
    case 51:
    case 53:
    case 55:
      return { label: "Drizzle", icon: CloudDrizzle, color: "text-sky-300" };
    case 56:
    case 57:
      return { label: "Freezing Drizzle", icon: CloudDrizzle, color: "text-teal-300" };
    case 61:
    case 63:
    case 65:
      return { label: "Rainy", icon: CloudRain, color: "text-blue-500" };
    case 66:
    case 67:
      return { label: "Freezing Rain", icon: CloudRain, color: "text-teal-500" };
    case 71:
    case 73:
    case 75:
      return { label: "Snowy", icon: CloudSnow, color: "text-indigo-200" };
    case 77:
      return { label: "Snow Grains", icon: CloudSnow, color: "text-indigo-100" };
    case 80:
    case 81:
    case 82:
      return { label: "Rain Showers", icon: CloudRain, color: "text-sky-500" };
    case 85:
    case 86:
      return { label: "Snow Showers", icon: CloudSnow, color: "text-indigo-300" };
    case 95:
      return { label: "Thunderstorm", icon: CloudLightning, color: "text-purple-500" };
    case 96:
    case 99:
      return { label: "Thunderstorm with Hail", icon: CloudLightning, color: "text-pink-600" };
    default:
      return { label: "Unknown", icon: Cloud, color: "text-slate-400" };
  }
}

export interface AQICategory {
  label: string;
  level: "good" | "moderate" | "unhealthy-sensitive" | "unhealthy" | "very-unhealthy" | "hazardous";
  colorClass: string;
  bgColorClass: string;
  textColorClass: string;
  description: string;
}

export function getAQICategory(aqi: number): AQICategory {
  if (aqi <= 50) {
    return {
      label: "Good",
      level: "good",
      colorClass: "bg-emerald-500",
      bgColorClass: "bg-emerald-500/10 border-emerald-500/20",
      textColorClass: "text-emerald-400",
      description: "Air quality is satisfactory, and air pollution poses little or no risk.",
    };
  } else if (aqi <= 100) {
    return {
      label: "Moderate",
      level: "moderate",
      colorClass: "bg-amber-500",
      bgColorClass: "bg-amber-500/10 border-amber-500/20",
      textColorClass: "text-amber-400",
      description: "Air quality is acceptable. However, there may be a risk for some sensitive individuals.",
    };
  } else if (aqi <= 150) {
    return {
      label: "Unhealthy for Sensitive Groups",
      level: "unhealthy-sensitive",
      colorClass: "bg-orange-500",
      bgColorClass: "bg-orange-500/10 border-orange-500/20",
      textColorClass: "text-orange-400",
      description: "Members of sensitive groups may experience health effects. The general public is less likely to be affected.",
    };
  } else if (aqi <= 200) {
    return {
      label: "Unhealthy",
      level: "unhealthy",
      colorClass: "bg-rose-500",
      bgColorClass: "bg-rose-500/10 border-rose-500/20",
      textColorClass: "text-rose-400",
      description: "Some members of the general public may experience health effects; sensitive groups may experience more serious effects.",
    };
  } else if (aqi <= 300) {
    return {
      label: "Very Unhealthy",
      level: "very-unhealthy",
      colorClass: "bg-purple-500",
      bgColorClass: "bg-purple-500/10 border-purple-500/20",
      textColorClass: "text-purple-400",
      description: "Health alert: The risk of health effects is increased for everyone.",
    };
  } else {
    return {
      label: "Hazardous",
      level: "hazardous",
      colorClass: "bg-red-700",
      bgColorClass: "bg-red-700/10 border-red-700/20",
      textColorClass: "text-red-400",
      description: "Health warning of emergency conditions: Everyone is more likely to be affected.",
    };
  }
}
