// ── STEREO MAP ENGINE ──
// Delta-based dragging: tracks cursor movement frame-to-frame,
// applies scale correction for SVG viewport vs rendered size.

const MAP_CX = 340, MAP_CY = 430;
const MAP_RADII = [85, 145, 200, 245, 280];

const COLOR_LIST = [
  '#e05050','#1D9E75','#378ADD','#BA7517','#D85A30','#7F77DD',
  '#f06292','#4fc3f7','#aed581','#ffb74d','#ce93d8','#80cbc4'
];

// ── COORDINATE MATH ──
function mapAngleToXY(angleDeg, radius) {
  const rad = angleDeg * Math.PI / 180;
  return {
    x: MAP_CX + radius * Math.cos(rad),
    y: MAP_CY - radius * Math.sin(rad)
  };
}

function mapXYToAngleRadius(x, y) {
  const dx = x - MAP_CX;
  const dy = MAP_CY - y;
  let a = Math.atan2(dy, dx) * 180 / Math.PI;
  a = Math.min(180, Math.max(0, a));
  const dist = Math.sqrt(dx * dx + dy * dy);
  const clamped = Math.min(Math.max(dist, MAP_RADII[0]), MAP_RADII[MAP_RADII.length - 1]);
  const snapped = MAP_RADII.reduce((a, b) =>
    Math.abs(b - clamped) < Math.abs(a - clamped) ? b : a
  );
  return { angle: a, radius: snapped };
}

function mapClockLabel(a) {
  const hour = 9 + ((180 - a) / 180) * 6;
  const h = Math.floor(hour);
  const m = Math.round((hour - h) * 60);
  return h + ':' + (m === 0 ? '00' : m < 10 ? '0' + m : m);
}

function mapSideLabel(a) {
  if (a < 89) return 'R';
  if (a > 91) return 'L';
  return 'C';
}

function mapLabelOffset(a) {
  if (a < 70)  return { dx: 14,  dy: -4, anchor: 'start'  };
  if (a > 110) return { dx: -14, dy: -4, anchor: 'end'    };
  return { dx: 0, dy: -16, anchor: 'middle' };
}

// ── STEREO ARC MATH ──
// Draw a wedge arc from (centerAngle - halfWidth) to (centerAngle + halfWidth)
// at the given radius, as a filled semi-transparent path
function buildArcPath(centerAngle, halfWidth, radius) {
  const startAngle = Math.max(0, centerAngle - halfWidth);
  const endAngle = Math.min(180, centerAngle + halfWidth);
  const outerR = radius + 18;
  const innerR = Math.max(10, radius - 18);

  const s1 = mapAngleToXY(startAngle, outerR);
  const e1 = mapAngleToXY(endAngle, outerR);
  const s2 = mapAngleToXY(endAngle, innerR);
  const e2 = mapAngleToXY(startAngle, innerR);

  const largeArc = (endAngle - startAngle) > 180 ? 1 : 0;

  return `M ${s1.x} ${s1.y} A ${outerR} ${outerR} 0 ${largeArc} 0 ${e1.x} ${e1.y} L ${s2.x} ${s2.y} A ${innerR} ${innerR} 0 ${largeArc} 1 ${e2.x} ${e2.y} Z`;
}

