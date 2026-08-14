import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Search,
  MapPin,
  Wind,
  Droplets,
  Sun,
  Moon,
  CloudRain,
  Compass,
  Activity,
  ChevronRight,
  RefreshCw,
  Layers,
  Atom,
  Shield,
  FlaskConical,
  Gauge,
} from "lucide-react";

import { City, WeatherData, AQIData } from "./types";
import { searchCities, getWeatherData, getAQIData, reverseGeocode } from "./api";
import { getWeatherCondition, getAQICategory } from "./utils";
import WeatherMap from "./components/WeatherMap";
import WeatherCharts from "./components/WeatherCharts";
import { getFamousCitiesForCountry, GLOBAL_DEFAULT_PRESETS } from "./data/famousCities";

export default function App() {
  const [selectedCity, setSelectedCity] = useState<City>(GLOBAL_DEFAULT_PRESETS[0]);
  const [presetCities, setPresetCities] = useState<City[]>(GLOBAL_DEFAULT_PRESETS);
  const [detectedCountry, setDetectedCountry] = useState<{ code: string; name: string } | null>(null);
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [aqiData, setAQIData] = useState<AQIData | null>(null);

  // Keep preset cities updated with the country of the user's detected location, or fallback to selected city
  useEffect(() => {
    if (detectedCountry) {
      const countryPresets = getFamousCitiesForCountry(detectedCountry.code, detectedCountry.name);
      setPresetCities(countryPresets);
    } else if (selectedCity) {
      const countryPresets = getFamousCitiesForCountry(selectedCity.country_code, selectedCity.country);
      setPresetCities(countryPresets);
    }
  }, [detectedCountry, selectedCity]);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<City[]>([]);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [timeState, setTimeState] = useState({ date: "", time: "", ampm: "" });

  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem("atmosphere_theme");
    return saved !== null ? saved === "dark" : true;
  });

  const [isLocating, setIsLocating] = useState(false);

  // Fallback IP-based geolocation when standard navigator.geolocation fails or is denied (essential in iframe environments)
  const detectIPLocation = async (silent = false) => {
    try {
      if (!silent) setIsLocating(true);
      let res = await fetch("https://ipapi.co/json/");
      if (!res.ok) {
        // Safe secondary fallback
        res = await fetch("https://freeipapi.com/api/json");
      }
      if (!res.ok) throw new Error("IP geolocation services did not respond.");
      
      const data = await res.json();
      const lat = data.latitude || data.latitudeNum;
      const lng = data.longitude || data.longitudeNum;
      const cityName = data.city || data.cityName || "My Location";
      const countryStr = data.country_name || data.countryName || "Detected Area";
      const countryCode = (data.country_code || data.countryCode || "LOC").toUpperCase();
      const regionStr = data.region || data.regionName || "";

      if (lat && lng) {
        const detectedCity: City = {
          name: cityName,
          latitude: lat,
          longitude: lng,
          country: countryStr,
          country_code: countryCode,
          admin1: regionStr
        };
        setSelectedCity(detectedCity);
        if (countryCode && countryCode !== "LOC") {
          setDetectedCountry({
            code: countryCode,
            name: countryStr
          });
        }
      }
    } catch (err: any) {
      console.warn("IP geolocation fallback also failed:", err);
      if (!silent) {
        setError("Could not auto-determine your current coordinates. Please search manually.");
      }
    } finally {
      if (!silent) setIsLocating(false);
    }
  };

  // Auto-detect current location on mount or when requested
  const detectCurrentLocation = (silent = false) => {
    if (!navigator.geolocation) {
      if (!silent) setError("Geolocation is not supported by your browser.");
      detectIPLocation(silent);
      return;
    }

    if (!silent) setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const detectedCity = await reverseGeocode(latitude, longitude);
          setSelectedCity(detectedCity);
          if (detectedCity && detectedCity.country_code && detectedCity.country_code !== "LOC") {
            setDetectedCountry({
              code: detectedCity.country_code,
              name: detectedCity.country
            });
          }
        } catch (err: any) {
          console.error("Geolocation reverse geocode error:", err);
          detectIPLocation(silent);
        } finally {
          if (!silent) setIsLocating(false);
        }
      },
      (err) => {
        console.warn("Geolocation permission or access failed, trying IP fallback...", err);
        detectIPLocation(silent);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  useEffect(() => {
    detectCurrentLocation(true);
  }, []);

  const toggleTheme = () => {
    setIsDarkMode(prev => {
      const next = !prev;
      localStorage.setItem("atmosphere_theme", next ? "dark" : "light");
      return next;
    });
  };

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close search dropdown on clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowSearchDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch Weather and AQI data on City change
  const fetchAllData = async (city: City, isRefreshed = false) => {
    if (isRefreshed) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const [weather, aqi] = await Promise.all([
        getWeatherData(city.latitude, city.longitude),
        getAQIData(city.latitude, city.longitude),
      ]);

      if (weather && aqi) {
        setWeatherData(weather);
        setAQIData(aqi);
      } else {
        throw new Error("Unable to fetch complete metrics for this location.");
      }
    } catch (err: any) {
      setError(err?.message || "Data fetching failed. Please check network connection.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAllData(selectedCity);
  }, [selectedCity]);

  // Live timezone clock ticking
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const timezone = weatherData?.timezone || "UTC";
      try {
        const dateFormatter = new Intl.DateTimeFormat("en-US", {
          weekday: "long",
          month: "short",
          day: "numeric",
          timeZone: timezone,
        });
        const timeFormatter = new Intl.DateTimeFormat("en-US", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
          timeZone: timezone,
        });

        const dateParts = dateFormatter.format(now);
        const timeParts = timeFormatter.formatToParts(now);
        
        const hourMin = timeParts
          .filter(p => p.type === "hour" || p.type === "minute" || p.type === "literal")
          .map(p => p.value)
          .join("");
        const ampmVal = timeParts.find(p => p.type === "dayPeriod")?.value || "";

        setTimeState({
          date: dateParts,
          time: hourMin.trim(),
          ampm: ampmVal,
        });
      } catch (e) {
        setTimeState({
          date: now.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" }),
          time: now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }),
          ampm: "",
        });
      }
    };

    updateTime();
    const interval = setInterval(updateTime, 10000); // refresh every 10 seconds 
    return () => clearInterval(interval);
  }, [weatherData?.timezone]);

  // Handle Search Input matching
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (searchQuery.trim().length >= 2) {
        const results = await searchCities(searchQuery);
        setSearchResults(results);
        setShowSearchDropdown(true);
      } else {
        setSearchResults([]);
        setShowSearchDropdown(false);
      }
    }, 400); // debounce text changes

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Handle preset selected city switch
  const handleSelectCity = (city: City) => {
    setSelectedCity(city);
    setSearchQuery("");
    setShowSearchDropdown(false);
  };

  const currentCondition = weatherData ? getWeatherCondition(weatherData.current.weather_code) : null;
  const currentAQI = aqiData ? getAQICategory(aqiData.current.us_aqi) : null;

  // Render UV Warning Level helper
  const getUVBadgeColor = (uv: number) => {
    if (uv <= 2) return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    if (uv <= 5) return "bg-amber-500/10 text-amber-400 border-amber-500/20";
    if (uv <= 7) return "bg-orange-500/10 text-orange-400 border-orange-500/20";
    return "bg-rose-500/10 text-rose-400 border-rose-500/20";
  };

  return (
    <div className={`min-h-screen pb-16 font-sans transition-colors duration-300 selection:text-white antialiased ${
      isDarkMode ? "bg-[#0F172A] selection:bg-sky-500" : "bg-[#F8FAFC] selection:bg-blue-600"
    }`} id="root-layout">
      
      {/* Bento Top Header: Slate glassmorphism with elegant layout */}
      <header className={`sticky top-0 z-40 backdrop-blur-md border-b transition-colors duration-300 px-6 py-4 ${
        isDarkMode ? "bg-[#0F172A]/90 border-slate-800/80" : "bg-white/90 border-slate-200/80 shadow-sm"
      }`} id="header-bar">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          
          {/* Brand Identity with Logo */}
          <div className="flex items-center gap-3.5">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-lg shrink-0 ${
              isDarkMode ? "bg-sky-500 shadow-sky-500/20" : "bg-blue-600 shadow-blue-600/20"
            }`}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5.5 w-5.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
              </svg>
            </div>
            <div>
              <h1 className={`text-xl font-black tracking-tight leading-none flex items-center gap-1 transition-colors ${
                isDarkMode ? "text-white" : "text-slate-900"
              }`}>
                Atmosphere<span className={`select-none ${isDarkMode ? "text-sky-400" : "text-blue-600"}`}>IQ</span>
              </h1>
              <p className={`text-[9px] font-bold uppercase tracking-wider mt-1 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>WEATHER &amp; AIR ANALYTICS</p>
            </div>
          </div>

          {/* Quick Preset Selector Buttons (Design alignment) */}
          <div className="flex items-center gap-2 overflow-x-auto py-1 scrollbar-none" id="presets-panel">
            {presetCities.map((val) => {
              const isActive = val.name === selectedCity.name;
              return (
                <button
                  key={val.name}
                  onClick={() => handleSelectCity(val)}
                  className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl shrink-0 transition-all cursor-pointer border ${
                    isActive
                      ? isDarkMode
                        ? "bg-sky-500 text-white border-sky-450 hover:bg-sky-600 shadow-sm"
                        : "bg-blue-600 text-white border-blue-500 hover:bg-blue-700 shadow-sm"
                      : isDarkMode
                        ? "bg-[#1E293B] text-slate-300 border-slate-700/80 hover:bg-slate-700 hover:text-white"
                        : "bg-white text-slate-650 border-slate-200 hover:bg-slate-50 hover:text-slate-800 shadow-sm"
                  }`}
                >
                  {val.name}
                </button>
              );
            })}
          </div>

          {/* Right control container: clock + toggle switch */}
          <div className="flex items-center gap-4.5 select-none" id="realtime-clock-display">
            {/* Clock display */}
            <div className="text-left md:text-right hidden sm:block">
              <p className={`text-[10px] font-extrabold uppercase tracking-wider ${isDarkMode ? "text-white/95" : "text-slate-800"}`}>
                {timeState.date || "Loading location..."}
              </p>
              <p className={`text-xs font-bold tracking-tight mt-0.5 ${isDarkMode ? "text-slate-400" : "text-slate-550"}`}>
                {timeState.time} <span className={`text-[10px] font-extrabold tracking-widest ${isDarkMode ? "text-sky-400" : "text-blue-600"}`}>{timeState.ampm}</span>
              </p>
            </div>
            
            {/* Subtle separator on desktop */}
            <span className={`w-px h-6 hidden sm:block ${isDarkMode ? "bg-slate-800" : "bg-slate-200"}`} />

            {/* Slider Switch Toggle Dial */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={toggleTheme}
                className={`relative inline-flex h-7 w-13 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-300 ease-in-out focus:outline-none ${
                  isDarkMode ? "bg-[#1f293d] border-slate-700" : "bg-slate-200 border-slate-300"
                }`}
                aria-label="Toggle visual theme"
                id="theme-toggle-btn"
              >
                <div className="relative h-full w-full">
                  <motion.div
                    animate={{ x: isDarkMode ? 22 : 0 }}
                    transition={{ type: "spring", stiffness: 350, damping: 22 }}
                    className={`flex h-5.5 w-5.5 items-center justify-center rounded-full shadow ${
                      isDarkMode ? "bg-blue-600 text-white" : "bg-white text-amber-500"
                    } mt-0.5 ml-0.5`}
                  >
                    {isDarkMode ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
                  </motion.div>
                </div>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 mt-6">
        
        {/* Core Control Center Search Bar (Elegant Glass implementation) */}
        <section className="mb-6 max-w-2xl" id="search-section">
          <div className="relative" ref={dropdownRef}>
            <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none text-slate-400">
              <Search className="w-5 h-5 pointer-events-none" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search city (e.g., Tokyo, San Francisco, New Delhi...)"
              className={`w-full pl-12 pr-14 py-3 rounded-full border transition-all text-sm focus:outline-none focus:ring-2 ${
                isDarkMode 
                  ? "bg-[#1E293B] text-slate-200 border-slate-700 focus:ring-blue-500/40 focus:border-blue-500 placeholder:text-slate-400" 
                  : "bg-white text-slate-800 border-slate-200 focus:ring-blue-500/25 focus:border-blue-500 shadow-sm placeholder:text-slate-400"
              }`}
              id="search-input"
            />
            
            {/* Locate trigger button inside search input */}
            <div className="absolute inset-y-0 right-3 flex items-center">
              <button
                onClick={() => detectCurrentLocation(false)}
                disabled={isLocating}
                className={`p-1.5 rounded-full cursor-pointer transition-all ${
                  isDarkMode 
                    ? "hover:bg-slate-850 text-blue-450 disabled:text-slate-600" 
                    : "hover:bg-slate-100 text-blue-600 disabled:text-slate-400"
                }`}
                title="Detect Current Location"
              >
                <MapPin className={`w-5 h-5 ${isLocating ? "animate-bounce text-sky-450" : isDarkMode ? "text-sky-400" : "text-blue-600"}`} />
              </button>
            </div>
            
            {/* Dropdown with match suggestions */}
            <AnimatePresence>
              {showSearchDropdown && searchResults.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.12 }}
                  className={`absolute left-0 right-0 mt-2 rounded-2xl border shadow-2xl z-50 overflow-hidden divide-y max-h-72 overflow-y-auto duration-200 ${
                    isDarkMode
                      ? "bg-[#1E293B] border-slate-705/80 divide-slate-800"
                      : "bg-white border-slate-200 divide-slate-100"
                  }`}
                  id="results-dropdown"
                >
                  {searchResults.map((city, idx) => (
                    <button
                      key={`${city.latitude}-${city.longitude}-${idx}`}
                      onClick={() => handleSelectCity(city)}
                      className={`w-full text-left px-4 py-3 transition-colors flex items-center justify-between group cursor-pointer ${
                        isDarkMode ? "hover:bg-slate-800" : "hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <MapPin className={`w-4 h-4 ${isDarkMode ? "text-sky-400" : "text-blue-600"}`} />
                        <div>
                          <span className={`font-semibold text-sm transition-colors ${
                            isDarkMode ? "group-hover:text-sky-500 text-white" : "group-hover:text-blue-600 text-slate-800"
                          }`}>
                            {city.name}
                          </span>
                          <span className="text-xs text-slate-400 ml-2">
                            {city.admin1 ? `${city.admin1}, ` : ""}{city.country}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className={`w-4 h-4 text-slate-500 transition-colors ${isDarkMode ? "group-hover:text-sky-500" : "group-hover:text-blue-600"}`} />
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </section>

        {/* Dynamic Error State Notification */}
        {error && (
          <div className={`border rounded-3xl p-4 mb-6 text-sm flex items-center gap-3 ${
            isDarkMode 
              ? "bg-rose-950/40 border-rose-800/80 text-rose-300" 
              : "bg-rose-50 border-rose-200 text-rose-800"
          }`}>
            <span className="font-extrabold">Error:</span>
            <span>{error}</span>
            <button
              onClick={() => fetchAllData(selectedCity)}
              className="ml-auto text-xs py-1.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 font-bold text-white flex items-center gap-1 transition-all cursor-pointer shadow-sm"
            >
              <RefreshCw className="w-3 h-3" /> Try Again
            </button>
          </div>
        )}

        {/* Bento Grid: 12-column layout pattern to fit both details and interactive maps perfectly */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-5" id="bento-layout-parent">
          
          {/* CARD 1: MAIN WEATHER GRADIENT CARD (Span 5 on lg viewports) */}
          <div
            className={`rounded-[24px] p-6 text-white min-h-[320px] lg:col-span-5 flex flex-col justify-between relative overflow-hidden shadow-xl shadow-indigo-950/15 ${
              isDarkMode ? "bg-gradient-to-br from-sky-400 via-sky-550 to-indigo-750" : "bg-gradient-to-br from-blue-600 to-indigo-800"
            }`}
            id="weather-core-card"
          >
            {loading && (
              <div className={`absolute inset-0 z-10 flex items-center justify-center backdrop-blur-sm ${
                isDarkMode ? "bg-[#0F172A]/40" : "bg-white/40"
              }`}>
                <RefreshCw className={`w-8 h-8 animate-spin ${isDarkMode ? "text-white" : "text-blue-600"}`} />
              </div>
            )}

            {/* Top Row with details and refresh triggers */}
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-3xl font-black tracking-tight flex items-center gap-1.5">
                  {selectedCity.name}
                </h2>
                <p className={`text-xs font-medium mt-1 ${isDarkMode ? "text-sky-100" : "text-blue-100"}`}>
                  {selectedCity.admin1 ? `${selectedCity.admin1}, ` : ""}{selectedCity.country}
                </p>
              </div>

              {/* Refresh atmospheric reports */}
              <button
                onClick={() => fetchAllData(selectedCity, true)}
                disabled={refreshing}
                className="p-2.5 rounded-xl bg-white/10 text-white/80 hover:text-white hover:bg-white/20 transition-all cursor-pointer border border-white/10 shadow-sm"
                title="Refresh reports"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
              </button>
            </div>

            {/* Temperature Metrics with animated conditions */}
            {weatherData && currentCondition && (
              <div className="my-5 flex items-center justify-between">
                <div>
                  <div className="flex items-baseline">
                    <span className="text-7xl font-black tracking-tighter leading-none">
                      {Math.round(weatherData.current.temperature_2m)}°
                    </span>
                    <span className="text-2xl ml-2 font-bold opacity-90">{currentCondition.label}</span>
                  </div>
                  <p className={`text-xs mt-2 ${isDarkMode ? "text-sky-100" : "text-blue-100"}`}>
                    Feels like <span className="font-extrabold text-white">{Math.round(weatherData.current.apparent_temperature)}°C</span>
                  </p>
                </div>

                <div className="bg-white/10 h-16 w-16 rounded-2xl flex items-center justify-center border border-white/10 shrink-0 shadow-inner">
                  <currentCondition.icon className="h-10 w-10 text-yellow-300 animate-bounce" />
                </div>
              </div>
            )}

            {/* Daily Highs and Lows scale matching design */}
            {weatherData && (
              <div className="grid grid-cols-3 gap-3 border-t border-white/10 pt-4 text-left">
                <div>
                  <p className={`text-[10px] uppercase/normal tracking-wide ${isDarkMode ? "text-sky-200" : "text-blue-200"}`}>High Temp</p>
                  <p className="text-lg font-bold text-white">{Math.round(weatherData.daily.temperature_2m_max[0])}°C</p>
                </div>
                <div>
                  <p className={`text-[10px] uppercase/normal tracking-wide ${isDarkMode ? "text-sky-200" : "text-blue-200"}`}>Low Temp</p>
                  <p className="text-lg font-bold text-white">{Math.round(weatherData.daily.temperature_2m_min[0])}°C</p>
                </div>
                <div>
                  <p className={`text-[10px] uppercase/normal tracking-wide ${isDarkMode ? "text-sky-200" : "text-blue-200"}`}>Precipitation</p>
                  <p className="text-lg font-bold text-white">{weatherData.daily.precipitation_probability_max[0]}%</p>
                </div>
              </div>
            )}
          </div>

          {/* CARD 2: INTERACTIVE SPATIAL MAP VIEWPORT (Span 7 on lg viewports) */}
          <div
            className={`rounded-[24px] border p-0 relative min-h-[350px] lg:col-span-7 overflow-hidden transition-all duration-300 ${
              isDarkMode ? "bg-[#1E293B] border-slate-700/80 shadow-lg" : "bg-white border-slate-200/80 shadow-md"
            }`}
            id="map-section-grid"
          >
            {/* Decorative layout label overlay inside map overlay */}
            <div className="p-4 absolute top-0 left-0 z-10 w-full flex justify-between items-start pointer-events-none">
              <span className={`backdrop-blur-md px-3.5 py-1.5 rounded-full text-[10px] font-extrabold border tracking-wider transition-colors duration-300 ${
                isDarkMode 
                  ? "bg-[#0F172A]/85 border-slate-700 text-sky-400" 
                  : "bg-white/85 border-slate-200 text-blue-600 shadow-sm"
              }`}>
                ATMOSPHERIC SPATIAL MAP
              </span>
            </div>

            <WeatherMap
              city={selectedCity}
              weatherData={weatherData}
              aqiData={aqiData}
              isDarkMode={isDarkMode}
              onSelectCity={handleSelectCity}
            />
          </div>

          {/* CARD 3: AIR QUALITY INDEX DETAILS (Span 3 on lg viewports) */}
          {aqiData && currentAQI && (
            <div
              className={`rounded-[24px] border p-5 flex flex-col justify-between min-h-[300px] lg:col-span-3 transition-all duration-300 ${
                isDarkMode ? "bg-[#1E293B] border-slate-700/80 text-slate-100 shadow-lg" : "bg-white border-slate-200/80 text-slate-800 shadow-md"
              }`}
              id="aqi-card"
            >
              <div>
                <span className={`text-[10px] font-bold uppercase tracking-widest block mb-1 ${
                  isDarkMode ? "text-slate-400" : "text-slate-500"
                }`}>Air Quality Index</span>
                <div className="flex items-baseline gap-2 mt-2">
                  <span className={`text-6xl font-black ${currentAQI.textColorClass}`}>
                    {aqiData.current.us_aqi}
                  </span>
                  <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">AQI</span>
                </div>
                <p className={`text-lg font-bold mt-1.5 ${isDarkMode ? "text-white" : "text-slate-900"}`}>{currentAQI.label}</p>
                <p className={`text-xs mt-2 leading-relaxed ${isDarkMode ? "text-slate-400" : "text-slate-600"}`}>{currentAQI.description}</p>
              </div>

              {/* Progress visualizer for PM2.5 pollutant */}
              <div className={`mt-4 pt-4 border-t ${isDarkMode ? "border-slate-750" : "border-slate-100"}`}>
                <div className="flex justify-between text-[10px] font-bold text-slate-400 mb-1.5">
                  <span>Particulate PM2.5</span>
                  <span className={isDarkMode ? "text-slate-300" : "text-slate-700"}>{Math.round(aqiData.current.pm2_5)} µg/m³</span>
                </div>
                <div className={`w-full h-1.5 rounded-full overflow-hidden ${isDarkMode ? "bg-[#0F172A]" : "bg-slate-100"}`}>
                  <div
                    className={`${currentAQI.colorClass} h-full rounded-full transition-all duration-500`}
                    style={{ width: `${Math.min(100, Math.max(12, (aqiData.current.pm2_5 / 75) * 100))}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* CARD 4: HUMIDITY & DOCK METRIC (Span 2 on lg viewports) */}
          {weatherData && (
            <div className={`rounded-[24px] border p-5 flex flex-row items-center gap-4 lg:col-span-2 transition-all duration-300 ${
              isDarkMode 
                ? "bg-[#1E293B] border-slate-700/80 text-slate-100 shadow-lg hover:border-slate-600" 
                : "bg-white border-slate-200/80 text-slate-800 shadow-md hover:border-slate-350"
            }`}>
              <div className={`p-2.5 rounded-xl border shrink-0 transition-all ${
                isDarkMode ? "bg-[#0F172A] border-slate-850" : "bg-slate-50 border-slate-150 text-blue-650"
              }`}>
                <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 ${isDarkMode ? "text-sky-400" : "text-blue-600"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Humidity</p>
                <p className={`text-xl font-black mt-0.5 ${isDarkMode ? "text-white" : "text-slate-900"}`}>{weatherData.current.relative_humidity_2m}%</p>
              </div>
            </div>
          )}

          {/* CARD 5: UV INDEX METRIC (Span 2 on lg viewports) */}
          {weatherData && (
            <div className={`rounded-[24px] border p-5 flex flex-row items-center gap-4 lg:col-span-2 transition-all duration-300 ${
              isDarkMode 
                ? "bg-[#1E293B] border-slate-700/80 text-slate-100 shadow-lg hover:border-slate-600" 
                : "bg-white border-slate-200/80 text-slate-800 shadow-md hover:border-slate-350"
            }`}>
              <div className={`p-2.5 rounded-xl border shrink-0 transition-all ${
                isDarkMode ? "bg-[#0F172A] border-slate-850" : "bg-slate-50 border-slate-150 text-amber-600"
              }`}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">UV Index</p>
                <p className={`text-xl font-black mt-0.5 flex items-baseline gap-1.5 ${isDarkMode ? "text-white" : "text-slate-900"}`}>
                  {weatherData.daily.uv_index_max[0]}
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-extrabold border uppercase ${getUVBadgeColor(weatherData.daily.uv_index_max[0])}`}>
                    {weatherData.daily.uv_index_max[0] <= 2 ? "Low" : weatherData.daily.uv_index_max[0] <= 5 ? "Mod" : "High"}
                  </span>
                </p>
              </div>
            </div>
          )}

          {/* CARD 6: EXTENDED FORECAST TIMELINE GRID (Span 5 on lg viewports) */}
          {weatherData && (
            <div
              className={`rounded-[24px] border p-5 lg:col-span-5 flex flex-col justify-between transition-all duration-300 ${
                isDarkMode ? "bg-[#1E293B] border-slate-700/80 text-slate-100 shadow-lg" : "bg-white border-slate-200/80 text-slate-800 shadow-md"
              }`}
              id="forecast-card"
            >
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-4">5-Day Forecast Plan</span>
              <div className="flex flex-col sm:flex-row justify-between items-center gap-4 h-full">
                {weatherData.daily.time.slice(0, 5).map((time, index) => {
                  const dateObj = new Date(time);
                  const isToday = index === 0;
                  const dayName = isToday
                    ? "Today"
                    : dateObj.toLocaleDateString([], { weekday: "short" });

                  const cond = getWeatherCondition(weatherData.daily.weather_code[index]);
                  const maxTemp = Math.round(weatherData.daily.temperature_2m_max[index]);
                  const minTemp = Math.round(weatherData.daily.temperature_2m_min[index]);

                  return (
                    <div
                      key={time}
                      className={`flex sm:flex-col items-center justify-between sm:justify-center w-full sm:w-auto p-2.5 border rounded-2xl sm:border-none sm:bg-transparent ${
                        isDarkMode 
                          ? "bg-[#0F172A]/45 border-slate-800" 
                          : "bg-slate-50 border-slate-150 shadow-sm sm:shadow-none"
                      }`}
                    >
                      <p className={`text-xs font-bold w-16 sm:w-auto text-left sm:text-center shrink-0 ${
                        isDarkMode ? "text-slate-300" : "text-slate-700"
                      }`}>{dayName}</p>
                      
                      {/* Weather Icon badge */}
                      <div className={`my-1.5 sm:my-3 w-9 h-9 rounded-full border flex items-center justify-center text-center shrink-0 shadow-sm ${
                        isDarkMode ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200 text-slate-800"
                      }`}>
                        <cond.icon className={`w-4.5 h-4.5 ${cond.color}`} />
                      </div>

                      <div className="text-right sm:text-center w-20 sm:w-auto shrink-0 leading-tight">
                        <p className={`font-black text-sm ${isDarkMode ? "text-white" : "text-slate-900"}`}>{maxTemp}°C</p>
                        <p className={`text-[10px] font-bold mt-0.5 ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>{minTemp}°C</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* CARD 7: AIR POLLUTION DETAILED MICRO GRID (Span 5 on lg viewports) */}
          {aqiData && (
            <div
              className={`rounded-[24px] border p-5 lg:col-span-5 flex flex-col justify-between transition-all duration-300 ${
                isDarkMode ? "bg-[#1E293B] border-[#334155] text-slate-100 shadow-lg" : "bg-white border-slate-200/80 text-slate-800 shadow-md"
              }`}
              id="aqi-breakdown-details"
            >
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-3">Concentration Levels</span>
              <div className="grid grid-cols-3 gap-2 flex-1">
                {/* PM10 */}
                <div className={`border rounded-2xl p-2.5 flex flex-col justify-between transition-all group hover:scale-[1.02] duration-300 ${
                  isDarkMode 
                    ? "bg-[#0F172A]/45 border-slate-700/50 hover:border-slate-600" 
                    : "bg-slate-50 border-slate-200 hover:border-slate-300 shadow-sm"
                }`}>
                  <div className="flex items-center justify-between">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">PM10</p>
                    <Layers className={`w-3.5 h-3.5 opacity-80 group-hover:rotate-12 transition-transform duration-300 ${
                      isDarkMode ? "text-sky-400" : "text-blue-600"
                    }`} />
                  </div>
                  <p className={`text-sm font-black mt-1.5 ${isDarkMode ? "text-white" : "text-slate-900"}`}>{Math.round(aqiData.current.pm10)} <span className="text-[9px] text-slate-400 font-normal">µg/m³</span></p>
                </div>

                {/* nitrogen_dioxide */}
                <div className={`border rounded-2xl p-2.5 flex flex-col justify-between transition-all group hover:scale-[1.02] duration-300 ${
                  isDarkMode 
                    ? "bg-[#0F172A]/45 border-slate-700/50 hover:border-slate-600" 
                    : "bg-slate-50 border-slate-200 hover:border-slate-300 shadow-sm"
                }`}>
                  <div className="flex items-center justify-between">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">NO₂</p>
                    <Atom className="w-3.5 h-3.5 text-purple-400 opacity-80 group-hover:rotate-45 transition-transform duration-300" />
                  </div>
                  <p className={`text-sm font-black mt-1.5 ${isDarkMode ? "text-white" : "text-slate-900"}`}>{Math.round(aqiData.current.nitrogen_dioxide)} <span className="text-[9px] text-slate-400 font-normal">µg/m³</span></p>
                </div>

                {/* Ozone */}
                <div className={`border rounded-2xl p-2.5 flex flex-col justify-between transition-all group hover:scale-[1.02] duration-300 ${
                  isDarkMode 
                    ? "bg-[#0F172A]/45 border-slate-700/50 hover:border-slate-600" 
                    : "bg-slate-50 border-slate-200 hover:border-slate-300 shadow-sm"
                }`}>
                  <div className="flex items-center justify-between">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">O₃</p>
                    <Shield className="w-3.5 h-3.5 text-emerald-400 opacity-80 group-hover:scale-110 transition-transform duration-300" />
                  </div>
                  <p className={`text-sm font-black mt-1.5 ${isDarkMode ? "text-white" : "text-slate-900"}`}>{Math.round(aqiData.current.ozone)} <span className="text-[9px] text-slate-400 font-normal">µg/m³</span></p>
                </div>

                {/* sulphur_dioxide */}
                <div className={`border rounded-2xl p-2.5 flex flex-col justify-between transition-all group hover:scale-[1.02] duration-300 ${
                  isDarkMode 
                    ? "bg-[#0F172A]/45 border-slate-700/50 hover:border-slate-600" 
                    : "bg-slate-50 border-slate-200 hover:border-slate-300 shadow-sm"
                }`}>
                  <div className="flex items-center justify-between">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">SO₂</p>
                    <FlaskConical className="w-3.5 h-3.5 text-amber-500 opacity-80 group-hover:-rotate-12 transition-transform duration-300" />
                  </div>
                  <p className={`text-sm font-black mt-1.5 ${isDarkMode ? "text-white" : "text-slate-900"}`}>{Math.round(aqiData.current.sulphur_dioxide)} <span className="text-[9px] text-slate-400 font-normal">µg/m³</span></p>
                </div>

                {/* wind */}
                <div className={`border rounded-2xl p-2.5 flex flex-col justify-between transition-all group hover:scale-[1.02] duration-300 ${
                  isDarkMode 
                    ? "bg-[#0F172A]/45 border-slate-700/50 hover:border-slate-600" 
                    : "bg-slate-50 border-slate-200 hover:border-slate-300 shadow-sm"
                }`}>
                  <div className="flex items-center justify-between">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Wind</p>
                    <Wind className="w-3.5 h-3.5 text-teal-400 opacity-80 group-hover:translate-x-0.5 transition-transform duration-300" />
                  </div>
                  <p className={`text-sm font-black mt-1.5 ${isDarkMode ? "text-white" : "text-slate-900"}`}>{weatherData?.current.wind_speed_10m} <span className="text-[9px] text-slate-400 font-normal">km/h</span></p>
                </div>

                {/* carbon_monoxide */}
                <div className={`border rounded-2xl p-2.5 flex flex-col justify-between transition-all group hover:scale-[1.02] duration-300 ${
                  isDarkMode 
                    ? "bg-[#0F172A]/45 border-slate-700/50 hover:border-slate-600" 
                    : "bg-slate-50 border-slate-200 hover:border-slate-300 shadow-sm"
                }`}>
                  <div className="flex items-center justify-between">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">CO</p>
                    <Gauge className="w-3.5 h-3.5 text-rose-400 opacity-80 group-hover:scale-110 transition-transform duration-300" />
                  </div>
                  <p className={`text-sm font-black mt-1.5 ${isDarkMode ? "text-white" : "text-slate-900"}`}>{Math.round(aqiData.current.carbon_monoxide / 1000)} <span className="text-[9px] text-slate-400 font-normal">mg/m³</span></p>
                </div>
              </div>
            </div>
          )}

          {/* CARD 8: CHARTS TREND ANALYTICS PANEL (Span 7 on lg viewports) */}
          <div className="lg:col-span-7 md:col-span-2">
            <WeatherCharts
              weatherData={weatherData}
              aqiData={aqiData}
              isDarkMode={isDarkMode}
            />
          </div>

        </div>
      </main>
    </div>
  );
}
