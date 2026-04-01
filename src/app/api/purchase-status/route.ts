import { NextRequest, NextResponse } from "next/server";
import {
  getPurchaseFromRequest,
  getFreeCountFromRequest,
  isPurchaseValid,
} from "@/lib/purchase";

// ---------------------------------------------------------------------------
// Purchase Status — GET /api/purchase-status
//
// Returns the current user's plan status based on their cookies.
// Used by the client to show appropriate UI (remaining generations, etc.)
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const cookieHeader = request.headers.get("cookie");
  const purchase = getPurchaseFromRequest(cookieHeader);
  const freeCount = getFreeCountFromRequest(cookieHeader);

  if (purchase && isPurchaseValid(purchase)) {
    return NextResponse.json({
      plan: purchase.plan,
      generationsUsed: purchase.generationsUsed ?? 0,
      generationsAllowed: purchase.generationsAllowed ?? (purchase.plan === "pro" ? 999999 : 4),
      active: true,
    });
  }

  // If they had a purchase but it's expired/used up
  if (purchase && !isPurchaseValid(purchase)) {
    return NextResponse.json({
      plan: purchase.plan,
      generationsUsed: purchase.generationsUsed ?? 0,
      generationsAllowed: purchase.generationsAllowed ?? 4,
      active: false,
      expired: true,
    });
  }

  // Free tier
  return NextResponse.json({
    plan: "free",
    generationsUsed: freeCount,
    generationsAllowed: 1,
    active: freeCount < 1,
  });
}
