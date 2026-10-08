import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { sora, manrope, jetbrainsMono } from "@/lib/fonts";
import { buildMetadata, defaultViewport } from "@/lib/seo";
import { Nav } from "@/components/nav/Nav";
import { Footer } from "@/components/footer/Footer";
import { Starfield } from "@/components/fondo/Starfield";
import { GlassPointer } from "@/components/fondo/GlassPointer";
import { Cursor } from "@/components/cursor/Cursor";
import "./globals.css";

export const metadata = buildMetadata();
export const viewport = defaultViewport;

export default function RootLayout({ children }) {
  return (
    <html
      lang="es"
      className={`${sora.variable} ${manrope.variable} ${jetbrainsMono.variable} no-js`}
      suppressHydrationWarning
    >
      <body className="min-h-dvh bg-bg text-text antialiased">
        {/* Sin JavaScript, los revelados muestran el contenido (ver .no-js en globals.css). */}
        <script
          dangerouslySetInnerHTML={{
            __html: "document.documentElement.classList.remove('no-js')",
          }}
        />
        <a
          href="#contenido"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-text focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-bg"
        >
          Saltar al contenido principal
        </a>
        <Starfield />
        <GlassPointer />
        <Cursor />
        <Nav />
        <main id="contenido" className="relative z-10">
          {children}
        </main>
        <Footer />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
