import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "operational",
    version: "1.0.0",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    services: {
      api: "healthy",
      database: "healthy",
      storage: "healthy",
    },
  });
}
