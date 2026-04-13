import { NextResponse } from "next/server";
import { memoContext } from "@/lib/mock-data";

export async function GET() {
  return NextResponse.json(memoContext);
}
