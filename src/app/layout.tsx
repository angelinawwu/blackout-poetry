import type { Metadata } from "next";
import localFont from "next/font/local";
import { Archivo, PT_Mono } from "next/font/google";
import "./globals.css";

const ppWriter = localFont({
  src: [
    { path: "./fonts/PPWriter-Book.otf", weight: "400", style: "normal" },
    { path: "./fonts/PPWriter-RegularItalic.otf", weight: "400", style: "italic" },
  ],
  variable: "--font-pp-writer",
  display: "swap",
});

const archivo = Archivo({
  subsets: ["latin"],
  variable: "--font-archivo",
  display: "swap",
});

const ptMono = PT_Mono({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-pt-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Blackout Poetry",
  description:
    "Redact pages from public-domain classics into your own blackout poetry.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={`${ppWriter.variable} ${archivo.variable} ${ptMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
