import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { sora, manrope, jetbrainsMono } from "@/lib/fonts";
import { buildMetadata, defaultViewport } from "@/lib/seo";
import { Nav } from "@/components/nav/Nav";
import { Footer } from "@/components/footer/Footer";
import { PausaMovimiento } from "@/components/ui/PausaMovimiento";
import { Starfield } from "@/components/fondo/Starfield";
import { GlassPointer } from "@/components/fondo/GlassPointer";
import { Cursor } from "@/components/cursor/Cursor";
import { Asistente } from "@/components/asistente/Asistente";
import { AnclasInternas } from "@/components/ui/AnclasInternas";
import "./globals.css";

export const metadata = buildMetadata();
export const viewport = defaultViewport;

// Analítica de Vercel solo donde existe (evita 404 en local).
const enVercel = Boolean(process.env.VERCEL);

export default function RootLayout({ children }) {
  return (
    <html lang="es" className={`${sora.variable} ${manrope.variable} ${jetbrainsMono.variable}`}>
      <body className="min-h-dvh text-text antialiased">
        <a
          href="#contenido"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-text focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-bg focus:outline-2 focus:outline-offset-4 focus:outline-accent"
        >
          Saltar al contenido principal
        </a>
        <PausaMovimiento salto />
        <Starfield />
        <GlassPointer />
        <Cursor />
        <AnclasInternas />
        <Nav />
        <main id="contenido" className="relative z-10">
          {children}
        </main>
        <Footer />
        <Asistente />
        {enVercel ? (
          <>
            <Analytics />
            <SpeedInsights />
          </>
        ) : null}
      </body>
    </html>
  );
}
