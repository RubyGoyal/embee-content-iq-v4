import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EmbeeContentIQ — AI Content Audit Platform",
  description:
    "AI-powered content audit for Embee Software marketing assets — solution-name consistency, brand voice, SEO, links, CTAs.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
