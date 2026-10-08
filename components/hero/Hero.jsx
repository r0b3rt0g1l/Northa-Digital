import { Button } from "@/components/ui/Button";
import { HeroVisual } from "./HeroVisual";
import { site } from "@/lib/site";
import { ctaPrincipal } from "@/lib/content/nav";

/**
 * Hero: etiqueta, titular, subtítulo y dos acciones. Secuencia de entrada
 * breve (halo → título → subtítulo → botones → composición), ver globals.css.
 */
export function Hero() {
  return (
    <section
      id="inicio"
      aria-labelledby="hero-title"
      className="relative isolate overflow-hidden px-5 pb-20 pt-[132px] sm:px-8 sm:pt-[156px] lg:pb-28 lg:pt-[176px]"
    >
      {/* Iluminación tenue del fondo, aparece primero */}
      <div
        aria-hidden="true"
        className="hero-glow pointer-events-none absolute left-1/2 top-[-30%] -z-10 h-[900px] w-[1100px] -translate-x-[30%] bg-[radial-gradient(closest-side,rgba(79,140,255,0.16),rgba(79,140,255,0)_70%)]"
      />

      <div className="mx-auto grid w-full max-w-[1200px] items-center gap-12 lg:grid-cols-[1.2fr_0.8fr] lg:gap-16">
        <div className="flex flex-col gap-7">
          <p className="hero-in eyebrow m-0" style={{ "--d": "150ms" }}>
            {site.tagline}
          </p>
          <h1
            id="hero-title"
            className="hero-in text-[length:var(--text-h1)] leading-[1.02] tracking-[-0.035em]"
            style={{ "--d": "220ms" }}
          >
            <span className="block">Verse mejor.</span>
            <span className="block">Comunicar mejor.</span>
            <span className="block text-muted">Operar mejor.</span>
          </h1>
          <p
            className="hero-in m-0 max-w-[54ch] text-[length:var(--text-lead)] leading-[1.55] text-text-2"
            style={{ "--d": "380ms" }}
          >
            {site.description}
          </p>
          <div
            className="hero-in mt-1 flex flex-col gap-3 sm:flex-row"
            style={{ "--d": "520ms" }}
          >
            <Button href={ctaPrincipal.href}>{ctaPrincipal.label}</Button>
            <Button href="#portafolio" variant="secondary">
              Ver portafolio
            </Button>
          </div>
        </div>

        <div className="hero-in" style={{ "--d": "640ms" }}>
          <HeroVisual />
        </div>
      </div>
    </section>
  );
}

export default Hero;
