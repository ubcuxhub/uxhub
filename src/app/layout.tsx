import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { DM_Sans, Inter, Lora } from "next/font/google";
import { UserProvider } from "@/context/UserContext";
import { themeInitScript } from "@/lib/theme";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-dm-sans",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const lora = Lora({
  subsets: ["latin"],
  weight: ["600"],
  style: ["italic", "normal"],
  variable: "--font-lora",
});

export const metadata: Metadata = {
  title: "UBC UX Hub",
  description: "A collaborative whiteboard and design hub",
  icons: {
    icon: [
      { url: "/favicon/favicon.ico", sizes: "any" },
      { url: "/favicon/icon-dark.svg" },
      { url: "/favicon/icon-dark.svg", media: "(prefers-color-scheme: light)" },
      { url: "/favicon/icon-light.svg", media: "(prefers-color-scheme: dark)" },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
  flow,
}: Readonly<{
  children: React.ReactNode;
  flow: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${dmSans.variable} ${lora.variable} text-body antialiased`}
      >
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <UserProvider>
          {children}
          {flow}
        </UserProvider>
        <Analytics />
      </body>
    </html>
  );
}
