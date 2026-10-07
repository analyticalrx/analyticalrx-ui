import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./dashboard.css";
import "./responsive.css";
import "./tasks.css";
import { AuthProvider } from "@/components/auth-provider";

export const metadata: Metadata = {
  title: "AnalyticalRx | Pharmacy Operations",
  description: "Real time pharmacy operations, insights, and workflow.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "light",
  themeColor: "#102c29",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body><AuthProvider>{children}</AuthProvider></body>
    </html>
  );
}
