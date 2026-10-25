import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy - Quotation & Invoicing",
  description: "Privacy policy for the Quotation & Invoicing Management System",
};

export default function PrivacyPolicyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background font-sans text-foreground">
        {children}
      </body>
    </html>
  );
}