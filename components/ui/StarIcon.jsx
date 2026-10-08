import { cn } from "@/lib/cn";

/**
 * Estrella polar de 8 puntas — motivo de marca de Northa ("el norte").
 * Cuerpo en currentColor + un cuadrante en el acento.
 * Decorativa por defecto (aria-hidden); pasa `title` para uso semántico.
 */
export function StarIcon({ className, title }) {
  return (
    <svg
      viewBox="0 0 200 200"
      className={cn("text-text", className)}
      role={title ? "img" : undefined}
      aria-label={title || undefined}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      {title ? <title>{title}</title> : null}
      <path
        d="M100 18 L121.2 78.8 L168 100 L121.2 121.2 L100 182 L78.8 121.2 L32 100 L78.8 78.8 Z"
        className="fill-current"
      />
      <path
        d="M100 18 L121.2 78.8 L100 100 L78.8 78.8 Z"
        className="fill-accent"
      />
    </svg>
  );
}

export default StarIcon;
