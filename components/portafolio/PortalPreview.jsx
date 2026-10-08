/**
 * Presentación abstracta y sobria de un portal: marco de navegador, cabecera,
 * bloque principal y tres módulos. No imita ningún sitio real ni inventa
 * contenido; sirve como preview cuando no hay material fotográfico.
 * Decorativa (aria-hidden).
 */
export function PortalPreview({ className = "" }) {
  return (
    <div
      aria-hidden="true"
      className={`relative overflow-hidden rounded-[20px] border border-line-strong bg-gradient-to-b from-surface to-[#0a0c0f] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] ${className}`}
    >
      <div className="flex h-9 items-center gap-1.5 border-b border-line px-3.5">
        <span className="h-2 w-2 rounded-full bg-white/[0.18]" />
        <span className="h-2 w-2 rounded-full bg-white/[0.18]" />
        <span className="h-2 w-2 rounded-full bg-white/[0.18]" />
        <span className="ml-2.5 h-2.5 w-[46%] rounded-full bg-white/[0.08]" />
      </div>
      <div className="flex items-center gap-3 px-5 py-4">
        <span className="h-6 w-6 rounded-full bg-accent/35" />
        <span className="h-2 w-[22%] rounded bg-white/[0.22]" />
        <span className="ml-auto h-2 w-[11%] rounded bg-white/[0.12]" />
        <span className="h-2 w-[11%] rounded bg-white/[0.12]" />
        <span className="h-2 w-[11%] rounded bg-white/[0.12]" />
      </div>
      <div className="mx-5 flex h-[30%] min-h-[96px] flex-col justify-end gap-2 rounded-[14px] border border-line bg-gradient-to-br from-accent/[0.22] to-accent-2/[0.06] p-4">
        <span className="h-2.5 w-[46%] rounded bg-white/30" />
        <span className="h-2 w-[64%] rounded bg-white/[0.14]" />
      </div>
      <div className="mx-5 mb-5 mt-3.5 grid grid-cols-3 gap-3">
        {[70, 60, 80].map((w) => (
          <div
            key={w}
            className="flex h-[88px] flex-col gap-2 rounded-xl border border-line bg-white/[0.04] p-3"
          >
            <span className="h-6 w-6 rounded-lg bg-accent/30" />
            <span className="h-[7px] rounded bg-white/[0.18]" style={{ width: `${w}%` }} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default PortalPreview;
