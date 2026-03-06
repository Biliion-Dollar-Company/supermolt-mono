/**
 * Polymarket Weather Market Scanner
 *
 * Strategy: Buy deep OTM weather contracts at $0.01-$0.03 where NOAA
 * probability diverges >15% from Polymarket price. Low competition,
 * high asymmetry — target 10,000-20,000% returns on extreme tails.
 */

import { polymarketClient } from './polymarket.client';
import { db } from '../../lib/db';

const WEATHER_KEYWORDS = [
  'weather', 'temperature', 'rain', 'snow', 'hurricane', 'storm',
  'flood', 'drought', 'celsius', 'fahrenheit', 'degrees', 'precipitation',
];

const OTM_THRESHOLD = 0.04; // Only look at contracts priced < $0.04
const EDGE_THRESHOLD = 0.15; // NOAA prob must diverge >15% from market price

// Major US cities for NOAA lookups
const NOAA_CITIES: { name: string; lat: number; lon: number }[] = [
  { name: 'New York', lat: 40.7128, lon: -74.006 },
  { name: 'Los Angeles', lat: 34.0522, lon: -118.2437 },
  { name: 'Chicago', lat: 41.8781, lon: -87.6298 },
  { name: 'Miami', lat: 25.7617, lon: -80.1918 },
  { name: 'Houston', lat: 29.7604, lon: -95.3698 },
];

interface NOAAForecast {
  city: string;
  periods: {
    name: string;
    temperature: number;
    temperatureUnit: string;
    shortForecast: string;
    detailedForecast: string;
    probabilityOfPrecipitation?: { value: number | null };
  }[];
}

export class PolymarketWeatherScanner {
  private scansRun = 0;
  private marketsScanned = 0;
  private opportunitiesFound = 0;
  private lastScanAt: Date | null = null;
  private noaaCache: Map<string, { data: NOAAForecast; fetchedAt: number }> = new Map();

  async scan(): Promise<void> {
    this.scansRun++;
    this.lastScanAt = new Date();

    const markets = await polymarketClient.getMarkets(500);
    if (!Array.isArray(markets) || markets.length === 0) return;

    // Filter for weather-related markets
    const weatherMarkets = markets.filter((m) => {
      if (!m || !m.question) return false;
      const q = m.question.toLowerCase();
      return WEATHER_KEYWORDS.some((kw) => q.includes(kw));
    });

    this.marketsScanned = weatherMarkets.length;
    if (weatherMarkets.length === 0) return;

    console.log(`[PolymarketWeather] Found ${weatherMarkets.length} weather markets`);

    // Fetch NOAA data (cached for 10 minutes)
    const noaaForecasts = await this.fetchAllNOAA();

    for (const m of weatherMarkets) {
      const prices = typeof m.outcomePrices === 'string'
        ? JSON.parse(m.outcomePrices)
        : m.outcomePrices;
      const yes = Number(prices?.[0] ?? 0);
      const no = Number(prices?.[1] ?? 0);

      const yesPrice = yes;
      const noPrice = no;
      if (!yesPrice && !noPrice) continue;

      // Only interested in deep OTM contracts
      const hasOTMYes = yesPrice > 0 && yesPrice < OTM_THRESHOLD;
      const hasOTMNo = noPrice > 0 && noPrice < OTM_THRESHOLD;
      if (!hasOTMYes && !hasOTMNo) continue;

      // Estimate NOAA probability from forecast data
      const noaaProb = this.estimateNOAAProbability(m.question, noaaForecasts);
      if (noaaProb === null) continue;

      // Check for edge on YES side
      if (hasOTMYes && noaaProb - yesPrice > EDGE_THRESHOLD) {
        await this.recordOpportunity(m, 'YES', yesPrice, noPrice, noaaProb);
      }

      // Check for edge on NO side
      if (hasOTMNo && (1 - noaaProb) - noPrice > EDGE_THRESHOLD) {
        await this.recordOpportunity(m, 'NO', yesPrice, noPrice, 1 - noaaProb);
      }
    }
  }

  private async recordOpportunity(
    m: any,
    side: 'YES' | 'NO',
    yesPrice: number,
    noPrice: number,
    noaaProb: number,
  ): Promise<void> {
    const marketPrice = side === 'YES' ? yesPrice : noPrice;
    const edge = ((noaaProb - marketPrice) * 100).toFixed(1);

    this.opportunitiesFound++;

    console.log(
      `[PolymarketWeather] OPPORTUNITY: "${m.question}" | side=${side} price=$${marketPrice} NOAA=${(noaaProb * 100).toFixed(1)}% edge=${edge}%`,
    );

    // Upsert market
    const market = await db.predictionMarket.upsert({
      where: {
        platform_externalId: {
          platform: 'POLYMARKET',
          externalId: String(m.id),
        },
      },
      create: {
        platform: 'POLYMARKET',
        externalId: String(m.id),
        title: m.question,
        category: 'Weather',
        yesPrice,
        noPrice,
        volume: Number(m.volume ?? 0),
        expiresAt: m.end_date ? new Date(m.end_date) : new Date(Date.now() + 86400000),
        status: 'open',
        outcome: 'PENDING',
        metadata: { weatherEdge: edge, noaaProb },
      },
      update: {
        yesPrice,
        noPrice,
        volume: Number(m.volume ?? 0),
        metadata: { weatherEdge: edge, noaaProb },
      },
    });

    // Save as agentPrediction
    await db.agentPrediction.create({
      data: {
        agentId: 'weather-scanner',
        marketId: market.id,
        side,
        confidence: Math.min(99, Math.round(noaaProb * 100)),
        reasoning: `weather-arb:${side.toLowerCase()}`,
        contracts: 1,
        avgPrice: marketPrice,
        totalCost: marketPrice,
        outcome: 'PENDING',
        realOrder: false,
      },
    });
  }

