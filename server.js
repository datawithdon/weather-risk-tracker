require('dotenv').config();
const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const CACHE = {};
const CACHE_TTL = 5 * 60 * 1000;

function getCache(key) {
  const entry = CACHE[key];
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
  return null;
}

function setCache(key, data) {
  CACHE[key] = { data, ts: Date.now() };
}

const PROVINCES = {
  AB: 'Alberta', BC: 'British Columbia', MB: 'Manitoba',
  NB: 'New Brunswick', NL: 'Newfoundland and Labrador',
  NS: 'Nova Scotia', NT: 'Northwest Territories',
  NU: 'Nunavut', ON: 'Ontario', PE: 'Prince Edward Island',
  QC: 'Quebec', SK: 'Saskatchewan', YT: 'Yukon',
};

const CITIES = [
  { name: 'Toronto', province: 'ON', lat: 43.70, lon: -79.42 },
  { name: 'Ottawa', province: 'ON', lat: 45.42, lon: -75.70 },
  { name: 'Thunder Bay', province: 'ON', lat: 48.38, lon: -89.25 },
  { name: 'Windsor', province: 'ON', lat: 42.32, lon: -83.03 },
  { name: 'Vancouver', province: 'BC', lat: 49.25, lon: -123.12 },
  { name: 'Victoria', province: 'BC', lat: 48.43, lon: -123.37 },
  { name: 'Prince George', province: 'BC', lat: 53.92, lon: -122.75 },
  { name: 'Kelowna', province: 'BC', lat: 49.89, lon: -119.49 },
  { name: 'Calgary', province: 'AB', lat: 51.05, lon: -114.07 },
  { name: 'Edmonton', province: 'AB', lat: 53.55, lon: -113.50 },
  { name: 'Lethbridge', province: 'AB', lat: 49.69, lon: -112.84 },
  { name: 'Winnipeg', province: 'MB', lat: 49.90, lon: -97.14 },
  { name: 'Montreal', province: 'QC', lat: 45.51, lon: -73.57 },
  { name: 'Quebec City', province: 'QC', lat: 46.81, lon: -71.21 },
  { name: 'Halifax', province: 'NS', lat: 44.65, lon: -63.58 },
  { name: 'Fredericton', province: 'NB', lat: 45.96, lon: -66.64 },
  { name: 'Moncton', province: 'NB', lat: 46.09, lon: -64.80 },
  { name: "St. John's", province: 'NL', lat: 47.57, lon: -52.71 },
  { name: 'Charlottetown', province: 'PE', lat: 46.24, lon: -63.13 },
  { name: 'Saskatoon', province: 'SK', lat: 52.13, lon: -106.67 },
  { name: 'Regina', province: 'SK', lat: 50.45, lon: -104.62 },
  { name: 'Whitehorse', province: 'YT', lat: 60.72, lon: -135.05 },
  { name: 'Yellowknife', province: 'NT', lat: 62.45, lon: -114.38 },
  { name: 'Iqaluit', province: 'NU', lat: 63.75, lon: -68.52 },
];

const WMO_CODES = {
  0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Fog', 48: 'Icy fog',
  51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle',
  56: 'Freezing drizzle', 57: 'Heavy freezing drizzle',
  61: 'Light rain', 63: 'Rain', 65: 'Heavy rain',
  66: 'Freezing rain', 67: 'Heavy freezing rain',
  71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 77: 'Snow grains',
  80: 'Rain showers', 81: 'Rain showers', 82: 'Heavy showers',
  85: 'Snow showers', 86: 'Heavy snow showers',
  95: 'Thunderstorm', 96: 'Thunderstorm w/ hail', 99: 'Severe thunderstorm',
};

