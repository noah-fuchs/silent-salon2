"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Scissors, Sparkles } from "lucide-react";
import { SalonDashboard } from "@/components/salon/salon-dashboard";
import { ThemeSwitcher } from "@/components/theme-switcher";

export default function DashboardPage() {
  const [activeSalonSlug, setActiveSalonSlug] = useState("atelier-lumiere");

  return (
    <div className="min-h-screen bg-stone-100/70 dark:bg-stone-950 text-stone-900 dark:text-stone-100">
      <header className="sticky top-0 z-30 border-b border-stone-200 dark:border-stone-800 bg-white/90 dark:bg-stone-950/90 backdrop-blur px-4 sm:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-600 dark:text-stone-300 hover:text-stone-900"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Zurück zur Produkt-Übersicht</span>
          </Link>
          <span className="text-stone-300 dark:text-stone-700">|</span>
          <div className="flex items-center gap-2 font-bold text-sm">
            <Scissors className="w-4 h-4 text-amber-600" />
            <span>SILENT SALON · Steuerzentrale</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={`/embed/${activeSalonSlug}`}
            target="_blank"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-amber-500/15 text-amber-900 dark:text-amber-300 text-xs font-semibold"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Kunden-Widget öffnen</span>
          </Link>
          <ThemeSwitcher />
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        <SalonDashboard
          salonSlug={activeSalonSlug}
          onSalonChange={setActiveSalonSlug}
        />
      </main>
    </div>
  );
}
