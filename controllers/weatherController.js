let cachedWeatherData = null;
let lastFetchTime = null;
const CACHE_DURATION_MS = 15 * 60 * 1000; // 15 minutes in milliseconds

async function getWeatherData() {
    const now = Date.now();

    // Check if we have cached data less than 15 minutes old
    if (cachedWeatherData && lastFetchTime && (now - lastFetchTime < CACHE_DURATION_MS)) {
        return cachedWeatherData;
    }

    const lat = 32.0853;
    const lon = 34.7818;
    const apiKey = process.env.WEATHER_API_KEY;
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${apiKey}`;

    try {
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Weather API error: ${response.statusText}`);
        }
        const data = await response.json();
        cachedWeatherData = {
            city: process.env.WEATHER_CITY,
            temp: Math.round(data.main.temp),
            description: data.weather[0].description,
            icon: `https://openweathermap.org/img/wn/${data.weather[0].icon}@2x.png`
        };
        lastFetchTime = now;
        return cachedWeatherData;
    } catch (error) {
        console.error("Error getting weather data:", error);
        // Fallback
        return cachedWeatherData || null;
    }
}

module.exports = { getWeatherData };