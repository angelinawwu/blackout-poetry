import type { Metadata } from "next";
import { Archivo, Cardo, PT_Mono } from "next/font/google";
import "./globals.css";

const cardo = Cardo({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-cardo",
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
        className={`${cardo.variable} ${archivo.variable} ${ptMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
