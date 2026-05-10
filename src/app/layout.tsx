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
  title: "blackout poetry",
  description:
    "redact pages from public-domain classics to create your own blackout poetry",
  openGraph: {
    images: [
      {
        url: "/PreviewImage.png",
        width: 1200,
        height: 630,
        alt: "blackout poetry",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/PreviewImage.png"],
  },
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
