import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    mode: "precomputed",
    timestamp: new Date().toISOString(),
  });
}
