// ── SONG ENERGY MAP ENGINE ──

// ── CONSTANTS ──
const ENERGY_MIN = 1;
const ENERGY_MAX = 10;
const SAMPLE_INTERVAL = 0.5; // seconds between curve samples
const CURVE_COLOR = 'rgba(79,195,247,0.8)';
const CURVE_FILL = 'rgba(79,195,247,0.15)';
const GRID_COLOR = 'rgba(255,255,255,0.06)';
const PLAYHEAD_COLOR = '#4fc3f7';

// ── STATE ──
let energyState = {
  audioUrl: null,
  videoId: null,
  duration: 0,
  curve: [],          // [{time, value}] sampled points
  currentTime: 0,
  currentEnergy: 5,
  isPlaying: false,
  isRecording: false,
  isSubmitted: false,
  recordingInterval: null,
  ytPlayer: null,
  ytReady: false,
  canvas: null,
  ctx: null,
  sliderDragging: false,
  editMode: false,    // post-playback edit mode
};

// ── INIT ──
function initEnergyMap(canvasId, sliderId) {
  energyState.canvas = document.getElementById(canvasId);
  energyState.ctx = energyState.canvas.getContext('2d');
  energyState.slider = document.getElementById(sliderId);

  // Slider input
  energyState.slider.addEventListener('input', e => {
    energyState.currentEnergy = parseFloat(e.target.value);
    updateSliderDisplay();
    if (energyState.isPlaying) {
      recordSample(energyState.currentTime, energyState.currentEnergy);
      drawCurve();
    } else if (energyState.editMode) {
      editCurveAtTime(energyState.currentTime, energyState.currentEnergy);
    }
  });

  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  drawCurve();
}

function resizeCanvas() {
  if (!energyState.canvas) return;
  const wrap = energyState.canvas.parentElement;
  energyState.canvas.width = wrap.clientWidth;
  energyState.canvas.height = wrap.clientHeight || 200;
  drawCurve();
}