  /**
   * Estimate NOAA probability for a given market question.
   * Parses temperature/precipitation references and matches against forecasts.
   */
  private estimateNOAAProbability(question: string, forecasts: NOAAForecast[]): number | null {
    const q = question.toLowerCase();

    // Try to extract a temperature threshold from the question
    const tempMatch = q.match(/(\d+)\s*(?:degrees|°|fahrenheit|celsius|°f|°c)/);
    const precipKeywords = ['rain', 'snow', 'precipitation', 'storm', 'hurricane', 'flood'];
    const hasPrecipRef = precipKeywords.some((kw) => q.includes(kw));

    if (!tempMatch && !hasPrecipRef) return null;

    // Aggregate across city forecasts
    let totalProb = 0;
    let count = 0;

    for (const forecast of forecasts) {
      if (!forecast.periods || forecast.periods.length === 0) continue;

      if (tempMatch) {
        const threshold = parseInt(tempMatch[1], 10);
        const isAbove = q.includes('above') || q.includes('over') || q.includes('exceed') || q.includes('higher');

        // Check how many forecast periods exceed/fall below threshold
        let matching = 0;
        for (const period of forecast.periods) {
          if (isAbove && period.temperature >= threshold) matching++;
          else if (!isAbove && period.temperature <= threshold) matching++;
        }
        const prob = matching / forecast.periods.length;
        totalProb += prob;
        count++;
      }

      if (hasPrecipRef) {
        // Use precipitation probability from NOAA
        let precipProbs = 0;
        let precipCount = 0;
        for (const period of forecast.periods) {
          const pop = period.probabilityOfPrecipitation?.value;
          if (pop !== null && pop !== undefined) {
            precipProbs += pop / 100;
            precipCount++;
          }
        }
        if (precipCount > 0) {
          totalProb += precipProbs / precipCount;
          count++;
        }
      }
    }

    if (count === 0) return null;
    return totalProb / count;
  }

  /**
   * Fetch NOAA forecasts for all tracked cities (cached 10 min).
   */
  private async fetchAllNOAA(): Promise<NOAAForecast[]> {
    const results: NOAAForecast[] = [];
    const now = Date.now();
    const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

    for (const city of NOAA_CITIES) {
      const cached = this.noaaCache.get(city.name);
      if (cached && now - cached.fetchedAt < CACHE_TTL) {
        results.push(cached.data);
        continue;
      }

      try {
        const forecast = await this.fetchNOAAForecast(city);
        if (forecast) {
          this.noaaCache.set(city.name, { data: forecast, fetchedAt: now });
          results.push(forecast);
        }
      } catch (err) {
        console.warn(`[PolymarketWeather] NOAA fetch failed for ${city.name}:`, err);
      }
    }

    return results;
  }

  private async fetchNOAAForecast(city: { name: string; lat: number; lon: number }): Promise<NOAAForecast | null> {
    // Step 1: Get grid point from coordinates
    const pointsUrl = `https://api.weather.gov/points/${city.lat},${city.lon}`;
    const pointsRes = await fetch(pointsUrl, {
      headers: { 'User-Agent': 'SuperMolt/1.0 (weather-scanner)', Accept: 'application/geo+json' },
    });

    if (!pointsRes.ok) {
      console.warn(`[PolymarketWeather] NOAA points API ${pointsRes.status} for ${city.name}`);
      return null;
    }

    const pointsData = await pointsRes.json() as any;
    const forecastUrl = pointsData?.properties?.forecast;
    if (!forecastUrl) return null;

    // Step 2: Get forecast
    const forecastRes = await fetch(forecastUrl, {
      headers: { 'User-Agent': 'SuperMolt/1.0 (weather-scanner)', Accept: 'application/geo+json' },
    });

    if (!forecastRes.ok) return null;

    const forecastData = await forecastRes.json() as any;
    const periods = forecastData?.properties?.periods;
    if (!Array.isArray(periods)) return null;

    return {
      city: city.name,
      periods: periods.map((p: any) => ({
        name: p.name,
        temperature: p.temperature,
        temperatureUnit: p.temperatureUnit,
        shortForecast: p.shortForecast,
        detailedForecast: p.detailedForecast,
        probabilityOfPrecipitation: p.probabilityOfPrecipitation,
      })),
    };
  }

  getStats() {
    return {
      scansRun: this.scansRun,
      marketsScanned: this.marketsScanned,
      opportunitiesFound: this.opportunitiesFound,
      lastScanAt: this.lastScanAt,
    };
  }
}

export const polymarketWeatherScanner = new PolymarketWeatherScanner();