function guessProvince(text) {
  if (!text) return null;
  const map = {
    'Ontario': 'ON', 'British Columbia': 'BC', 'Alberta': 'AB',
    'Manitoba': 'MB', 'Quebec': 'QC', 'Saskatchewan': 'SK',
    'Nova Scotia': 'NS', 'New Brunswick': 'NB',
    'Newfoundland': 'NL', 'Labrador': 'NL',
    'Prince Edward Island': 'PE', 'Yukon': 'YT',
    'Northwest Territories': 'NT', 'Nunavut': 'NU',
  };
  for (const [name, code] of Object.entries(map)) {
    if (text.includes(name)) return code;
  }
  return null;
}

function guessProvinceByCoord(lat, lon) {
  if (!lat || !lon) return null;
  if (lon > -60) return 'NL';
  if (lon > -64 && lat < 48) return 'PE';
  if (lon > -66 && lat < 47) return 'NS';
  if (lon > -68 && lat < 48) return 'NB';
  if (lat > 62 && lon > -96) return 'NU';
  if (lat > 60 && lon < -120) return 'YT';
  if (lat > 60) return 'NT';
  if (lon > -74 && lat < 60) return 'QC';
  if (lon > -84 && lat < 57) return 'ON';
  if (lon > -102) return 'MB';
  if (lon > -110) return 'SK';
  if (lon > -120) return 'AB';
  return 'BC';
}

function categorizeAlert(event) {
  const e = (event || '').toLowerCase();
  if (e.includes('tornado') || e.includes('thunderstorm') || e.includes('wind') || e.includes('storm') || e.includes('squall') || e.includes('hurricane')) return 'storm';
  if (e.includes('snow') || e.includes('blizzard') || e.includes('ice') || e.includes('freez') || e.includes('winter') || e.includes('frost') || e.includes('cold')) return 'winter';
  if (e.includes('fire') || e.includes('smoke') || e.includes('heat') || e.includes('drought')) return 'fire';
  if (e.includes('flood') || e.includes('rain') || e.includes('rainfall') || e.includes('overland flow')) return 'flood';
  return 'other';
}

function riskColourToSeverity(colour) {
  if (!colour) return 'Unknown';
  const c = colour.toLowerCase();
  if (c.includes('red'))    return 'Extreme';
  if (c.includes('orange')) return 'Severe';
  if (c.includes('yellow')) return 'Moderate';
  return 'Minor';
}

async function fetchAlerts() {
  const cached = getCache('alerts');
  if (cached) return cached;

  const alerts = [];

  try {
    const response = await axios.get(
      'https://api.weather.gc.ca/collections/weather-alerts/items?limit=500&lang=en',
      { timeout: 12000, headers: { Accept: 'application/geo+json' } }
    );

    const features = response.data?.features || [];
    for (const f of features) {
      const p = f.properties || {};
      const event = p.alert_name_en || p.alert_short_name_en || 'Weather Alert';
      alerts.push({
        id: p.id || f.id,
        event,
        severity: riskColourToSeverity(p.risk_colour_en),
        urgency: p.alert_type || 'Unknown',
        certainty: 'Observed',
        headline: (p.alert_text_en || '').split('\n')[0].substring(0, 200),
        area: p.feature_name_en || '',
        onset: p.validity_datetime || null,
        expires: p.expiration_datetime || null,
        province: p.province || guessProvince(p.feature_name_en || ''),
        category: categorizeAlert(event),
      });
    }
  } catch (err) {
    console.error('[ECCC] weather-alerts fetch failed:', err.message);
  }

  setCache('alerts', alerts);
  return alerts;
}

