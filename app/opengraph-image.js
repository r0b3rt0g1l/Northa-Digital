import { ImageResponse } from "next/og";
import { site } from "@/lib/site";
import { hero } from "@/lib/content/hero";

export const runtime = "nodejs";
export const alt = `${site.name}. ${hero.titulo}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0c10",
          color: "#F2F4F7",
          padding: 72,
          position: "relative",
          fontFamily: "sans-serif",
          textAlign: "center",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            background:
              "radial-gradient(circle at 50% 22%, rgba(79,140,255,0.24), transparent 46%), radial-gradient(circle at 50% 120%, rgba(127,211,255,0.08), transparent 50%)",
          }}
        />
        <svg width="64" height="64" viewBox="0 0 200 200" style={{ filter: "drop-shadow(0 0 24px rgba(127,211,255,0.6))" }}>
          <path d="M100 18 L121.2 78.8 L168 100 L121.2 121.2 L100 182 L78.8 121.2 L32 100 L78.8 78.8 Z" fill="#F2F4F7" />
          <path d="M100 18 L121.2 78.8 L100 100 L78.8 78.8 Z" fill="#4F8CFF" />
        </svg>
        <div style={{ display: "flex", fontSize: 22, letterSpacing: 2, color: "#9AA4B2", marginTop: 36 }}>
          {site.name}
        </div>
        <div style={{ display: "flex", fontSize: 76, fontWeight: 700, letterSpacing: -3, lineHeight: 1.04, marginTop: 18, maxWidth: 980 }}>
          {hero.titulo}
        </div>
        <div style={{ display: "flex", fontSize: 28, color: "#B4BCC8", marginTop: 24, maxWidth: 860, lineHeight: 1.35 }}>
          {hero.subtitulo}
        </div>
      </div>
    ),
    { ...size },
  );
}
