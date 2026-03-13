import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';

const HISTORY_FILE = join(
  process.env.HOME || '/Users/henry',
  '.openclaw/workspace/polymarket-bot/research/results/history.json',
);

export async function GET() {
  try {
    const raw = await readFile(HISTORY_FILE, 'utf-8');
    const data = JSON.parse(raw);
    return NextResponse.json(Array.isArray(data) ? data : []);
  } catch {
    return NextResponse.json([]);
  }
}
