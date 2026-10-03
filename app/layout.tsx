import type { Metadata } from "next";
import "./globals.css";
import "./dashboard.css";
import { AuthProvider } from "@/components/auth-provider";

export const metadata: Metadata = {
  title: "AnalyticalRx | Pharmacy Operations",
  description: "Real time pharmacy operations, insights, and workflow.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body><AuthProvider>{children}</AuthProvider></body>
    </html>
  );
}