// ── SVG BASE BUILDER ──
function buildMapBase(svgEl) {
  svgEl.innerHTML = '';

  const radii = [280, 245, 200, 145, 85];
  radii.forEach((r, i) => {
    const opacity = 0.06 + i * 0.035;
    const fill = makeSVG('path');
    fill.setAttribute('d', `M ${MAP_CX - r} ${MAP_CY} A ${r} ${r} 0 0 1 ${MAP_CX + r} ${MAP_CY}`);
    fill.setAttribute('fill', `rgba(79,195,247,${opacity.toFixed(3)})`);
    fill.setAttribute('stroke', 'none');
    svgEl.appendChild(fill);

    const stroke = makeSVG('path');
    stroke.setAttribute('d', `M ${MAP_CX - r} ${MAP_CY} A ${r} ${r} 0 0 1 ${MAP_CX + r} ${MAP_CY}`);
    stroke.setAttribute('fill', 'none');
    stroke.setAttribute('stroke', 'rgba(79,195,247,0.18)');
    stroke.setAttribute('stroke-width', '0.5');
    svgEl.appendChild(stroke);
  });

  [180, 150, 120, 90, 60, 30, 0].forEach(a => {
    const rad = a * Math.PI / 180;
    const line = makeSVG('line');
    line.setAttribute('x1', MAP_CX); line.setAttribute('y1', MAP_CY);
    line.setAttribute('x2', MAP_CX + 280 * Math.cos(rad));
    line.setAttribute('y2', MAP_CY - 280 * Math.sin(rad));
    line.setAttribute('stroke', 'rgba(79,195,247,0.07)');
    line.setAttribute('stroke-width', '0.5');
    svgEl.appendChild(line);
  });

  const ticks = [
    { a: 180, label: '9:00',  tx: 22,  ty: 436 },
    { a: 150, label: '10:00', tx: 82,  ty: 255 },
    { a: 120, label: '11:00', tx: 172, ty: 148 },
    { a: 90,  label: '12:00', tx: 340, ty: 107 },
    { a: 60,  label: '1:00',  tx: 508, ty: 148 },
    { a: 30,  label: '2:00',  tx: 598, ty: 255 },
    { a: 0,   label: '3:00',  tx: 658, ty: 436 },
  ];
  ticks.forEach(t => {
    const rad = t.a * Math.PI / 180;
    const ix = MAP_CX + 280 * Math.cos(rad);
    const iy = MAP_CY - 280 * Math.sin(rad);
    const ox = MAP_CX + 298 * Math.cos(rad);
    const oy = MAP_CY - 298 * Math.sin(rad);
    const line = makeSVG('line');
    line.setAttribute('x1', ix); line.setAttribute('y1', iy);
    line.setAttribute('x2', ox); line.setAttribute('y2', oy);
    line.setAttribute('stroke', 'rgba(79,195,247,0.35)');
    line.setAttribute('stroke-width', '1.2');
    line.setAttribute('stroke-linecap', 'round');
    svgEl.appendChild(line);

    const text = makeSVG('text');
    text.setAttribute('x', t.tx); text.setAttribute('y', t.ty);
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('font-family', 'DM Mono, monospace');
    text.setAttribute('font-size', '11');
    text.setAttribute('fill', 'rgba(79,195,247,0.55)');
    text.textContent = t.label;
    svgEl.appendChild(text);
  });

  [
    ['ellipse', { cx: 340, cy: 454, rx: 38, ry: 13, fill: '#c0392b', opacity: 0.7 }],
    ['rect',    { x: 333, y: 439, width: 14, height: 14, rx: 3, fill: '#d4a574' }],
    ['circle',  { cx: 340, cy: 430, r: 17, fill: '#d4a574' }],
    ['ellipse', { cx: 323, cy: 430, rx: 4, ry: 6, fill: '#c49060' }],
    ['ellipse', { cx: 357, cy: 430, rx: 4, ry: 6, fill: '#c49060' }],
    ['circle',  { cx: 340, cy: 426, r: 9, fill: '#e8b88a', opacity: 0.45 }],
  ].forEach(([tag, attrs]) => {
    const el = makeSVG(tag);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    svgEl.appendChild(el);
  });

  // Stereo arcs group (behind dots)
  const arcsG = makeSVG('g');
  arcsG.setAttribute('id', svgEl.id + '-arcs');
  svgEl.appendChild(arcsG);

  // Dots group (on top)
  const g = makeSVG('g');
  g.setAttribute('id', svgEl.id + '-dots');
  svgEl.appendChild(g);
}

