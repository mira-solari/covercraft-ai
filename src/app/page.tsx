"use client";

import { useState, useRef } from "react";
import Header from "@/components/Header";
import Hero from "@/components/Hero";
import Generator from "@/components/Generator";
import HowItWorks from "@/components/HowItWorks";
import Pricing from "@/components/Pricing";
import FAQ from "@/components/FAQ";
import Footer from "@/components/Footer";

export default function Home() {
  const generatorRef = useRef<HTMLDivElement>(null);

  const scrollToGenerator = () => {
    generatorRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <main className="min-h-screen">
      <Header onGetStarted={scrollToGenerator} />
      <Hero onGetStarted={scrollToGenerator} />
      <div ref={generatorRef}>
        <Generator />
      </div>
      <HowItWorks />
      <Pricing />
      <FAQ />
      <Footer />
    </main>
  );
}
