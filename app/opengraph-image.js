import { ImageResponse } from "next/og";
import { site } from "@/lib/site";

export const runtime = "nodejs";
export const alt = `${site.name} — ${site.tagline}`;
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
          justifyContent: "space-between",
          background: "#07080A",
          color: "#F2F4F7",
          padding: 72,
          position: "relative",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            background:
              "radial-gradient(circle at 82% 18%, rgba(79,140,255,0.26), transparent 52%), radial-gradient(circle at 10% 95%, rgba(127,211,255,0.10), transparent 50%)",
          }}
        />

        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <svg width="44" height="44" viewBox="0 0 200 200">
            <path
              d="M100 18 L121.2 78.8 L168 100 L121.2 121.2 L100 182 L78.8 121.2 L32 100 L78.8 78.8 Z"
              fill="#F2F4F7"
            />
            <path d="M100 18 L121.2 78.8 L100 100 L78.8 78.8 Z" fill="#4F8CFF" />
          </svg>
          <span style={{ fontSize: 30, fontWeight: 700, letterSpacing: -0.5 }}>
            Northa <span style={{ color: "#9AA4B2", fontWeight: 500 }}>Digital</span>
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div
            style={{
              display: "flex",
              fontSize: 20,
              letterSpacing: 2,
              color: "#9AA4B2",
            }}
          >
            {site.tagline.toUpperCase()}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 72,
              fontWeight: 700,
              letterSpacing: -3,
              lineHeight: 1.02,
              maxWidth: 1000,
            }}
          >
            Verse mejor. Comunicar mejor. Operar mejor.
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 26,
              color: "#B4BCC8",
              maxWidth: 900,
              lineHeight: 1.35,
            }}
          >
            Portales, sistemas, sitios web, identidad visual y contenido
            digital para organizaciones.
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
