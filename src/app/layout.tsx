import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Tio Snoop Imports Full",
    template: "%s | Tio Snoop Imports Full",
  },
  description: "Loja premium com produtos de alta qualidade.",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body className="bg-dark-bg text-dark-text antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
