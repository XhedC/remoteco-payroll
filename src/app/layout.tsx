import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { StoreHydration } from "@/components/store-hydration";
import { ScreenshotCaptureManager } from "@/components/screenshot-capture-manager";
import { AutoClockOutOnClose } from "@/components/auto-clock-out-on-close";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "RemoteCo Payroll",
  description: "Payroll, time tracking, and workforce management dashboard",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <StoreHydration />
        <ScreenshotCaptureManager />
        <AutoClockOutOnClose />
        {children}
        <Toaster />
      </body>
    </html>
  );
}
