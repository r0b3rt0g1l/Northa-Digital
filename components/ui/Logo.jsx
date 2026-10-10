import { cn } from "@/lib/cn";
import { StarIcon } from "./StarIcon";

/**
 * Lockup de marca: símbolo en squircle + "Northa Digital".
 * Por debajo de 400 px se queda en "Northa" para no partirse en dos líneas.
 */
export function Logo({ className }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5 whitespace-nowrap", className)}>
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] border border-line-strong bg-gradient-to-b from-[#171a20] to-[#0e1014]">
        <StarIcon className="h-[18px] w-[18px]" />
      </span>
      <span className="font-display text-[17px] font-semibold tracking-[-0.01em] text-text">
        Northa
        <span className="font-medium text-muted max-[400px]:hidden"> Digital</span>
      </span>
    </span>
  );
}

export default Logo;
