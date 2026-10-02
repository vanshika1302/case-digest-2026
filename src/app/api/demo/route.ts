import { NextResponse } from "next/server";
import { demoDigest } from "@/lib/demo";

export function GET() {
  return NextResponse.json(demoDigest);
}