// ── RENDER DOTS + ARCS ──
function renderDots(svgEl, instruments, activeIdx = null, answerKey = null, locks = {}) {
  const arcsG = document.getElementById(svgEl.id + '-arcs');
  const g = document.getElementById(svgEl.id + '-dots');
  if (!g) return;
  arcsG.innerHTML = '';
  g.innerHTML = '';

  // Draw answer key ghost arcs/dots first
  if (answerKey) {
    answerKey.forEach((ans, idx) => {
      const inst = instruments[idx];
      if (!inst || ans.angle == null) return;

      if (inst.type === 'stereo') {
        // Ghost arc for answer key
        const halfWidth = (ans.widthMin + ans.widthMax) / 4;
        const arcPath = buildArcPath(ans.angle, halfWidth, ans.radius || MAP_RADII[2]);
        const arc = makeSVG('path');
        arc.setAttribute('d', arcPath);
        arc.setAttribute('fill', inst.color);
        arc.setAttribute('fill-opacity', '0.2');
        arc.setAttribute('stroke', inst.color);
        arc.setAttribute('stroke-width', '1.5');
        arc.setAttribute('stroke-dasharray', '4 3');
        arc.setAttribute('opacity', '0.6');
        arcsG.appendChild(arc);
      } else {
        // Ghost dot for mono answer key
        const { x, y } = mapAngleToXY(ans.angle, ans.radius);
        const { x: sx, y: sy } = mapAngleToXY(inst.angle, inst.radius);
        if (Math.hypot(sx - x, sy - y) > 4) {
          const line = makeSVG('line');
          line.setAttribute('x1', sx); line.setAttribute('y1', sy);
          line.setAttribute('x2', x);  line.setAttribute('y2', y);
          line.setAttribute('stroke', inst.color);
          line.setAttribute('stroke-width', '1');
          line.setAttribute('stroke-dasharray', '3 3');
          line.setAttribute('opacity', '0.35');
          g.appendChild(line);
        }
        const ghost = makeSVG('circle');
        ghost.setAttribute('cx', x); ghost.setAttribute('cy', y);
        ghost.setAttribute('r', (inst.r || 8) + 4);
        ghost.setAttribute('fill', 'none');
        ghost.setAttribute('stroke', inst.color);
        ghost.setAttribute('stroke-width', '1.5');
        ghost.setAttribute('stroke-dasharray', '3 2');
        ghost.setAttribute('opacity', '0.65');
        g.appendChild(ghost);
      }
    });
  }

  // Draw student instrument arcs (stereo) behind dots
  instruments.forEach((inst, idx) => {
    if (inst.type !== 'stereo') return;
    const angle = inst.angle || 90;
    const radius = inst.radius || MAP_RADII[2];
    const halfWidth = (inst.width || 30) / 2;
    const lockState = locks[idx];
    const fullyLocked = lockState === 'full';
    const centerLocked = lockState === 'center';
    const widthDraggable = answerKey === null && !fullyLocked;

    const arcPath = buildArcPath(angle, halfWidth, radius);
    const arc = makeSVG('path');
    arc.setAttribute('d', arcPath);
    arc.setAttribute('fill', fullyLocked ? '#66bb6a' : inst.color);
    arc.setAttribute('fill-opacity', fullyLocked ? '0.15' : '0.18');
    arc.setAttribute('stroke', fullyLocked ? '#66bb6a' : inst.color);
    arc.setAttribute('stroke-width', '1.5');
    arc.setAttribute('opacity', '0.7');
    arcsG.appendChild(arc);

    if (!widthDraggable) return;

    // Left edge handle
    const leftAngle = Math.max(0, angle - halfWidth);
    const leftPos = mapAngleToXY(leftAngle, radius);
    const leftHandle = makeSVG('circle');
    leftHandle.setAttribute('cx', leftPos.x);
    leftHandle.setAttribute('cy', leftPos.y);
    leftHandle.setAttribute('r', 6);
    leftHandle.setAttribute('fill', inst.color);
    leftHandle.setAttribute('opacity', '0.8');
    leftHandle.setAttribute('data-idx', idx);
    leftHandle.setAttribute('data-handle', 'left');
    leftHandle.style.cursor = 'ew-resize';
    arcsG.appendChild(leftHandle);

    // Right edge handle
    const rightAngle = Math.min(180, angle + halfWidth);
    const rightPos = mapAngleToXY(rightAngle, radius);
    const rightHandle = makeSVG('circle');
    rightHandle.setAttribute('cx', rightPos.x);
    rightHandle.setAttribute('cy', rightPos.y);
    rightHandle.setAttribute('r', 6);
    rightHandle.setAttribute('fill', inst.color);
    rightHandle.setAttribute('opacity', '0.8');
    rightHandle.setAttribute('data-idx', idx);
    rightHandle.setAttribute('data-handle', 'right');
    rightHandle.style.cursor = 'ew-resize';
    arcsG.appendChild(rightHandle);

    leftHandle.addEventListener('mousedown', e => mapStartHandleDrag(e, svgEl, instruments, idx, 'left'));
    leftHandle.addEventListener('touchstart', e => mapStartHandleDrag(e, svgEl, instruments, idx, 'left'), { passive: false });
    rightHandle.addEventListener('mousedown', e => mapStartHandleDrag(e, svgEl, instruments, idx, 'right'));
    rightHandle.addEventListener('touchstart', e => mapStartHandleDrag(e, svgEl, instruments, idx, 'right'), { passive: false });
  });

  // Draw instrument dots
  instruments.forEach((inst, idx) => {
    const { x, y } = mapAngleToXY(inst.angle, inst.radius);
    const { dx, dy, anchor } = mapLabelOffset(inst.angle);
    const isActive = idx === activeIdx;
    const isLead = inst.r > 10;
    const lockState = locks[idx];
    const fullyLocked = lockState === 'full';
    const draggable = answerKey === null && !fullyLocked;

    const group = makeSVG('g');
    group.setAttribute('data-idx', idx);
    group.style.cursor = draggable ? (isActive ? 'grabbing' : 'grab') : (fullyLocked ? 'default' : 'default');

    // Green lock ring for correct instruments
    if (fullyLocked) {
      const lockRing = makeSVG('circle');
      lockRing.setAttribute('cx', x); lockRing.setAttribute('cy', y);
      lockRing.setAttribute('r', (inst.r || 8) + 5);
      lockRing.setAttribute('fill', 'none');
      lockRing.setAttribute('stroke', '#66bb6a');
      lockRing.setAttribute('stroke-width', '2.5');
      lockRing.setAttribute('opacity', '0.9');
      group.appendChild(lockRing);
    } else if (isLead || isActive) {
      const ring = makeSVG('circle');
      ring.setAttribute('cx', x); ring.setAttribute('cy', y);
      ring.setAttribute('r', (inst.r || 8) + (isActive ? 5 : 3));
      ring.setAttribute('fill', 'none');
      ring.setAttribute('stroke', inst.color);
      ring.setAttribute('stroke-width', isActive ? '2.5' : '2');
      ring.setAttribute('opacity', isActive ? '0.9' : '0.5');
      group.appendChild(ring);
    }

    const circle = makeSVG('circle');
    circle.setAttribute('cx', x); circle.setAttribute('cy', y);
    circle.setAttribute('r', isActive ? (inst.r || 8) + 1 : (inst.r || 8));
    circle.setAttribute('fill', isLead ? '#1e2333' : inst.color);
    circle.setAttribute('stroke', inst.color);
    circle.setAttribute('stroke-width', isLead ? '2.5' : '0');
    circle.setAttribute('opacity', '0.95');
    group.appendChild(circle);

    // Stereo indicator badge
    if (inst.type === 'stereo') {
      const badge = makeSVG('text');
      badge.setAttribute('x', x);
      badge.setAttribute('y', y + 1);
      badge.setAttribute('text-anchor', 'middle');
      badge.setAttribute('dominant-baseline', 'central');
      badge.setAttribute('font-family', 'DM Mono, monospace');
      badge.setAttribute('font-size', '7');
      badge.setAttribute('fill', '#fff');
      badge.setAttribute('pointer-events', 'none');
      badge.textContent = '↔';
      group.appendChild(badge);
    }

    const label = makeSVG('text');
    label.setAttribute('x', x + dx); label.setAttribute('y', y + dy);
    label.setAttribute('text-anchor', anchor);
    label.setAttribute('font-family', 'DM Sans, sans-serif');
    label.setAttribute('font-size', '11.5');
    label.setAttribute('font-weight', '500');
    label.setAttribute('fill', inst.color);
    label.setAttribute('pointer-events', 'none');
    label.textContent = inst.label;
    group.appendChild(label);

    if (draggable) {
      group.addEventListener('mousedown', e => mapStartDrag(e, svgEl, instruments));
      group.addEventListener('touchstart', e => mapStartDrag(e, svgEl, instruments), { passive: false });
    }
    g.appendChild(group);
  });
}

