/**
 * Per-app home-screen (PWA) icon support.
 *
 * The SPA ships a single static manifest + `apple-touch-icon` (the Homestead
 * brand). To let an individual app own its home-screen icon, we mutate the
 * document head at runtime when the user is inside that app:
 *
 *   - `<link rel="apple-touch-icon">` → the app's icon (iOS "Add to Home
 *     Screen" reads this directly).
 *   - `<link rel="manifest">` → a generated, app-specific manifest data URL
 *     carrying the app's name, start path and icon (Chrome/Android install).
 *   - `<meta name="apple-mobile-web-app-title">` → the app's name (the iOS
 *     home-screen label).
 *
 * The first time we touch each element we stash its original value in a
 * `data-hs-default` attribute, so `resetHomeScreenIcon` can faithfully
 * restore the global Homestead defaults — no module-level mutable state, which
 * keeps the behavior self-contained and easy to test.
 */

/** Brand color, kept in sync with `frontend/index.html`. */
const THEME_COLOR = '#F7F9FC';

const DEFAULT_APPLE_TOUCH_ICON = '/apple-touch-icon.png';
const DEFAULT_MANIFEST = '/manifest.webmanifest';
const DEFAULT_APP_TITLE = 'Homestead';

/** The minimal app metadata needed to build a home-screen icon. */
export interface HomeScreenApp {
  /** App display name → manifest name + iOS home-screen label. */
  name: string;
  /** App description (optional manifest field). */
  description?: string;
  /** Base path the installed app should launch to, e.g. `/groceries`. */
  basePath: string;
  /** URL/path to the app's square home-screen image. */
  iconHref: string;
}

function guessImageType(href: string): string {
  const path = href.split(/[?#]/, 1)[0].toLowerCase();
  if (path.endsWith('.svg')) return 'image/svg+xml';
  if (path.endsWith('.jpg') || path.endsWith('.jpeg')) return 'image/jpeg';
  if (path.endsWith('.webp')) return 'image/webp';
  return 'image/png';
}

/**
 * Build a `data:application/manifest+json` URL for a single app. All URLs are
 * resolved to absolute against `origin` because a data-URL manifest has no
 * base against which relative paths could resolve.
 */
export function buildAppManifestUrl(app: HomeScreenApp, origin: string): string {
  const icon = new URL(app.iconHref, origin).href;
  const launch = new URL(app.basePath, origin).href;
  const type = guessImageType(app.iconHref);
  const manifest = {
    name: app.name,
    short_name: app.name,
    ...(app.description ? { description: app.description } : {}),
    start_url: launch,
    scope: launch,
    display: 'standalone',
    theme_color: THEME_COLOR,
    background_color: THEME_COLOR,
    icons: [
      { src: icon, sizes: '192x192', type, purpose: 'any' },
      { src: icon, sizes: '512x512', type, purpose: 'any maskable' },
    ],
  };
  return `data:application/manifest+json,${encodeURIComponent(JSON.stringify(manifest))}`;
}

function ensureLink(doc: Document, rel: string): HTMLLinkElement {
  let link = doc.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!link) {
    link = doc.createElement('link');
    link.setAttribute('rel', rel);
    doc.head.appendChild(link);
  }
  return link;
}

function ensureMeta(doc: Document, name: string): HTMLMetaElement {
  let meta = doc.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!meta) {
    meta = doc.createElement('meta');
    meta.setAttribute('name', name);
    doc.head.appendChild(meta);
  }
  return meta;
}

/** Record the element's current attribute value once, before we overwrite it. */
function stashDefault(el: Element, attr: string, fallback: string): void {
  if (!el.hasAttribute('data-hs-default')) {
    el.setAttribute('data-hs-default', el.getAttribute(attr) ?? fallback);
  }
}

/**
 * Point the document's home-screen metadata at `app`. Idempotent and
 * reversible via {@link resetHomeScreenIcon}.
 */
export function applyHomeScreenIcon(
  doc: Document,
  app: HomeScreenApp,
  origin: string,
): void {
  const appleIcon = ensureLink(doc, 'apple-touch-icon');
  stashDefault(appleIcon, 'href', DEFAULT_APPLE_TOUCH_ICON);
  appleIcon.setAttribute('href', app.iconHref);

  const manifest = ensureLink(doc, 'manifest');
  stashDefault(manifest, 'href', DEFAULT_MANIFEST);
  manifest.setAttribute('href', buildAppManifestUrl(app, origin));

  const title = ensureMeta(doc, 'apple-mobile-web-app-title');
  stashDefault(title, 'content', DEFAULT_APP_TITLE);
  title.setAttribute('content', app.name);
}

/** Restore the global Homestead home-screen icon, name and manifest. */
export function resetHomeScreenIcon(doc: Document): void {
  const appleIcon = doc.head.querySelector<HTMLLinkElement>(
    'link[rel="apple-touch-icon"]',
  );
  if (appleIcon) {
    appleIcon.setAttribute(
      'href',
      appleIcon.getAttribute('data-hs-default') ?? DEFAULT_APPLE_TOUCH_ICON,
    );
  }

  const manifest = doc.head.querySelector<HTMLLinkElement>('link[rel="manifest"]');
  if (manifest) {
    manifest.setAttribute(
      'href',
      manifest.getAttribute('data-hs-default') ?? DEFAULT_MANIFEST,
    );
  }

  const title = doc.head.querySelector<HTMLMetaElement>(
    'meta[name="apple-mobile-web-app-title"]',
  );
  if (title) {
    title.setAttribute(
      'content',
      title.getAttribute('data-hs-default') ?? DEFAULT_APP_TITLE,
    );
  }
}