function assessWeatherRisks(current, daily) {
  const risks = [];
  const gusts = Math.max(current.wind_gusts_10m || 0, daily.wind_gusts_10m_max?.[0] || 0);
  const precip = daily.precipitation_sum?.[0] || 0;
  const snowfall = daily.snowfall_sum?.[0] || 0;
  const temp = current.temperature_2m ?? 10;

  if (gusts >= 110) risks.push({ type: 'storm', level: 'extreme', desc: 'Extreme wind gusts' });
  else if (gusts >= 90) risks.push({ type: 'storm', level: 'high', desc: 'Severe wind gusts' });
  else if (gusts >= 65) risks.push({ type: 'storm', level: 'moderate', desc: 'Strong wind gusts' });

  if (snowfall > 30 || (temp < -10 && precip > 20)) risks.push({ type: 'winter', level: 'extreme', desc: 'Severe winter storm' });
  else if (snowfall > 15 || (temp < 0 && precip > 15)) risks.push({ type: 'winter', level: 'high', desc: 'Heavy winter precip' });
  else if (snowfall > 3 || (temp < 2 && precip > 5)) risks.push({ type: 'winter', level: 'moderate', desc: 'Winter precipitation' });

  if (precip > 60) risks.push({ type: 'flood', level: 'extreme', desc: 'Extreme rainfall' });
  else if (precip > 35) risks.push({ type: 'flood', level: 'high', desc: 'Heavy rainfall' });
  else if (precip > 15) risks.push({ type: 'flood', level: 'moderate', desc: 'Significant rainfall' });

  return risks;
}

async function fetchWeather() {
  const cached = getCache('weather');
  if (cached) return cached;

  const results = await Promise.allSettled(
    CITIES.map(async (city) => {
      const url =
        `https://api.open-meteo.com/v1/forecast` +
        `?latitude=${city.lat}&longitude=${city.lon}` +
        `&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_gusts_10m,precipitation,weather_code` +
        `&daily=precipitation_sum,snowfall_sum,wind_gusts_10m_max,precipitation_probability_max` +
        `&timezone=auto&forecast_days=1`;
      const res = await axios.get(url, { timeout: 8000 });
      const c = res.data.current || {};
      const d = res.data.daily || {};
      return {
        city: city.name,
        province: city.province,
        temperature: c.temperature_2m,
        humidity: c.relative_humidity_2m,
        windSpeed: c.wind_speed_10m,
        windGusts: c.wind_gusts_10m,
        precipitation: c.precipitation,
        weatherCode: c.weather_code,
        weatherDesc: WMO_CODES[c.weather_code] || 'Unknown',
        dailyPrecip: d.precipitation_sum?.[0],
        dailySnowfall: d.snowfall_sum?.[0],
        dailyMaxGusts: d.wind_gusts_10m_max?.[0],
        risks: assessWeatherRisks(c, d),
      };
    })
  );

  const weather = results.filter(r => r.status === 'fulfilled').map(r => r.value);
  setCache('weather', weather);
  return weather;
}

async function fetchWildfires() {
  const cached = getCache('wildfires');
  if (cached) return cached;

  const fires = [];

  try {
    const res = await axios.get(
      'https://cwfis.cfs.nrcan.gc.ca/geoserver/public/wfs?service=WFS&version=2.0.0&request=GetFeature&typeName=public:hotspots_24h&outputFormat=application/json&count=3000',
      { timeout: 20000, headers: { Accept: 'application/json' } }
    );
    const features = res.data?.features || [];
    for (const f of features) {
      const p = f.properties || {};
      const lat = p.lat || f.geometry?.coordinates?.[1];
      const lon = p.lon || f.geometry?.coordinates?.[0];
      fires.push({
        id: f.id || p.uid,
        lat,
        lon,
        fireName: p.uid || 'Hotspot',
        province: guessProvinceByCoord(parseFloat(lat), parseFloat(lon)),
        agency: p.agency || 'Unknown',
        sizeHa: parseFloat(p.estarea || p.estarea2 || 0) || 0,
        fwi: parseFloat(p.fwi || 0) || 0,
        frp: parseFloat(p.frp || 0) || 0,
        reportedDate: p.rep_date || null,
        stageOfControl: 'Active Hotspot',
      });
    }
  } catch (err) {
    console.error('[CWFIS] fetch failed:', err.message);
  }

  setCache('wildfires', fires);
  return fires;
}

