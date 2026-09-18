import type { Metadata, Viewport } from "next";
import { inter } from "@/lib/fonts";
import "./globals.css";
import { Providers } from "@/components/layout/Providers";
import { themeInitScript } from "@/components/experience/theme-script";

export const metadata: Metadata = {
  title: { default: "Matan AI", template: "%s · Matan AI" },
  description: "Your intelligent eye at home. Ring sees the event. Matan understands the situation.",
  icons: { icon: "/brand/matan-ai-logo.png" },
};

export const viewport: Viewport = {
  themeColor: "#031326",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded-lg focus:bg-primary focus:px-3 focus:py-2 focus:text-white">
          Skip to content
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
