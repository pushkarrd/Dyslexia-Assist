"use client";

import { usePathname } from "next/navigation";
import AlphabetRain from "@/components/common/AlphabetRain";
import AppSidebar from "@/components/layout/AppSidebar";
import AccessibilityToolbar from "@/components/common/AccessibilityToolbar";
import ReadingRuler from "@/components/common/ReadingRuler";
import { Toaster } from "@/components/ui/sonner";

// Pages where the sidebar should NOT appear
const PUBLIC_PATHS = ["/", "/login", "/signup"];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const showSidebar = !PUBLIC_PATHS.includes(pathname);

  return (
    <>
      <AlphabetRain />
      <div className="flex h-screen overflow-hidden relative z-10">
        {showSidebar && <AppSidebar />}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
      <AccessibilityToolbar />
      <ReadingRuler />
      <Toaster richColors position="top-right" />
    </>
  );
}
