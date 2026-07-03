import { NextResponse } from "next/server";
import { runClipdropRoute } from "@/lib/server/imageProxy";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request): Promise<NextResponse> {
  let body: {
    image?: string;
    fileName?: string;
    targetWidth?: number;
    targetHeight?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const { status, json } = await runClipdropRoute("upscale", body);
  return NextResponse.json(json, { status });
}
