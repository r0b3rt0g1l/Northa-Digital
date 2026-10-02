// RECONSTRUCCIÓN PARA PRUEBAS: solo la forma de lo que usa el script (el api.js real tiene más).
import { cookies } from "next/headers";

const BASE = process.env.API_URL;

export function getSession() {
  return cookies();
}

async function getMunicipioSlug() {
  const s = await getSession();
  return s?.municipioSlug;
}

export async function apiFetch(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, opts);
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

export async function getSevac(filtros = {}) {
  const slug = await getMunicipioSlug();
  return apiFetch(`/api/municipios/${slug}/sevac/admin/todas`);
}

export async function updateSevac(id, formData) {
  const slug = await getMunicipioSlug();
  return apiFetch(`/api/municipios/${slug}/sevac/${id}`, { method: "PUT", body: formData });
}
