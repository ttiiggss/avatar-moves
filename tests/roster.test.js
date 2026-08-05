import { describe, it, expect, beforeEach } from 'vitest';
import { loadPage, keydown } from './helpers/load-page.js';

let page;
let document;
let window;

beforeEach(async () => {
  ({ page, document, window } = await loadPage('roster'));
});

describe('character data', () => {
  it('every character carries the fields the roster renders', () => {
    expect(page.characters.length).toBeGreaterThan(0);
    for (const c of page.characters) {
      expect(c.id).toBeTruthy();
      expect(c.num).toMatch(/^\d{2}$/);
      expect(c.name).toBeTruthy();
      expect(page.elementIcons[c.element]).toBeTruthy();
      expect(c.elementLabel).toBeTruthy();
      expect(c.archetype).toBeTruthy();
      expect(c.difficulty).toBeGreaterThanOrEqual(1);
      expect(c.difficulty).toBeLessThanOrEqual(5);
      expect(Array.isArray(c.supports)).toBe(true);
      expect(Object.keys(c.moves).length).toBeGreaterThan(0);
      expect(c.supportDetails.length).toBeGreaterThan(0);
    }
  });

  it('uses unique character ids and roster numbers', () => {
    const ids = page.characters.map(c => c.id);
    const nums = page.characters.map(c => c.num);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(nums).size).toBe(nums.length);
  });

  it('exposes an icon for every element used by the roster', () => {
    const elements = new Set(page.characters.map(c => c.element));
    for (const element of elements) expect(page.elementIcons[element]).toBeTruthy();
  });
});

describe('renderRoster', () => {
  it('renders a card per character on load', () => {
    expect(document.querySelectorAll('#rosterGrid .fighter-card')).toHaveLength(page.characters.length);
  });

  it('renders name, element label, archetype, series and supports on a card', () => {
    const c = page.characters[0];
    const card = document.querySelector('#rosterGrid .fighter-card');
    expect(card.querySelector('.fighter-name').textContent).toBe(c.name);
    expect(card.querySelector('.fighter-element-label').textContent).toBe(c.elementLabel);
    expect(card.dataset.element).toBe(c.element);
    const tags = [...card.querySelectorAll('.fighter-tag')].map(t => t.textContent);
    expect(tags).toEqual([c.archetype, c.series]);
    expect(card.querySelector('.fighter-supports').textContent).toBe(`Supports: ${c.supports.join(' · ')}`);
  });

  it('renders complexity as filled and empty stars out of five', () => {
    const c = page.characters[0];
    const stars = document.querySelector('#rosterGrid .fighter-card .stars').textContent;
    expect(stars).toHaveLength(5);
    expect([...stars].filter(s => s === '★')).toHaveLength(c.difficulty);
  });

  it('falls back to the element emblem when a character has no portrait', () => {
    delete page.characters[0].portrait;
    page.renderRoster();
    const card = document.querySelector('#rosterGrid .fighter-card');
    expect(card.querySelector('img.fighter-portrait')).toBe(null);
    expect(card.querySelector('.fighter-art').textContent)
      .toContain(page.elementIcons[page.characters[0].element]);
  });

  it('renders a portrait image when the character has one', () => {
    const index = page.characters.findIndex(c => c.portrait);
    expect(index).toBeGreaterThanOrEqual(0);
    const card = document.querySelectorAll('#rosterGrid .fighter-card')[index];
    const img = card.querySelector('img.fighter-portrait');
    expect(img.getAttribute('src')).toBe(page.characters[index].portrait);
    expect(img.getAttribute('alt')).toBe(page.characters[index].name);
  });

  it('filters the grid down to a single element', () => {
    const element = page.characters[0].element;
    page.renderRoster(element);
    const cards = document.querySelectorAll('#rosterGrid .fighter-card');
    const expected = page.characters.filter(c => c.element === element).length;
    expect(cards).toHaveLength(expected);
    expect([...cards].every(card => card.dataset.element === element)).toBe(true);
  });

  it('renders an empty grid for an element nobody uses', () => {
    page.renderRoster('lightning');
    expect(document.querySelectorAll('#rosterGrid .fighter-card')).toHaveLength(0);
  });

  it('filter buttons re-render the grid and move the active state', () => {
    const button = document.querySelector('.filter-btn[data-filter="fire"]');
    button.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    expect(button.classList.contains('active')).toBe(true);
    expect(document.querySelectorAll('.filter-btn.active')).toHaveLength(1);
    const expected = page.characters.filter(c => c.element === 'fire').length;
    expect(document.querySelectorAll('#rosterGrid .fighter-card')).toHaveLength(expected);
  });
});

