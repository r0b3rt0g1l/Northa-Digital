"use client";

import { useEffect, useState } from "react";

/**
 * Devuelve el id de la sección actualmente visible según IntersectionObserver.
 * @param {string[]} ids - Lista ordenada de ids a observar (sin "#").
 * @param {object} options - { rootMargin, threshold }.
 */
export function useScrollSpy(ids = [], options = {}) {
  const { rootMargin = "-45% 0px -50% 0px", threshold = 0 } = options;
  const [activeId, setActiveId] = useState(ids[0] ?? null);

  useEffect(() => {
    if (typeof window === "undefined" || !ids.length) return;

    const elements = ids
      .map((id) => document.getElementById(id))
      .filter(Boolean);

    if (!elements.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      { rootMargin, threshold },
    );

    elements.forEach((el) => observer.observe(el));
    return () => {
      elements.forEach((el) => observer.unobserve(el));
      observer.disconnect();
    };
  }, [ids, rootMargin, threshold]);

  return activeId;
}

export default useScrollSpy;
