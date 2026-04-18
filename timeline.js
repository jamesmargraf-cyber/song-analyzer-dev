// ── SONG STRUCTURE TIMELINE ENGINE ──

const DEFAULT_SECTION_TYPES = [
  'Intro', 'Verse', 'Pre-chorus', 'Chorus',
  'Bridge', 'Solo', 'Instrumental', 'Outro', 'Coda'
];

const SECTION_COLORS = {
  'Intro':        '#4fc3f7',
  'Verse':        '#1D9E75',
  'Pre-chorus':   '#BA7517',
  'Chorus':       '#e05050',
  'Bridge':       '#7F77DD',
  'Solo':         '#D85A30',
  'Instrumental': '#378ADD',
  'Outro':        '#888780',
  'Coda':         '#ce93d8',
};

function getSectionColor(type) {
  return SECTION_COLORS[type] || '#4fc3f7';
}

// ── RENDER PALETTE ──
function renderPalette(containerId, sectionTypes, onDragStart) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';
  sectionTypes.forEach(type => {
    const chip = document.createElement('div');
    chip.className = 'section-chip';
    chip.style.background = getSectionColor(type) + '22';
    chip.style.border = '1.5px solid ' + getSectionColor(type);
    chip.style.color = getSectionColor(type);
    chip.textContent = type;
    chip.setAttribute('data-type', type);
    chip.setAttribute('draggable', 'true');
    chip.addEventListener('dragstart', e => {
      e.dataTransfer.setData('text/plain', JSON.stringify({ type, source: 'palette' }));
      chip.style.opacity = '0.5';
      if (onDragStart) onDragStart(type, 'palette');
    });
    chip.addEventListener('dragend', () => { chip.style.opacity = '1'; });
    container.appendChild(chip);
  });
}

// ── RENDER TIMELINE ──
function renderTimeline(containerId, slots, answerKey, locks, interactive, onUpdate) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';

  slots.forEach((slot, idx) => {
    const lockState = locks ? locks[idx] : null;
    const isLocked = lockState === 'full';
    const answerSlot = answerKey ? answerKey[idx] : null;

    const slotEl = document.createElement('div');
    slotEl.className = 'timeline-slot' + (isLocked ? ' locked' : '') + (slot ? ' filled' : ' empty');
    slotEl.setAttribute('data-idx', idx);

    // Slot number
    const num = document.createElement('div');
    num.className = 'slot-number';
    num.textContent = idx + 1;
    slotEl.appendChild(num);

    // Chip inside slot
    if (slot) {
      const chip = document.createElement('div');
      chip.className = 'section-chip slot-chip' + (isLocked ? ' locked-chip' : '');
      chip.style.background = getSectionColor(slot) + '22';
      chip.style.border = '1.5px solid ' + (isLocked ? '#66bb6a' : getSectionColor(slot));
      chip.style.color = isLocked ? '#66bb6a' : getSectionColor(slot);
      chip.textContent = slot;

      if (interactive && !isLocked) {
        chip.setAttribute('draggable', 'true');
        chip.addEventListener('dragstart', e => {
          e.dataTransfer.setData('text/plain', JSON.stringify({ type: slot, source: 'slot', slotIdx: idx }));
          chip.style.opacity = '0.5';
        });
        chip.addEventListener('dragend', () => { chip.style.opacity = '1'; });

        // Remove button
        const removeBtn = document.createElement('button');
        removeBtn.className = 'slot-remove';
        removeBtn.textContent = '×';
        removeBtn.addEventListener('click', e => {
          e.stopPropagation();
          slots[idx] = null;
          renderTimeline(containerId, slots, answerKey, locks, interactive, onUpdate);
          if (onUpdate) onUpdate(slots);
        });
        chip.appendChild(removeBtn);
      }

      if (isLocked) {
        const lockIcon = document.createElement('span');
        lockIcon.style.cssText = 'font-size:10px;margin-left:4px;';
        lockIcon.textContent = '✓';
        chip.appendChild(lockIcon);
      }

      slotEl.appendChild(chip);

      // Show answer key ghost if reviewing
      if (answerSlot && !isLocked && answerKey) {
        const ghost = document.createElement('div');
        ghost.className = 'slot-answer-ghost';
        ghost.style.color = getSectionColor(answerSlot);
        ghost.textContent = '→ ' + answerSlot;
        slotEl.appendChild(ghost);
      }
    } else {
      const placeholder = document.createElement('div');
      placeholder.className = 'slot-placeholder';
      placeholder.textContent = 'drop here';
      slotEl.appendChild(placeholder);
    }

    // Drop target
    if (interactive) {
      slotEl.addEventListener('dragover', e => {
        e.preventDefault();
        if (!isLocked) slotEl.classList.add('drag-over');
      });
      slotEl.addEventListener('dragleave', () => slotEl.classList.remove('drag-over'));
      slotEl.addEventListener('drop', e => {
        e.preventDefault();
        slotEl.classList.remove('drag-over');
        if (isLocked) return;
        const data = JSON.parse(e.dataTransfer.getData('text/plain'));
        // If dragging from another slot, clear that slot
        if (data.source === 'slot' && data.slotIdx !== undefined) {
          slots[data.slotIdx] = null;
        }
        slots[idx] = data.type;
        renderTimeline(containerId, slots, answerKey, locks, interactive, onUpdate);
        if (onUpdate) onUpdate(slots);
      });
    }

    container.appendChild(slotEl);
  });

  // Add / remove slot buttons (teacher only)
  if (interactive && !answerKey) {
    const controls = document.createElement('div');
    controls.style.cssText = 'display:flex;gap:8px;margin-top:12px;';

    const addBtn = document.createElement('button');
    addBtn.className = 'btn sm';
    addBtn.textContent = '+ Add section';
    addBtn.addEventListener('click', () => {
      slots.push(null);
      renderTimeline(containerId, slots, answerKey, locks, interactive, onUpdate);
      if (onUpdate) onUpdate(slots);
    });

    const removeBtn = document.createElement('button');
    removeBtn.className = 'btn sm danger';
    removeBtn.textContent = '− Remove last';
    removeBtn.addEventListener('click', () => {
      if (slots.length > 1) {
        slots.pop();
        renderTimeline(containerId, slots, answerKey, locks, interactive, onUpdate);
        if (onUpdate) onUpdate(slots);
      }
    });

    controls.appendChild(addBtn);
    controls.appendChild(removeBtn);
    container.appendChild(controls);
  }
}

