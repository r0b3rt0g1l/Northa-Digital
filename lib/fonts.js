import { Sora, Manrope, JetBrains_Mono } from "next/font/google";

// Titulares — geométrica, contundente, con buena respiración a gran tamaño.
export const sora = Sora({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-sora",
  display: "swap",
});

// Cuerpo / interfaz — legible, fría y sobria.
export const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-manrope",
  display: "swap",
});

// Etiquetas, numeración y datos de contacto.
export const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});
