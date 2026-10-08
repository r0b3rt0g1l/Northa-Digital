import { Button } from "@/components/ui/Button";
import { StarIcon } from "@/components/ui/StarIcon";

export default function NotFound() {
  return (
    <section className="relative flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
      <StarIcon className="h-14 w-14 [filter:drop-shadow(0_0_30px_rgba(79,140,255,0.45))]" />
      <h1 className="text-[length:var(--text-h2)]">Página no encontrada</h1>
      <p className="m-0 max-w-md text-text-2">
        La página que buscas no existe o cambió de lugar.
      </p>
      <Button href="/">Volver al inicio</Button>
    </section>
  );
}
