"use client";
// Réplica para pruebas: en el molde, el contenedor del menú vive aquí y las opciones en otros
// componentes (el bundle publicado los junta en un solo chunk).
import { navItems } from "./navItems";
import { NavLink, EnlaceExterno } from "./NavLink";
import { NavDropdown } from "./NavDropdown";

export function MainNav() {
  return (
    <nav className="hidden items-stretch gap-5 lg:flex">
      <NavDropdown label="Gobierno" />
      <EnlaceExterno href="https://transparencia.sonora.gob.mx" label="Transparencia" />
      {navItems.map((item) => (
        <NavLink key={item.href} href={item.href} label={item.label} />
      ))}
    </nav>
  );
}