// ── DRAG STATE ──
let _dragging = null;
let _dotX = 0, _dotY = 0;
let _prevClientX = 0, _prevClientY = 0;
let _activeSvg = null;
let _activeInstruments = null;
let _readoutId = null;
let _onDragEndCallback = null;
let _dragMode = 'dot';
let _dragIdx = null;
let _activeLocks = {};

function mapGetScale(svgEl) {
  const rect = svgEl.getBoundingClientRect();
  return { sx: 680 / rect.width, sy: 490 / rect.height };
}

function mapStartDrag(e, svgEl, instruments, onEnd) {
  e.preventDefault();
  const idx = parseInt(e.currentTarget.getAttribute('data-idx'));
  _dragging = idx;
  _dragMode = 'dot';
  _activeSvg = svgEl;
  _activeInstruments = instruments;
  _onDragEndCallback = onEnd || null;
  _activeLocks = {};
  _readoutId = svgEl.id === 'map-svg' ? 'map-readout' : 'student-readout';

  const pos = mapAngleToXY(instruments[idx].angle, instruments[idx].radius);
  _dotX = pos.x; _dotY = pos.y;

  const src = e.touches ? e.touches[0] : e;
  _prevClientX = src.clientX;
  _prevClientY = src.clientY;

  document.body.style.cursor = 'grabbing';
  document.addEventListener('mousemove', _onDrag);
  document.addEventListener('mouseup', _onDragEnd);
  document.addEventListener('touchmove', _onDrag, { passive: false });
  document.addEventListener('touchend', _onDragEnd);

  renderDots(svgEl, instruments, idx, null);
}

