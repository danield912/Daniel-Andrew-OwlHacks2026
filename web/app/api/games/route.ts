import { NextResponse } from "next/server";

export async function GET() {
  const apiKey = process.env.TICKETMASTER_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "Ticketmaster API key is missing" },
      { status: 500 }
    );
  }

  const url = new URL(
    "https://app.ticketmaster.com/discovery/v2/events.json"
  );

  url.searchParams.set("apikey", apiKey);
  url.searchParams.set("countryCode", "US");
  url.searchParams.set("classificationName", "Sports");
  url.searchParams.set("city", "Philadelphia");
  url.searchParams.set("size", "20");

  const response = await fetch(url.toString());

  if (!response.ok) {
    return NextResponse.json(
      { error: "Ticketmaster request failed" },
      { status: response.status }
    );
  }

  const data = await response.json();

  return NextResponse.json(data);
}