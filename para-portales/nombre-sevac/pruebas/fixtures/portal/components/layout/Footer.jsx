const ENLACES = [
  { label: "Transparencia", href: "/transparencia" },
  { label: "SEvAC", href: "/transparencia/sevac" },
  { label: "Contacto", href: "/contacto" },
];

export function Footer() {
  return <footer>{ENLACES.map((e) => <a key={e.href} href={e.href}>{e.label}</a>)}</footer>;
}
