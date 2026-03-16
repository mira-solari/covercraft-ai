"use client";

import { useState } from "react";

interface HeaderProps {
  onGetStarted: () => void;
}

export default function Header({ onGetStarted }: HeaderProps) {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 glass">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">C</span>
            </div>
            <span className="text-lg font-bold">
              Cover<span className="gradient-text">Craft</span>
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-8">
            <a
              href="#how-it-works"
              className="text-sm text-gray-400 hover:text-white transition"
            >
              How It Works
            </a>
            <a
              href="#pricing"
              className="text-sm text-gray-400 hover:text-white transition"
            >
              Pricing
            </a>
            <a
              href="#faq"
              className="text-sm text-gray-400 hover:text-white transition"
            >
              FAQ
            </a>
          </nav>

          <button
            onClick={onGetStarted}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition"
          >
            Get Started Free
          </button>
        </div>
      </div>
    </header>
  );
}
