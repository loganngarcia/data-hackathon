import { NextResponse } from "next/server";
import { screenerRows } from "@/lib/mock-data";

export async function GET() {
  return NextResponse.json(screenerRows);
}
