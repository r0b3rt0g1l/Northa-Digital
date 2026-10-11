import { Fragment } from "react";

/**
 * Texto que entra palabra por palabra: cada palabra sube desde una máscara
 * cuando su Reveal entra en pantalla. Si el Reveal no se arma (ya visible,
 * sin JavaScript o con movimiento reducido) las palabras quedan en su sitio.
 * El texto accesible no cambia: las palabras siguen separadas por espacios.
 */
export function Palabras({ children }) {
  const palabras = String(children).split(" ");
  return palabras.map((p, i) => (
    <Fragment key={i}>
      <span className="palabra">
        <span style={{ "--i": i }}>{p}</span>
      </span>
      {i < palabras.length - 1 ? " " : null}
    </Fragment>
  ));
}

export default Palabras;
