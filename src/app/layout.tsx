import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";


const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Escape Room CRM",
  description: "Gestión de reservas y salas para Escape Rooms",
  openGraph: {
    title: "Escape Room CRM",
    description: "Plataforma moderna de gestión de reservas para Escape Rooms.",
    url: "https://escaperoom-crm.vercel.app",
    siteName: "Escape Room CRM",
    images: [
      {
        url: "https://escaperoom-crm.vercel.app/uploads/crm-escape-room.png", 
        width: 1200,
        height: 630,
        alt: "Escape Room CRM - Sistema de reservas",
      },
    ],
    locale: "es_ES",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Escape Room CRM",
    description: "Plataforma moderna de gestión de reservas para Escape Rooms.",
    images: ["https://escaperoom-crm.vercel.app/uploads/crm-escape-room.png"],
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        
        {children}
        <Toaster
          richColors
          position="top-right"
          expand
          closeButton
          toastOptions={{ duration: 3000 }}
        />
      </body>
    </html>
  );
}
