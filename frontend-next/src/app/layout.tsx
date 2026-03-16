
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers/Providers";
import AppShell from "@/components/layout/AppShell";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1.0,
  viewportFit: "cover",
  userScalable: false,
  themeColor: "#0a0a0f",
};

export const metadata: Metadata = {
  title: "NeuroLex - AI-Powered Learning Assistant",
  description: "AI-powered learning assistant for students with dyslexia. Features include gaze tracking, handwriting analysis, adaptive reading, and cognitive games.",
  keywords: ["dyslexia", "learning", "AI", "accessibility", "education", "reading assistant"],
  authors: [{ name: "NeuroLex Team" }],
  icons: { icon: "/favicon.ico" },
  openGraph: {
    title: "NeuroLex - AI-Powered Learning Assistant",
    description: "AI-powered learning assistant for students with dyslexia",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.cdnfonts.com/css/opendyslexic" rel="stylesheet" />
      </head>
      <body className={`${inter.variable} antialiased`}>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
