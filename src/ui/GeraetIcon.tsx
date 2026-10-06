import type { ReactNode } from 'react';
import type { GeraetTyp } from '../model/datei';

/** Eigene, neutrale Linien-Icons (keine Übernahme aus Filius). Farbe über currentColor. */
const pfade: Record<GeraetTyp, ReactNode> = {
  computer: (
    <>
      <rect x="3" y="4" width="18" height="12" rx="1.5" />
      <path d="M8 20h8M12 16v4" />
    </>
  ),
  smartphone: (
    <>
      <rect x="7" y="2.5" width="10" height="19" rx="2" />
      <path d="M11 18.5h2" />
    </>
  ),
  spielkonsole: (
    <>
      <path d="M6.5 8h11a4 4 0 0 1 4 4.2l-.3 3.3a2.5 2.5 0 0 1-4.3 1.5L15 15H9l-1.9 2a2.5 2.5 0 0 1-4.3-1.5l-.3-3.3A4 4 0 0 1 6.5 8Z" />
      <path d="M7.5 10.5v3M6 12h3M15.5 11.5h.01M17.5 13h.01" />
    </>
  ),
  server: (
    <>
      <rect x="4" y="3" width="16" height="7" rx="1.5" />
      <rect x="4" y="14" width="16" height="7" rx="1.5" />
      <path d="M8 6.5h.01M8 17.5h.01M12 6.5h5M12 17.5h5" />
    </>
  ),
  switch: (
    <>
      <rect x="2.5" y="7" width="19" height="10" rx="1.5" />
      <path d="M6 11h2M10 11h2M14 11h2M6 14h2M10 14h2M14 14h2M18.5 12.5h.01" />
    </>
  ),
  router: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 5v5M12 14v5M5 12h5M14 12h5M10 7l2-2 2 2M10 17l2 2 2-2M7 10l-2 2 2 2M17 10l2 2-2 2" />
    </>
  ),
  'access-point': (
    <>
      <rect x="4" y="15" width="16" height="5" rx="1.5" />
      <path d="M12 15v-3M8.5 9.5a5 5 0 0 1 7 0M6 7a8.5 8.5 0 0 1 12 0" />
      <path d="M8 17.5h.01" />
    </>
  ),
};

export function GeraetIcon({ typ, groesse = 32 }: { typ: GeraetTyp; groesse?: number }) {
  return (
    <svg
      width={groesse}
      height={groesse}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {pfade[typ]}
    </svg>
  );
}
