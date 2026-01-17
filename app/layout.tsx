import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tita Vape Shop - Inventory System",
  description: "Inventory management system for Tita Vape Shop",
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
