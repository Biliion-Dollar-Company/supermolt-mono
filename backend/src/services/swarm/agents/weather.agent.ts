/**
 * Weather Agent — Specialization: Weather market inefficiencies
 * Fetches NOAA data and compares with Polymarket pricing
 */

import { AgentVote, MarketSignal } from '../swarm.types';

const AGENT_ID = 'swarm-weather';

const WEATHER_KEYWORDS = [
  'rain', 'temperature', 'snow', 'hurricane', 'drought',
  'storm', 'flood', 'tornado', 'blizzard', 'heatwave',
  'weather', 'celsius', 'fahrenheit', 'precipitation', 'forecast',
  'typhoon', 'monsoon', 'frost', 'wind', 'thunderstorm',
];

interface NOAAForecast {
  probability: number; // 0-1 probability of event
  location: string;
  period: string;
}

async function fetchNOAAData(question: string): Promise<NOAAForecast | null> {
  try {
    // Extract location hints from question
    const response = await fetch('https://api.weather.gov/gridpoints/OKX/33,37/forecast', {
      headers: { 'User-Agent': 'PolymarketSwarm/1.0' },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) return null;

    const data = await response.json() as { properties?: { periods?: Array<{ name: string; detailedForecast: string; probabilityOfPrecipitation?: { value: number | null } }> } };
    const periods = data.properties?.periods;
    if (!periods || periods.length === 0) return null;

    // Use first forecast period
    const first = periods[0];
    const precipProb = first.probabilityOfPrecipitation?.value ?? 50;

    return {
      probability: precipProb / 100,
      location: 'NYC', // Default grid point
      period: first.name,
    };
  } catch {
    return null;
  }
}

function isWeatherMarket(question: string): boolean {
  const lower = question.toLowerCase();
  return WEATHER_KEYWORDS.some((kw) => lower.includes(kw));
}

export async function analyze(signal: MarketSignal): Promise<AgentVote> {
  if (!isWeatherMarket(signal.question)) {
    return {
      agentId: AGENT_ID,
      vote: 'ABSTAIN',
      confidence: 0,
      reasoning: 'Not a weather-related market',
    };
  }

  const forecast = await fetchNOAAData(signal.question);

  if (!forecast) {
    return {
      agentId: AGENT_ID,
      vote: 'ABSTAIN',
      confidence: 0.1,
      reasoning: 'Unable to fetch NOAA forecast data',
    };
  }

  const divergence = forecast.probability - signal.yesPrice;

  // NOAA shows >60% chance but YES price < 0.35 — underpriced tail
  if (forecast.probability > 0.6 && signal.yesPrice < 0.35) {
    return {
      agentId: AGENT_ID,
      vote: 'YES',
      confidence: Math.min(1, Math.abs(divergence)),
      reasoning: `NOAA forecast ${(forecast.probability * 100).toFixed(0)}% but market YES at ${(signal.yesPrice * 100).toFixed(0)}c — underpriced by ${(divergence * 100).toFixed(0)}c`,
    };
  }

  // NOAA shows <20% chance but YES price > 0.70 — overpriced
  if (forecast.probability < 0.2 && signal.yesPrice > 0.7) {
    return {
      agentId: AGENT_ID,
      vote: 'NO',
      confidence: Math.min(1, Math.abs(divergence)),
      reasoning: `NOAA forecast only ${(forecast.probability * 100).toFixed(0)}% but market YES at ${(signal.yesPrice * 100).toFixed(0)}c — overpriced by ${(Math.abs(divergence) * 100).toFixed(0)}c`,
    };
  }

  return {
    agentId: AGENT_ID,
    vote: 'ABSTAIN',
    confidence: 0.2,
    reasoning: `Weather market but no clear divergence. NOAA: ${(forecast.probability * 100).toFixed(0)}%, Market YES: ${(signal.yesPrice * 100).toFixed(0)}c`,
  };
}