// ── SCORE TIMELINE ATTEMPT ──
function scoreTimeline(studentSlots, answerSlots) {
  return answerSlots.map((correct, idx) => {
    const student = studentSlots[idx] || null;
    const grade = student === correct ? 'correct' : 'wrong';
    const score = grade === 'correct' ? 100 : 0;
    return { idx, correct, student, grade, score };
  });
}

// ── TIMELINE STYLES (injected once) ──
function injectTimelineStyles() {
  if (document.getElementById('timeline-styles')) return;
  const style = document.createElement('style');
  style.id = 'timeline-styles';
  style.textContent = `
    .timeline-container {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 4px 0;
    }
    .timeline-slot {
      display: flex;
      align-items: center;
      gap: 10px;
      background: var(--surface);
      border: 1.5px solid var(--border);
      border-radius: 10px;
      padding: 10px 14px;
      min-height: 52px;
      transition: border-color 0.15s, background 0.15s;
    }
    .timeline-slot.drag-over {
      border-color: var(--accent);
      background: var(--surface2);
    }
    .timeline-slot.locked {
      border-color: rgba(102,187,106,0.4);
      background: rgba(102,187,106,0.06);
    }
    .slot-number {
      font-family: 'DM Mono', monospace;
      font-size: 12px;
      color: var(--text3);
      width: 20px;
      flex-shrink: 0;
      text-align: center;
    }
    .slot-placeholder {
      font-size: 12px;
      color: var(--text3);
      font-style: italic;
    }
    .slot-answer-ghost {
      font-size: 11px;
      font-family: 'DM Mono', monospace;
      margin-left: auto;
    }
    .section-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 5px 12px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 500;
      cursor: grab;
      user-select: none;
      transition: opacity 0.15s;
      white-space: nowrap;
    }
    .section-chip:active { cursor: grabbing; }
    .slot-chip { cursor: grab; }
    .locked-chip { cursor: default; }
    .slot-remove {
      background: none;
      border: none;
      color: inherit;
      cursor: pointer;
      font-size: 16px;
      padding: 0;
      line-height: 1;
      opacity: 0.6;
      margin-left: 2px;
    }
    .slot-remove:hover { opacity: 1; }
    .palette-container {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      padding: 12px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      margin-bottom: 16px;
    }
    .timeline-result-row {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 7px 0;
      border-bottom: 1px solid var(--border);
      font-size: 13px;
    }
    .timeline-result-row:last-child { border-bottom: none; }
    .result-slot-num {
      font-family: 'DM Mono', monospace;
      font-size: 11px;
      color: var(--text3);
      width: 24px;
      flex-shrink: 0;
    }
    .result-chip {
      padding: 3px 10px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 500;
    }
  `;
  document.head.appendChild(style);
}
