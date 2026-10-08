import { cn } from "@/lib/cn";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-[background-color,border-color,color,box-shadow] duration-300 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60";

const sizes = {
  md: "h-[52px] px-6 text-[15px]",
  sm: "h-10 px-[18px] text-sm",
};

const variants = {
  primary:
    "bg-text text-bg shadow-[0_12px_40px_-16px_rgba(79,140,255,0.6)] hover:bg-white hover:shadow-[0_16px_48px_-16px_rgba(79,140,255,0.8)]",
  secondary: "glass glass-hover font-medium text-text",
  ghost:
    "border border-line-strong font-medium text-text-2 hover:border-white/25 hover:text-text",
};

/**
 * Botón / enlace de acción. Renderiza <a> si se pasa `href`, si no <button>.
 * `magnetic` activa el imán del cursor en escritorio (ver components/cursor).
 * Compartido (sin estado) — válido en Server y Client.
 */
export function Button({
  href,
  variant = "primary",
  size = "md",
  magnetic = true,
  className,
  children,
  external = false,
  ...props
}) {
  const cls = cn(base, sizes[size] || sizes.md, variants[variant] || variants.primary, className);
  const magnet = magnetic ? { "data-magnetic": "" } : {};

  if (href) {
    const ext = external
      ? { target: "_blank", rel: "noopener noreferrer" }
      : {};
    return (
      <a href={href} className={cls} {...magnet} {...ext} {...props}>
        {children}
      </a>
    );
  }

  return (
    <button type="button" className={cls} {...magnet} {...props}>
      {children}
    </button>
  );
}

export default Button;
