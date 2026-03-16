import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY || "", {
    apiVersion: "2026-02-25.clover",
  });
}

export async function POST(request: NextRequest) {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json(
        { error: "Payments are being set up. Please try again shortly." },
        { status: 503 }
      );
    }

    const { plan } = await request.json();
    const stripe = getStripe();

    const origin = request.headers.get("origin") || "https://applyfaster.ai";

    if (plan === "single") {
      // One-time $3 payment
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: "ApplyFaster — Single Premium Letter",
                description:
                  "1 premium cover letter with up to 3 regenerations",
              },
              unit_amount: 300, // $3.00
            },
            quantity: 1,
          },
        ],
        success_url: `${origin}?purchased=single&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}?cancelled=true`,
      });

      return NextResponse.json({ url: session.url });
    } else if (plan === "pro") {
      // Monthly $12 subscription
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: "ApplyFaster Pro",
                description:
                  "Unlimited cover letters, all tones, priority speed",
              },
              unit_amount: 1200, // $12.00
              recurring: {
                interval: "month",
              },
            },
            quantity: 1,
          },
        ],
        success_url: `${origin}?purchased=pro&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}?cancelled=true`,
      });

      return NextResponse.json({ url: session.url });
    } else {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }
  } catch (error: any) {
    console.error("Checkout error:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
