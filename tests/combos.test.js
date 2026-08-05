import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { loadPage, keydown, useTrainerClock } from './helpers/load-page.js';

let page;
let document;
let window;

/** Presses the key the trainer expects for the current step at the given timing. */
function hitCurrentStep(progress = 0.5) {
  const combo = page.combos[page.currentComboIdx];
  const step = combo.steps[page.currentStep];
  vi.advanceTimersByTime(Math.round(combo.timingMs * progress));
  keydown(document, step.key);
}

/**
 * Plays the loaded combo to completion. `perfectSteps` steps are pressed inside the
 * perfect window, the rest merely inside the good window; `missAt` step indices get a
 * wrong key first.
 */
function playCombo({ perfectSteps = Infinity, missAt = [] } = {}) {
  const total = page.combos[page.currentComboIdx].steps.length;
  for (let i = 0; i < total; i++) {
    if (missAt.includes(i)) {
      vi.advanceTimersByTime(10);
      keydown(document, 'z');
      vi.advanceTimersByTime(600); // let the miss recovery timeout run
    }
    hitCurrentStep(i < perfectSteps ? 0.5 : 0.2);
  }
}

beforeEach(async () => {
  ({ page, document, window } = await loadPage('combos'));
  useTrainerClock();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('combo data', () => {
  it('every combo has consistent metadata and steps', () => {
    expect(page.combos.length).toBeGreaterThan(0);
    for (const combo of page.combos) {
      expect(typeof combo.id).toBe('number');
      expect(combo.name).toBeTruthy();
      expect(combo.char).toBeTruthy();
      expect(combo.timingMs).toBeGreaterThan(0);
      expect(combo.steps.length).toBeGreaterThan(0);
      for (const step of combo.steps) {
        expect(step.key).toMatch(/^[a-z ]$/);
        expect(step.label).toBeTruthy();
        expect(step.input).toBeTruthy();
      }
    }
  });

  it('uses unique combo ids', () => {
    const ids = page.combos.map(c => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('filtering', () => {
  it('getFilteredCombos returns every combo by default', () => {
    expect(page.getFilteredCombos()).toHaveLength(page.combos.length);
  });

  it('filterChar narrows the list and selects the first match', () => {
    const target = page.combos[page.combos.length - 1].char;
    page.filterChar(target);
    const filtered = page.getFilteredCombos();
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.every(c => c.char === target)).toBe(true);
    expect(page.combos[page.currentComboIdx].char).toBe(target);
  });

  it('filterChar marks the matching filter pill active', () => {
    const target = page.combos[0].char;
    const pill = document.querySelector(`#charFilter .combo-pill[data-char="${target}"]`);
    page.filterChar(target);
    if (pill) expect(pill.classList.contains('active')).toBe(true);
    expect(document.querySelectorAll('#charFilter .combo-pill.active').length).toBeLessThanOrEqual(1);
  });

  it('filterChar ignores an unknown character and keeps the current combo', () => {
    page.selectCombo(2);
    page.filterChar('Nobody');
    expect(page.currentComboIdx).toBe(2);
  });

  it('filterChar("all") restores the full list', () => {
    page.filterChar(page.combos[0].char);
    page.filterChar('all');
    expect(page.getFilteredCombos()).toHaveLength(page.combos.length);
  });
});

describe('rendering', () => {
  it('renderSelector renders one pill per filtered combo', () => {
    page.filterChar(page.combos[0].char);
    const expected = page.getFilteredCombos().length;
    expect(document.querySelectorAll('#comboSelector .combo-pill')).toHaveLength(expected);
  });

  it('renderSelector marks the current combo active', () => {
    page.selectCombo(1);
    const pills = document.querySelectorAll('#comboSelector .combo-pill');
    expect(pills[1].classList.contains('active')).toBe(true);
    expect(pills[0].classList.contains('active')).toBe(false);
  });

  it('renderProgress renders a dot per filtered combo with the current one flagged', () => {
    page.selectCombo(0);
    const dots = document.querySelectorAll('#progressRow .progress-dot');
    expect(dots).toHaveLength(page.getFilteredCombos().length);
    expect(dots[0].classList.contains('current')).toBe(true);
  });

  it('renderRefTable lists every combo with a 2-digit index', () => {
    page.renderRefTable();
    const rows = document.querySelectorAll('#comboRefBody tr');
    expect(rows).toHaveLength(page.combos.length);
    expect(rows[0].children[0].textContent).toBe('01');
    expect(rows[0].children[1].textContent).toBe(page.combos[0].char);
  });

  it('renderRefTable dims rows outside the active character filter', () => {
    const target = page.combos[0].char;
    page.filterChar(target);
    page.renderRefTable();
    const rows = [...document.querySelectorAll('#comboRefBody tr')];
    const dimmed = rows.filter(r => r.getAttribute('style').includes('opacity:0.3'));
    expect(dimmed.length).toBe(page.combos.filter(c => c.char !== target).length);
  });

  it('renderSequence renders a node per step, all pending while idle', () => {
    const combo = page.combos[page.currentComboIdx];
    const nodes = document.querySelectorAll('#comboSequence .input-node');
    expect(nodes).toHaveLength(combo.steps.length);
    expect([...nodes].every(n => n.classList.contains('pending'))).toBe(true);
  });

  it('renderSequence marks hit and current nodes once a run is in progress', () => {
    page.startCombo();
    hitCurrentStep();
    page.renderSequence();
    const nodes = document.querySelectorAll('#comboSequence .input-node');
    expect(nodes[0].classList.contains('hit')).toBe(true);
    expect(nodes[1].classList.contains('current')).toBe(true);
  });

  it('loadCombo fills in the combo header and info panel', () => {
    page.selectCombo(1);
    const combo = page.combos[1];
    expect(document.getElementById('comboName').textContent).toBe(combo.name);
    expect(document.getElementById('comboChar').textContent).toContain(combo.char);
    expect(document.getElementById('comboChar').textContent).toContain(`${combo.steps.length} inputs`);
    expect(document.getElementById('comboInfo').textContent).toContain(combo.notation);
    expect(document.getElementById('comboInfo').textContent)
      .toContain(`${(combo.timingMs / 1000).toFixed(2)}s per input`);
  });
});

describe('navigation', () => {
  it('nextCombo and prevCombo move through the unfiltered list', () => {
    page.selectCombo(0);
    page.nextCombo();
    expect(page.currentComboIdx).toBe(1);
    page.prevCombo();
    expect(page.currentComboIdx).toBe(0);
  });

  it('prevCombo wraps around to the last combo', () => {
    page.selectCombo(0);
    page.prevCombo();
    expect(page.currentComboIdx).toBe(page.combos.length - 1);
  });

  it('nextCombo wraps around to the first combo', () => {
    page.selectCombo(page.combos.length - 1);
    page.nextCombo();
    expect(page.currentComboIdx).toBe(0);
  });

  it('navigation stays inside the active character filter', () => {
    const target = page.combos[0].char;
    page.filterChar(target);
    const filtered = page.getFilteredCombos();
    for (let i = 0; i < filtered.length + 1; i++) {
      expect(page.combos[page.currentComboIdx].char).toBe(target);
      page.nextCombo();
    }
  });

  it('selecting a combo cancels an in-progress run', () => {
    page.startCombo();
    expect(page.isActive).toBe(true);
    page.selectCombo(1);
    expect(page.isActive).toBe(false);
    expect(page.currentStep).toBe(0);
  });
});

describe('run lifecycle', () => {
  it('startCombo activates the run and shows the timing bar', () => {
    page.startCombo();
    expect(page.isActive).toBe(true);
    expect(page.currentStep).toBe(0);
    expect(document.getElementById('btnStart').textContent).toBe('Restart');
    expect(document.getElementById('timingContainer').style.display).toBe('block');
  });

  it('resetCombo deactivates the run and hides the timing bar', () => {
    page.startCombo();
    page.resetCombo();
    expect(page.isActive).toBe(false);
    expect(page.currentStep).toBe(0);
    expect(document.getElementById('btnStart').textContent).toBe('Start Combo');
    expect(document.getElementById('timingContainer').style.display).toBe('none');
  });

  it('resetStats zeroes the stat line', () => {
    page.startCombo();
    hitCurrentStep();
    page.resetStats();
    expect(page.stats).toEqual({ hits: 0, misses: 0, perfects: 0, streak: 0, maxStreak: 0 });
    expect(document.getElementById('statHits').textContent).toBe('0');
    expect(document.getElementById('statStreak').textContent).toBe('0');
    expect(document.getElementById('statBest').textContent).toBe('0');
  });

  it('startTimingLoop counts a miss when the input window lapses', () => {
    page.startCombo();
    const combo = page.combos[page.currentComboIdx];
    vi.advanceTimersByTime(Math.ceil(combo.timingMs * 1.3) + 32);
    expect(page.stats.misses).toBeGreaterThanOrEqual(1);
  });
});

describe('input handling', () => {
  it('ignores keys while idle but starts a run on Enter', () => {
    keydown(document, 'a');
    expect(page.isActive).toBe(false);
    keydown(document, 'Enter');
    expect(page.isActive).toBe(true);
  });

  it('Escape aborts an active run', () => {
    page.startCombo();
    keydown(document, 'Escape');
    expect(page.isActive).toBe(false);
  });

  it('ignores auto-repeat keydowns', () => {
    page.startCombo();
    const step = page.combos[page.currentComboIdx].steps[0];
    keydown(document, step.key, { repeat: true });
    expect(page.stats.hits).toBe(0);
    expect(page.currentStep).toBe(0);
  });

  it('accepts the expected key regardless of case', () => {
    page.startCombo();
    const step = page.combos[page.currentComboIdx].steps[0];
    keydown(document, step.key.toUpperCase());
    expect(page.stats.hits).toBe(1);
  });

  it('counts a mid-window press as perfect', () => {
    page.startCombo();
    hitCurrentStep(0.5);
    expect(page.stats.perfects).toBe(1);
    expect(document.getElementById('feedback').textContent).toBe('PERFECT!');
  });

  it('counts an early press as a non-perfect hit', () => {
    page.startCombo();
    hitCurrentStep(0.05);
    expect(page.stats.hits).toBe(1);
    expect(page.stats.perfects).toBe(0);
    expect(document.getElementById('feedback').textContent).toBe('HIT!');
  });

  it('counts a late-but-in-window press as a non-perfect hit', () => {
    page.startCombo();
    hitCurrentStep(0.75);
    expect(page.stats.hits).toBe(1);
    expect(page.stats.perfects).toBe(0);
  });

  it('advances the step pointer and highlights the next node on a hit', () => {
    page.startCombo();
    hitCurrentStep();
    expect(page.currentStep).toBe(1);
    const nodes = document.querySelectorAll('.input-node');
    expect(nodes[0].classList.contains('perfect')).toBe(true);
    expect(nodes[1].classList.contains('current')).toBe(true);
  });

  it('tracks streak and best streak', () => {
    page.startCombo();
    hitCurrentStep();
    hitCurrentStep();
    expect(page.stats.streak).toBe(2);
    expect(page.stats.maxStreak).toBe(2);
    expect(document.getElementById('statStreak').textContent).toBe('2');
    expect(document.getElementById('statBest').textContent).toBe('2');
  });

  it('a wrong key is a miss that breaks the streak without losing progress', () => {
    page.startCombo();
    hitCurrentStep();
    vi.advanceTimersByTime(10);
    keydown(document, 'z');
    expect(page.stats.misses).toBe(1);
    expect(page.stats.streak).toBe(0);
    expect(page.stats.maxStreak).toBe(1);
    expect(page.currentStep).toBe(1);
    expect(document.getElementById('feedback').textContent).toBe('MISS!');
  });

  it('restores the current node highlight after the miss pause', () => {
    page.startCombo();
    vi.advanceTimersByTime(10);
    keydown(document, 'z');
    const node = document.querySelector('.input-node[data-step="0"]');
    expect(node.classList.contains('miss')).toBe(true);
    vi.advanceTimersByTime(500);
    expect(node.classList.contains('miss')).toBe(false);
    expect(node.classList.contains('current')).toBe(true);
  });

  it('updateStepDisplay highlights only the current node', () => {
    page.startCombo();
    hitCurrentStep();
    page.updateStepDisplay();
    const current = document.querySelectorAll('.input-node.current');
    expect(current).toHaveLength(1);
    expect(current[0].dataset.step).toBe('1');
  });
});

describe('completion and grading', () => {
  it('a flawless run grades S and records the combo as completed', () => {
    page.selectCombo(0);
    page.startCombo();
    playCombo();
    expect(page.isActive).toBe(false);
    expect(page.completedCombos.has(0)).toBe(true);
    vi.advanceTimersByTime(800);
    expect(document.getElementById('resultsGrade').textContent).toBe('S');
    expect(document.getElementById('resAccuracy').textContent).toBe('100%');
    expect(document.getElementById('resultsOverlay').classList.contains('active')).toBe(true);
  });

  it('a clean run with half the inputs perfect grades A', () => {
    page.selectCombo(0);
    page.startCombo();
    playCombo({ perfectSteps: Math.ceil(page.combos[0].steps.length / 2) });
    vi.advanceTimersByTime(800);
    expect(document.getElementById('resultsGrade').textContent).toBe('A');
  });

  it('a clean run without perfects still only grades B', () => {
    page.selectCombo(0);
    page.startCombo();
    playCombo({ perfectSteps: 0 });
    vi.advanceTimersByTime(800);
    expect(document.getElementById('resultsGrade').textContent).toBe('B');
    expect(document.getElementById('resAccuracy').textContent).toBe('100%');
  });

  it('a run with a single miss grades B', () => {
    page.selectCombo(0);
    page.startCombo();
    playCombo({ missAt: [0] });
    vi.advanceTimersByTime(800);
    expect(document.getElementById('resultsGrade').textContent).toBe('B');
  });

  it('a run with several misses grades C and reports accuracy below 100%', () => {
    page.selectCombo(0);
    page.startCombo();
    playCombo({ missAt: [0, 1, 2] });
    vi.advanceTimersByTime(800);
    expect(document.getElementById('resultsGrade').textContent).toBe('C');
    const accuracy = Number(document.getElementById('resAccuracy').textContent.replace('%', ''));
    expect(accuracy).toBeLessThan(100);
  });

  it('the results panel reports perfects out of total steps and best streak', () => {
    page.selectCombo(0);
    const steps = page.combos[0].steps.length;
    page.startCombo();
    playCombo({ progress: 0.5 });
    vi.advanceTimersByTime(800);
    expect(document.getElementById('resPerfects').textContent).toBe(`${steps}/${steps}`);
    expect(document.getElementById('resMaxStreak').textContent).toBe(String(steps));
    expect(document.getElementById('resultsTitle').textContent).toBe(`${page.combos[0].name} Complete!`);
  });

  it('completed combos are flagged in the selector and progress row', () => {
    page.selectCombo(0);
    page.startCombo();
    playCombo();
    expect(document.querySelectorAll('#comboSelector .combo-pill')[0].classList.contains('completed')).toBe(true);
    // The dot for the loaded combo shows as current; it reads as completed once you move on.
    expect(document.querySelectorAll('#progressRow .progress-dot')[0].classList.contains('current')).toBe(true);
    page.nextCombo();
    expect(document.querySelectorAll('#progressRow .progress-dot')[0].classList.contains('completed')).toBe(true);
  });

  it('closeResults hides the overlay', () => {
    page.selectCombo(0);
    page.startCombo();
    playCombo();
    vi.advanceTimersByTime(800);
    page.closeResults();
    expect(document.getElementById('resultsOverlay').classList.contains('active')).toBe(false);
  });

  it('clicking the overlay backdrop closes it, clicking the panel does not', () => {
    const overlay = document.getElementById('resultsOverlay');
    overlay.classList.add('active');
    overlay.firstElementChild.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    expect(overlay.classList.contains('active')).toBe(true);
    overlay.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    expect(overlay.classList.contains('active')).toBe(false);
  });
});

describe('gamepad', () => {
  function fakeGamepad({ index = 0, pressed = [], axes = [0, 0], id = 'Fake Pad 8BitDo Ultimate Wireless Controller' } = {}) {
    const buttons = Array.from({ length: 16 }, (_, i) => ({ pressed: pressed.includes(i) }));
    return { index, id, buttons, axes };
  }

  function installGamepads(pads) {
    window.navigator.getGamepads = () => pads;
  }

  it('gpConnect marks the controller connected and reveals the mapping', () => {
    page.gpConnect({ gamepad: fakeGamepad({ index: 2 }) });
    expect(page.GP.connected).toBe(true);
    expect(page.GP.index).toBe(2);
    expect(document.getElementById('gamepadStatus').classList.contains('connected')).toBe(true);
    expect(document.getElementById('gpLabel').textContent).toContain('Controller connected:');
    expect(document.getElementById('gamepadMapping').style.display).toBe('flex');
  });

  it('gpConnect truncates a long controller name', () => {
    const id = 'x'.repeat(80);
    page.gpConnect({ gamepad: fakeGamepad({ id }) });
    expect(document.getElementById('gpLabel').textContent).toBe(`Controller connected: ${'x'.repeat(40)}`);
  });

  it('gpDisconnect resets the state for the connected controller', () => {
    page.gpConnect({ gamepad: fakeGamepad({ index: 1 }) });
    page.gpDisconnect({ gamepad: fakeGamepad({ index: 1 }) });
    expect(page.GP.connected).toBe(false);
    expect(page.GP.index).toBe(null);
    expect(document.getElementById('gamepadStatus').classList.contains('connected')).toBe(false);
    expect(document.getElementById('gamepadMapping').style.display).toBe('none');
  });

  it('gpDisconnect ignores a different controller', () => {
    page.gpConnect({ gamepad: fakeGamepad({ index: 1 }) });
    page.gpDisconnect({ gamepad: fakeGamepad({ index: 5 }) });
    expect(page.GP.connected).toBe(true);
    expect(page.GP.index).toBe(1);
  });

  it('gpPoll translates a button press into the mapped keydown once per press', () => {
    page.gpConnect({ gamepad: fakeGamepad() });
    page.startCombo();
    const step = page.combos[page.currentComboIdx].steps[0];
    const btnIdx = Object.keys(page.GP.btnMap).find(i => page.GP.btnMap[i] === step.key);
    expect(btnIdx).toBeDefined();

    installGamepads([fakeGamepad({ pressed: [Number(btnIdx)] })]);
    page.gpPoll();
    expect(page.stats.hits).toBe(1);

    page.gpPoll(); // still held — must not re-fire
    expect(page.stats.hits).toBe(1);
  });

  it('gpPoll highlights and releases the on-screen button', () => {
    page.gpConnect({ gamepad: fakeGamepad() });
    const btn = document.querySelector('.gamepad-btn[data-gp="0"]');
    installGamepads([fakeGamepad({ pressed: [0] })]);
    page.gpPoll();
    if (btn) expect(btn.classList.contains('pressed')).toBe(true);
    installGamepads([fakeGamepad()]);
    page.gpPoll();
    if (btn) expect(btn.classList.contains('pressed')).toBe(false);
  });

  it('gpPoll maps analog stick down and right to the d-pad keys', () => {
    page.gpConnect({ gamepad: fakeGamepad() });
    const keys = [];
    document.addEventListener('keydown', e => keys.push(e.key));
    installGamepads([fakeGamepad({ axes: [0.9, 0.9] })]);
    page.gpPoll();
    expect(keys).toContain('t');
    expect(keys).toContain('r');
  });

  it('gpPoll ignores stick movement below the threshold', () => {
    page.gpConnect({ gamepad: fakeGamepad() });
    const keys = [];
    document.addEventListener('keydown', e => keys.push(e.key));
    installGamepads([fakeGamepad({ axes: [0.2, 0.2] })]);
    page.gpPoll();
    expect(keys).toHaveLength(0);
  });

  it('connects an already-plugged-in controller on the first keypress', () => {
    installGamepads([null, fakeGamepad({ index: 1 })]);
    keydown(document, 'a');
    expect(page.GP.connected).toBe(true);
    expect(page.GP.index).toBe(1);
  });

  it('leaves the state alone on the first keypress when nothing is plugged in', () => {
    installGamepads([]);
    keydown(document, 'a');
    expect(page.GP.connected).toBe(false);
  });

  it('gpPoll is a no-op when the controller has gone away', () => {
    page.gpConnect({ gamepad: fakeGamepad({ index: 3 }) });
    installGamepads([]);
    expect(() => page.gpPoll()).not.toThrow();
  });
});

describe('feedback', () => {
  it('showFeedback displays text and clears it after the timeout', () => {
    page.showFeedback('HIT!', 'good');
    const el = document.getElementById('feedback');
    expect(el.textContent).toBe('HIT!');
    expect(el.className).toBe('feedback good show');
    vi.advanceTimersByTime(600);
    expect(el.classList.contains('show')).toBe(false);
  });

  it('showFeedback with empty text hides the element immediately', () => {
    page.showFeedback('HIT!', 'good');
    page.showFeedback('', '');
    expect(document.getElementById('feedback').classList.contains('show')).toBe(false);
  });

  it('newer feedback is not cleared by the previous message timeout', () => {
    page.showFeedback('HIT!', 'good');
    vi.advanceTimersByTime(300);
    page.showFeedback('PERFECT!', 'perfect');
    vi.advanceTimersByTime(300);
    const el = document.getElementById('feedback');
    expect(el.textContent).toBe('PERFECT!');
    expect(el.classList.contains('show')).toBe(true);
  });
});
