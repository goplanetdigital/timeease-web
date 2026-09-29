import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TimeEase",
  description: "Practical document extraction and spreadsheet automation for busy teams.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
