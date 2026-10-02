import { NextRequest, NextResponse } from "next/server";
import { exchangeCode } from "@/lib/clio";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const expected = req.cookies.get("clio_oauth_state")?.value;

  if (!code) return NextResponse.json({ error: req.nextUrl.searchParams.get("error") ?? "missing code" }, { status: 400 });
  if (!state || state !== expected) return NextResponse.json({ error: "OAuth state mismatch" }, { status: 400 });

  await exchangeCode(code);
  const res = NextResponse.redirect(new URL("/", req.url));
  res.cookies.delete("clio_oauth_state");
  return res;
}
