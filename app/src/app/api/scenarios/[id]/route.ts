import { NextRequest, NextResponse } from "next/server";
import { scenarioResults } from "@/lib/mock-data";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const scenario = scenarioResults[id];

  if (!scenario) {
    return NextResponse.json(
      { error: "Scenario not found" },
      { status: 404 }
    );
  }

  return NextResponse.json(scenario);
}
