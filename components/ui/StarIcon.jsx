import { cn } from "@/lib/cn";

/**
 * Estrella polar de 8 puntas: el motivo de marca de Northa ("el norte").
 * Cuerpo en currentColor y un cuadrante en el acento. Decorativa.
 */
export function StarIcon({ className }) {
  return (
    <svg
      viewBox="0 0 200 200"
      className={cn("text-text", className)}
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M100 18 L121.2 78.8 L168 100 L121.2 121.2 L100 182 L78.8 121.2 L32 100 L78.8 78.8 Z"
        className="fill-current"
      />
      <path d="M100 18 L121.2 78.8 L100 100 L78.8 78.8 Z" className="fill-accent" />
    </svg>
  );
}

export default StarIcon;
