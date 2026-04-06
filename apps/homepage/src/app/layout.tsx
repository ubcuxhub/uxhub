import type { Metadata, Viewport } from "next";
// import { Geist, Geist_Mono } from "next/font/google";
import { DM_Sans, Lora } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-dm-sans",
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
      { url: "/icon-dark.svg", media: "(prefers-color-scheme: light)" },
      { url: "/icon-light.svg", media: "(prefers-color-scheme: dark)" },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${dmSans.variable} ${lora.variable} antialiased`}
    >
      <body
        className={`${dmSans.className} font-sans text-black text-[16px]`}
      >
        {children}
      </body>
    </html>
  );
}
