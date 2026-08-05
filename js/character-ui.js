// ═══════════════════════════════════════════════════════
// AVATAR LEGENDS — SHARED CHARACTER UI HELPERS
// Rendering pieces used by both the guide (index.html)
// and the roster (roster.html).
// ═══════════════════════════════════════════════════════

const elementIcons = {
  air: '🌀', water: '🌊', earth: '⛰️', fire: '🔥', spirit: '✨', nonbender: '⚔️'
};

// ── Complexity stars, e.g. 4 → ★★★★☆ ──
function renderStars(difficulty, max = 5) {
  return '★'.repeat(difficulty) + '☆'.repeat(max - difficulty);
}

// ── Category for a single move property, drives .prop-badge colour ──
function propBadgeClass(prop) {
  const t = prop.trim().toLowerCase();
  if (t.includes('overhead')) return 'overhead';
  if (t.includes('low')) return 'low';
  if (t.includes('invuln')) return 'invuln';
  if (t.includes('energy') || t.includes('ex')) return 'ex';
  if (t.includes('super') || t.includes('7 energy') || t.includes('4 energy')) return 'super';
  return 'default';
}

// ── Comma/semicolon separated property list → badges ──
function renderPropBadges(props) {
  const badges = (props || '').split(/[,;]/)
    .map(p => `<span class="prop-badge ${propBadgeClass(p)}">${p.trim()}</span>`)
    .join('');
  return badges || '<span class="prop-badge default">—</span>';
}

// ── One table per move category ──
function renderMoveTables(character) {
  return Object.entries(character.moves).map(([category, moves]) => `
    <div class="move-list">
      <div class="move-list-title">${category}</div>
      <table class="move-table">
        <thead>
          <tr>
            <th style="width: 25%">Move</th>
            <th style="width: 20%">Input</th>
            <th style="width: 20%">Properties</th>
            <th style="width: 35%">Description</th>
          </tr>
        </thead>
        <tbody>
          ${moves.map(m => `
            <tr>
              <td class="move-name">${m[0]}</td>
              <td class="move-input">${m[1]}</td>
              <td><div class="move-props">${renderPropBadges(m[2])}</div></td>
              <td class="move-desc">${m[3] || ''}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `).join('');
}

// ── Support cards grid contents ──
function renderSupportCards(supportDetails) {
  return supportDetails.map(s => `
    <div class="support-card">
      <div class="support-name">${s.name}</div>
      <div class="support-type">${s.type}</div>
      <div class="support-desc">${s.desc}</div>
    </div>
  `).join('');
}

// ── Tab switching within a detail panel (falls back to the document) ──
function switchTab(evt, tabId) {
  evt.target.parentElement.querySelectorAll('.detail-tab')
    .forEach(t => t.classList.remove('active'));
  evt.target.classList.add('active');

  const scope = evt.target.closest('.character-detail') || document;
  scope.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.getElementById(tabId).classList.add('active');
}
