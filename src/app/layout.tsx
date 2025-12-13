import type { Metadata } from "next";
import { Anton, JetBrains_Mono, Inter, Chakra_Petch, IBM_Plex_Sans_Thai, Moul, Kantumruy_Pro } from "next/font/google";
import "./globals.css";
import { ConvexClientProvider } from "./ConvexClientProvider";

const anton = Anton({
  variable: "--font-anton",
  subsets: ["latin"],
  display: "swap",
  weight: ["400"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "700"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const chakraPetch = Chakra_Petch({
  variable: "--font-chakra",
  subsets: ["thai", "latin"],
  display: "swap",
  weight: ["400", "700"],
});

const ibmPlexThai = IBM_Plex_Sans_Thai({
  variable: "--font-ibm-thai",
  subsets: ["thai", "latin"],
  display: "swap",
  weight: ["400", "700"],
});

const moul = Moul({
  variable: "--font-moul",
  subsets: ["khmer"],
  display: "swap",
  weight: ["400"],
});

const kantumruy = Kantumruy_Pro({
  variable: "--font-kantumruy",
  subsets: ["khmer", "latin"],
  display: "swap",
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "BORDER CONFLICT MONITOR // 2025",
  description: "Real-time intelligence monitoring of the Thailand-Cambodia border situation. Multi-perspective news aggregation with AI-powered neutral analysis.",
  keywords: ["Thailand", "Cambodia", "border", "conflict", "monitor", "intelligence", "news"],
  openGraph: {
    title: "BORDER CONFLICT MONITOR // 2025",
    description: "Real-time intelligence monitoring of the Thailand-Cambodia border situation",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${anton.variable} ${jetbrainsMono.variable} ${inter.variable} ${chakraPetch.variable} ${ibmPlexThai.variable} ${moul.variable} ${kantumruy.variable} antialiased`}
        style={{ fontFamily: "var(--font-inter), system-ui, sans-serif" }}
      >
        <ConvexClientProvider>{children}</ConvexClientProvider>
      </body>
    </html>
  );
}