function mapStartHandleDrag(e, svgEl, instruments, idx, handle) {
  e.preventDefault();
  e.stopPropagation();
  _dragging = idx;
  _dragMode = handle;
  _activeSvg = svgEl;
  _activeInstruments = instruments;
  _readoutId = svgEl.id === 'map-svg' ? 'map-readout' : 'student-readout';

  const src = e.touches ? e.touches[0] : e;
  _prevClientX = src.clientX;
  _prevClientY = src.clientY;

  document.body.style.cursor = 'ew-resize';
  document.addEventListener('mousemove', _onDrag);
  document.addEventListener('mouseup', _onDragEnd);
  document.addEventListener('touchmove', _onDrag, { passive: false });
  document.addEventListener('touchend', _onDragEnd);
}

function _onDrag(e) {
  if (_dragging === null) return;
  e.preventDefault();
  const src = e.touches ? e.touches[0] : e;
  const { sx, sy } = mapGetScale(_activeSvg);
  const ddx = (src.clientX - _prevClientX) * sx;
  const ddy = (src.clientY - _prevClientY) * sy;
  _prevClientX = src.clientX;
  _prevClientY = src.clientY;

  const inst = _activeInstruments[_dragging];

  if (_dragMode === 'dot') {
    const instLock = (_activeLocks || {})[_dragging];
    if (instLock === 'full' || instLock === 'center') return;
    _dotX += ddx; _dotY += ddy;
    const clampedY = Math.min(_dotY, MAP_CY - 5);
    const { angle, radius } = mapXYToAngleRadius(_dotX, clampedY);
    inst.angle = angle;
    inst.radius = radius;
    renderDots(_activeSvg, _activeInstruments, _dragging, null);
    const rd = document.getElementById(_readoutId);
    if (rd) {
      rd.textContent = inst.label + ' — ' + mapClockLabel(angle) + ' · ' + mapSideLabel(angle);
      rd.classList.add('active');
    }
  } else if (_dragMode === 'left' || _dragMode === 'right') {
    // Convert cursor delta to angle change
    const angleDelta = -ddx * 0.3;
    const currentWidth = inst.width || 30;
    if (_dragMode === 'left') {
      inst.width = Math.max(10, Math.min(160, currentWidth + angleDelta * 2));
    } else {
      inst.width = Math.max(10, Math.min(160, currentWidth - angleDelta * 2));
    }
    renderDots(_activeSvg, _activeInstruments, null, null);
    const rd = document.getElementById(_readoutId);
    if (rd) {
      rd.textContent = inst.label + ' — width: ' + Math.round(inst.width) + '°';
      rd.classList.add('active');
    }
  }
}

