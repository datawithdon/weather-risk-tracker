# Weather Risk Tracker

Real-time weather risk tracking dashboard for all of Canada. Monitors severe storms, winter weather, wildfires, and flooding across all 13 provinces and territories — using only free, public data sources.

## Features

- **4 risk categories**: Severe Storms, Winter Weather, Wildfires & Smoke, Flooding
- **Province filter**: Drill down into any province or territory
- **Live alerts**: Official warnings and watches from Environment Canada (ECCC)
- **Wildfire tracking**: Active fires with size and stage of control from CWFIS
- **Current conditions**: Weather for 24 Canadian cities via Open-Meteo
- **Auto-refresh**: Dashboard updates every 5 minutes
- **Responsive**: Works on desktop and mobile

## Free Data Sources

| Source | Data | API Key Required |
|--------|------|-----------------|
| [Environment Canada (ECCC)](https://weather.gc.ca) | Official alerts, warnings, watches | No |
| [Open-Meteo](https://open-meteo.com) | Current weather & forecasts | No |
| [CWFIS — Natural Resources Canada](https://cwfis.cfs.nrcan.gc.ca) | Active wildfires across Canada | No |

## Quick Start

```bash
# Install dependencies
npm install

# Copy env file (optional — defaults work out of the box)
cp .env.example .env

# Start the server
npm start
```

Open [http://localhost:3000](http://localhost:3000)

## Development

```bash
npm run dev   # auto-reloads on file changes (nodemon)
```

## Risk Levels

| Level | Description |
|-------|-------------|
| **Extreme** | Life-threatening conditions, take immediate action |
| **High** | Significant risk, prepare and monitor closely |
| **Moderate** | Elevated risk, stay informed |
| **Low** | Minor risk, standard precautions |
| **None** | No significant weather risk detected |

## Architecture

```
weather-risk-tracker/
├── server.js          # Express backend — fetches & caches API data
├── public/
│   ├── index.html     # Dashboard layout
│   ├── style.css      # Clean light theme
│   └── app.js         # Frontend — renders data, auto-refresh
├── .env.example
└── package.json
```

The backend caches all API responses for 5 minutes to respect rate limits. Data sources are fetched in parallel on each request.

## Official Warnings

This dashboard is for situational awareness only. Always consult official sources:
- [weather.gc.ca](https://weather.gc.ca) — Environment Canada warnings
- [cwfis.cfs.nrcan.gc.ca](https://cwfis.cfs.nrcan.gc.ca) — Canadian wildfire information
- [511 provincial road conditions](https://511.alberta.ca) for travel safety
