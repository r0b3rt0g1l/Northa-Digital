import { cn } from "@/lib/cn";
import { StarIcon } from "./StarIcon";

/**
 * Lockup de marca: símbolo en squircle + wordmark "Northa Digital".
 * Compartido (sin estado) — válido en Server y Client.
 */
export function Logo({ className, compact = false }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] border border-line-strong bg-gradient-to-b from-[#171a20] to-[#0e1014]">
        <StarIcon className="h-[18px] w-[18px]" />
      </span>
      <span className="font-display text-[17px] font-semibold tracking-[-0.01em] text-text">
        Northa
        {compact ? null : <span className="font-medium text-muted"> Digital</span>}
      </span>
    </span>
  );
}

export default Logo;
