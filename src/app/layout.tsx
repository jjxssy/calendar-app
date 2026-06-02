import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Arcgenda",
  description:
    "A fast iPhone-style calendar and productivity PWA built with Next.js.",
  applicationName: "Arcgenda",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Arcgenda",
    statusBarStyle: "default",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icons/arcgenda-icon-32.png", sizes: "32x32", type: "image/png" },
      {
        url: "/icons/arcgenda-icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      { url: "/favicon.ico" },
    ],
    apple: [
      {
        url: "/icons/arcgenda-icon-180.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f4ff" },
    { media: "(prefers-color-scheme: dark)", color: "#18181b" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var t=localStorage.getItem('arcgenda-theme')||'system';var d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=t;document.documentElement.classList.toggle('dark',d)}catch(e){}",
          }}
        />
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "if('serviceWorker'in navigator){addEventListener('load',function(){var r=function(){navigator.serviceWorker.register('/sw.js').catch(function(e){console.warn('Service worker registration failed:',e)})};'requestIdleCallback'in window?requestIdleCallback(r,{timeout:3000}):setTimeout(r,1200)})}",
          }}
        />
      </body>
    </html>
  );
}
