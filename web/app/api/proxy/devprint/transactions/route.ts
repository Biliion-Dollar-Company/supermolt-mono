import { NextResponse } from 'next/server';

export async function GET() {
    try {
        const res = await fetch('https://devprint-v2-production.up.railway.app/api/transactions');

        // If the server returns an error (like 400 or 404 because there are no transactions or endpoint missing),
        // we return an empty array instead of throwing an error that clutters the UI/Network tab.
        if (!res.ok) {
            if (res.status >= 400 && res.status < 600) {
                return NextResponse.json({ success: true, data: [] });
            }
            return new NextResponse(res.statusText, { status: res.status });
        }

        const data = await res.json();

        // In case the data is somehow not an array or has no data payload, ensure we don't crash
        if (!data || (!Array.isArray(data) && !Array.isArray(data.data))) {
            return NextResponse.json({ success: true, data: [] });
        }

        return NextResponse.json(data);
    } catch (error) {
        // Complete fallback if fetch fails instantly (e.g. network issue or dead backend)
        console.error('Failed to fetch DevPrint transactions:', error);
        return NextResponse.json({ success: true, data: [] });
    }
}
