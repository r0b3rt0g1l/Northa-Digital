"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { UserRound } from "lucide-react";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { isPendingName } from "@/lib/cabildo";
import styles from "./Organigrama.module.css";

// Tamaños de avatar por jerarquía: cabezas (lead) > Regidurías (base).
const AVATAR_SIZE = {
  lead: "h-[140px] w-[140px] md:h-[160px] md:w-[160px]",
  base: "h-[104px] w-[104px] md:h-[120px] md:w-[120px]",
};

const CARD_WIDTH = { lead: "w-[260px]", base: "w-[220px]" };

function OrgAvatar({ src, nombre, size = "base", ring = "guinda" }) {
  const dims = AVATAR_SIZE[size] ?? AVATAR_SIZE.base;
  const ringColor =
    ring === "dorado"
      ? "ring-[var(--color-dorado)]"
      : "ring-[var(--color-guinda)]";
  return (
    <div
      className={`relative ${dims} overflow-hidden rounded-full ring-2 ${ringColor}`}
    >
      {src ? (
        <Image
          src={src}
          alt={`Fotografía de ${nombre}`}
          fill
          sizes="170px"
          className="object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[var(--color-guinda-deep)] to-[var(--color-guinda)] text-[var(--color-cream)]">
          <UserRound className="h-14 w-14" aria-hidden="true" />
        </div>
      )}
    </div>
  );
}

// Nodo del organigrama. `size` controla el tamaño; `ring` el color del anillo;
// `eyebrow` la etiqueta del órgano (Presidencia/Sindicatura). Los nodos inferiores
// no llevan eyebrow (el `cargo` ya lo indica). Política Northa: cero contacto directo.
// `onClick` (opcional): si llega, el nodo es un BOTÓN accesible que abre el detalle
// (directorio). Sin `onClick` → display-only (cabildo). Nombres "[PENDIENTE: …]" se
// muestran como "Por designar".
function OrgNode({ person, eyebrow = null, size = "base", ring = "guinda", onClick = null }) {
  const reduce = useReducedMotion();
  if (!person) return null;
  const width = CARD_WIDTH[size] ?? CARD_WIDTH.base;
  const border =
    ring === "dorado"
      ? "border-[var(--color-dorado)]/40"
      : "border-[var(--color-border)]";
  const pending = isPendingName(person.nombre);
  const baseClass = `glass-light--flat flex h-full ${width} max-w-full flex-col items-center gap-3 rounded-xl p-6 text-center ${border}`;

  const inner = (
    <>
      {eyebrow && (
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-dorado-700)]">
          {eyebrow}
        </span>
      )}
      <OrgAvatar src={person.foto} nombre={person.nombre} size={size} ring={ring} />
      <div className="flex flex-col items-center gap-1">
        {pending ? (
          <h3 className="line-clamp-2 font-display text-lg font-medium italic leading-snug text-[var(--color-text-muted)]">
            Por designar
          </h3>
        ) : (
          <h3 className="line-clamp-2 font-display text-lg font-bold leading-snug text-[var(--color-guinda-deep)]">
            {person.nombre}
          </h3>
        )}
        <p className="text-[13px] text-[var(--color-text-secondary)]">
          {person.cargo}
        </p>
      </div>
    </>
  );

  if (onClick) {
    return (
      <motion.button
        type="button"
        onClick={() => onClick(person)}
        aria-label={
          pending
            ? `${person.cargo} — por designar`
            : `Ver detalles de ${person.nombre}`
        }
        whileHover={reduce ? undefined : { scale: 1.03 }}
        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        className={`${baseClass} transition-colors hover:border-[var(--color-guinda)]/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-dorado)] focus-visible:ring-offset-2`}
      >
        {inner}
      </motion.button>
    );
  }

  return (
    <motion.article
      whileHover={reduce ? undefined : { scale: 1.03 }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      className={baseClass}
    >
      {inner}
    </motion.article>
  );
}

// Organigrama jerárquico de 2 niveles: arriba la Presidencia y la Sindicatura
// LADO A LADO (a la par); debajo la fila de subordinados, unida por un conector
// que sale del centro del grupo superior. Los conectores se dibujan solo si hay
// cabeza y subordinados (robusto multi-tenant). En móvil colapsa a espina vertical.
//
// El grupo inferior es genérico: `subordinados` (p. ej. el gabinete en el Directorio)
// gana; si no llega, cae a `regidores` (uso del Cabildo, sin cambios). `onSelect`
// (opcional): si llega, los nodos son clicables y abren el detalle (Directorio);
// sin él, display-only (Cabildo).
export function Organigrama({
  presidente = null,
  sindica = null,
  regidores = [],
  subordinados = null,
  onSelect = null,
}) {
  const lower = ((subordinados ?? regidores) || []).filter(Boolean);
  const hayCabeza = Boolean(presidente || sindica);

  if (!hayCabeza && lower.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-bg)] px-6 py-12 text-center text-sm text-[var(--color-text-muted)]">
        El organigrama se publicará conforme a las designaciones oficiales.
      </div>
    );
  }

  return (
    <div className={styles.tree}>
      {hayCabeza && (
        <div className={styles.heads}>
          {presidente && (
            <OrgNode
              person={presidente}
              eyebrow="Presidencia Municipal"
              size="lead"
              ring="dorado"
              onClick={onSelect}
            />
          )}
          {sindica && (
            <OrgNode
              person={sindica}
              eyebrow="Sindicatura Municipal"
              size="lead"
              ring="guinda"
              onClick={onSelect}
            />
          )}
        </div>
      )}

      {hayCabeza && lower.length > 0 && (
        <span className={styles.trunk} aria-hidden="true" />
      )}

      {lower.length > 0 && (
        <ul className={hayCabeza ? styles.children : styles.childrenFlat}>
          {lower.map((p) => (
            <li key={p.id} className={styles.child}>
              <OrgNode person={p} size="base" ring="guinda" onClick={onSelect} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default Organigrama;
