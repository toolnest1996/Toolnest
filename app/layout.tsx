import type { Metadata } from "next";
import Script from "next/script";
import { Poppins, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-display",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://toolnest.io"),
  title: {
    default: "ToolNest — Every Tool. One Place.",
    template: "%s · ToolNest",
  },
  description:
    "ToolNest.io — the all-in-one online tools platform. 120 free tools for PDF, images, video, OCR, AI and more. No installs, no signups.",
  keywords: [
    "online tools",
    "pdf tools",
    "image compressor",
    "video downloader",
    "ocr",
    "ai tools",
  ],
  openGraph: {
    title: "ToolNest — Every Tool. One Place.",
    description: "120 powerful online tools in one place.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${poppins.variable} ${jetbrains.variable} antialiased`}
        suppressHydrationWarning
      >
        <Script id="theme-init" strategy="beforeInteractive">
          {`(function(){try{var t=localStorage.getItem("theme")||"dark";if(t==="system"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.classList.add(t);document.documentElement.style.colorScheme=t}catch(e){document.documentElement.classList.add("dark")}})();`}
        </Script>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