describe('openDetail', () => {
  it('opens the modal for a known character and locks page scrolling', () => {
    const c = page.characters[0];
    page.openDetail(c.id);
    expect(document.getElementById('detailOverlay').classList.contains('active')).toBe(true);
    expect(document.body.style.overflow).toBe('hidden');
    expect(document.querySelector('.detail-banner-name').textContent).toBe(c.name);
    expect(document.querySelector('.detail-banner').dataset.element).toBe(c.element);
  });

  it('does nothing for an unknown character id', () => {
    page.openDetail('nobody');
    expect(document.getElementById('detailOverlay').classList.contains('active')).toBe(false);
    expect(document.getElementById('detailModal').innerHTML).toBe('');
  });

  it('renders one move table per move category with a row per move', () => {
    const c = page.characters[0];
    page.openDetail(c.id);
    const categories = Object.keys(c.moves);
    const lists = document.querySelectorAll('#tab-moves .move-list');
    expect(lists).toHaveLength(categories.length);
    expect([...lists].map(l => l.querySelector('.move-list-title').textContent)).toEqual(categories);
    const firstRows = lists[0].querySelectorAll('tbody tr');
    expect(firstRows).toHaveLength(c.moves[categories[0]].length);
    const move = c.moves[categories[0]][0];
    expect(firstRows[0].querySelector('.move-name').textContent).toBe(move[0]);
    expect(firstRows[0].querySelector('.move-input').textContent).toBe(move[1]);
  });

  it('classifies move properties into badge types', () => {
    page.openDetail(page.characters[0].id);
    const badgeFor = text => [...document.querySelectorAll('#tab-moves .prop-badge')]
      .find(b => b.textContent.toLowerCase().includes(text));
    expect(badgeFor('overhead').classList.contains('overhead')).toBe(true);
    expect(badgeFor('low').classList.contains('low')).toBe(true);
    expect(badgeFor('invuln').classList.contains('invuln')).toBe(true);
    expect(badgeFor('energy').classList.contains('ex')).toBe(true);
  });

  it('renders an em dash badge when a move has no properties', () => {
    const withEmpty = page.characters.find(c =>
      Object.values(c.moves).flat().some(m => !m[2] || m[2] === '—'));
    expect(withEmpty).toBeDefined();
    page.openDetail(withEmpty.id);
    const badges = [...document.querySelectorAll('#tab-moves .prop-badge')];
    expect(badges.some(b => b.textContent === '—')).toBe(true);
  });

  it('renders a support card per support detail and counts them in the tab label', () => {
    const c = page.characters[0];
    page.openDetail(c.id);
    const cards = document.querySelectorAll('#tab-supports .support-card');
    expect(cards).toHaveLength(c.supportDetails.length);
    expect(cards[0].querySelector('.support-name').textContent).toBe(c.supportDetails[0].name);
    expect(cards[0].querySelector('.support-type').textContent).toBe(c.supportDetails[0].type);
    const supportsTab = [...document.querySelectorAll('.detail-tab')][1];
    expect(supportsTab.textContent).toBe(`Supports (${c.supports.length})`);
  });

  it('renders mechanic and playstyle text on the info tab', () => {
    const c = page.characters[0];
    page.openDetail(c.id);
    const texts = [...document.querySelectorAll('#tab-info .playstyle-text')].map(p => p.textContent);
    expect(texts).toEqual([c.mechanic, c.playstyle]);
  });

  it('omits the voice row for characters without a credited voice', () => {
    const voiceless = page.characters.find(c => c.voice === '—');
    expect(voiceless).toBeDefined();
    page.openDetail(voiceless.id);
    expect(document.querySelector('.detail-banner-meta').textContent).not.toContain('Voice:');
  });

  it('shows the voice row when a voice is credited', () => {
    const voiced = page.characters.find(c => c.voice && c.voice !== '—');
    page.openDetail(voiced.id);
    expect(document.querySelector('.detail-banner-meta').textContent).toContain(`Voice: ${voiced.voice}`);
  });
});

describe('modal interaction', () => {
  beforeEach(() => page.openDetail(page.characters[0].id));

  it('switchTab activates the clicked tab and its panel only', () => {
    const tabs = [...document.querySelectorAll('.detail-tab')];
    tabs[2].dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    page.switchTab({ target: tabs[2] }, 'tab-info');
    expect(tabs[2].classList.contains('active')).toBe(true);
    expect(tabs[0].classList.contains('active')).toBe(false);
    const active = [...document.querySelectorAll('.tab-content.active')];
    expect(active).toHaveLength(1);
    expect(active[0].id).toBe('tab-info');
  });

  it('closeDetail hides the overlay and restores scrolling', () => {
    page.closeDetail();
    expect(document.getElementById('detailOverlay').classList.contains('active')).toBe(false);
    expect(document.body.style.overflow).toBe('');
  });

  it('clicking the backdrop closes the modal, clicking inside it does not', () => {
    const overlay = document.getElementById('detailOverlay');
    document.getElementById('detailModal').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    expect(overlay.classList.contains('active')).toBe(true);
    overlay.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    expect(overlay.classList.contains('active')).toBe(false);
  });

  it('Escape closes the modal and other keys do not', () => {
    const overlay = document.getElementById('detailOverlay');
    keydown(document, 'a');
    expect(overlay.classList.contains('active')).toBe(true);
    keydown(document, 'Escape');
    expect(overlay.classList.contains('active')).toBe(false);
  });
});
