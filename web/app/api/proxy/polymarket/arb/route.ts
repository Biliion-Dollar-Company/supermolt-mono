import { NextResponse } from 'next/server';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';

const ARB_DIR = join(
  process.env.HOME || '/Users/henry',
  '.openclaw/workspace/polymarket-bot/src/arbitrage',
);

export async function GET() {
  try {
    // Look for any JSON output files in the arb scanner directory
    const files = await readdir(ARB_DIR);
    const jsonFiles = files.filter((f) => f.endsWith('.json'));

    if (jsonFiles.length === 0) {
      return NextResponse.json([]);
    }

    // Read the most recent JSON file
    const latest = jsonFiles[jsonFiles.length - 1];
    const raw = await readFile(join(ARB_DIR, latest), 'utf-8');
    const data = JSON.parse(raw);
    return NextResponse.json(Array.isArray(data) ? data : [data]);
  } catch {
    // No arb data available — return empty array
    return NextResponse.json([]);
  }
}
