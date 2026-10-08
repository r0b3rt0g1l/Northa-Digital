import { Reveal } from "@/components/ui/Reveal";
import { ContactoRapido } from "./ContactoRapido";
import { WEB3FORMS_KEY } from "@/lib/site";

/**
 * Bloque estratégico de conversión, después de los servicios.
 * Vidrio oscuro destacado, halo tenue y entrada animada.
 */
export function ContactoBloque() {
  return (
    <section
      id="contacto"
      aria-labelledby="contacto-title"
      className="relative scroll-mt-24 overflow-hidden px-4 pb-[88px] pt-6 sm:px-8 sm:pb-28 lg:pb-32"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-[40%] h-[600px] w-[900px] -translate-x-1/2 -translate-y-1/2 bg-[radial-gradient(closest-side,rgba(79,140,255,0.14),rgba(79,140,255,0)_70%)]"
      />
      <Reveal className="glass-strong relative mx-auto w-full max-w-[960px] rounded-[24px] p-6 sm:rounded-[28px] sm:p-10 lg:p-14">
        <div className="flex max-w-[640px] flex-col gap-4">
          <p className="eyebrow m-0">Contacto</p>
          <h2 id="contacto-title" className="text-[length:var(--text-h2)]">
            Cuéntanos qué necesitas en 30 segundos.
          </h2>
          <p className="m-0 text-[length:var(--text-lead)] text-text-2">
            No necesitas tener todo definido. Compártenos tu idea, objetivo o
            problema y te ayudamos a identificar el siguiente paso.
          </p>
        </div>
        <ContactoRapido accessKey={WEB3FORMS_KEY} />
      </Reveal>
    </section>
  );
}

export default ContactoBloque;
