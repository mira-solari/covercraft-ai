import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

// ---------------------------------------------------------------------------
// Stripe Webhook — /api/webhook
//
// Handles checkout.session.completed events. This is the authoritative record
// of payment — the verify-session endpoint is the user-facing counterpart
// that sets the cookie.
//
// For now we just log successful payments. In the future this could write to
// a database. The actual cookie-setting happens via /api/verify-session
// because webhooks can't set cookies on the user's browser.
// ---------------------------------------------------------------------------

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY || "", {
    apiVersion: "2026-02-25.clover",
  });
}

export async function POST(request: NextRequest) {
  const stripe = getStripe();

  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json(
      { error: "Stripe not configured" },
      { status: 503 }
    );
  }

  // Read raw body for signature verification
  const body = await request.text();
  const sig = request.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  // Verify webhook signature if secret is configured
  if (process.env.STRIPE_WEBHOOK_SECRET) {
    try {
      event = stripe.webhooks.constructEvent(
        body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err: any) {
      console.error("Webhook signature verification failed:", err.message);
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 400 }
      );
    }
  } else {
    // In development without webhook secret, parse the event directly
    // WARNING: This should never happen in production
    console.warn(
      "STRIPE_WEBHOOK_SECRET not set — accepting unverified webhook"
    );
    try {
      event = JSON.parse(body) as Stripe.Event;
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }
  }

  // Handle the event
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const mode = session.mode; // "payment" or "subscription"

      console.log(
        `[webhook] checkout.session.completed: session=${session.id}, mode=${mode}, ` +
          `customer=${session.customer}, amount=${session.amount_total}, ` +
          `payment_status=${session.payment_status}`
      );

      if (mode === "subscription" && session.subscription) {
        console.log(
          `[webhook] Pro subscription created: ${session.subscription}`
        );
      }

      if (mode === "payment") {
        console.log(
          `[webhook] Single payment completed for session: ${session.id}`
        );
      }

      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      console.log(
        `[webhook] Subscription canceled: ${subscription.id}, ` +
          `customer=${subscription.customer}`
      );
      // Note: The cookie will naturally expire. For immediate revocation,
      // you'd need a database to check against.
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      console.log(
        `[webhook] Payment failed: invoice=${invoice.id}, ` +
          `customer=${invoice.customer}`
      );
      break;
    }

    default:
      // Unhandled event type — just acknowledge it
      console.log(`[webhook] Unhandled event type: ${event.type}`);
  }

  // Always return 200 to acknowledge receipt
  return NextResponse.json({ received: true });
}