// ── YOUTUBE ──
function extractEnergyYTId(url) {
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

function loadEnergyYT(url, containerId, onReady) {
  const id = extractEnergyYTId(url);
  if (!id) return false;
  energyState.videoId = id;
  energyState.ytReady = false;

  const container = document.getElementById(containerId);
  container.innerHTML = `<div id="energy-yt-iframe"></div>`;

  if (window.YT && window.YT.Player) {
    createEnergyYTPlayer(onReady);
  } else {
    window.onYouTubeIframeAPIReady = () => createEnergyYTPlayer(onReady);
    if (!document.getElementById('yt-api-script')) {
      const tag = document.createElement('script');
      tag.id = 'yt-api-script';
      tag.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(tag);
    }
  }
  return true;
}

function createEnergyYTPlayer(onReady) {
  energyState.ytPlayer = new YT.Player('energy-yt-iframe', {
    height: '195',
    width: '100%',
    videoId: energyState.videoId,
    playerVars: { rel: 0, modestbranding: 1 },
    events: {
      onReady: e => {
  energyState.ytReady = true;
  energyState.duration = e.target.getDuration();
  energyState.curve = [];
  energyState.currentTime = 0;
  energyState.currentEnergy = 5;
  energyState.slider = document.getElementById('energy-slider');
  energyState.canvas = document.getElementById('energy-canvas');
  energyState.ctx = energyState.canvas ? energyState.canvas.getContext('2d') : null;
  if (energyState.canvas) {
    energyState.canvas.width = energyState.canvas.offsetWidth;
    energyState.canvas.height = energyState.canvas.offsetHeight || 200;
  }
  if (energyState.slider) energyState.slider.value = 5;
  updateSliderDisplay();
  drawCurve();
  if (onReady) onReady(energyState.duration, e.target.getVideoData()?.title || '');
},
      onStateChange: e => {
        if (e.data === YT.PlayerState.PLAYING) {
          energyState.isPlaying = true;
          startRecording();
        } else if (e.data === YT.PlayerState.PAUSED || e.data === YT.PlayerState.ENDED) {
          energyState.isPlaying = false;
          stopRecording();
          if (e.data === YT.PlayerState.ENDED) {
            energyState.editMode = true;
            updateEnergyUI();
          }
        }
      }
    }
  });
}

// ── RECORDING ──
function startRecording() {
  if (energyState.recordingInterval) return;
  energyState.recordingInterval = setInterval(() => {
    if (!energyState.ytPlayer || !energyState.ytReady) return;
    const t = energyState.ytPlayer.getCurrentTime();
    energyState.currentTime = t;
    recordSample(t, energyState.currentEnergy);
    drawCurve();
    updatePlayheadPosition();
  }, SAMPLE_INTERVAL * 1000);
}

function stopRecording() {
  if (energyState.recordingInterval) {
    clearInterval(energyState.recordingInterval);
    energyState.recordingInterval = null;
  }
}

function recordSample(time, value) {
  // Find and update existing sample at this time, or insert
  const tolerance = SAMPLE_INTERVAL * 0.6;
  const idx = energyState.curve.findIndex(p => Math.abs(p.time - time) < tolerance);
  if (idx >= 0) {
    energyState.curve[idx] = { time, value };
  } else {
    energyState.curve.push({ time, value });
    energyState.curve.sort((a, b) => a.time - b.time);
  }
}

function editCurveAtTime(time, value) {
  recordSample(time, value);
  drawCurve();
}

// ── RESET ──
function resetEnergyMap() {
  stopRecording();
  energyState.curve = [];
  energyState.currentTime = 0;
  energyState.currentEnergy = 5;
  energyState.editMode = false;
  energyState.isPlaying = false;
  energyState.slider.value = 5;
  updateSliderDisplay();
  if (energyState.ytPlayer && energyState.ytReady) {
    energyState.ytPlayer.seekTo(0);
    energyState.ytPlayer.stopVideo();
  }
  drawCurve();
  updateEnergyUI();
}

// ── CANVAS DRAWING ──
function drawCurve() {
  const canvas = energyState.canvas;
  const ctx = energyState.ctx;
  if (!canvas || !ctx) return;

  const W = canvas.width;
  const H = canvas.height;
  const duration = energyState.duration || 1;
  const PAD_LEFT = 36;
  const PAD_RIGHT = 16;
  const PAD_TOP = 12;
  const PAD_BOTTOM = 24;
  const graphW = W - PAD_LEFT - PAD_RIGHT;
  const graphH = H - PAD_TOP - PAD_BOTTOM;

  ctx.clearRect(0, 0, W, H);

  // Background
  ctx.fillStyle = 'rgba(15,17,23,0.6)';
  ctx.fillRect(0, 0, W, H);

  // Grid lines
  ctx.strokeStyle = GRID_COLOR;
  ctx.lineWidth = 1;
  for (let i = 1; i <= 9; i++) {
    const y = PAD_TOP + graphH - (i / 10) * graphH;
    ctx.beginPath();
    ctx.moveTo(PAD_LEFT, y);
    ctx.lineTo(PAD_LEFT + graphW, y);
    ctx.stroke();
  }

  // Y axis labels
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.font = '10px DM Mono, monospace';
  ctx.textAlign = 'right';
  [1, 3, 5, 7, 10].forEach(v => {
    const y = PAD_TOP + graphH - ((v - 1) / 9) * graphH;
    ctx.fillText(v, PAD_LEFT - 4, y + 3);
  });

  // X axis time labels
  ctx.textAlign = 'center';
  const tickCount = Math.min(8, Math.floor(duration / 30));
  const tickInterval = duration / (tickCount || 1);
  for (let i = 0; i <= tickCount; i++) {
    const t = i * tickInterval;
    const x = PAD_LEFT + (t / duration) * graphW;
    const mins = Math.floor(t / 60);
    const secs = Math.floor(t % 60);
    ctx.fillText(`${mins}:${secs.toString().padStart(2,'0')}`, x, H - 6);
  }

  // Draw curve
  const curve = energyState.curve;
  if (curve.length > 1) {
    // Fill
    ctx.beginPath();
    ctx.moveTo(PAD_LEFT + (curve[0].time / duration) * graphW,
               PAD_TOP + graphH - ((curve[0].value - 1) / 9) * graphH);
    for (let i = 1; i < curve.length; i++) {
      const x = PAD_LEFT + (curve[i].time / duration) * graphW;
      const y = PAD_TOP + graphH - ((curve[i].value - 1) / 9) * graphH;
      ctx.lineTo(x, y);
    }
    const lastX = PAD_LEFT + (curve[curve.length-1].time / duration) * graphW;
    ctx.lineTo(lastX, PAD_TOP + graphH);
    ctx.lineTo(PAD_LEFT, PAD_TOP + graphH);
    ctx.closePath();
    ctx.fillStyle = CURVE_FILL;
    ctx.fill();

    // Line
    ctx.beginPath();
    ctx.moveTo(PAD_LEFT + (curve[0].time / duration) * graphW,
               PAD_TOP + graphH - ((curve[0].value - 1) / 9) * graphH);
    for (let i = 1; i < curve.length; i++) {
      const x = PAD_LEFT + (curve[i].time / duration) * graphW;
      const y = PAD_TOP + graphH - ((curve[i].value - 1) / 9) * graphH;
      ctx.lineTo(x, y);
    }
    ctx.strokeStyle = CURVE_COLOR;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.stroke();
  }

  // Playhead
  if (energyState.duration > 0) {
    const px = PAD_LEFT + (energyState.currentTime / duration) * graphW;
    ctx.strokeStyle = PLAYHEAD_COLOR;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(px, PAD_TOP);
    ctx.lineTo(px, PAD_TOP + graphH);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Overlay curves
  if (energyState.overlayCurves && energyState.overlayCurves.length > 0) {
    const overlayColors = [
      'rgba(224,80,80,0.5)','rgba(29,158,117,0.5)','rgba(186,117,23,0.5)',
      'rgba(127,119,221,0.5)','rgba(216,90,48,0.5)','rgba(255,183,77,0.5)',
      'rgba(206,147,216,0.5)','rgba(128,203,196,0.5)'
    ];
    energyState.overlayCurves.forEach((oc, i) => {
      const color = overlayColors[i % overlayColors.length];
      if (!oc.curve || oc.curve.length < 2) return;
      ctx.beginPath();
      ctx.moveTo(PAD_LEFT + (oc.curve[0].time / duration) * graphW,
                 PAD_TOP + graphH - ((oc.curve[0].value - 1) / 9) * graphH);
      for (let j = 1; j < oc.curve.length; j++) {
        const x = PAD_LEFT + (oc.curve[j].time / duration) * graphW;
        const y = PAD_TOP + graphH - ((oc.curve[j].value - 1) / 9) * graphH;
        ctx.lineTo(x, y);
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.stroke();
    });
  }
}

// ── CANVAS CLICK TO SEEK (edit mode) ──
function initCanvasSeek(canvasId) {
  const canvas = document.getElementById(canvasId);
  canvas.addEventListener('click', e => {
    if (!energyState.editMode || !energyState.duration) return;
    const rect = canvas.getBoundingClientRect();
    const PAD_LEFT = 36;
    const PAD_RIGHT = 16;
    const graphW = canvas.width - PAD_LEFT - PAD_RIGHT;
    const x = (e.clientX - rect.left) * (canvas.width / rect.width) - PAD_LEFT;
    const t = Math.max(0, Math.min(energyState.duration, (x / graphW) * energyState.duration));
    energyState.currentTime = t;
    if (energyState.ytPlayer && energyState.ytReady) {
      energyState.ytPlayer.seekTo(t, true);
    }
    // Get energy at this time
    const nearby = energyState.curve.find(p => Math.abs(p.time - t) < 2);
    if (nearby) {
      energyState.currentEnergy = nearby.value;
      energyState.slider.value = nearby.value;
      updateSliderDisplay();
    }
    drawCurve();
  });
}

// ── SLIDER DISPLAY ──
function updateSliderDisplay() {
  const label = document.getElementById('energy-value-label');
  if (label) label.textContent = energyState.currentEnergy;
}

function updatePlayheadPosition() {
  // Move the slider container to follow playhead
  const canvas = energyState.canvas;
  if (!canvas || !energyState.duration) return;
  const PAD_LEFT = 36;
  const PAD_RIGHT = 16;
  const graphW = canvas.offsetWidth - PAD_LEFT - PAD_RIGHT;
  const pct = energyState.currentTime / energyState.duration;
  const x = PAD_LEFT + pct * graphW;
  const sliderWrap = document.getElementById('energy-slider-wrap');
  if (sliderWrap) {
    sliderWrap.style.left = Math.max(0, Math.min(canvas.offsetWidth - 40, x - 20)) + 'px';
  }
}

// ── UI STATE ──
function updateEnergyUI() {
  const recordingMsg = document.getElementById('energy-recording-msg');
  const editMsg = document.getElementById('energy-edit-msg');
  const submitBtn = document.getElementById('energy-submit-btn');
  const resetBtn = document.getElementById('energy-reset-btn');

  if (energyState.editMode) {
    if (recordingMsg) recordingMsg.style.display = 'none';
    if (editMsg) editMsg.style.display = 'block';
    if (submitBtn) submitBtn.style.display = 'inline-flex';
  } else {
    if (recordingMsg) recordingMsg.style.display = 'block';
    if (editMsg) editMsg.style.display = 'none';
    if (submitBtn) submitBtn.style.display = 'none';
  }
}

// ── OVERLAY ──
function setOverlayCurves(curves) {
  energyState.overlayCurves = curves;
  drawCurve();
}

// ── OVERLAY CANVAS (teacher/student review) ──
function drawOverlayOnly(canvasId, curves, duration, studentNames) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const PAD_LEFT = 36;
  const PAD_RIGHT = 16;
  const PAD_TOP = 12;
  const PAD_BOTTOM = 24;
  const graphW = W - PAD_LEFT - PAD_RIGHT;
  const graphH = H - PAD_TOP - PAD_BOTTOM;

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(15,17,23,0.8)';
  ctx.fillRect(0, 0, W, H);

  // Grid
  ctx.strokeStyle = GRID_COLOR;
  ctx.lineWidth = 1;
  for (let i = 1; i <= 9; i++) {
    const y = PAD_TOP + graphH - (i / 10) * graphH;
    ctx.beginPath();
    ctx.moveTo(PAD_LEFT, y);
    ctx.lineTo(PAD_LEFT + graphW, y);
    ctx.stroke();
  }

  // Y labels
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.font = '10px DM Mono, monospace';
  ctx.textAlign = 'right';
  [1, 3, 5, 7, 10].forEach(v => {
    const y = PAD_TOP + graphH - ((v - 1) / 9) * graphH;
    ctx.fillText(v, PAD_LEFT - 4, y + 3);
  });

  // X labels
  ctx.textAlign = 'center';
  const tickCount = Math.min(8, Math.floor(duration / 30));
  const tickInterval = duration / (tickCount || 1);
  for (let i = 0; i <= tickCount; i++) {
    const t = i * tickInterval;
    const x = PAD_LEFT + (t / duration) * graphW;
    const mins = Math.floor(t / 60);
    const secs = Math.floor(t % 60);
    ctx.fillText(`${mins}:${secs.toString().padStart(2,'0')}`, x, H - 6);
  }

  const overlayColors = [
    '#4fc3f7','#e05050','#1D9E75','#BA7517','#7F77DD',
    '#D85A30','#ffa726','#ce93d8','#80cbc4','#aed581'
  ];

  curves.forEach((oc, i) => {
    if (!oc || oc.length < 2) return;
    const color = overlayColors[i % overlayColors.length];
    ctx.beginPath();
    ctx.moveTo(PAD_LEFT + (oc[0].time / duration) * graphW,
               PAD_TOP + graphH - ((oc[0].value - 1) / 9) * graphH);
    for (let j = 1; j < oc.length; j++) {
      const x = PAD_LEFT + (oc[j].time / duration) * graphW;
      const y = PAD_TOP + graphH - ((oc[j].value - 1) / 9) * graphH;
      ctx.lineTo(x, y);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.stroke();
  });

  // Legend
  if (studentNames && studentNames.length > 0) {
    let legendX = PAD_LEFT;
    const legendY = PAD_TOP + 8;
    studentNames.forEach((name, i) => {
      const color = overlayColors[i % overlayColors.length];
      ctx.fillStyle = color;
      ctx.fillRect(legendX, legendY - 8, 16, 3);
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.font = '10px DM Sans, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(name.split(' ')[0], legendX + 20, legendY);
      legendX += ctx.measureText(name.split(' ')[0]).width + 36;
    });
  }
}
