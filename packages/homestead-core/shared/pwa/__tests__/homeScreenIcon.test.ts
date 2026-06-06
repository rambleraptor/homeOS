/**
 * Tests for the per-app home-screen (PWA) icon head mutations.
 *
 * These run against jsdom's `document`, seeding the head with the same tags
 * `packages/homestead-app/index.html` ships, then asserting apply/reset behavior.
 */

import { describe, expect, it, beforeEach } from 'vitest';
import {
  applyHomeScreenIcon,
  resetHomeScreenIcon,
  buildAppManifestUrl,
  type HomeScreenApp,
} from '../homeScreenIcon';

const ORIGIN = 'https://home.example.com';

const GROCERIES: HomeScreenApp = {
  name: 'Groceries',
  description: 'Shopping lists',
  basePath: '/groceries',
  iconHref: '/module-icons/groceries.png',
};

function seedHead(): void {
  document.head.innerHTML = `
    <meta name="apple-mobile-web-app-title" content="Homestead" />
    <link rel="manifest" href="/manifest.webmanifest" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
  `;
}

function appleTouchHref(): string | null {
  return document.head
    .querySelector('link[rel="apple-touch-icon"]')
    ?.getAttribute('href') ?? null;
}

function manifestHref(): string | null {
  return document.head
    .querySelector('link[rel="manifest"]')
    ?.getAttribute('href') ?? null;
}

function appTitle(): string | null {
  return document.head
    .querySelector('meta[name="apple-mobile-web-app-title"]')
    ?.getAttribute('content') ?? null;
}

/** Decode the JSON payload from a `data:application/manifest+json,...` URL. */
function decodeManifest(url: string): Record<string, unknown> {
  const prefix = 'data:application/manifest+json,';
  expect(url.startsWith(prefix)).toBe(true);
  return JSON.parse(decodeURIComponent(url.slice(prefix.length)));
}

describe('buildAppManifestUrl', () => {
  it('embeds the app name, absolute start_url and absolute icon', () => {
    const manifest = decodeManifest(buildAppManifestUrl(GROCERIES, ORIGIN));

    expect(manifest.name).toBe('Groceries');
    expect(manifest.short_name).toBe('Groceries');
    expect(manifest.description).toBe('Shopping lists');
    expect(manifest.start_url).toBe(`${ORIGIN}/groceries`);
    expect(manifest.scope).toBe(`${ORIGIN}/groceries`);
    expect(manifest.icons).toEqual([
      {
        src: `${ORIGIN}/module-icons/groceries.png`,
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: `${ORIGIN}/module-icons/groceries.png`,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any maskable',
      },
    ]);
  });

  it('resolves an absolute icon URL against its own origin', () => {
    const manifest = decodeManifest(
      buildAppManifestUrl(
        { ...GROCERIES, iconHref: 'https://cdn.example.com/g.svg' },
        ORIGIN,
      ),
    );
    const icons = manifest.icons as Array<{ src: string; type: string }>;
    expect(icons[0].src).toBe('https://cdn.example.com/g.svg');
    expect(icons[0].type).toBe('image/svg+xml');
  });

  it('omits description when the app has none', () => {
    const manifest = decodeManifest(
      buildAppManifestUrl({ ...GROCERIES, description: undefined }, ORIGIN),
    );
    expect('description' in manifest).toBe(false);
  });
});

describe('applyHomeScreenIcon / resetHomeScreenIcon', () => {
  beforeEach(seedHead);

  it('points apple-touch-icon, manifest and app title at the app', () => {
    applyHomeScreenIcon(document, GROCERIES, ORIGIN);

    expect(appleTouchHref()).toBe('/module-icons/groceries.png');
    expect(appTitle()).toBe('Groceries');
    const manifest = decodeManifest(manifestHref()!);
    expect(manifest.name).toBe('Groceries');
  });

  it('restores the Homestead defaults on reset', () => {
    applyHomeScreenIcon(document, GROCERIES, ORIGIN);
    resetHomeScreenIcon(document);

    expect(appleTouchHref()).toBe('/apple-touch-icon.png');
    expect(manifestHref()).toBe('/manifest.webmanifest');
    expect(appTitle()).toBe('Homestead');
  });

  it('restores the original defaults even after switching between apps', () => {
    const recipes: HomeScreenApp = {
      name: 'Recipes',
      basePath: '/recipes',
      iconHref: '/module-icons/recipes.png',
    };
    applyHomeScreenIcon(document, GROCERIES, ORIGIN);
    applyHomeScreenIcon(document, recipes, ORIGIN);

    expect(appleTouchHref()).toBe('/module-icons/recipes.png');
    expect(appTitle()).toBe('Recipes');

    resetHomeScreenIcon(document);
    expect(appleTouchHref()).toBe('/apple-touch-icon.png');
    expect(appTitle()).toBe('Homestead');
  });

  it('creates missing head tags when none are present', () => {
    document.head.innerHTML = '';
    applyHomeScreenIcon(document, GROCERIES, ORIGIN);

    expect(appleTouchHref()).toBe('/module-icons/groceries.png');
    expect(manifestHref()).not.toBeNull();
    expect(appTitle()).toBe('Groceries');
  });

  it('is a no-op on reset when nothing was applied', () => {
    expect(() => resetHomeScreenIcon(document)).not.toThrow();
    expect(appleTouchHref()).toBe('/apple-touch-icon.png');
  });
});
