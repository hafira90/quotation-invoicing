import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Quotation & Invoicing",
    template: "%s | Quotation & Invoicing",
  },
  description:
    "Quotation and invoicing management: customers, products, quotations, invoices, payments, credit notes and reports.",
  keywords: "quotation, invoice, invoicing, billing, accounting, business, myrmalaysia",
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: "Quotation & Invoicing Management System",
    description:
      "Quotation and invoicing management: customers, products, quotations, invoices, payments, credit notes and reports.",
    images: [{
      url: "https://your-domain.com/og-image.jpg",
      width: 1200,
      height: 630,
      alt: "Quotation & Invoicing Management System",
    }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Quotation & Invoicing Management System",
    description:
      "Quotation and invoicing management: customers, products, quotations, invoices, payments, credit notes and reports.",
    images: ["https://your-domain.com/og-image.jpg"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background font-sans text-foreground">
        {children}
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  );
}
