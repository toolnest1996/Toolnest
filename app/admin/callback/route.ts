import { NextResponse } from "next/server";

/** Legacy admin callback — forward to the shared auth callback. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  url.pathname = "/auth/callback";
  return NextResponse.redirect(url);
}
