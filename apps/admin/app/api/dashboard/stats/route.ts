import { NextResponse } from "next/server";

export async function GET() {
  // Mock delay
  await new Promise((resolve) => setTimeout(resolve, 1000));

  return NextResponse.json({
    revenue: { value: 45231.89, change: 20.1 },
    subscriptions: { value: 2350, change: 180.1 },
    sales: { value: 12234, change: 19 },
    activeNow: { value: 573, change: 201 },
  });
}
