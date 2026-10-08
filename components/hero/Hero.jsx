import { Button } from "@/components/ui/Button";
import { HeroSenal } from "./HeroSenal";
import { hero } from "@/lib/content/hero";
import { ctaPrincipal } from "@/lib/content/nav";

/**
 * Hero: ¿qué hacemos? Una sola idea, centrada bajo una señal de luz.
 * Entrada breve: halo y señal, etiqueta, titular, subtítulo y botones.
 * El titular no espera: es el elemento principal de la primera pintura.
 */
export function Hero() {
  return (
    <section
      id="inicio"
      aria-labelledby="hero-title"
      className="relative isolate flex min-h-[100svh] flex-col items-center justify-center overflow-hidden px-5 pb-24 pt-28 text-center sm:px-8 sm:pt-32"
    >
      <div
        aria-hidden="true"
        className="hero-glow pointer-events-none absolute left-1/2 top-[-10%] -z-10 h-[820px] w-[1100px] -translate-x-1/2 bg-[radial-gradient(closest-side,rgba(79,140,255,0.14),rgba(79,140,255,0)_70%)]"
      />

      <HeroSenal />

      <div data-cielo-claro className="relative mt-6 flex w-full max-w-[940px] flex-col items-center gap-6 sm:mt-8">
        <p className="hero-in eyebrow m-0">{hero.etiqueta}</p>
        <h1
          id="hero-title"
          className="hero-in text-[length:var(--text-h1)] leading-[1.02] tracking-[-0.035em]"
          style={{ "--d": "60ms" }}
        >
          {hero.titulo}
        </h1>
        <p
          className="hero-in m-0 max-w-[44ch] text-[length:var(--text-lead)] leading-[1.55] text-text-2"
          style={{ "--d": "200ms" }}
        >
          {hero.subtitulo}
        </p>
        <div
          className="hero-in mt-2 flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row"
          style={{ "--d": "320ms" }}
        >
          <Button href={ctaPrincipal.href}>{ctaPrincipal.label}</Button>
          <Button href={hero.ctaSecundario.href} variant="secondary">
            {hero.ctaSecundario.label}
          </Button>
        </div>
      </div>
    </section>
  );
}

export default Hero;