function buildSummary(alerts, weather, wildfires) {
  const levelOrder = { extreme: 4, high: 3, moderate: 2, low: 1, none: 0 };

  function topLevel(levels) {
    if (!levels.length) return 'none';
    const max = Math.max(...levels.map(l => levelOrder[l] || 0));
    return Object.keys(levelOrder).find(k => levelOrder[k] === max) || 'none';
  }

  function alertSevToLevel(sev) {
    return { Extreme: 'extreme', Severe: 'high', Moderate: 'moderate', Minor: 'low' }[sev] || 'none';
  }

  const categorized = { storm: [], winter: [], fire: [], flood: [], other: [] };
  for (const a of alerts) categorized[a.category]?.push(a);

  const wStorm = weather.flatMap(w => w.risks.filter(r => r.type === 'storm').map(r => r.level));
  const wWinter = weather.flatMap(w => w.risks.filter(r => r.type === 'winter').map(r => r.level));
  const wFlood = weather.flatMap(w => w.risks.filter(r => r.type === 'flood').map(r => r.level));

  const fireLevel = wildfires.length > 150 ? 'extreme'
    : wildfires.length > 50 ? 'high'
    : wildfires.length > 10 ? 'moderate'
    : wildfires.length > 0 ? 'low' : 'none';

  const totalHectares = Math.round(wildfires.reduce((s, f) => s + (f.sizeHa || 0), 0));

  return {
    counts: {
      totalAlerts: alerts.length,
      extremeAlerts: alerts.filter(a => a.severity === 'Extreme').length,
      severeAlerts: alerts.filter(a => a.severity === 'Severe').length,
      activeWildfires: wildfires.length,
      largeWildfires: wildfires.filter(f => f.sizeHa > 1000).length,
      totalFireHectares: totalHectares,
    },
    riskCategories: {
      storm: {
        level: topLevel([...categorized.storm.map(a => alertSevToLevel(a.severity)), ...wStorm]),
        alertCount: categorized.storm.length,
      },
      winter: {
        level: topLevel([...categorized.winter.map(a => alertSevToLevel(a.severity)), ...wWinter]),
        alertCount: categorized.winter.length,
      },
      wildfire: { level: fireLevel, activeCount: wildfires.length },
      flooding: {
        level: topLevel([...categorized.flood.map(a => alertSevToLevel(a.severity)), ...wFlood]),
        alertCount: categorized.flood.length,
      },
    },
    byProvince: Object.keys(PROVINCES).map(code => ({
      code,
      name: PROVINCES[code],
      alertCount: alerts.filter(a => a.province === code).length,
      fireCount: wildfires.filter(f => f.province === code).length,
      weatherRisks: weather.filter(w => w.province === code).flatMap(w => w.risks),
    })),
    lastUpdated: new Date().toISOString(),
  };
}

app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/summary', async (req, res) => {
  try {
    const [alerts, weather, wildfires] = await Promise.all([fetchAlerts(), fetchWeather(), fetchWildfires()]);
    res.json({ success: true, data: buildSummary(alerts, weather, wildfires) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/alerts', async (req, res) => {
  try {
    const all = await fetchAlerts();
    const data = req.query.province ? all.filter(a => a.province === req.query.province) : all;
    res.json({ success: true, data, total: data.length });
  } catch (err) {
    res.status(500).json({ success: false, data: [], error: err.message });
  }
});

app.get('/api/weather', async (req, res) => {
  try {
    const all = await fetchWeather();
    const data = req.query.province ? all.filter(w => w.province === req.query.province) : all;
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, data: [], error: err.message });
  }
});

app.get('/api/wildfires', async (req, res) => {
  try {
    const all = await fetchWildfires();
    const data = req.query.province ? all.filter(f => f.province === req.query.province) : all;
    res.json({ success: true, data, total: data.length });
  } catch (err) {
    res.status(500).json({ success: false, data: [], error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Weather Risk Tracker → http://localhost:${PORT}`);
  console.log('Data sources: ECCC GeoMet · Open-Meteo · CWFIS');
});
