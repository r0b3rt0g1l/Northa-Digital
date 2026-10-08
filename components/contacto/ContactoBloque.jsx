import { Reveal } from "@/components/ui/Reveal";
import { Palabras } from "@/components/ui/Palabras";
import { ContactoRapido } from "./ContactoRapido";
import { contacto } from "@/lib/content/contacto";
import { WEB3FORMS_KEY } from "@/lib/site";

/**
 * ¿Cómo inicio una conversación? El punto principal de conversión, justo
 * después de los servicios: panel de vidrio con una luz muy tenue.
 */
export function ContactoBloque() {
  return (
    <section
      id="contacto"
      aria-labelledby="contacto-title"
      className="relative overflow-hidden px-3 pb-24 pt-4 sm:px-8 sm:pb-32 lg:pb-40"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-[45%] h-[620px] w-[960px] -translate-x-1/2 -translate-y-1/2 bg-[radial-gradient(closest-side,rgba(79,140,255,0.13),rgba(79,140,255,0)_70%)]"
      />
      <Reveal className="relative mx-auto w-full max-w-[960px]">
        <div className="glass-strong rounded-[24px] p-6 sm:rounded-[32px] sm:p-10 lg:p-14">
          <div className="flex max-w-[780px] flex-col gap-4">
            <p className="eyebrow m-0">Contacto</p>
            <h2 id="contacto-title" className="text-[length:var(--text-h2)]">
              <Palabras>{contacto.titulo}</Palabras>
            </h2>
            <p className="m-0 text-[length:var(--text-lead)] text-text-2">{contacto.texto}</p>
          </div>
          <ContactoRapido accessKey={WEB3FORMS_KEY} />
        </div>
      </Reveal>
    </section>
  );
}

export default ContactoBloque;
