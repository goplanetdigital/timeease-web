import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const baseUrl = "https://timeease-ruby.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: "TimeEase — AI File Processing & Business Automation",
    template: "%s | TimeEase",
  },
  description:
    "Turn PDFs, invoices, Excel and CSV files into clean, ready-to-use results. Pay per task or use monthly credits for repeat work.",
  keywords: [
    "PDF to Excel",
    "invoice to Excel",
    "Excel cleanup",
    "CSV cleanup",
    "AI document processing",
    "business automation",
    "data extraction",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: baseUrl,
    title: "TimeEase — AI File Processing & Business Automation",
    description:
      "Turn PDFs, invoices, Excel and CSV files into clean, ready-to-use results.",
    siteName: "TimeEase",
  },
  twitter: {
    card: "summary_large_image",
    title: "TimeEase — AI File Processing & Business Automation",
    description:
      "Turn PDFs, invoices, Excel and CSV files into clean, ready-to-use results.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "TimeEase",
    url: baseUrl,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description:
      "AI-powered document processing, spreadsheet cleanup, data extraction, and business automation.",
    offers: {
      "@type": "AggregateOffer",
      lowPrice: "39",
      priceCurrency: "USD",
    },
  };

  return (
    <html lang="en">
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
