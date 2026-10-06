/**
 * Bereitet das HTML der Schüler:innen für die Anzeige im Browser-Fenster und in der Vorschau vor.
 *
 * Zwei Schutzschichten (Datenschutz, offline, keine Skripte):
 * 1. `bereinigeHtml` entfernt alles, was ausführen oder von außen nachladen könnte. `DOMParser` lädt dabei
 *    selbst nichts. Links werden zu `data-href`, damit ein Klick nie das iframe wegnavigiert –
 *    die App fängt ihn ab und schickt ihn als Anfrage durch die Simulation.
 * 2. Content-Security-Policy im Dokument als zweite Absicherung.
 */
const CSP = "default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:";

const VERBOTENE_ELEMENTE = 'script, iframe, frame, object, embed, link, meta, base, form, noscript, template';
const URL_ATTRIBUTE = ['src', 'srcset', 'poster', 'background', 'action', 'formaction', 'data', 'xlink:href'];

/** Erlaubt sind nur eingebettete data:-Inhalte, keine Adressen nach außen. */
function istErlaubteQuelle(wert: string): boolean {
  return /^\s*data:/i.test(wert);
}

function bereinigeCss(css: string): string {
  return css
    .replace(/url\s*\(([^)]*)\)/gi, (treffer, inhalt: string) =>
      istErlaubteQuelle(inhalt.replace(/["']/g, '')) ? treffer : 'none',
    )
    .replace(/@import[^;]*;?/gi, '');
}

export function bereinigeHtml(html: string): string {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  doc.querySelectorAll(VERBOTENE_ELEMENTE).forEach((el) => el.remove());
  doc.querySelectorAll('*').forEach((el) => {
    for (const attr of [...el.attributes]) {
      const name = attr.name.toLowerCase();
      if (name.startsWith('on')) el.removeAttribute(attr.name);
      else if (URL_ATTRIBUTE.includes(name) && !istErlaubteQuelle(attr.value)) el.removeAttribute(attr.name);
      else if (name === 'style') el.setAttribute('style', bereinigeCss(attr.value));
    }
    if (el.tagName === 'A' || el.tagName === 'AREA') {
      const ziel = el.getAttribute('href');
      el.removeAttribute('href');
      el.removeAttribute('target');
      if (ziel) {
        el.setAttribute('data-href', ziel);
        el.setAttribute('role', 'link');
        el.setAttribute('tabindex', '0');
      }
    }
    if (el.tagName === 'STYLE') el.textContent = bereinigeCss(el.textContent ?? '');
  });
  return doc.body.innerHTML;
}

/** Kennung der Nachricht, mit der das Link-Skript im iframe einen Klick an die App meldet. */
export const LINK_NACHRICHT = 'netzwerkstatt-link';

/**
 * Winziges eigenes Skript für das Browser-Fenster: meldet Klicks/Enter auf Links per postMessage.
 * Läuft im isolierten iframe (allow-scripts ohne allow-same-origin) und ist per Nonce freigegeben –
 * Skripte aus dem HTML der Schüler:innen sind entfernt und hätten ohnehin keinen gültigen Nonce.
 */
function linkSkript(nonce: string): string {
  return `<script nonce="${nonce}">(function(){function f(e){var a=e.target&&e.target.closest&&e.target.closest('[data-href]');if(!a)return;e.preventDefault();parent.postMessage({typ:'${LINK_NACHRICHT}',href:a.getAttribute('data-href')},'*');}document.addEventListener('click',f);document.addEventListener('keydown',function(e){if(e.key==='Enter')f(e);});})();</script>`;
}

/**
 * Vollständiges Dokument für ein iframe. Mit `nonce` wird das Link-Skript eingebaut (Browser-Fenster);
 * ohne bleibt die Seite völlig skriptfrei (Vorschau im Editor).
 */
export function seitenDokument(html: string, nonce?: string): string {
  const csp = nonce ? `${CSP}; script-src 'nonce-${nonce}'` : CSP;
  return `<!doctype html><html lang="de"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<style>body{font-family:system-ui,sans-serif;margin:16px;line-height:1.5;color:#14181f;background:#fff}
[data-href]{color:#1f4e79;text-decoration:underline;cursor:pointer}</style>
</head><body>${bereinigeHtml(html)}${nonce ? linkSkript(nonce) : ''}</body></html>`;
}
