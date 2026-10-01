import { BarChart3, FileText, Users } from "lucide-react";

const CHIPS = [
  { icon: FileText, label: "Información pública" },
  { icon: BarChart3, label: "SEvAC" },
  { icon: Users, label: "Organigrama" },
];

export function TransparenciaCTA() {
  return (
    <section>
      <p>
            Información pública, leyes, evaluaciones SEvAC y el organigrama
      </p>
      {CHIPS.map((c) => <span key={c.label}>{c.label}</span>)}
    </section>
  );
}