function _onDragEnd() {
  if (_dragging === null) return;
  const wasIdx = _dragging;
  _dragging = null;
  document.body.style.cursor = '';
  document.removeEventListener('mousemove', _onDrag);
  document.removeEventListener('mouseup', _onDragEnd);
  document.removeEventListener('touchmove', _onDrag);
  document.removeEventListener('touchend', _onDragEnd);

  renderDots(_activeSvg, _activeInstruments, null, null);

  const rd = document.getElementById(_readoutId);
  if (rd) { rd.textContent = 'Drag instruments into position'; rd.classList.remove('active'); }

  if (_onDragEndCallback) _onDragEndCallback(wasIdx);
  _activeSvg = null; _activeInstruments = null;
}

// ── SCORING ──
function scoreAttempt(studentInstruments, answerKey) {
  return studentInstruments.map((inst, idx) => {
    const ans = answerKey[idx];
    if (!ans) return { label: inst.label, color: inst.color, type: inst.type || 'mono', grade: 'none', score: 0 };

    if (inst.type === 'stereo') {
      // Score center placement
      const ringDiff = Math.abs(MAP_RADII.indexOf(inst.radius) - MAP_RADII.indexOf(ans.radius));
      const angleDiff = Math.abs(inst.angle - ans.angle) / 30;
      const dist = ringDiff + angleDiff;
      let centerGrade;
      if (dist < 1.2)      centerGrade = 'close';
      else if (dist < 2.5) centerGrade = 'near';
      else                 centerGrade = 'far';

      // Score width
      const studentWidth = inst.width || 30;
      let widthGrade;
      if (studentWidth >= ans.widthMin && studentWidth <= ans.widthMax) {
        widthGrade = 'good';
      } else if (studentWidth < ans.widthMin) {
        widthGrade = 'narrow';
      } else {
        widthGrade = 'wide';
      }

      const centerScore = centerGrade === 'close' ? 100 : centerGrade === 'near' ? 60 : 20;
      const widthScore = widthGrade === 'good' ? 100 : 40;
      const score = Math.round((centerScore + widthScore) / 2);

      return { label: inst.label, color: inst.color, type: 'stereo', centerGrade, widthGrade, score, grade: centerGrade };
    } else {
      // Mono scoring
      const ringDiff = Math.abs(MAP_RADII.indexOf(inst.radius) - MAP_RADII.indexOf(ans.radius));
      const angleDiff = Math.abs(inst.angle - ans.angle) / 30;
      const dist = ringDiff + angleDiff;
      let grade, score;
      if (dist < 1.2)      { grade = 'close'; score = 100; }
      else if (dist < 2.5) { grade = 'near';  score = 60;  }
      else                 { grade = 'far';   score = 20;  }
      return { label: inst.label, color: inst.color, type: 'mono', grade, score };
    }
  });
}

// ── UTIL ──
function makeSVG(tag) {
  return document.createElementNS('http://www.w3.org/2000/svg', tag);
}

function scramblePositions(instruments) {
  const total = instruments.length;
  return instruments.map((inst, idx) => ({
    ...inst,
    angle: 20 + (idx / Math.max(total - 1, 1)) * 140,
    radius: MAP_RADII[0],
    width: inst.type === 'stereo' ? 30 : undefined
  }));
}
