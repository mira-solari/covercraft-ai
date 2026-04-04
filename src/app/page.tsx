"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Header from "@/components/Header";
import Hero from "@/components/Hero";
import Generator from "@/components/Generator";
import HowItWorks from "@/components/HowItWorks";
import Pricing from "@/components/Pricing";
import FAQ from "@/components/FAQ";
import Footer from "@/components/Footer";
import HomeSchema from "@/components/HomeSchema";

interface PlanStatus {
  plan: "free" | "single" | "pro";
  generationsUsed: number;
  generationsAllowed: number;
  active: boolean;
  expired?: boolean;
}

export default function Home() {
  const generatorRef = useRef<HTMLDivElement>(null);
  const [planStatus, setPlanStatus] = useState<PlanStatus | null>(null);
  const [verifyingPayment, setVerifyingPayment] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const scrollToGenerator = () => {
    generatorRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Fetch current plan status on mount
  const fetchPlanStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/purchase-status");
      if (res.ok) {
        const data = await res.json();
        setPlanStatus(data);
      }
    } catch {
      // Silently fail — free tier is the default
    }
  }, []);

  useEffect(() => {
    fetchPlanStatus();
  }, [fetchPlanStatus]);

  // Handle post-payment redirect: verify the Stripe session
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");
    const purchased = params.get("purchased");

    if (!sessionId || !purchased) return;

    // Clean the URL so refreshing doesn't re-verify
    const cleanUrl = window.location.pathname;
    window.history.replaceState({}, "", cleanUrl);

    setVerifyingPayment(true);

    fetch("/api/verify-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (res.ok) {
          const planLabel = data.plan === "pro" ? "Pro" : "Single";
          setPaymentSuccess(
            `Payment confirmed! Your ${planLabel} plan is now active.`
          );
          // Refresh plan status
          await fetchPlanStatus();
          // Scroll to generator so they can start using it
          setTimeout(() => {
            generatorRef.current?.scrollIntoView({ behavior: "smooth" });
          }, 500);
        } else {
          setPaymentError(
            data.error || "Could not verify payment. Please contact support."
          );
        }
      })
      .catch(() => {
        setPaymentError(
          "Could not verify payment. Please check your connection and refresh the page."
        );
      })
      .finally(() => {
        setVerifyingPayment(false);
      });
  }, [fetchPlanStatus]);

  return (
    <main className="min-h-screen">
      <Header onGetStarted={scrollToGenerator} />

      {/* Payment verification banner */}
      {verifyingPayment && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-indigo-600 text-white text-center py-3 px-4 text-sm font-medium animate-pulse">
          Verifying your payment with Stripe...
        </div>
      )}

      {paymentSuccess && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-green-600 text-white text-center py-3 px-4 text-sm font-medium flex items-center justify-center gap-2">
          <svg
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
          {paymentSuccess}
          <button
            onClick={() => setPaymentSuccess(null)}
            className="ml-4 text-white/80 hover:text-white"
          >
            Dismiss
          </button>
        </div>
      )}

      {paymentError && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-red-600 text-white text-center py-3 px-4 text-sm font-medium flex items-center justify-center gap-2">
          {paymentError}
          <button
            onClick={() => setPaymentError(null)}
            className="ml-4 text-white/80 hover:text-white underline"
          >
            Dismiss
          </button>
        </div>
      )}

      <Hero onGetStarted={scrollToGenerator} />
      <div ref={generatorRef}>
        <Generator
          planStatus={planStatus}
          onPlanStatusChange={fetchPlanStatus}
        />
      </div>
      <HowItWorks />
      <Pricing />
      <FAQ />
      <Footer />
      <HomeSchema />
    </main>
  );
}
