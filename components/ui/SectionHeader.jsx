import { cn } from "@/lib/cn";
import { Reveal } from "./Reveal";

/**
 * Encabezado de sección: etiqueta y título a la izquierda, una línea de
 * contexto a la derecha; en móvil se apila. `titleId` = `labelledBy`.
 */
export function SectionHeader({ eyebrow, title, titleId, description, className }) {
  return (
    <Reveal className={cn("grid gap-5 md:grid-cols-2 md:items-end md:gap-12", className)}>
      <div className="flex flex-col gap-4">
        {eyebrow ? <p className="eyebrow m-0">{eyebrow}</p> : null}
        <h2 id={titleId} className="text-[length:var(--text-h2)]">
          {title}
        </h2>
      </div>
      {description ? (
        <p className="m-0 max-w-[46ch] text-[length:var(--text-lead)] text-muted md:justify-self-end">
          {description}
        </p>
      ) : null}
    </Reveal>
  );
}

export default SectionHeader;
