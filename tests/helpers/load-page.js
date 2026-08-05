import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { vi } from 'vitest';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

// `performance` is intentionally left as node's: jsdom's implementation delegates
// to the global one, so re-exposing it globally makes now() recurse forever.
const GLOBALS = [
  'window', 'document', 'navigator', 'location',
  'KeyboardEvent', 'Event', 'MouseEvent', 'HTMLElement', 'Node',
  'requestAnimationFrame', 'cancelAnimationFrame', 'getComputedStyle',
];

/**
 * Boots a page's inline script inside a fresh jsdom document and returns the
 * page module together with the DOM it rendered into.
 *
 * `beforeScript` runs against the parsed document before the page script does,
 * which lets a test supply containers the page's markup does not provide.
 */
export async function loadPage(name, { beforeScript } = {}) {
  const html = readFileSync(join(repoRoot, `${name}.html`), 'utf8');
  const dom = new JSDOM(html, { url: 'https://example.test/', pretendToBeVisual: true });

  for (const key of GLOBALS) {
    const value = dom.window[key];
    globalThis[key] = typeof value === 'function' ? value.bind(dom.window) : value;
  }
  // jsdom does not implement scrollIntoView.
  dom.window.Element.prototype.scrollIntoView = () => {};

  beforeScript?.(dom.window.document);

  vi.resetModules();
  const page = await import(`../generated/${name}.js`);
  return { page, dom, window: dom.window, document: dom.window.document };
}

/** Fake timers that also drive performance.now() and the animation frame loop. */
export function useTrainerClock() {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance', 'requestAnimationFrame', 'cancelAnimationFrame'] });
}

export function keydown(document, key, init = {}) {
  const event = new document.defaultView.KeyboardEvent('keydown', { key, bubbles: true, ...init });
  document.dispatchEvent(event);
  return event;
}
