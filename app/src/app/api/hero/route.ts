import { NextResponse } from "next/server";
import { heroCaseStudy } from "@/lib/mock-data";

export async function GET() {
  return NextResponse.json(heroCaseStudy);
}
