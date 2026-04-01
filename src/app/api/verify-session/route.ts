import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import {
  generateToken,
  purchaseCookieHeader,
  getPurchaseFromRequest,
  type PurchasePayload,
  type PlanType,
} from "@/lib/purchase";

// ---------------------------------------------------------------------------
// Verify Session — /api/verify-session
//
// Called by the client after Stripe redirects back with ?session_id=...
// Verifies the checkout session with Stripe, then sets a signed cookie
// containing the purchase info.
//
// This is the main fulfillment mechanism: the cookie is what gates access
// to premium features in /api/generate.
// ---------------------------------------------------------------------------

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY || "", {
    apiVersion: "2026-02-25.clover",
  });
}

export async function POST(request: NextRequest) {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json(
        { error: "Payments not configured" },
        { status: 503 }
      );
    }

    const { sessionId } = await request.json();

    if (!sessionId || typeof sessionId !== "string") {
      return NextResponse.json(
        { error: "Missing session_id" },
        { status: 400 }
      );
    }

    // Check if this user already has a valid purchase cookie
    // (prevents re-verification of the same session creating duplicate tokens)
    const existingPurchase = getPurchaseFromRequest(
      request.headers.get("cookie")
    );
    if (existingPurchase && existingPurchase.sessionId === sessionId) {
      return NextResponse.json({
        plan: existingPurchase.plan,
        alreadyVerified: true,
        generationsAllowed: existingPurchase.generationsAllowed,
        generationsUsed: existingPurchase.generationsUsed,
      });
    }

    const stripe = getStripe();

    // Retrieve the checkout session from Stripe
    let session: Stripe.Checkout.Session;
    try {
      session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ["subscription"],
      });
    } catch (err: any) {
      console.error("Failed to retrieve checkout session:", err.message);
      return NextResponse.json(
        { error: "Invalid or expired session" },
        { status: 400 }
      );
    }

    // Verify the payment was actually completed
    if (session.payment_status !== "paid") {
      return NextResponse.json(
        { error: "Payment not completed" },
        { status: 400 }
      );
    }

    // Determine the plan type from the session mode
    let plan: PlanType;
    let subscriptionId: string | undefined;
    let periodEnd: string | undefined;
    let maxAgeDays: number;

    if (session.mode === "subscription") {
      plan = "pro";
      maxAgeDays = 35; // Slightly more than a month; will be refreshed on renewal

      // Extract subscription details
      if (session.subscription) {
        const sub =
          typeof session.subscription === "string"
            ? await stripe.subscriptions.retrieve(session.subscription, {
                expand: ["items.data"],
              })
            : session.subscription;
        subscriptionId = sub.id;
        // In Stripe API 2026+, current_period_end is on subscription items
        const item = sub.items?.data?.[0];
        if (item?.current_period_end) {
          periodEnd = new Date(item.current_period_end * 1000).toISOString();
        } else {
          // Fallback: 30 days from now
          periodEnd = new Date(
            Date.now() + 30 * 24 * 60 * 60 * 1000
          ).toISOString();
        }
      }
    } else {
      plan = "single";
      maxAgeDays = 365; // Single purchases don't expire (but have usage limits)
    }

    // Build the purchase payload
    const payload: PurchasePayload = {
      plan,
      token: generateToken(),
      sessionId: session.id,
      subscriptionId,
      purchasedAt: new Date().toISOString(),
      generationsAllowed: plan === "pro" ? 999999 : 4,
      generationsUsed: 0,
      periodEnd,
    };

    console.log(
      `[verify-session] Verified: plan=${plan}, session=${session.id}`
    );

    // Set the signed cookie and return the plan info
    const response = NextResponse.json({
      plan: payload.plan,
      generationsAllowed: payload.generationsAllowed,
      generationsUsed: payload.generationsUsed,
      subscriptionId: payload.subscriptionId,
    });

    response.headers.set("Set-Cookie", purchaseCookieHeader(payload, maxAgeDays));

    return response;
  } catch (error: any) {
    console.error("Verify session error:", error);
    return NextResponse.json(
      { error: "Failed to verify session" },
      { status: 500 }
    );
  }
}
