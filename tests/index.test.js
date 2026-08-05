import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { loadPage } from './helpers/load-page.js';

let page;
let document;
let window;

// index.html links out to roster.html and no longer ships the roster containers its
// inline script renders into, so tests supply them before the script runs.
function addRosterContainers(doc) {
  const section = doc.getElementById('roster');
  section.insertAdjacentHTML('beforeend',
    '<div id="rosterGrid"></div><div id="characterDetail" class="character-detail"></div>');
}

beforeEach(async () => {
  vi.useFakeTimers();
  ({ page, document, window } = await loadPage('index', { beforeScript: addRosterContainers }));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('character data', () => {
  it('every character carries the fields the landing page renders', () => {
    expect(page.characters.length).toBeGreaterThan(0);
    for (const c of page.characters) {
      expect(c.id).toBeTruthy();
      expect(c.num).toMatch(/^\d{2}$/);
      expect(c.name).toBeTruthy();
      expect(page.elementIcons[c.element]).toBeTruthy();
      expect(c.archetype).toBeTruthy();
      expect(c.difficulty).toBeGreaterThanOrEqual(1);
      expect(c.difficulty).toBeLessThanOrEqual(5);
      expect(c.mechanic).toBeTruthy();
      expect(c.playstyle).toBeTruthy();
      expect(Object.keys(c.moves).length).toBeGreaterThan(0);
    }
  });

  it('every move row is a [name, input, properties, description] tuple', () => {
    for (const c of page.characters) {
      for (const moves of Object.values(c.moves)) {
        for (const move of moves) {
          expect(Array.isArray(move)).toBe(true);
          expect(move.length).toBe(4);
          expect(move[0]).toBeTruthy();
          expect(move[1]).toBeTruthy();
        }
      }
    }
  });

  it('uses unique character ids', () => {
    const ids = page.characters.map(c => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('renderRoster', () => {
  it('renders a card per character with number, name and archetype', () => {
    const cards = document.querySelectorAll('#rosterGrid .character-card');
    expect(cards).toHaveLength(page.characters.length);
    const c = page.characters[0];
    expect(cards[0].querySelector('.character-number').textContent).toBe(c.num);
    expect(cards[0].querySelector('.character-name').textContent).toBe(c.name);
    expect(cards[0].querySelector('.character-archetype').textContent).toBe(c.archetype);
    expect(cards[0].dataset.element).toBe(c.element);
  });

  it('renders the element emblem and a five-star complexity meter', () => {
    const c = page.characters[0];
    const card = document.querySelector('#rosterGrid .character-card');
    expect(card.querySelector('.character-emblem').textContent).toBe(page.elementIcons[c.element]);
    const stars = card.querySelector('.stars').textContent;
    expect(stars).toHaveLength(5);
    expect([...stars].filter(s => s === '★')).toHaveLength(c.difficulty);
  });
});

describe('selectCharacter', () => {
  it('renders the detail panel for a known character', () => {
    const c = page.characters[1];
    page.selectCharacter(c.id);
    const detail = document.getElementById('characterDetail');
    expect(detail.classList.contains('active')).toBe(true);
    expect(detail.querySelector('.detail-name').textContent).toBe(c.name);
    expect(detail.querySelector('.detail-header').dataset.element).toBe(c.element);
    expect(detail.querySelector('.detail-meta').textContent).toContain(c.series);
    expect(detail.querySelector('.detail-meta').textContent).toContain(c.supports.join(', '));
  });

  it('does nothing for an unknown character id', () => {
    document.getElementById('characterDetail').innerHTML = '';
    page.selectCharacter('nobody');
    expect(document.getElementById('characterDetail').innerHTML).toBe('');
    expect(document.getElementById('characterDetail').classList.contains('active')).toBe(false);
  });

  it('moves the active highlight to the selected card', () => {
    page.selectCharacter(page.characters[0].id);
    page.selectCharacter(page.characters[2].id);
    const active = document.querySelectorAll('.character-card.active');
    expect(active).toHaveLength(1);
    expect(active[0].querySelector('.character-name').textContent).toBe(page.characters[2].name);
  });

  it('renders a move table per category with a row per move', () => {
    const c = page.characters[0];
    page.selectCharacter(c.id);
    const categories = Object.keys(c.moves);
    const lists = document.querySelectorAll(`#moves-${c.id} .move-list`);
    expect(lists).toHaveLength(categories.length);
    expect([...lists].map(l => l.querySelector('.move-list-title').textContent)).toEqual(categories);
    const rows = lists[0].querySelectorAll('tbody tr');
    expect(rows).toHaveLength(c.moves[categories[0]].length);
    const move = c.moves[categories[0]][0];
    expect(rows[0].querySelector('.move-name').textContent).toBe(move[0]);
    expect(rows[0].querySelector('.move-input').textContent).toBe(move[1]);
    expect(rows[0].querySelector('.move-desc').textContent).toBe(move[3]);
  });

  it('splits move properties on commas and semicolons into separate badges', () => {
    const c = page.characters.find(ch =>
      Object.values(ch.moves).flat().some(m => (m[2] || '').includes(',')));
    expect(c).toBeDefined();
    page.selectCharacter(c.id);
    const multi = Object.values(c.moves).flat().find(m => (m[2] || '').includes(','));
    const badges = [...document.querySelectorAll(`#moves-${c.id} .prop-badge`)].map(b => b.textContent);
    for (const part of multi[2].split(/[,;]/)) expect(badges).toContain(part.trim());
  });

  it('classifies overhead, low, invuln and energy properties', () => {
    const c = page.characters[0];
    page.selectCharacter(c.id);
    const badges = [...document.querySelectorAll(`#moves-${c.id} .prop-badge`)];
    const classOf = text => badges.find(b => b.textContent.toLowerCase().includes(text))?.classList;
    expect(classOf('overhead')?.contains('overhead')).toBe(true);
    expect(classOf('low')?.contains('low')).toBe(true);
    expect(classOf('invulnerable')?.contains('invuln')).toBe(true);
    expect(classOf('energy')?.contains('ex')).toBe(true);
    expect(badges.find(b => b.textContent === '—')?.classList.contains('default')).toBe(true);
  });

  it('renders a placeholder badge for moves without properties', () => {
    const c = page.characters[0];
    page.selectCharacter(c.id);
    const badges = [...document.querySelectorAll(`#moves-${c.id} .prop-badge`)];
    expect(badges.some(b => b.textContent === '—')).toBe(true);
  });

  it('renders a support card per support detail', () => {
    const c = page.characters[0];
    page.selectCharacter(c.id);
    const cards = document.querySelectorAll(`#supports-${c.id} .support-card`);
    expect(cards).toHaveLength(c.supportDetails.length);
    expect(cards[0].querySelector('.support-name').textContent).toBe(c.supportDetails[0].name);
    expect(cards[0].querySelector('.support-desc').textContent).toBe(c.supportDetails[0].desc);
  });

  it('renders mechanic and playstyle copy on the info tab', () => {
    const c = page.characters[0];
    page.selectCharacter(c.id);
    const paragraphs = [...document.querySelectorAll(`#info-${c.id} p`)].map(p => p.textContent);
    expect(paragraphs).toEqual([c.mechanic, c.playstyle]);
  });

  it('omits the voice row for characters without a credited voice', () => {
    const voiceless = page.characters.find(c => c.voice === '—');
    expect(voiceless).toBeDefined();
    page.selectCharacter(voiceless.id);
    expect(document.querySelector('.detail-meta').textContent).not.toContain('Voice:');
  });

  it('shows the voice row when a voice is credited', () => {
    const voiced = page.characters.find(c => c.voice && c.voice !== '—');
    page.selectCharacter(voiced.id);
    expect(document.querySelector('.detail-meta').textContent).toContain(`Voice: ${voiced.voice}`);
  });

  it('opens on the moves tab', () => {
    const c = page.characters[0];
    page.selectCharacter(c.id);
    const active = [...document.querySelectorAll('.tab-content.active')];
    expect(active).toHaveLength(1);
    expect(active[0].id).toBe(`moves-${c.id}`);
  });
});

describe('tabs and navigation', () => {
  it('switchTab activates the clicked tab and its panel only', () => {
    const c = page.characters[0];
    page.selectCharacter(c.id);
    const tabs = [...document.querySelectorAll('.detail-tab')];
    page.switchTab({ target: tabs[1] }, `supports-${c.id}`);
    expect(tabs[1].classList.contains('active')).toBe(true);
    expect(tabs[0].classList.contains('active')).toBe(false);
    const active = [...document.querySelectorAll('.tab-content.active')];
    expect(active).toHaveLength(1);
    expect(active[0].id).toBe(`supports-${c.id}`);
  });

  it('scrollToSection scrolls the requested section into view', () => {
    const spy = vi.fn();
    document.getElementById('roster').scrollIntoView = spy;
    page.scrollToSection('roster');
    expect(spy).toHaveBeenCalledWith({ behavior: 'smooth' });
  });

  it('scroll marks the nav link of the section in view', () => {
    for (const id of page.sections) {
      const el = document.getElementById(id);
      if (el) el.getBoundingClientRect = () => ({ top: id === 'mechanics' ? 50 : 500 });
    }
    window.dispatchEvent(new window.Event('scroll'));
    const active = [...document.querySelectorAll('.nav-link.active')].map(l => l.textContent.toLowerCase());
    expect(active).toEqual(['mechanics']);
  });

  it('scroll clears the active nav link when no section has been reached', () => {
    for (const id of page.sections) {
      const el = document.getElementById(id);
      if (el) el.getBoundingClientRect = () => ({ top: 500 });
    }
    window.dispatchEvent(new window.Event('scroll'));
    expect(document.querySelectorAll('.nav-link.active')).toHaveLength(0);
  });
});

describe('initialisation', () => {
  it('the shipped markup no longer provides the containers the script renders into', async () => {
    await expect(loadPage('index')).rejects.toThrow(/innerHTML/);
  });

  it('the load-time throw pre-empts the auto-select timer, so only one error surfaces', async () => {
    const before = vi.getTimerCount();
    await expect(loadPage('index')).rejects.toThrow();
    expect(vi.getTimerCount()).toBe(before);
  });

  it('auto-selects Aang shortly after load', () => {
    expect(document.getElementById('characterDetail').classList.contains('active')).toBe(false);
    vi.advanceTimersByTime(500);
    expect(document.querySelector('.detail-name').textContent).toBe('Aang');
  });
});
