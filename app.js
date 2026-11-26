(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const storageKey = 'sonora-progress-v1';
  const state = {
    view: 'home',
    lab: 'phase',
    progress: loadProgress(),
    quiz: { questions: [], index: 0, correct: 0, answered: 0, locked: false, finished: false },
    audioContext: null,
    activeSource: null,
    activeButton: null,
    toastTimer: null
  };

  function loadProgress() {
    const fallback = { answered: 0, correct: 0, labs: [], lastView: 'home' };
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
      return saved && typeof saved === 'object' ? { ...fallback, ...saved, labs: Array.isArray(saved.labs) ? saved.labs : [] } : fallback;
    } catch { return fallback; }
  }
  function saveProgress() {
    try { localStorage.setItem(storageKey, JSON.stringify(state.progress)); } catch { /* local storage may be disabled */ }
    updateStats();
  }
  function updateStats() {
    $('#stat-answered').textContent = state.progress.answered;
    $('#stat-correct').textContent = state.progress.answered ? `${Math.round(100 * state.progress.correct / state.progress.answered)}%` : '0%';
    $('#stat-labs').textContent = state.progress.labs.length;
    const pct = state.progress.answered ? Math.round(100 * state.progress.correct / state.progress.answered) : 0;
    $('#progress-fill').style.width = `${pct}%`;
    $('#progress-caption').textContent = state.progress.answered ? `${state.progress.correct} risposte corrette su ${state.progress.answered}.` : 'Il tuo ripasso comincia qui.';
  }
  function showToast(message) {
    const toast = $('#toast');
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => toast.classList.remove('show'), 2300);
  }

  const viewNames = { home: 'Panoramica', labs: 'Laboratori', review: 'Ripasso', formulas: 'Formulario', lesson: 'Lezione' };
  function showView(name) {
    state.view = name;
    $$('.view').forEach(view => view.classList.toggle('active', view.id === `view-${name}`));
    $$('.nav-item').forEach(btn => btn.classList.toggle('active', btn.dataset.view === name));
    $('#breadcrumb-current').textContent = viewNames[name] || 'Panoramica';
    state.progress.lastView = name;
    saveProgress();
    if (name === 'labs') requestAnimationFrame(drawActiveLab);
  }
  function openLab(name) {
    state.lab = name;
    showView('labs');
    $$('.lab-tab').forEach(tab => tab.classList.toggle('active', tab.dataset.lab === name));
    $$('.lab-view').forEach(view => view.classList.toggle('active', view.id === `lab-${name}`));
    if (!state.progress.labs.includes(name)) state.progress.labs.push(name);
    saveProgress();
    requestAnimationFrame(drawActiveLab);
  }
  function openLesson(number) {
    const lessons = {
      1: { title: 'Lezione 01 · Che cos’è il suono?', description: 'Il punto di partenza: una sorgente vibra, la perturbazione si propaga in un mezzo e il sistema uditivo la riceve.', topics: ['Sorgente sonora, mezzo di propagazione e ricezione.', 'Vibrazioni, compressioni e rarefazioni.', 'Frequenza, ampiezza e timbro.', 'Il microfono come trasduttore: dal fenomeno acustico al segnale elettrico.'] },
      2: { title: 'Lezione 02 · Le caratteristiche dell’onda', description: 'Imparare a descrivere un’onda nel tempo e nello spazio, collegando periodo, frequenza, lunghezza d’onda e velocità.', topics: ['Periodo T: durata di un ciclo completo.', 'Frequenza f: numero di cicli al secondo; f = 1/T.', 'Lunghezza d’onda λ: distanza associata a un ciclo nello spazio.', 'Velocità di propagazione: v = fλ.'] },
      3: { title: 'Lezione 03 · La fase e l’interazione tra le onde', description: 'La fase identifica la posizione dell’oscillazione nel proprio ciclo; la sovrapposizione descrive come si combinano le perturbazioni.', topics: ['Fase iniziale φ₀ e fase istantanea φ(t) = ωt + φ₀.', 'Pulsazione ω = 2πf.', 'Differenza di fase, ritardo temporale e differenza di percorso.', 'Principio di sovrapposizione e interferenza costruttiva/distruttiva.'] },
      4: { title: 'Lezione 04 · Interferenza e battimenti', description: 'Quando due frequenze sono vicine ma non uguali, la relazione di fase cambia nel tempo e la somma produce una pulsazione dell’ampiezza.', topics: ['Formula di prostaferesi e somma di due sinusoidi.', 'Frequenza media e inviluppo.', 'Frequenza di battimento: fᵦ = |f₁ − f₂|.', 'Accordatura degli strumenti e applicazioni audio.'] }
    };
    const lesson = lessons[number];
    if (!lesson) return;
    $('#lesson-title').textContent = lesson.title;
    $('#lesson-description').textContent = lesson.description;
    $('#lesson-topics').innerHTML = lesson.topics.map(item => `<div class="topic-row">${escapeHtml(item)}</div>`).join('');
    showView('lesson');
  }
  function escapeHtml(str) { return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  // Phase Explorer ----------------------------------------------------------
  const phaseInputs = {
    shift: $('#phase-shift'), frequency: $('#phase-frequency'), a1: $('#amp-one'), a2: $('#amp-two')
  };
  const deg = value => value * Math.PI / 180;
  const fmt = (value, digits = 2) => Number(value).toLocaleString('it-IT', { maximumFractionDigits: digits, minimumFractionDigits: digits });
  function readPhase() {
    return { shift: Number(phaseInputs.shift.value), frequency: Number(phaseInputs.frequency.value), a1: Number(phaseInputs.a1.value), a2: Number(phaseInputs.a2.value) };
  }
  function phaseResultAmplitude({ shift, a1, a2 }) {
    const rad = deg(shift);
    return Math.sqrt(Math.max(0, a1 * a1 + a2 * a2 + 2 * a1 * a2 * Math.cos(rad)));
  }
  function phaseRelation(shift) {
    const norm = ((shift % 360) + 360) % 360;
    const d0 = Math.min(norm, 360 - norm);
    if (d0 < 1 || Math.abs(d0 - 360) < 1) return 'In fase';
    if (Math.abs(d0 - 180) < 1) return 'Opposizione';
    if (Math.abs(d0 - 90) < 1) return 'Quadratura';
    if (norm < 180) return 'Sfasamento';
    return 'Sfasamento';
  }
  function paintRange(input) {
    const min = Number(input.min), max = Number(input.max), value = Number(input.value);
    input.style.background = `linear-gradient(90deg, var(--teal) 0%, var(--teal) ${(value - min) / (max - min) * 100}%, #30435b ${(value - min) / (max - min) * 100}%, #30435b 100%)`;
  }
  function updatePhaseUI() {
    const data = readPhase();
    $('#phase-value').textContent = `${data.shift}°`;
    $('#phase-frequency-value').textContent = `${data.frequency} Hz`;
    $('#amp-one-value').textContent = fmt(data.a1, 1);
    $('#amp-two-value').textContent = fmt(data.a2, 1);
    $$('.preset-row [data-phase-preset]').forEach(btn => btn.classList.toggle('selected', Number(btn.dataset.phasePreset) === data.shift));
    const result = phaseResultAmplitude(data);
    $('#result-amplitude').textContent = fmt(result);
    $('#phase-description').textContent = phaseRelation(data.shift);
    $('#result-frequency').textContent = `${data.frequency} Hz`;
    Object.values(phaseInputs).forEach(paintRange);
    drawPhaseChart(data);
    updatePhaseExpectation(data, result);
  }
  function updatePhaseExpectation(data, result) {
    const angle = ((data.shift % 360) + 360) % 360;
    const close = (a, b, tolerance = 2) => Math.abs(a - b) <= tolerance;
    let title = 'Interferenza parziale';
    let text = 'I contributi si sommano istante per istante. La differenza di fase determina quanto la risultante si avvicina al rinforzo o alla compensazione.';
    let value = `Aᵣᵢₛ = ${fmt(result, 2)}`;
    let condition = `Calcolo per A₁ = ${fmt(data.a1, 1)} e A₂ = ${fmt(data.a2, 1)} (unità relative).`;
    if (close(angle, 0) || close(angle, 360)) {
      title = 'Onde in fase: rinforzo';
      text = 'Massimi, minimi e attraversamenti corrispondono. I contributi hanno lo stesso segno nello stesso istante e si sommano.';
      value = `Aᵣᵢₛ = A₁ + A₂ = ${fmt(data.a1 + data.a2, 2)}`;
      condition = 'Il rinforzo massimo si osserva quando la differenza di fase è 0° (o 360°).';
    } else if (close(angle, 180)) {
      title = 'Opposizione di fase: compensazione';
      text = 'Il massimo di una sinusoide coincide con il minimo dell’altra. I contributi si sottraggono: la cancellazione completa richiede ampiezze uguali.';
      value = `Aᵣᵢₛ = |A₁ − A₂| = ${fmt(Math.abs(data.a1 - data.a2), 2)}`;
      condition = Math.abs(data.a1 - data.a2) < 1e-6 ? 'Con ampiezze uguali, la risultante ideale è nulla.' : 'Con ampiezze diverse resta una componente residua.';
    } else if (close(angle, 90) || close(angle, 270)) {
      title = 'Quadratura: risultato intermedio';
      text = 'Le onde sono sfasate di un quarto di ciclo. Non si ha né rinforzo massimo né cancellazione completa.';
      value = `Aᵣᵢₛ = √(A₁² + A₂²) = ${fmt(Math.sqrt(data.a1 ** 2 + data.a2 ** 2), 2)}`;
      condition = 'Se A₁ = A₂ = A, la risultante vale √2 A.';
    }
    $('#phase-expected-title').textContent = title;
    $('#phase-expected-text').textContent = text;
    $('#phase-expected-value').textContent = value;
    $('#phase-expected-condition').textContent = condition;
  }
  function canvasSetup(canvas) {
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(260, rect.width);
    const height = Math.max(160, rect.height);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, width, height };
  }
  function drawGrid(ctx, x, y, w, h, rows = 1) {
    ctx.save();
    ctx.strokeStyle = 'rgba(120,145,170,.13)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 8; i++) {
      const xx = x + w * i / 8;
      ctx.beginPath(); ctx.moveTo(xx, y); ctx.lineTo(xx, y + h); ctx.stroke();
    }
    for (let i = 0; i <= rows * 2; i++) {
      const yy = y + h * i / (rows * 2);
      ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x + w, yy); ctx.stroke();
    }
    ctx.restore();
  }
  function drawWave(ctx, points, color, lineWidth = 1.8, dash = []) {
    ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = lineWidth; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.setLineDash(dash);
    ctx.beginPath(); points.forEach((point, i) => i ? ctx.lineTo(point[0], point[1]) : ctx.moveTo(point[0], point[1])); ctx.stroke(); ctx.restore();
  }
  function drawPhaseChart(data = readPhase()) {
    const canvas = $('#phase-canvas');
    if (!canvas || !$('#lab-phase').classList.contains('active')) return;
    const setup = canvasSetup(canvas); if (!setup) return;
    const { ctx, width, height } = setup;
    ctx.clearRect(0, 0, width, height);
    const left = 52, right = 14, top = 15, bottom = 17, plotW = width - left - right, plotH = height - top - bottom;
    const rowH = plotH / 3;
    drawGrid(ctx, left, top, plotW, plotH, 3);
    const resultA = phaseResultAmplitude(data);
    const scaleA = Math.max(data.a1, data.a2, resultA, .8) * 1.18;
    const labels = ['ONDA 1', 'ONDA 2', 'SOMMA'];
    const colors = ['#51d7c2', '#f2c76d', '#b5a2ff'];
    const rows = [
      theta => data.a1 * Math.sin(theta),
      theta => data.a2 * Math.sin(theta + deg(data.shift)),
      theta => data.a1 * Math.sin(theta) + data.a2 * Math.sin(theta + deg(data.shift))
    ];
    rows.forEach((fn, r) => {
      const y0 = top + rowH * r;
      const mid = y0 + rowH / 2;
      ctx.save();
      ctx.strokeStyle = 'rgba(170,190,210,.3)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(left, mid); ctx.lineTo(left + plotW, mid); ctx.stroke();
      ctx.fillStyle = colors[r]; ctx.font = '9px "DM Mono", monospace'; ctx.fillText(labels[r], 8, y0 + 13);
      ctx.fillStyle = '#71869d'; ctx.font = '9px "DM Mono", monospace'; ctx.fillText('0', 22, mid + 3);
      ctx.restore();
      const points = [];
      const n = Math.max(450, Math.floor(plotW * 1.1));
      for (let i = 0; i <= n; i++) {
        const theta = (i / n) * 4 * Math.PI;
        const x = left + (i / n) * plotW;
        const y = mid - fn(theta) / scaleA * (rowH * .36);
        points.push([x, y]);
      }
      drawWave(ctx, points, colors[r], r === 2 ? 2.5 : 1.8);
    });
    ctx.save(); ctx.fillStyle = '#6f849b'; ctx.font = '9px "DM Mono", monospace';
    ctx.fillText('0', left - 3, height - 3); ctx.fillText('T', left + plotW / 2 - 3, height - 3); ctx.fillText('2T', left + plotW - 14, height - 3); ctx.restore();
  }

  // Beat Frequency Lab ------------------------------------------------------
  const beatInputs = { f1: $('#beat-f1'), f2: $('#beat-f2') };
  function readBeat() { return { f1: Number(beatInputs.f1.value), f2: Number(beatInputs.f2.value) }; }
  function updateBeatUI() {
    const { f1, f2 } = readBeat();
    const fb = Math.abs(f1 - f2);
    $('#beat-f1-value').textContent = `${f1} Hz`;
    $('#beat-f2-value').textContent = `${f2} Hz`;
    $('#beat-frequency').textContent = `${fmt(fb, 0)} Hz`;
    $('#beat-period').textContent = fb ? `${fmt(1 / fb, 2)} s` : '—';
    $('#beat-average').textContent = `${fmt((f1 + f2) / 2, 1)} Hz`;
    $$('.beat-presets [data-beat-preset]').forEach(btn => btn.classList.toggle('selected', Math.abs(f1 - f2) === Number(btn.dataset.beatPreset)));
    Object.values(beatInputs).forEach(paintRange);
    drawBeatChart(f1, f2);
    updateBeatExpectation(f1, f2, fb);
  }
  function updateBeatExpectation(f1, f2, fb) {
    const mean = (f1 + f2) / 2;
    let title, text, value, condition;
    if (fb === 0) {
      title = 'Le frequenze coincidono';
      text = 'La differenza di fase non varia nel tempo. La somma è una sinusoide della stessa frequenza con ampiezza e fase risultanti costanti: non si osservano battimenti lenti.';
      value = 'fᵦ = 0 Hz';
      condition = `La frequenza della componente risultante resta ${fmt(mean, 1)} Hz.`;
    } else {
      title = `${fmt(fb, 0)} pulsazioni al secondo`;
      text = `Le fasi avanzano a velocità diverse. La risultante alterna rinforzi e compensazioni; l’inviluppo torna al massimo ogni ${fmt(1 / fb, 3)} s.`;
      value = `Tᵦ = 1/fᵦ = ${fmt(1 / fb, 3)} s`;
      condition = `La frequenza media delle componenti è fₘ = ${fmt(mean, 1)} Hz; la frequenza di battimento è ${fmt(fb, 0)} Hz.`;
    }
    $('#beat-expected-title').textContent = title;
    $('#beat-expected-text').textContent = text;
    $('#beat-expected-value').textContent = value;
    $('#beat-expected-condition').textContent = condition;
  }
  function drawBeatChart(f1, f2) {
    const canvas = $('#beat-canvas');
    if (!canvas || !$('#lab-beats').classList.contains('active')) return;
    const setup = canvasSetup(canvas); if (!setup) return;
    const { ctx, width, height } = setup;
    ctx.clearRect(0, 0, width, height);
    const left = 48, right = 13, plotW = width - left - right;
    const fb = Math.abs(f1 - f2), fmean = (f1 + f2) / 2;
    const gap = 24, topH = height * .57, lowerTop = topH + gap, lowerH = height - lowerTop - 18;
    drawGrid(ctx, left, 12, plotW, topH - 12, 1);
    ctx.save(); ctx.fillStyle = '#7d91a7'; ctx.font = '9px "DM Mono", monospace'; ctx.fillText('INVILUPPO', 8, 24); ctx.fillText('ZOOM', 8, lowerTop + 10); ctx.restore();
    const span = fb > 0 ? Math.min(3, Math.max(1, 2.5 / fb)) : 1;
    $('#beat-time-span').textContent = `${fmt(span, 2)} s`;
    // Envelope magnitude: 2A |cos(pi * delta-f * t)| for two unit-amplitude tones.
    const envTop = [], envBottom = [];
    const n = Math.max(360, Math.floor(plotW * 1.2));
    for (let i = 0; i <= n; i++) {
      const t = (i / n) * span;
      const x = left + (i / n) * plotW;
      const env = fb === 0 ? 2 : 2 * Math.abs(Math.cos(Math.PI * fb * t));
      const yScale = (topH - 38) / 2;
      envTop.push([x, 12 + 15 + (2 - env) * yScale]);
      envBottom.push([x, 12 + 15 + (2 + env) * yScale]);
    }
    ctx.save(); ctx.fillStyle = 'rgba(81,215,194,.09)'; ctx.beginPath(); envTop.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1])); for(let i=envBottom.length-1;i>=0;i--)ctx.lineTo(envBottom[i][0],envBottom[i][1]); ctx.closePath(); ctx.fill(); ctx.restore();
    drawWave(ctx, envTop, '#51d7c2', 2.1); drawWave(ctx, envBottom, '#51d7c2', 1.3, [4,4]);
    ctx.save(); ctx.strokeStyle='rgba(242,199,109,.22)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(left,12+15+(topH-38)/2);ctx.lineTo(left+plotW,12+15+(topH-38)/2);ctx.stroke();ctx.restore();
    // A short carrier zoom: show two component tones and their sum over 5 mean cycles.
    drawGrid(ctx, left, lowerTop, plotW, lowerH, 1);
    const zoomSpan = 5 / fmean;
    const mid = lowerTop + lowerH / 2;
    ctx.save(); ctx.strokeStyle = 'rgba(170,190,210,.3)'; ctx.beginPath(); ctx.moveTo(left,mid); ctx.lineTo(left+plotW,mid); ctx.stroke(); ctx.restore();
    const w1=[],w2=[],sum=[];
    for(let i=0;i<=n;i++){
      const t=i/n*zoomSpan, x=left+i/n*plotW;
      w1.push([x,mid-Math.sin(2*Math.PI*f1*t)*lowerH*.27]);
      w2.push([x,mid-Math.sin(2*Math.PI*f2*t)*lowerH*.27]);
      sum.push([x,mid-(Math.sin(2*Math.PI*f1*t)+Math.sin(2*Math.PI*f2*t))*lowerH*.25]);
    }
    drawWave(ctx,w1,'rgba(81,215,194,.38)',1.2); drawWave(ctx,w2,'rgba(242,199,109,.45)',1.2); drawWave(ctx,sum,'#e6c16d',1.8);
    ctx.save();ctx.fillStyle='#71869d';ctx.font='9px "DM Mono", monospace';ctx.fillText('5 cicli circa',left+plotW-72,height-3);ctx.restore();
  }
  function drawActiveLab() {
    if (state.lab === 'phase') drawPhaseChart();
    else if (state.lab === 'beats') drawBeatChart(...Object.values(readBeat()));
    else if (state.lab === 'microphones') { drawMicScene(); drawMicSignalChart(); }
  }

  // Microphone Placement Lab -----------------------------------------------
  // Estendibile: ogni modello di sorgente definisce una forma d'onda e una descrizione didattica.
  const micSource = { x: 1.1, y: 2.5 };
  const micState = {
    sourceType: 'sine',
    frequency: 1000,
    speed: 344,
    level: 1,
    mic1: { x: 4.8, y: 1.3 },
    mic2: { x: 4.8, y: 3.7 },
    dragging: null
  };
  const micInputs = {
    sourceType: $('#mic-source-type'), frequency: $('#mic-frequency'), speed: $('#mic-speed'), level: $('#mic-level'),
    x1: $('#mic1-x'), y1: $('#mic1-y'), x2: $('#mic2-x'), y2: $('#mic2-y')
  };
  const micSceneCanvas = $('#mic-scene-canvas');
  const micSignalCanvas = $('#mic-signal-canvas');
  const micNoiseRate = 44100;
  const micNoise = (() => {
    // Rumore bianco deterministico: la stessa sequenza permette confronti ripetibili.
    const buffer = new Float32Array(micNoiseRate * 3);
    let seed = 0x5eed1234;
    for (let i = 0; i < buffer.length; i++) {
      seed = (1664525 * seed + 1013904223) >>> 0;
      buffer[i] = (seed / 4294967296) * 2 - 1;
    }
    return buffer;
  })();
  const harmonicComponents = [
    { multiple: 1, weight: .62 },
    { multiple: 2, weight: .23 },
    { multiple: 3, weight: .10 },
    { multiple: 4, weight: .05 }
  ];
  // Catalogo di sorgenti: per aggiungerne una nuova basta definirne il modello,
  // la descrizione e l'etichetta della frequenza di riferimento.
  // Le registrazioni reali vengono caricate da un repository pubblico GitHub tramite jsDelivr.
  // I campioni selezionati appartengono al sottoinsieme ESC-10; i dettagli di attribuzione
  // e le licenze delle singole registrazioni sono riportati in README.md.
  const micSourceModels = {
    sine: {
      kind: 'single-tone', sceneLabel: 'Generatore',
      description: 'Tono puro generato nel browser. Contiene una sola componente sinusoidale: frequenza e fase sono definite.',
      frequencyLabel: 'Frequenza',
      sample: (time, f) => Math.sin(2 * Math.PI * f * time)
    },
    harmonic: {
      kind: 'harmonic', sceneLabel: 'Corda',
      description: 'Modello di corda vibrante: fondamentale e armoniche 2f₀, 3f₀ e 4f₀. I pesi delle componenti sono fissati; la frequenza impostata è la fondamentale.',
      frequencyLabel: 'Frequenza fondamentale',
      sample: (time, f) => harmonicComponents.reduce((value, part) => value + part.weight * Math.sin(2 * Math.PI * f * part.multiple * time), 0)
    },
    noise: {
      kind: 'broadband', sceneLabel: 'Rumore',
      description: 'Rumore bianco a banda larga generato nel browser. Non ha una sola frequenza né una fase globale.',
      frequencyLabel: 'Frequenza di riferimento',
      sample: time => {
        const length = micNoise.length;
        const position = ((time * micNoiseRate) % length + length) % length;
        const index = Math.floor(position), next = (index + 1) % length, fraction = position - index;
        return micNoise[index] * (1 - fraction) + micNoise[next] * fraction;
      }
    },
    dog: {
      kind: 'recording', sceneLabel: 'Cane', frequencyLabel: 'Frequenza di riferimento',
      description: 'Registrazione reale di un abbaio. È un suono transitorio e complesso: il controllo della frequenza serve solo come riferimento per leggere λ e la fase di una componente ipotetica; non modifica il campione.',
      audioUrl: 'https://cdn.jsdelivr.net/gh/karolpiczak/ESC-50@master/audio/1-100032-A-0.wav',
      sourceName: 'Abbaio di cane', sourceCredit: 'nfrae · Freesound 100032 · CC0', sourceUrl: 'https://freesound.org/people/nfrae/sounds/100032/'
    },
    rain: {
      kind: 'recording', sceneLabel: 'Pioggia', frequencyLabel: 'Frequenza di riferimento',
      description: 'Registrazione reale di pioggia. Il segnale contiene molte componenti e varia nel tempo; non esiste una sola fase valida per tutto il campione.',
      audioUrl: 'https://cdn.jsdelivr.net/gh/karolpiczak/ESC-50@master/audio/1-17367-A-10.wav',
      sourceName: 'Pioggia', sourceCredit: 'cognito perceptu · Freesound 17367 · CC0', sourceUrl: 'https://freesound.org/people/cognito%20perceptu/sounds/17367/'
    },
    clock: {
      kind: 'recording', sceneLabel: 'Orologio', frequencyLabel: 'Frequenza di riferimento',
      description: 'Registrazione reale di un orologio. I ticchettii sono transitori: nel grafico si confronta la stessa registrazione ricevuta con due ritardi e attenuazioni differenti.',
      audioUrl: 'https://cdn.jsdelivr.net/gh/karolpiczak/ESC-50@master/audio/1-35687-A-38.wav',
      sourceName: 'Clock-grandfather-ticks & striking once', sourceCredit: 'Bansemer · Freesound 35687 · CC0', sourceUrl: 'https://freesound.org/people/Bansemer/sounds/35687/'
    },
    fire: {
      kind: 'recording', sceneLabel: 'Fuoco', frequencyLabel: 'Frequenza di riferimento',
      description: 'Registrazione reale di crepitio. Il contenuto spettrale cambia rapidamente; lo sfasamento dipende dalla frequenza di ciascuna componente.',
      audioUrl: 'https://cdn.jsdelivr.net/gh/karolpiczak/ESC-50@master/audio/1-17808-A-12.wav',
      sourceName: 'Foc.WAV', sourceCredit: 'Everard · Freesound 17808 · CC0', sourceUrl: 'https://freesound.org/people/Everard/sounds/17808/'
    },
    helicopter: {
      kind: 'recording', sceneLabel: 'Elicottero', frequencyLabel: 'Frequenza di riferimento',
      description: 'Registrazione reale di un elicottero in movimento. La sorgente è complessa e ha un andamento temporale non sinusoidale; il modello applica il ritardo geometrico ai campioni registrati.',
      audioUrl: 'https://cdn.jsdelivr.net/gh/karolpiczak/ESC-50@master/audio/1-172649-A-40.wav',
      sourceName: 'Small Helicopter Takes Off', sourceCredit: 'senorstudy · Freesound 172649 · CC0', sourceUrl: 'https://freesound.org/people/senorstudy/sounds/172649/'
    },
    chainsaw: {
      kind: 'recording', sceneLabel: 'Motosega', frequencyLabel: 'Frequenza di riferimento',
      description: 'Registrazione reale di una motosega. Il suono è sostenuto ma complesso: lo spostamento dei microfoni introduce ritardi diversi e modifica la somma ricevuta.',
      audioUrl: 'https://cdn.jsdelivr.net/gh/karolpiczak/ESC-50@master/audio/1-116765-A-41.wav',
      sourceName: 'chainsaw.wav', sourceCredit: 'UncleSigmund · Freesound 116765 · CC0', sourceUrl: 'https://freesound.org/people/UncleSigmund/sounds/116765/'
    }
  };
  function activeMicSourceModel() {
    return micSourceModels[micState.sourceType] || micSourceModels.sine;
  }
  function sourceDescription() { return activeMicSourceModel().description; }
  function sourceSignalAt(time) {
    const model = activeMicSourceModel();
    if (model.kind !== 'recording') return model.sample(time, micState.frequency);
    if (!model.audioData || !model.audioBuffer || time < 0 || time >= model.audioBuffer.duration) return 0;
    const position = time * model.audioBuffer.sampleRate;
    const index = Math.floor(position);
    const fraction = position - index;
    const next = Math.min(index + 1, model.audioData.length - 1);
    return model.audioData[index] * (1 - fraction) + model.audioData[next] * fraction;
  }
  async function loadMicRecording(model = activeMicSourceModel()) {
    if (model.kind !== 'recording') return null;
    if (model.audioBuffer) return model.audioBuffer;
    if (model.loading) return model.loading;
    model.error = '';
    model.loading = (async () => {
      const response = await fetch(model.audioUrl, { mode: 'cors', cache: 'force-cache' });
      if (!response.ok) throw new Error(`Caricamento audio non riuscito (${response.status}).`);
      const bytes = await response.arrayBuffer();
      const context = await getAudioContext();
      const decoded = await context.decodeAudioData(bytes.slice(0));
      model.audioBuffer = decoded;
      model.audioData = decoded.getChannelData(0);
      return decoded;
    })();
    try { return await model.loading; }
    catch (error) { model.error = error.message || 'Campione non disponibile.'; throw error; }
    finally { model.loading = null; }
  }
  function updateMicSourceStatus() {
    const model = activeMicSourceModel();
    const status = $('#mic-source-status');
    const credit = $('#mic-source-credit');
    if (model.kind === 'recording') {
      if (model.audioBuffer) {
        status.textContent = `Campione caricato · ${fmt(model.audioBuffer.duration, 1)} s · ${model.audioBuffer.sampleRate.toLocaleString('it-IT')} Hz · ${model.audioBuffer.numberOfChannels} canale/i.`;
      } else if (model.loading) {
        status.textContent = 'Caricamento della registrazione da GitHub…';
      } else if (model.error) {
        status.textContent = 'Campione non caricato. Controlla la connessione e seleziona di nuovo la sorgente.';
      } else {
        status.textContent = 'Registrazione esterna: sarà caricata quando selezionata.';
      }
      credit.hidden = false;
      credit.innerHTML = `<strong>${model.sourceName}</strong><p>Autore: ${model.sourceCredit}. Il campione è incluso nel sottoinsieme ESC-10 del dataset ESC-50.</p><a href="${model.sourceUrl}" target="_blank" rel="noopener noreferrer">Registrazione originale su Freesound ↗</a>`;
    } else {
      status.textContent = 'Segnale generato localmente nel browser; nessun file audio esterno.';
      credit.hidden = true;
    }
  }
  async function requestSelectedMicRecording() {
    const model = activeMicSourceModel();
    if (model.kind !== 'recording' || model.audioBuffer) {
      updateMicSourceStatus();
      return;
    }
    const pending = loadMicRecording(model);
    updateMicSourceStatus();
    try {
      await pending;
      updateMicSourceStatus();
      if (activeMicSourceModel() === model) updateMicUI();
    } catch (error) {
      updateMicSourceStatus();
      showToast('Impossibile caricare il campione. Verifica la connessione Internet.');
    }
  }
  function wrapDegrees(value) {
    return ((value + 180) % 360 + 360) % 360 - 180;
  }
  function microphoneData() {
    const r1 = Math.hypot(micState.mic1.x - micSource.x, micState.mic1.y - micSource.y);
    const r2 = Math.hypot(micState.mic2.x - micSource.x, micState.mic2.y - micSource.y);
    const wavelength = micState.speed / micState.frequency;
    const deltaR = r2 - r1;
    const deltaT = deltaR / micState.speed;
    const deltaPhaseRad = -2 * Math.PI * micState.frequency * deltaT;
    const deltaPhaseDeg = wrapDegrees(deltaPhaseRad * 180 / Math.PI);
    // Campo libero ideale: ampiezza proporzionale a 1/r.
    const a1 = micState.level / Math.max(r1, 0.35);
    const a2 = micState.level / Math.max(r2, 0.35);
    const delay1 = r1 / micState.speed;
    const delay2 = r2 / micState.speed;
    // Valore efficace numerico della somma, utile anche per sorgenti non sinusoidali.
    const startTime = Math.max(delay1, delay2) + .007;
    const sampleCount = 2048;
    const sampleDuration = activeMicSourceModel().kind === 'broadband' ? .045 : activeMicSourceModel().kind === 'recording' ? .18 : 3 / micState.frequency;
    let sumSquares = 0;
    for (let i = 0; i < sampleCount; i++) {
      const t = startTime + sampleDuration * i / sampleCount;
      const p = a1 * sourceSignalAt(t - delay1) + a2 * sourceSignalAt(t - delay2);
      sumSquares += p * p;
    }
    const resultRms = Math.sqrt(sumSquares / sampleCount);
    return { r1, r2, wavelength, deltaR, deltaT, deltaPhaseRad, deltaPhaseDeg, a1, a2, resultRms, delay1, delay2 };
  }
  function syncMicPositionInputs() {
    const values = [
      ['x1', micState.mic1.x], ['y1', micState.mic1.y],
      ['x2', micState.mic2.x], ['y2', micState.mic2.y]
    ];
    for (const [key, value] of values) {
      micInputs[key].value = value.toFixed(1);
      paintRange(micInputs[key]);
      $(`#mic${key[1]}-${key[0][0]}-value`).textContent = `${fmt(value, 1)} m`;
    }
    $('#mic1-coords').textContent = `x ${fmt(micState.mic1.x, 1)} m · y ${fmt(micState.mic1.y, 1)} m`;
    $('#mic2-coords').textContent = `x ${fmt(micState.mic2.x, 1)} m · y ${fmt(micState.mic2.y, 1)} m`;
  }
  function updateMicExplanation(data) {
    const angle = Math.abs(data.deltaPhaseDeg);
    const close = (a, b, tolerance = 3) => Math.abs(a - b) <= tolerance;
    const levelsDiffer = Math.abs(data.a1 - data.a2) / Math.max(data.a1, data.a2) > .08;
    let title = 'La somma dipende dal percorso';
    let text = 'La differenza di percorso determina un ritardo. Il ritardo produce una differenza di fase che dipende dalla frequenza considerata. Anche i livelli ricevuti possono essere diversi, perché i microfoni si trovano a distanze differenti.';
    let value = `Δt = ${fmt(data.deltaT * 1000, 3)} ms`;
    let condition = 'Il segno indica se MIC 2 arriva dopo o prima di MIC 1.';

    if (micState.sourceType === 'harmonic') {
      title = 'Una fase diversa per ogni armonica';
      const secondPhase = wrapDegrees(2 * data.deltaPhaseDeg);
      const thirdPhase = wrapDegrees(3 * data.deltaPhaseDeg);
      text = `La fase indicata (${fmt(data.deltaPhaseDeg, 1)}°) si riferisce alla fondamentale. La seconda armonica accumula il doppio dello sfasamento e la terza il triplo. Per esempio, se la fondamentale è a 180°, la seconda armonica è a 360° (in fase) e la terza a 540° (equivalente a 180°, in opposizione). Le componenti possono quindi rinforzarsi o attenuarsi in modo diverso: cambia la forma d’onda risultante.`;
      value = `Δφ₂ ≡ ${fmt(secondPhase, 1)}°  ·  Δφ₃ ≡ ${fmt(thirdPhase, 1)}°`;
      condition = 'Le fasi delle armoniche si considerano modulo 360°. Il valore efficace della somma è calcolato numericamente nel modello.';
    } else if (activeMicSourceModel().kind === 'recording') {
      title = `Registrazione reale: ${activeMicSourceModel().sourceName.toLowerCase()}`;
      text = 'Il campione contiene più componenti e varia nel tempo: non si può attribuire un’unica frequenza o una sola fase a tutta la registrazione. I due microfoni ricevono la stessa forma d’onda con ritardi e livelli differenti. Ogni componente di frequenza accumula uno sfasamento diverso, proporzionale a f · Δt; nella somma alcune parti dello spettro possono rinforzarsi e altre attenuarsi. Nel grafico si osserva direttamente la somma dei campioni ritardati. Il file è già una registrazione: la simulazione lo usa come segnale emesso da una sorgente ideale e aggiunge ritardo e attenuazione; non ricostruisce la direttività della sorgente né l’ambiente della registrazione originale.';
      const phaseAtReference = wrapDegrees(-2 * Math.PI * micState.frequency * data.deltaT * 180 / Math.PI);
      value = `Δt = ${fmt(data.deltaT * 1000, 3)} ms`;
      condition = `Alla frequenza di riferimento (${micState.frequency} Hz), la fase teorica è ${fmt(phaseAtReference, 1)}° modulo 360°. Il valore RMS è stimato sui campioni della registrazione.`;
    } else if (micState.sourceType === 'noise') {
      title = 'Il rumore contiene molte frequenze';
      const phase100 = wrapDegrees(-2 * Math.PI * 100 * data.deltaT * 180 / Math.PI);
      const phase1000 = wrapDegrees(-2 * Math.PI * 1000 * data.deltaT * 180 / Math.PI);
      text = `Non esiste una sola fase che descriva tutto il rumore. Ogni componente riceve uno sfasamento proporzionale alla propria frequenza. Per questo stesso ritardo, una componente a 100 Hz ha uno sfasamento di ${fmt(phase100, 1)}° e una a 1000 Hz di ${fmt(phase1000, 1)}° (modulo 360°). Nella somma alcune bande possono rinforzarsi e altre attenuarsi: è il principio che porta all’effetto pettine.`;
      value = `Δφ(f) = −2π f · ${fmt(data.deltaT, 6)} s`;
      condition = `La fase numerica mostrata in alto vale soltanto alla frequenza di riferimento (${micState.frequency} Hz). Il valore efficace è stimato su una finestra temporale del rumore.`;
    } else {
      const phase = deg(data.deltaPhaseDeg);
      const resultPeak = Math.sqrt(Math.max(0, data.a1 ** 2 + data.a2 ** 2 + 2 * data.a1 * data.a2 * Math.cos(phase)));
      if (close(angle, 0) || close(angle, 360)) {
        title = 'I toni arrivano in fase';
        text = 'Alla frequenza impostata la differenza di fase è 0° modulo 360°. I contributi si sommano e il rinforzo è massimo. L’ampiezza raddoppia soltanto se anche i livelli ricevuti sono uguali.';
        value = `Aᵣᵢₛ = A₁ + A₂ = ${fmt(data.a1 + data.a2, 3)} Pa`;
        condition = 'Ampiezza di picco teorica della somma. Il valore efficace (RMS) è riportato nella misura qui sotto.';
      } else if (close(angle, 180)) {
        title = 'I toni arrivano in opposizione';
        text = 'Alla frequenza impostata la differenza di fase è circa 180°. Il massimo di un segnale coincide con il minimo dell’altro: i contributi si compensano. La cancellazione completa richiede livelli uguali.';
        value = `Aᵣᵢₛ = |A₁ − A₂| = ${fmt(Math.abs(data.a1 - data.a2), 3)} Pa`;
        condition = levelsDiffer ? 'I livelli ricevuti sono diversi: resta una componente residua.' : 'I livelli ricevuti sono uguali: nel modello ideale la somma è nulla.';
      } else if (close(angle, 90) || close(angle, 270)) {
        title = 'I toni arrivano in quadratura';
        text = 'La differenza di fase è un quarto di ciclo. La somma non raggiunge né il rinforzo massimo né la cancellazione completa.';
        value = `Aᵣᵢₛ = √(A₁² + A₂²) = ${fmt(resultPeak, 3)} Pa`;
        condition = 'Ampiezza di picco teorica per due sinusoidi in quadratura.';
      } else {
        title = 'I toni arrivano con uno sfasamento intermedio';
        text = 'I due segnali si sommano istante per istante. La differenza di fase determina il valore dell’ampiezza risultante, che si trova tra il rinforzo massimo e la compensazione.';
        value = `Aᵣᵢₛ = ${fmt(resultPeak, 3)} Pa`;
        condition = `Calcolo con A₁ = ${fmt(data.a1, 3)} Pa, A₂ = ${fmt(data.a2, 3)} Pa e Δφ = ${fmt(data.deltaPhaseDeg, 1)}°.`;
      }
    }
    if (levelsDiffer && micState.sourceType !== 'sine') {
      text += ' Inoltre i due microfoni ricevono livelli differenti perché si trovano a distanze diverse dalla sorgente: anche il livello contribuisce al risultato della somma.';
    } else if (levelsDiffer && micState.sourceType === 'sine' && !close(angle, 180)) {
      text += ' I due microfoni ricevono livelli differenti perché si trovano a distanze diverse dalla sorgente.';
    }
    $('#mic-expected-title').textContent = title;
    $('#mic-expected-text').textContent = text;
    $('#mic-expected-value').textContent = value;
    $('#mic-expected-condition').textContent = condition;
  }
  function updateMicUI() {
    const data = microphoneData();
    $('#mic-source-description').textContent = sourceDescription();
    updateMicSourceStatus();
    $('#mic-frequency-label').textContent = activeMicSourceModel().frequencyLabel;
    $('#mic-frequency-value').textContent = `${micState.frequency} Hz`;
    $('#mic-speed-value').textContent = `${micState.speed} m/s`;
    $('#mic-level-value').textContent = `${fmt(micState.level, 1)} Pa`;
    $('#mic-wavelength').textContent = `${fmt(data.wavelength, 3)} m`;
    $('#mic-delta-r').textContent = `${data.deltaR >= 0 ? '+' : '−'}${fmt(Math.abs(data.deltaR), 3)} m`;
    $('#mic-delta-t').textContent = `${data.deltaT >= 0 ? '+' : '−'}${fmt(Math.abs(data.deltaT * 1000), 3)} ms`;
    $('#mic-phase-delta').textContent = `${data.deltaPhaseDeg > 0 ? '+' : ''}${fmt(data.deltaPhaseDeg, 1)}°`;
    $('#mic-r1').textContent = `${fmt(data.r1, 2)} m`;
    $('#mic-r2').textContent = `${fmt(data.r2, 2)} m`;
    $('#mic-a1').textContent = `${fmt(data.a1, 3)} Pa`;
    $('#mic-a2').textContent = `${fmt(data.a2, 3)} Pa`;
    $('#mic-result-amplitude').textContent = `${fmt(data.resultRms, 3)} Pa RMS`;
    if (activeMicSourceModel().kind === 'broadband' || activeMicSourceModel().kind === 'recording') {
      $('#mic-phase-note').textContent = `Fase teorica alla frequenza di riferimento (${micState.frequency} Hz). ${activeMicSourceModel().kind === 'recording' ? 'La registrazione contiene molte componenti: ciascuna ha una fase relativa diversa.' : 'Il rumore contiene molte componenti con sfasamenti differenti.'}`;
    } else if (Math.abs(data.deltaPhaseDeg) < 0.5) {
      $('#mic-phase-note').textContent = Math.abs(data.deltaT) < 1e-7 ? 'I due microfoni hanno lo stesso percorso: i segnali arrivano nello stesso istante e con la stessa fase.' : 'La differenza di fase è 0° modulo 360°: alla frequenza di riferimento i segnali sono in fase.';
    } else if (Math.abs(Math.abs(data.deltaPhaseDeg) - 180) < 0.5) {
      $('#mic-phase-note').textContent = 'Alla frequenza di riferimento i segnali sono in opposizione di fase. La cancellazione completa richiede anche livelli uguali.';
    } else if (data.deltaT > 0) {
      $('#mic-phase-note').textContent = `MIC 2 è più lontano: il suo segnale arriva ${fmt(data.deltaT * 1000, 3)} ms dopo MIC 1.`;
    } else {
      $('#mic-phase-note').textContent = `MIC 2 è più vicino: il suo segnale arriva ${fmt(Math.abs(data.deltaT) * 1000, 3)} ms prima di MIC 1.`;
    }
    [micInputs.frequency, micInputs.speed, micInputs.level].forEach(paintRange);
    syncMicPositionInputs();
    updateMicExplanation(data);
    drawMicScene();
    drawMicSignalChart(data);
  }
  function micSceneMetrics(canvas) {
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(300, rect.width);
    const height = Math.max(260, rect.height);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const left = 36, right = 22, top = 22, bottom = 28;
    const plotW = width - left - right, plotH = height - top - bottom;
    return {
      ctx, width, height, left, top, plotW, plotH,
      toCanvas: p => [left + p.x / 8 * plotW, top + p.y / 5 * plotH],
      toWorld: (x, y) => ({ x: Math.max(.5, Math.min(7.5, (x - left) / plotW * 8)), y: Math.max(.5, Math.min(4.5, (y - top) / plotH * 5)) })
    };
  }
  function drawMicGlyph(ctx, x, y, color, label) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(-6, -12, 12, 22, 6); ctx.fill();
    ctx.beginPath(); ctx.arc(0, -2, 13, Math.PI * 1.12, Math.PI * 1.88); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, 11); ctx.lineTo(0, 17); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-7, 17); ctx.lineTo(7, 17); ctx.stroke();
    ctx.font = '600 11px system-ui, sans-serif';
    ctx.fillStyle = color;
    ctx.fillText(label, 13, 4);
    ctx.restore();
  }
  function drawMicScene() {
    if (!micSceneCanvas || !$('#lab-microphones').classList.contains('active')) return;
    const m = micSceneMetrics(micSceneCanvas);
    const { ctx, width, height, left, top, plotW, plotH } = m;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#0c1726'; ctx.fillRect(0, 0, width, height);
    ctx.save();
    ctx.strokeStyle = 'rgba(143,164,184,.15)'; ctx.lineWidth = 1;
    ctx.font = '10px ui-monospace, monospace'; ctx.fillStyle = '#8294a8';
    for (let x = 0; x <= 8; x++) {
      const px = left + x / 8 * plotW;
      ctx.beginPath(); ctx.moveTo(px, top); ctx.lineTo(px, top + plotH); ctx.stroke();
      if (x < 8) ctx.fillText(`${x} m`, px + 3, height - 8);
    }
    for (let y = 0; y <= 5; y++) {
      const py = top + y / 5 * plotH;
      ctx.beginPath(); ctx.moveTo(left, py); ctx.lineTo(left + plotW, py); ctx.stroke();
    }
    ctx.restore();
    const sourcePt = m.toCanvas(micSource);
    const mic1Pt = m.toCanvas(micState.mic1);
    const mic2Pt = m.toCanvas(micState.mic2);
    const data = microphoneData();
    // Cerchi di riferimento alla lunghezza d'onda fondamentale / impostata.
    ctx.save();
    ctx.strokeStyle = 'rgba(111,174,167,.25)'; ctx.lineWidth = 1;
    const maxRadius = 4.8;
    const pixelPerMetre = Math.min(plotW / 8, plotH / 5);
    const step = data.wavelength;
    if (step > 0.08) {
      for (let r = step; r <= maxRadius; r += step) {
        ctx.globalAlpha = Math.max(.05, .23 - r * .025);
        ctx.beginPath(); ctx.arc(sourcePt[0], sourcePt[1], r * pixelPerMetre, 0, Math.PI * 2); ctx.stroke();
      }
    }
    ctx.restore();
    ctx.save(); ctx.lineWidth = 1.6; ctx.setLineDash([5, 5]);
    ctx.strokeStyle = 'rgba(121,184,172,.75)'; ctx.beginPath(); ctx.moveTo(...sourcePt); ctx.lineTo(...mic1Pt); ctx.stroke();
    ctx.strokeStyle = 'rgba(120,169,230,.8)'; ctx.beginPath(); ctx.moveTo(...sourcePt); ctx.lineTo(...mic2Pt); ctx.stroke();
    ctx.restore();
    const label1x = (sourcePt[0] + mic1Pt[0]) / 2, label1y = (sourcePt[1] + mic1Pt[1]) / 2 - 7;
    const label2x = (sourcePt[0] + mic2Pt[0]) / 2, label2y = (sourcePt[1] + mic2Pt[1]) / 2 + 13;
    ctx.save(); ctx.font = '10px ui-monospace, monospace';
    ctx.fillStyle = '#7ed7c8'; ctx.fillText(`r₁ ${fmt(data.r1, 2)} m`, label1x + 3, label1y);
    ctx.fillStyle = '#91b8e8'; ctx.fillText(`r₂ ${fmt(data.r2, 2)} m`, label2x + 3, label2y);
    ctx.restore();
    ctx.save();
    ctx.fillStyle = '#d4b276'; ctx.beginPath(); ctx.arc(sourcePt[0], sourcePt[1], 12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#17202b'; ctx.font = 'bold 11px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('S', sourcePt[0], sourcePt[1] + .5);
    ctx.fillStyle = '#d4b276'; ctx.textAlign = 'left'; ctx.font = '600 11px system-ui'; ctx.fillText(activeMicSourceModel().sceneLabel, sourcePt[0] + 16, sourcePt[1] + 4);
    ctx.restore();
    drawMicGlyph(ctx, mic1Pt[0], mic1Pt[1], '#58c4b3', 'MIC 1');
    drawMicGlyph(ctx, mic2Pt[0], mic2Pt[1], '#78a9e6', 'MIC 2');
    if (micState.dragging) {
      const pt = micState.dragging === 'mic1' ? mic1Pt : mic2Pt;
      ctx.save(); ctx.strokeStyle = 'rgba(230,239,245,.55)'; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.arc(pt[0], pt[1], 23, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    }
  }
  function drawMicSignalChart(data = microphoneData()) {
    if (!micSignalCanvas || !$('#lab-microphones').classList.contains('active')) return;
    const setup = canvasSetup(micSignalCanvas); if (!setup) return;
    const { ctx, width, height } = setup;
    ctx.clearRect(0, 0, width, height);
    const left = 53, right = 14, top = 12, bottom = 19;
    const plotW = width - left - right;
    const plotH = height - top - bottom;
    const rowH = plotH / 3;
    const scale = Math.max(data.a1, data.a2, data.resultRms * 1.8, .1) * 1.45;
    drawGrid(ctx, left, top, plotW, plotH, 3);
    const sourceKind = activeMicSourceModel().kind;
    const periodic = sourceKind === 'single-tone' || sourceKind === 'harmonic';
    const timeSpan = periodic ? 3 / micState.frequency : sourceKind === 'recording' ? .18 : .012;
    $('#mic-chart-span').textContent = periodic ? 'tempo · 3 periodi' : sourceKind === 'recording' ? 'tempo · 180 ms' : 'tempo · 12 ms';
    const startTime = Math.max(data.delay1, data.delay2) + .004;
    const rows = [
      { label: 'MIC 1', color: '#58c4b3', fn: dt => data.a1 * sourceSignalAt(startTime + dt - data.delay1) },
      { label: 'MIC 2', color: '#78a9e6', fn: dt => data.a2 * sourceSignalAt(startTime + dt - data.delay2) },
      { label: 'SOMMA', color: '#c3ad86', fn: dt => data.a1 * sourceSignalAt(startTime + dt - data.delay1) + data.a2 * sourceSignalAt(startTime + dt - data.delay2) }
    ];
    rows.forEach((row, index) => {
      const y0 = top + rowH * index, mid = y0 + rowH / 2;
      ctx.save(); ctx.strokeStyle = 'rgba(170,190,210,.3)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(left, mid); ctx.lineTo(left + plotW, mid); ctx.stroke();
      ctx.fillStyle = row.color; ctx.font = '9px ui-monospace, monospace'; ctx.fillText(row.label, 8, y0 + 13);
      ctx.restore();
      const points = [], n = Math.max(400, Math.floor(plotW));
      for (let i = 0; i <= n; i++) {
        const dt = i / n * timeSpan;
        const x = left + i / n * plotW;
        const y = mid - row.fn(dt) / scale * rowH * .38;
        points.push([x, y]);
      }
      drawWave(ctx, points, row.color, index === 2 ? 2.2 : 1.7);
    });
    ctx.save(); ctx.fillStyle = '#8294a8'; ctx.font = '9px ui-monospace, monospace';
    ctx.fillText('inizio', left - 3, height - 3);
    ctx.fillText(periodic ? '3 periodi' : '12 ms', left + plotW - 55, height - 3);
    ctx.restore();
  }
  function setupMicCanvasEvents() {
    if (!micSceneCanvas) return;
    function canvasPoint(event) {
      const rect = micSceneCanvas.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    }
    micSceneCanvas.addEventListener('pointerdown', event => {
      const m = micSceneMetrics(micSceneCanvas), point = canvasPoint(event);
      const p1 = m.toCanvas(micState.mic1), p2 = m.toCanvas(micState.mic2);
      const d1 = Math.hypot(point.x - p1[0], point.y - p1[1]);
      const d2 = Math.hypot(point.x - p2[0], point.y - p2[1]);
      if (Math.min(d1, d2) > 28) return;
      micState.dragging = d1 <= d2 ? 'mic1' : 'mic2';
      micSceneCanvas.setPointerCapture(event.pointerId);
      micSceneCanvas.classList.add('dragging');
      event.preventDefault(); drawMicScene();
    });
    micSceneCanvas.addEventListener('pointermove', event => {
      if (!micState.dragging) return;
      const m = micSceneMetrics(micSceneCanvas), point = canvasPoint(event);
      const position = m.toWorld(point.x, point.y);
      micState[micState.dragging].x = Math.round(position.x * 10) / 10;
      micState[micState.dragging].y = Math.round(position.y * 10) / 10;
      updateMicUI(); event.preventDefault();
    });
    const finishDrag = () => {
      micState.dragging = null; micSceneCanvas.classList.remove('dragging'); drawMicScene();
    };
    micSceneCanvas.addEventListener('pointerup', finishDrag);
    micSceneCanvas.addEventListener('pointercancel', finishDrag);
  }
  function applyMicPreset(name) {
    micState.mic1 = { x: 4.8, y: 1.3 };
    micState.mic2 = { x: 4.8, y: 3.7 };
    if (name !== 'equal') {
      const r1 = Math.hypot(micState.mic1.x - micSource.x, micState.mic1.y - micSource.y);
      const target = r1 + micState.speed / micState.frequency * (name === 'quarter' ? .25 : .5);
      // Si colloca MIC 2 sull'asse orizzontale della scena, mantenendo esatta la distanza richiesta.
      micState.mic2 = { x: Math.min(7.5, micSource.x + target), y: micSource.y };
    }
    updateMicUI();
  }
  function playMicSignal(which, button) {
    if (state.activeButton === button) { stopAudio(); return; }
    if (activeMicSourceModel().kind === 'recording' && !activeMicSourceModel().audioBuffer) {
      showToast('Il campione non è ancora disponibile. Attendi il caricamento.');
      requestSelectedMicRecording();
      return;
    }
    const data = microphoneData();
    const sampleRate = 44100, duration = 2.2;
    const samples = new Float32Array(Math.floor(sampleRate * duration));
    const normalization = Math.max(data.a1 + data.a2, .1);
    for (let i = 0; i < samples.length; i++) {
      const t = i / sampleRate;
      const p1 = data.a1 * sourceSignalAt(t - data.delay1);
      const p2 = data.a2 * sourceSignalAt(t - data.delay2);
      samples[i] = (which === 'mic1' ? p1 : which === 'mic2' ? p2 : p1 + p2) / normalization;
    }
    playBuffer(samples, sampleRate, button, 'Ascolta');
  }
  micInputs.sourceType.addEventListener('change', () => {
    stopAudio();
    micState.sourceType = micInputs.sourceType.value;
    updateMicUI();
    requestSelectedMicRecording();
  });
  [micInputs.frequency, micInputs.speed, micInputs.level].forEach(input => input.addEventListener('input', () => {
    micState.frequency = Number(micInputs.frequency.value);
    micState.speed = Number(micInputs.speed.value);
    micState.level = Number(micInputs.level.value);
    updateMicUI();
  }));
  for (const [key, input] of Object.entries({ x1: micInputs.x1, y1: micInputs.y1, x2: micInputs.x2, y2: micInputs.y2 })) {
    input.addEventListener('input', () => {
      const microphone = key.endsWith('1') ? micState.mic1 : micState.mic2;
      microphone[key[0]] = Number(input.value);
      updateMicUI();
    });
  }
  $$('[data-mic-preset]').forEach(button => button.addEventListener('click', () => applyMicPreset(button.dataset.micPreset)));
  $('#play-mic-source').dataset.idleHtml = 'Anteprima della sorgente';
  $('#play-mic-sum').dataset.idleHtml = 'Ascolta la somma';
  $('#play-mic1').dataset.idleHtml = 'Solo MIC 1';
  $('#play-mic2').dataset.idleHtml = 'Solo MIC 2';
  function playMicSource(button) {
    if (state.activeButton === button) { stopAudio(); return; }
    const model = activeMicSourceModel();
    if (model.kind === 'recording' && !model.audioBuffer) {
      showToast(model.loading ? 'Il campione è ancora in caricamento.' : 'Carico la registrazione: riprova tra poco.');
      requestSelectedMicRecording();
      return;
    }
    const sampleRate = 44100, duration = model.kind === 'recording' ? Math.min(2.2, model.audioBuffer.duration) : 2.2;
    const samples = new Float32Array(Math.max(1, Math.floor(sampleRate * duration)));
    let peak = 0;
    for (let i = 0; i < samples.length; i++) {
      samples[i] = sourceSignalAt(i / sampleRate);
      peak = Math.max(peak, Math.abs(samples[i]));
    }
    const gain = peak > 0 ? .85 / peak : 1;
    for (let i = 0; i < samples.length; i++) samples[i] *= gain;
    playBuffer(samples, sampleRate, button, 'Riproduzione');
  }
  $('#play-mic-source').addEventListener('click', () => playMicSource($('#play-mic-source')));
  $('#play-mic-sum').addEventListener('click', () => playMicSignal('sum', $('#play-mic-sum')));
  $('#play-mic1').addEventListener('click', () => playMicSignal('mic1', $('#play-mic1')));
  $('#play-mic2').addEventListener('click', () => playMicSignal('mic2', $('#play-mic2')));
  setupMicCanvasEvents();
  updateMicUI();

  // Audio playback (generated in-browser; no microphone access) ------------
  async function getAudioContext() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) throw new Error('Web Audio API non disponibile in questo browser.');
    if (!state.audioContext) state.audioContext = new Ctx();
    if (state.audioContext.state === 'suspended') await state.audioContext.resume();
    return state.audioContext;
  }
  function stopAudio() {
    if (state.activeSource) {
      try { state.activeSource.stop(); } catch { /* already stopped */ }
      state.activeSource = null;
    }
    if (state.activeButton) {
      state.activeButton.innerHTML = state.activeButton.dataset.idleHtml || '<span class="play-icon">▶</span> Ascolta';
      state.activeButton = null;
    }
  }
  async function playBuffer(samples, sampleRate, button, label) {
    try {
      stopAudio();
      const context = await getAudioContext();
      const buffer = context.createBuffer(1, samples.length, sampleRate);
      buffer.copyToChannel(samples, 0);
      const source = context.createBufferSource();
      const gain = context.createGain();
      gain.gain.value = .22;
      source.buffer = buffer;
      source.connect(gain); gain.connect(context.destination);
      state.activeSource = source; state.activeButton = button;
      button.innerHTML = '<span class="play-icon">■</span> Riproduzione…';
      source.onended = () => { if (state.activeSource === source) stopAudio(); };
      source.start();
    } catch (error) {
      showToast(error.message || 'Impossibile riprodurre il suono.');
    }
  }
  $('#play-phase').dataset.idleHtml = '<span class="play-icon">▶</span> Ascolta la risultante';
  $('#play-beats').dataset.idleHtml = '<span class="play-icon">▶</span> Ascolta i battimenti';
  $('#play-phase').addEventListener('click', () => {
    const btn = $('#play-phase');
    if (state.activeButton === btn) { stopAudio(); return; }
    const { shift, frequency, a1, a2 } = readPhase();
    const sr = 44100, duration = 1.35, samples = new Float32Array(Math.floor(sr * duration)), phase = deg(shift);
    const normalization = Math.max(1, a1 + a2);
    for (let i=0;i<samples.length;i++) { const t=i/sr; samples[i]=(a1*Math.sin(2*Math.PI*frequency*t)+a2*Math.sin(2*Math.PI*frequency*t+phase))/normalization; }
    playBuffer(samples,sr,btn,'Ascolta');
  });
  $('#play-beats').addEventListener('click', () => {
    const btn = $('#play-beats');
    if (state.activeButton === btn) { stopAudio(); return; }
    const { f1, f2 } = readBeat();
    const sr = 44100, duration = 2.4, samples = new Float32Array(Math.floor(sr * duration));
    for(let i=0;i<samples.length;i++){const t=i/sr;samples[i]=.5*(Math.sin(2*Math.PI*f1*t)+Math.sin(2*Math.PI*f2*t));}
    playBuffer(samples,sr,btn,'Ascolta');
  });

  // Review library ----------------------------------------------------------
  // Schede sintetiche costruite sui quattro materiali di lezione allegati.
  const reviewLessons = {
    1: {
      title: 'Lezione 01 · Che cos’è il suono?',
      intro: 'Dalla vibrazione alla propagazione, fino alla ricezione e alla rappresentazione del segnale.',
      cards: [
        { title: 'Sorgente, propagazione, ricezione', body: 'Una sorgente (corda, membrana, corde vocali) vibra e trasferisce energia al mezzo. La perturbazione si propaga; l’orecchio la riceve e il sistema uditivo rende possibile la percezione. Sono tre momenti collegati, ma non coincidono.', note: 'Le particelle d’aria oscillano localmente: non viaggiano dalla sorgente fino all’orecchio insieme all’onda.' },
        { title: 'Onda meccanica e aria', body: 'Il suono è un’onda meccanica: richiede un mezzo materiale. Nell’aria è associato a variazioni di pressione, con compressioni (pressione maggiore) e rarefazioni (pressione minore). Può propagarsi anche in liquidi e solidi, ma non nel vuoto.', note: 'Non confondere il movimento locale delle particelle con la propagazione della perturbazione.' },
        { title: 'Grafico nel tempo', body: 'L’asse orizzontale rappresenta il tempo; quello verticale la variazione della grandezza osservata, ad esempio la pressione rispetto all’equilibrio. La linea centrale è il riferimento. L’ampiezza è la massima distanza da quel riferimento.', note: 'Il grafico temporale descrive ciò che accade in un punto di osservazione: non è la traiettoria delle particelle d’aria.' },
        { title: 'Frequenza, ampiezza e timbro', body: 'La frequenza f conta i cicli al secondo e si misura in hertz. È collegata all’altezza percepita (grave/acuto), ma non è la stessa cosa. L’ampiezza misura la massima variazione; è collegata alla sensazione di volume, che dipende anche da altri fattori. Il timbro dipende, tra le altre cose, dalla distribuzione delle componenti in frequenza e dall’evoluzione temporale del suono.', formula: 'f = N / Δt', note: 'Frequenza e altezza, ampiezza e volume, sono coppie collegate ma non sinonime.' },
        { title: 'Il microfono come trasduttore', body: 'L’onda sonora mette in movimento il diaframma del microfono. Il trasduttore converte quel movimento in un segnale elettrico, che può essere elaborato, rappresentato e registrato.', note: 'Il microfono non registra direttamente la sensazione uditiva: converte un fenomeno fisico in un segnale.', labs: ['microphones'] }
      ]
    },
    2: {
      title: 'Lezione 02 · Le caratteristiche di un’onda',
      intro: 'Descrivere un’onda nel tempo e nello spazio, collegando periodo, frequenza, lunghezza d’onda e velocità.',
      cards: [
        { title: 'Ciclo e periodo', body: 'Un ciclo è una ripetizione completa del fenomeno. Il punto di partenza è convenzionale: in una sinusoide si può scegliere un attraversamento crescente dell’equilibrio e arrivare al successivo. Il periodo T è il tempo necessario per un ciclo completo.', formula: 'T = tempo di un ciclo (s)', note: 'Il periodo non è la durata complessiva del suono: misura un singolo ciclo.' },
        { title: 'Frequenza e periodo', body: 'La frequenza indica quanti cicli completi avvengono in un secondo. Frequenza e periodo descrivono lo stesso fenomeno da due prospettive complementari: se T diminuisce, f aumenta.', formula: 'f = 1/T     ·     T = 1/f', note: 'Se T è espresso in secondi, f si ottiene in hertz (Hz).' },
        { title: 'Tempo e spazio', body: 'La pressione dipende in generale da posizione e tempo: p(x,t). Se fissiamo una posizione e osserviamo molti istanti, misuriamo l’evoluzione temporale e ricaviamo T e f. Se fissiamo un istante e confrontiamo posizioni diverse, osserviamo la struttura spaziale e ricaviamo λ.', note: 'Sono due sezioni dello stesso campo: un grafico temporale e un’istantanea spaziale non mostrano la stessa cosa.' },
        { title: 'Lunghezza d’onda e velocità', body: 'La lunghezza d’onda λ è la distanza tra due punti consecutivi che si trovano nella stessa fase. In un periodo T la perturbazione avanza di una lunghezza d’onda. La velocità è distanza divisa per tempo.', formula: 'v = λ/T = fλ', note: 'La velocità dell’onda non coincide con la velocità di oscillazione delle particelle del mezzo. La velocità dipende dal mezzo e dalle sue condizioni.', labs: ['microphones'] },
        { title: 'Esempi nell’aria e diffrazione', body: 'Nella lezione si usa v ≈ 344 m/s per l’aria a circa 20 °C. A 440 Hz, λ ≈ 344/440 ≈ 0,782 m. La diffrazione è la deviazione e redistribuzione dell’onda dietro un ostacolo o oltre un’apertura; tende a essere più evidente quando λ è grande rispetto alle dimensioni dell’ostacolo.', formula: 'λ = v/f', note: 'A parità di mezzo, i suoni gravi hanno lunghezze d’onda maggiori e in genere diffrangono di più.' },
        { title: 'Onde semplici, complesse e armoniche', body: 'Una sinusoide è un’onda semplice. Un suono periodico complesso può essere rappresentato come somma di sinusoidi. In un suono armonico le frequenze sono multipli interi della fondamentale f₀: 2f₀, 3f₀, 4f₀ e così via. Il termine parziale è più generale e indica una componente anche quando non è un multiplo intero.', formula: 'fₙ = n f₀  (per le armoniche)', note: 'Ampiezza e fase delle componenti contribuiscono alla forma d’onda risultante e al timbro. Un’onda quadra ideale contiene solo armoniche dispari.' },
        { title: 'Il monocordo', body: 'A tensione e caratteristiche della corda invariate, accorciare la parte vibrante aumenta la frequenza. Nel modello ideale, dimezzare la lunghezza vibrante raddoppia la frequenza e produce un’ottava.', note: 'La lunghezza della corda vibrante non è la lunghezza d’onda del suono che si propaga nell’aria: sono due grandezze diverse.' },
        { title: 'Primo collegamento con fase e sovrapposizione', body: 'La lezione introduce la fase come posizione dell’oscillazione nel ciclo e il principio di sovrapposizione: nello stesso punto e istante le variazioni di pressione si sommano. Interferenza costruttiva e distruttiva descrivono rinforzi e attenuazioni.', note: 'Per la cancellazione ideale servono stessa frequenza, stessa ampiezza e opposizione di fase nel punto considerato.' }
      ]
    },
    3: {
      title: 'Lezione 03 · La fase e l’interazione tra le onde',
      intro: 'Dalla posizione nel ciclo alla descrizione matematica dell’oscillazione e alla somma dei segnali.',
      cards: [
        { title: 'Che cosa descrive la fase?', body: 'La fase descrive la posizione di un’oscillazione all’interno del proprio ciclo, rispetto a un riferimento. Un giro completo equivale a 2π radianti, cioè 360°. Fasi che differiscono di un multiplo intero di 2π descrivono la stessa posizione ciclica.', formula: '0° = 0 rad   ·   90° = π/2   ·   180° = π   ·   360° = 2π', note: 'La fase non indica quanto è veloce l’oscillazione: la frequenza determina la rapidità con cui avanza la fase.' },
        { title: 'La funzione sinusoidale', body: 'Una componente sinusoidale della variazione di pressione può essere descritta con p′(t) = A sin(ωt + φ₀). A è l’ampiezza; ω è la pulsazione; t è l’istante; φ₀ è la fase iniziale nell’origine temporale scelta. p′(t) è la variazione rispetto alla pressione di equilibrio.', formula: 'p′(t) = A sin(ωt + φ₀)', note: 'La fase iniziale non indica necessariamente l’inizio fisico del suono: è riferita a t = 0 scelto per la descrizione.', labs: ['phase'] },
        { title: 'Pulsazione e fase istantanea', body: 'La pulsazione misura la rapidità con cui avanza l’angolo di fase. La fase istantanea è la posizione raggiunta all’istante t. Dopo un periodo T, la fase aumenta di 2π.', formula: 'ω = 2πf = 2π/T     ·     φ(t) = ωt + φ₀', note: 'ω si misura in radianti al secondo (rad/s); se la usi in una formula, il tempo va espresso in secondi.' },
        { title: 'Ritardo e differenza di fase', body: 'Per due sinusoidi della stessa frequenza, un ritardo τ corrisponde a una frazione del periodo. Un quarto di periodo equivale a 90°; mezzo periodo a 180°; un periodo intero a 360°.', formula: '|Δφ| = 2πfτ = ωτ', note: 'Lo stesso ritardo temporale produce sfasamenti differenti a frequenze differenti.', labs: ['phase', 'microphones'] },
        { title: 'Fase nello spazio e microfoni', body: 'Per un’onda che si propaga nello stesso mezzo, una differenza di percorso Δx produce una differenza di fase. Due microfoni a distanze diverse dalla stessa sorgente possono quindi ricevere segnali ritardati e sfasati.', formula: '|Δφ| = 2π |Δx| / λ', note: 'Il segno dipende da quale percorso si sceglie come riferimento e dal verso di propagazione.', labs: ['microphones'] },
        { title: 'Sovrapposizione e interferenza', body: 'Nel modello lineare, nello stesso punto e istante si sommano algebricamente le variazioni di pressione. Con stessa frequenza e fase relativa costante la somma è ancora sinusoidale. In fase si ha rinforzo; in opposizione si ha compensazione.', formula: 'p′ris(t) = p′₁(t) + p′₂(t)  ·  Aᵣᵢₛ = √(A₁² + A₂² + 2A₁A₂ cos Δφ)', note: 'La seconda relazione vale per sinusoidi della stessa frequenza. La cancellazione completa richiede stessa frequenza, stessa ampiezza e opposizione di fase. La somma nulla in un punto non significa che l’energia sia scomparsa da tutto lo spazio.', labs: ['phase'] }
      ]
    },
    4: {
      title: 'Lezione 04 · Interferenza e battimenti',
      intro: 'Quando le frequenze sono vicine ma diverse, la differenza di fase varia nel tempo e la somma produce una pulsazione dell’ampiezza.',
      cards: [
        { title: 'Stessa frequenza o frequenze diverse', body: 'Se le frequenze coincidono, le fasi avanzano alla stessa velocità e la loro differenza può rimanere costante. Se le frequenze sono diverse, le fasi avanzano a velocità differenti: la differenza di fase varia nel tempo.', formula: 'Δφ(t) = 2π(f₂ − f₁)t + Δφ₀', note: 'Con frequenze differenti, le onde passano periodicamente da condizioni di rinforzo a condizioni di compensazione.', labs: ['beats'] },
        { title: 'Somma di due sinusoidi', body: 'Per due sinusoidi di uguale ampiezza e fase iniziale nulla, la somma può essere trasformata con la formula di prostaferesi. Il risultato contiene un fattore rapido e un fattore lento.', formula: 'sin α + sin β = 2 sin((α+β)/2) cos((α−β)/2)', note: 'La derivazione della lezione assume due componenti sinusoidali di uguale ampiezza.', labs: ['beats'] },
        { title: 'Frequenza media e inviluppo', body: 'Il fattore rapido oscilla alla frequenza media delle due componenti. Il fattore lento determina l’inviluppo e quindi la variazione periodica dell’ampiezza risultante.', formula: 'fₘ = (f₁ + f₂)/2', note: 'Non confondere la frequenza media delle componenti con la frequenza di battimento.', labs: ['beats'] },
        { title: 'Frequenza e periodo dei battimenti', body: 'La frequenza di battimento conta quante pulsazioni dell’ampiezza avvengono in un secondo. Il periodo del battimento è l’intervallo tra due massimi consecutivi dell’inviluppo.', formula: 'fᵦ = |f₁ − f₂|     ·     Tᵦ = 1/fᵦ', note: 'Se le frequenze coincidono, fᵦ = 0 e la pulsazione lenta scompare.', labs: ['beats'] },
        { title: 'Ampiezze e limiti', body: 'Con ampiezze differenti, nei momenti di rinforzo i contributi si sommano; nei momenti di compensazione resta un residuo. La profondità della pulsazione dipende anche dal rapporto tra le ampiezze.', formula: 'Amax = A₁ + A₂     ·     Amin = |A₁ − A₂|', note: 'I battimenti non sono un nuovo tono aggiunto: sono una variazione periodica dell’ampiezza risultante.', labs: ['phase'] },
        { title: 'Accordatura e due microfoni', body: 'I battimenti aiutano a confrontare due frequenze vicine: mentre si accorda uno strumento, le pulsazioni rallentano fino a scomparire quando le frequenze coincidono. Con due microfoni, invece, una copia ritardata dello stesso segnale può rinforzare alcune frequenze e attenuarne altre: è il collegamento con l’effetto pettine.', note: 'Battimenti tra frequenze vicine ed effetto pettine da ritardo sono fenomeni collegati alla sovrapposizione, ma non sono la stessa cosa.', labs: ['beats', 'microphones'] }
      ]
    }
  };

  // Approfondimenti: spiegazioni estese ed esempi per lo studio autonomo.
  const reviewEnrichment = {
  "Sorgente, propagazione, ricezione": {
    "detail": "La sorgente è il corpo che vibra: una corda, una membrana o le corde vocali. La vibrazione mette in moto il mezzo vicino e genera una perturbazione. Le regioni del mezzo interagiscono e trasmettono la perturbazione alle regioni successive. Quando l’onda raggiunge l’orecchio, il timpano entra in vibrazione e il sistema uditivo elabora il segnale. La sorgente, il mezzo e il ricevitore sono quindi tre parti differenti della catena.",
    "example": "Una corda pizzicata è la sorgente; l’aria è il mezzo di propagazione; l’orecchio o il diaframma di un microfono sono ricevitori."
  },
  "Onda meccanica e aria": {
    "detail": "Un’onda meccanica ha bisogno di un mezzo materiale perché la perturbazione possa trasmettersi. Nell’aria il suono è associato a variazioni locali di pressione: in una compressione le particelle sono momentaneamente più ravvicinate e la pressione è maggiore; in una rarefazione sono più distanti e la pressione è minore. Il suono può propagarsi anche nei liquidi e nei solidi, ma non nel vuoto, dove manca il mezzo.",
    "example": "Quando un altoparlante spinge il diaframma in avanti, comprime l’aria vicina; quando si ritrae, produce una rarefazione. La perturbazione si allontana dalla sorgente."
  },
  "Grafico nel tempo": {
    "detail": "Un grafico temporale mostra come cambia una grandezza in un punto di osservazione. Sull’asse orizzontale si riporta il tempo; su quello verticale, ad esempio, la variazione di pressione rispetto al valore di equilibrio, indicata spesso con p′(t). La linea centrale rappresenta la condizione di equilibrio. I valori sopra e sotto la linea indicano variazioni positive e negative, non una pressione assoluta negativa.",
    "example": "Con un microfono fermo si registra p′(t): il grafico descrive ciò che arriva in quel punto al variare del tempo, non la forma dell’onda in tutto lo spazio."
  },
  "Frequenza, ampiezza e timbro": {
    "detail": "La frequenza f è il numero di cicli completi nell’unità di tempo e si misura in hertz: 1 Hz equivale a un ciclo al secondo. L’ampiezza descrive la massima variazione rispetto all’equilibrio. Il timbro non si riduce a una sola grandezza: dipende dalla distribuzione delle componenti in frequenza e da come il suono evolve nel tempo, per esempio attacco e decadimento. Le grandezze fisiche sono collegate alle percezioni, ma non sono sinonimi.",
    "example": "Un flauto e un pianoforte possono produrre la stessa nota fondamentale, ma avere componenti spettrali e inviluppi temporali differenti: per questo il timbro è riconoscibile."
  },
  "Il microfono come trasduttore": {
    "detail": "Il microfono converte un fenomeno acustico in un segnale elettrico. Le variazioni di pressione mettono in movimento il diaframma; il trasduttore converte quel movimento in una variazione elettrica che può essere amplificata, elaborata, visualizzata e registrata. La forma del segnale elettrico dipende dal suono ricevuto e dalle caratteristiche del microfono e della catena collegata.",
    "example": "La catena descritta nella lezione è: onda sonora → movimento del diaframma → segnale elettrico → sistema di registrazione."
  },
  "Ciclo e periodo": {
    "detail": "Un ciclo è una ripetizione completa del fenomeno. Per riconoscerlo si confrontano due istanti in cui l’oscillazione si trova nella stessa condizione e procede nello stesso verso. In una sinusoide possiamo scegliere due attraversamenti crescenti dell’equilibrio; anche due massimi positivi consecutivi delimitano un ciclo. Il periodo T è il tempo che separa questi due punti omologhi.",
    "example": "Se due attraversamenti crescenti avvengono a 0,010 s e 0,020 s, il periodo è T = 0,010 s."
  },
  "Frequenza e periodo": {
    "detail": "Il periodo misura la durata di un ciclo; la frequenza conta quanti cicli si completano in un secondo. Sono grandezze reciproche: f = 1/T e T = 1/f. Se un ciclo dura poco, in un secondo possono completarsi molti cicli; perciò la frequenza è elevata. Prima di calcolare, il periodo deve essere espresso in secondi.",
    "example": "A 200 Hz il periodo vale T = 1/200 s = 0,005 s = 5 ms."
  },
  "Tempo e spazio": {
    "detail": "La pressione sonora dipende in generale dalla posizione e dal tempo, p(x,t). Se si fissa la posizione x e si osserva come cambia il segnale nel tempo, si ottiene una descrizione temporale da cui si ricavano periodo e frequenza. Se invece si fissa un istante e si confrontano posizioni differenti, si osserva la distribuzione spaziale e si può misurare la lunghezza d’onda. I due grafici sono sezioni diverse dello stesso fenomeno.",
    "example": "Un microfono fermo registra p(x₀,t). Una fotografia ideale del campo sonoro a un istante t₀ descriverebbe invece p(x,t₀) lungo lo spazio."
  },
  "Lunghezza d’onda e velocità": {
    "detail": "La lunghezza d’onda λ è la distanza tra due punti consecutivi che si trovano nella stessa fase, per esempio due compressioni successive. Durante un periodo T la perturbazione avanza di una lunghezza d’onda. La velocità è quindi v = λ/T. Poiché f = 1/T, sostituendo si ottiene v = fλ. La velocità dipende dal mezzo e dalle sue condizioni; non è la velocità con cui le particelle d’aria oscillano.",
    "example": "Con v = 344 m/s e f = 200 Hz, λ = v/f = 344/200 = 1,72 m."
  },
  "Esempi nell’aria e diffrazione": {
    "detail": "Per l’aria a circa 20 °C, la lezione assume v ≈ 344 m/s. A parità di mezzo, una frequenza minore corrisponde a una lunghezza d’onda maggiore. La diffrazione descrive la deviazione e la redistribuzione dell’onda quando incontra un ostacolo o attraversa un’apertura. È più evidente quando la lunghezza d’onda è confrontabile con le dimensioni dell’ostacolo o dell’apertura.",
    "example": "A 440 Hz, λ ≈ 344/440 ≈ 0,782 m. A 100 Hz, λ ≈ 3,44 m: la lunghezza d’onda è maggiore."
  },
  "Onde semplici, complesse e armoniche": {
    "detail": "Una sinusoide è una componente semplice. Un suono periodico complesso può essere descritto come somma di più componenti sinusoidali. Se le frequenze sono multipli interi di una frequenza fondamentale f₀, si parla di armoniche: f₀, 2f₀, 3f₀, 4f₀ e così via. Il termine parziale è più generale: indica una componente anche quando la sua frequenza non è un multiplo intero della fondamentale. Ampiezza e fase delle componenti contribuiscono alla forma d’onda risultante.",
    "example": "Con f₀ = 100 Hz, le prime quattro armoniche si trovano a 100, 200, 300 e 400 Hz."
  },
  "Il monocordo": {
    "detail": "Il monocordo permette di osservare il legame tra lunghezza della parte vibrante di una corda e altezza del suono. Nel modello ideale, mantenendo costanti tensione e caratteristiche della corda, accorciare la parte vibrante aumenta la frequenza. Dimezzando la lunghezza vibrante si raddoppia la frequenza e si ottiene l’intervallo di ottava. La lunghezza della corda non va confusa con la lunghezza d’onda del suono nell’aria.",
    "example": "Se una corda produce 220 Hz, dimezzando la sua lunghezza vibrante si ottengono idealmente 440 Hz."
  },
  "Primo collegamento con fase e sovrapposizione": {
    "detail": "La fase descrive la posizione dell’oscillazione all’interno del ciclo rispetto a un riferimento. Il principio di sovrapposizione afferma che, nel modello lineare, nello stesso punto e nello stesso istante le variazioni di pressione si sommano algebricamente. Se due sinusoidi hanno stessa frequenza, il risultato dipende dalla differenza di fase: i contributi possono rinforzarsi o compensarsi.",
    "example": "Due sinusoidi uguali in opposizione di fase si compensano idealmente nel punto di sovrapposizione; con ampiezze diverse resta una variazione residua."
  },
  "Che cosa descrive la fase?": {
    "detail": "La fase è una grandezza angolare che identifica la posizione dell’oscillazione nel ciclo. Un giro completo corrisponde a 360° o 2π radianti. La scelta del punto iniziale è convenzionale: ciò che conta è confrontare la posizione rispetto allo stesso riferimento. A 0° e 360° l’oscillazione è nella stessa posizione ciclica; a 180° è nella posizione opposta.",
    "example": "90° corrisponde a un quarto di ciclo; 180° a mezzo ciclo; 270° a tre quarti di ciclo."
  },
  "La funzione sinusoidale": {
    "detail": "Nella funzione p′(t) = A sin(ωt + φ₀), p′(t) è la variazione di pressione rispetto all’equilibrio; A è l’ampiezza; ω è la pulsazione; t è il tempo; φ₀ è la fase iniziale nell’origine temporale scelta. Il termine tra parentesi è l’argomento della funzione seno e rappresenta la fase istantanea. La fase iniziale non deve coincidere con l’inizio fisico del suono.",
    "example": "Se φ₀ = π/2, al tempo t = 0 si ha p′(0) = A sin(π/2) = A: la sinusoide parte dal massimo positivo."
  },
  "Pulsazione e fase istantanea": {
    "detail": "La pulsazione ω esprime quanto rapidamente avanza la fase angolare. Si misura in radianti al secondo ed è collegata alla frequenza da ω = 2πf. La fase istantanea è φ(t) = ωt + φ₀. Dopo un periodo T, la fase aumenta di 2π radianti; dopo mezzo periodo aumenta di π radianti.",
    "example": "A 100 Hz, ω = 2π · 100 = 200π rad/s. Dopo 2,5 ms, cioè un quarto del periodo di 10 ms, la fase è avanzata di π/2 radianti."
  },
  "Ritardo e differenza di fase": {
    "detail": "Per due sinusoidi della stessa frequenza, un ritardo temporale τ equivale a una frazione del periodo. Il modulo della differenza di fase è |Δφ| = 2πfτ = ωτ. Il segno dipende dalla convenzione scelta per distinguere anticipo e ritardo. Lo stesso ritardo non produce sempre lo stesso sfasamento: a frequenza maggiore corrisponde un periodo più breve e quindi una frazione di ciclo più grande.",
    "example": "A 500 Hz il periodo è 2 ms. Un ritardo di 1 ms è metà periodo e corrisponde a 180°."
  },
  "Fase nello spazio e microfoni": {
    "detail": "Quando un’onda percorre distanze differenti, i segnali possono raggiungere due microfoni in istanti diversi. Il ritardo relativo dipende dalla differenza tra le distanze dalla sorgente, divisa per la velocità di propagazione. Per una componente di frequenza f, il ritardo produce una differenza di fase. In un suono complesso, le componenti hanno frequenze diverse e quindi accumulano sfasamenti diversi.",
    "example": "Se la differenza di percorso è λ/2, il modulo della differenza di fase è 180° per quella frequenza. Per un’altra frequenza, la stessa differenza di percorso corrisponde a un altro sfasamento."
  },
  "Sovrapposizione e interferenza": {
    "detail": "La somma è locale: si sommano le variazioni di pressione nello stesso punto e nello stesso istante, non i soli valori massimi. Per due sinusoidi della stessa frequenza la somma è ancora sinusoidale. La cancellazione completa richiede stessa frequenza, stessa ampiezza e opposizione di fase nel punto considerato. Una somma nulla in un punto non significa che l’energia sia scomparsa da tutto lo spazio.",
    "example": "Se p′₁ = +0,30 Pa e p′₂ = −0,10 Pa, la somma istantanea è +0,20 Pa."
  },
  "Stessa frequenza o frequenze diverse": {
    "detail": "La fase di una sinusoide avanza con velocità angolare ω = 2πf. Se due frequenze coincidono, le fasi avanzano allo stesso ritmo e la loro differenza può rimanere costante. Se le frequenze sono differenti, la differenza di fase varia linearmente nel tempo: le onde passano da configurazioni di rinforzo a configurazioni di compensazione.",
    "example": "Con 440 Hz e 442 Hz la seconda fase avanza un po’ più rapidamente della prima; la differenza cresce e la somma pulsa."
  },
  "Somma di due sinusoidi": {
    "detail": "La formula di prostaferesi trasforma la somma di due seni in un prodotto. Applicata a due sinusoidi di uguale ampiezza, separa un fattore che oscilla rapidamente, legato alla frequenza media, e un fattore lento, legato alla differenza di frequenza. La derivazione della lezione assume fasi iniziali nulle; con fasi iniziali diverse cambia la fase dei fattori, ma resta il principio di una modulazione lenta quando le frequenze sono vicine.",
    "example": "sin(2π·440t) + sin(2π·442t) = 2 sin(2π·441t) cos(2π·1t)."
  },
  "Frequenza media e inviluppo": {
    "detail": "La frequenza media fₘ = (f₁ + f₂)/2 descrive il ritmo dell’oscillazione rapida nella somma. Il fattore lento determina l’inviluppo, cioè il contorno dell’ampiezza risultante. Nel caso di due sinusoidi con uguale ampiezza e fase iniziale nulla, l’ampiezza massima teorica è 2A e l’inviluppo in valore assoluto è 2A|cos(π(f₁ − f₂)t)|.",
    "example": "Per 440 Hz e 442 Hz, la frequenza media è 441 Hz, mentre le pulsazioni avvengono a 2 Hz."
  },
  "Frequenza e periodo dei battimenti": {
    "detail": "La frequenza di battimento è il numero di massimi dell’inviluppo che si ripetono in un secondo. Nel caso trattato in lezione vale fᵦ = |f₁ − f₂|. Il periodo del battimento è l’intervallo tra due massimi consecutivi: Tᵦ = 1/fᵦ. Quando le frequenze coincidono, la differenza è zero e non si osservano più pulsazioni lente.",
    "example": "Con f₁ = 256 Hz e f₂ = 260 Hz, fᵦ = 4 Hz e Tᵦ = 0,25 s."
  },
  "Ampiezze e limiti": {
    "detail": "I casi ideali di massima pulsazione presuppongono ampiezze uguali. Se le ampiezze sono diverse, nei momenti di rinforzo il massimo è A₁ + A₂; nei momenti di opposizione resta un valore pari al modulo della differenza |A₁ − A₂|. Perciò la pulsazione può essere meno profonda. La differenza di frequenza determina la rapidità del battimento, mentre il rapporto tra le ampiezze influenza quanto è marcata la variazione.",
    "example": "Con A₁ = 1 Pa e A₂ = 0,6 Pa, il massimo è 1,6 Pa e il minimo ideale è 0,4 Pa."
  },
  "Accordatura e due microfoni": {
    "detail": "Nell’accordatura si confrontano due componenti che dovrebbero avere la stessa frequenza, per esempio due note all’unisono o componenti armoniche corrispondenti. Se sono leggermente differenti si percepiscono pulsazioni; regolando lo strumento, la differenza diminuisce e i battimenti rallentano fino a scomparire. Nel caso dei microfoni il problema può essere diverso: due percorsi con un ritardo costante producono fasi relative diverse alle diverse frequenze, generando rinforzi e attenuazioni selettivi, collegati all’effetto pettine.",
    "example": "Un tono diretto sommato alla sua copia ritardata può rinforzare una frequenza e attenuarne un’altra: non è lo stesso fenomeno dei battimenti tra due frequenze vicine."
  }
};
  Object.values(reviewLessons).forEach(lesson => lesson.cards.forEach(card => {
    if (reviewEnrichment[card.title]) Object.assign(card, reviewEnrichment[card.title]);
  }));

  function renderReviewTheory(topic = 'all') {
    const container = $('#review-theory-content');
    $$('.review-tab').forEach(button => {
      const active = button.dataset.reviewTopic === topic;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', String(active));
    });
    const ids = topic === 'all' ? [1, 2, 3, 4] : [Number(topic)];
    container.innerHTML = ids.map(id => {
      const lesson = reviewLessons[id];
      const cards = lesson.cards.map((card, index) => `
        <article class="review-topic-card">
          <div class="review-topic-card-head"><span>${String(index + 1).padStart(2, '0')}</span><h3>${escapeHtml(card.title)}</h3></div>
          <p>${escapeHtml(card.body)}</p>
          ${card.formula ? `<div class="review-formula">${escapeHtml(card.formula)}</div>` : ''}
          ${card.detail ? `<div class="review-detail"><h4>Spiegazione</h4><p>${escapeHtml(card.detail)}</p></div>` : ''}
          ${card.example ? `<div class="review-example"><b>Esempio</b><p>${escapeHtml(card.example)}</p></div>` : ''}
          <div class="review-note"><b>Da ricordare</b><span>${escapeHtml(card.note)}</span></div>
          ${card.labs?.length ? `<div class="review-card-actions">${card.labs.map(lab => `<button class="review-lab-link" data-review-lab="${lab}">Apri ${lab === 'phase' ? 'Phase Explorer' : lab === 'beats' ? 'Beat Lab' : 'Microphone Lab'} →</button>`).join('')}</div>` : ''}
        </article>`).join('');
      return `<section class="review-lesson-group"><div class="review-group-heading"><div><span class="eyebrow">MODULO 0${id}</span><h3>${escapeHtml(lesson.title)}</h3><p>${escapeHtml(lesson.intro)}</p></div><button class="text-button" data-review-quiz="${id}">Test su questa lezione →</button></div><div class="review-topic-grid">${cards}</div></section>`;
    }).join('');
    $$('[data-review-quiz]').forEach(button => button.addEventListener('click', () => {
      $('#review-filter').value = button.dataset.reviewQuiz;
      startQuiz();
      $('#question-text').scrollIntoView({ behavior: 'smooth', block: 'center' });
    }));
    $$('[data-review-lab]').forEach(button => button.addEventListener('click', () => {
      openLab(button.dataset.reviewLab);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }));
  }
  $$('.review-tab').forEach(button => button.addEventListener('click', () => renderReviewTheory(button.dataset.reviewTopic)));
  renderReviewTheory('all');

  // Review question bank ----------------------------------------------------
  const questionBank = [
    { lesson: 'LEZIONE 01 · FONDAMENTI', level: 'BASE', q: 'Quale affermazione descrive correttamente il suono nell’aria?', a: ['È una perturbazione meccanica che si propaga attraverso il mezzo.', 'È una sostanza che viaggia dalla sorgente all’orecchio.', 'È una radiazione elettromagnetica che non necessita di un mezzo.'], correct: 0, why: 'Il suono nell’aria è una perturbazione meccanica: si propaga attraverso variazioni di pressione del mezzo. Le particelle oscillano localmente; non viaggiano insieme all’onda dalla sorgente all’ascoltatore.' },
    { lesson: 'LEZIONE 01 · FONDAMENTI', level: 'BASE', q: 'Che cosa indica la frequenza di un’oscillazione periodica?', a: ['La massima variazione rispetto all’equilibrio.', 'Il numero di cicli completi che avvengono in un secondo.', 'La distanza tra due compressioni consecutive.'], correct: 1, why: 'La frequenza f conta i cicli completi nell’unità di tempo e si misura in hertz (Hz). L’ampiezza descrive invece la massima variazione e la lunghezza d’onda una distanza nello spazio.' },
    { lesson: 'LEZIONE 01 · FONDAMENTI', level: 'BASE', q: 'Quale affermazione sull’ampiezza è più precisa?', a: ['È identica alla sensazione soggettiva di volume in ogni situazione.', 'Indica quanti cicli avvengono ogni secondo.', 'È la massima variazione della grandezza oscillante rispetto al valore di equilibrio.'], correct: 2, why: 'L’ampiezza è una grandezza fisica. È collegata alla percezione dell’intensità, ma la sensazione di volume dipende anche dall’udito e dalle condizioni di ascolto.' },
    { lesson: 'LEZIONE 02 · L’ONDA', level: 'BASE', q: 'Un’oscillazione ha frequenza 250 Hz. Quanto vale il periodo?', a: ['0,004 s', '0,25 s', '250 s'], correct: 0, why: 'Si usa T = 1/f. Quindi T = 1/250 s = 0,004 s, cioè 4 millisecondi.' },
    { lesson: 'LEZIONE 02 · L’ONDA', level: 'INTERMEDIO', q: 'Se la frequenza raddoppia e la velocità di propagazione nel mezzo resta costante, che cosa accade alla lunghezza d’onda?', a: ['Raddoppia.', 'Si dimezza.', 'Rimane invariata.'], correct: 1, why: 'Dalla relazione v = fλ ricaviamo λ = v/f. Se v resta costante e f raddoppia, λ deve dimezzarsi.' },
    { lesson: 'LEZIONE 02 · L’ONDA', level: 'BASE', q: 'Quale grandezza si misura in radianti al secondo?', a: ['La lunghezza d’onda.', 'Il periodo.', 'La pulsazione ω.'], correct: 2, why: 'La pulsazione ω = 2πf descrive la rapidità con cui avanza l’angolo di fase e si misura in rad/s.' },
    { lesson: 'LEZIONE 03 · FASE', level: 'BASE', q: 'Due sinusoidi hanno la stessa frequenza e la stessa ampiezza. Possiamo concludere che sono in fase?', a: ['Sì, sempre.', 'No: possono avere fasi iniziali differenti.', 'Sì, ma solo se hanno anche la stessa lunghezza d’onda.'], correct: 1, why: 'Frequenza e ampiezza non determinano da sole la fase relativa. Due oscillazioni possono avere lo stesso periodo e ampiezza ma trovarsi in posizioni diverse del ciclo.' },
    { lesson: 'LEZIONE 03 · FASE', level: 'INTERMEDIO', q: 'Per p′(t) = A sin(ωt + π/2), in quale condizione si trova l’oscillazione a t = 0?', a: ['Al massimo positivo.', 'All’equilibrio, in salita.', 'Al minimo negativo.'], correct: 0, why: 'Ponendo t = 0 si ottiene p′(0) = A sin(π/2) = A: il valore massimo positivo.' },
    { lesson: 'LEZIONE 03 · FASE', level: 'INTERMEDIO', q: 'Un segnale di 500 Hz viene ritardato di 1 ms. Qual è il modulo dello sfasamento?', a: ['90°', '180°', '360°'], correct: 1, why: 'Il periodo è T = 1/500 = 2 ms. Il ritardo è metà periodo, quindi corrisponde a 180° (π radianti).' },
    { lesson: 'LEZIONE 03 · SOVRAPPOSIZIONE', level: 'BASE', q: 'Che cosa afferma il principio di sovrapposizione nel modello lineare?', a: ['Si sommano le frequenze delle onde.', 'Si sommano solo i valori massimi.', 'Le variazioni di pressione si sommano algebricamente nello stesso punto e istante.'], correct: 2, why: 'Si sommano i contributi istantanei: p′ris(t) = p′1(t) + p′2(t). Non si sommano soltanto i massimi.' },
    { lesson: 'LEZIONE 03 · INTERFERENZA', level: 'INTERMEDIO', q: 'Quando si ha cancellazione completa ideale di due sinusoidi?', a: ['Quando hanno stessa frequenza e ampiezza e sono in opposizione di fase.', 'Quando hanno frequenze diverse di poco.', 'Quando sono entrambe positive.'], correct: 0, why: 'Servono stessa frequenza, stessa ampiezza, differenza di fase di 180° e sovrapposizione nello stesso punto. La cancellazione descrive il risultato locale della somma.' },
    { lesson: 'LEZIONE 04 · BATTIMENTI', level: 'BASE', q: 'Due sinusoidi hanno frequenze 440 Hz e 442 Hz. Qual è la frequenza di battimento?', a: ['882 Hz', '2 Hz', '441 Hz'], correct: 1, why: 'La frequenza di battimento è fᵦ = |f₁ − f₂| = |440 − 442| = 2 Hz.' },
    { lesson: 'LEZIONE 04 · BATTIMENTI', level: 'INTERMEDIO', q: 'Se due frequenze diventano sempre più vicine, che cosa succede ai battimenti?', a: ['La pulsazione diventa più lenta.', 'La pulsazione diventa più veloce.', 'La frequenza di battimento resta sempre uguale.'], correct: 0, why: 'La frequenza di battimento è la differenza assoluta tra le frequenze. Se la differenza diminuisce, i battimenti diventano più lenti; quando le frequenze coincidono, la pulsazione scompare.' },
    { lesson: 'LEZIONE 04 · BATTIMENTI', level: 'INTERMEDIO', q: 'Perché due frequenze differenti non mantengono una differenza di fase costante?', a: ['Perché l’ampiezza deve cambiare.', 'Perché la lunghezza d’onda è sempre uguale.', 'Perché la fase avanza a velocità angolari differenti.'], correct: 2, why: 'La pulsazione è ω = 2πf. Frequenze diverse significano pulsazioni diverse: la differenza tra le fasi varia nel tempo, facendo alternare rinforzi e compensazioni.' },
    { lesson: 'LABORATORIO MICROFONI', level: 'INTERMEDIO', q: 'Due microfoni ricevono la stessa sinusoide. MIC 2 si trova mezzo metro più lontano di MIC 1. Che cosa determina il ritardo tra i segnali?', a: ['La differenza di percorso divisa per la velocità del suono.', 'La frequenza moltiplicata per l’ampiezza.', 'La sola distanza tra i microfoni, indipendentemente dalla sorgente.'], correct: 0, why: 'Il tempo di propagazione è r/c. La differenza dei tempi di arrivo è Δt = (r₂ − r₁)/c: conta la differenza tra le distanze percorse dalla sorgente ai due microfoni.' },
    { lesson: 'LABORATORIO MICROFONI', level: 'INTERMEDIO', q: 'A 1000 Hz, con c = 344 m/s, una differenza di percorso di 0,172 m corrisponde a quale differenza di fase in modulo?', a: ['90°', '180°', '360°'], correct: 1, why: 'La lunghezza d’onda è λ = c/f = 0,344 m. La differenza di percorso è λ/2, quindi la differenza di fase è 180°.' },
    { lesson: 'LEZIONE 01 · FONDAMENTI', level: 'BASE', q: 'Che cosa si propaga dalla sorgente all’ascoltatore?', a: ['Le stesse particelle d’aria, che viaggiano dalla sorgente all’orecchio.', 'La perturbazione attraverso il mezzo, con trasferimento di energia.', 'Soltanto il movimento del diaframma della sorgente.'], correct: 1, why: 'Le particelle oscillano localmente attorno alla posizione media. Ciò che avanza nel mezzo è la perturbazione sonora, insieme al trasferimento di energia.' },
    { lesson: 'LEZIONE 01 · FONDAMENTI', level: 'BASE', q: 'In una compressione dell’onda sonora nell’aria, che cosa accade?', a: ['Le particelle sono più ravvicinate e la pressione locale è maggiore.', 'Le particelle sono più distanti e la pressione locale è minore.', 'La pressione è sempre uguale a quella atmosferica.'], correct: 0, why: 'La compressione è una regione in cui le particelle d’aria sono momentaneamente più ravvicinate rispetto all’equilibrio: la pressione locale è maggiore.' },
    { lesson: 'LEZIONE 01 · FONDAMENTI', level: 'INTERMEDIO', q: 'In un grafico temporale della pressione, che cosa rappresentano gli assi?', a: ['Tempo in verticale e distanza in orizzontale.', 'Frequenza in orizzontale e volume in verticale.', 'Tempo in orizzontale e variazione di pressione in verticale.'], correct: 2, why: 'Il grafico temporale mostra come varia la pressione nel tempo in un punto di osservazione. Non rappresenta direttamente la forma dell’onda nello spazio.' },
    { lesson: 'LEZIONE 01 · FONDAMENTI', level: 'INTERMEDIO', q: 'Due strumenti suonano la stessa nota alla stessa ampiezza percepita. Perché possono essere riconosciuti come strumenti diversi?', a: ['Perché hanno necessariamente frequenze fondamentali diverse.', 'Perché il timbro dipende anche dalla distribuzione delle componenti e dall’evoluzione temporale.', 'Perché il periodo cambia continuamente in ogni strumento.'], correct: 1, why: 'Il timbro dipende, tra le altre cose, dalla distribuzione delle componenti in frequenza, dall’attacco, dalla durata, dal decadimento e dalle caratteristiche della sorgente.' },
    { lesson: 'LEZIONE 01 · FONDAMENTI', level: 'BASE', q: 'Qual è il compito del microfono descritto nella prima lezione?', a: ['Trasformare le variazioni acustiche in un segnale elettrico.', 'Trasformare direttamente il suono in una sensazione uditiva.', 'Misurare soltanto la frequenza, senza convertire il movimento.'], correct: 0, why: 'L’onda sonora mette in movimento il diaframma; il trasduttore converte quel movimento in un segnale elettrico che può essere elaborato e registrato.' },
    { lesson: 'LEZIONE 02 · L’ONDA', level: 'BASE', q: 'Due massimi consecutivi di una sinusoide delimitano:', a: ['Mezzo ciclo.', 'Un ciclo completo.', 'Due cicli completi.'], correct: 1, why: 'Tra due massimi positivi consecutivi la sinusoide torna nella stessa condizione: è trascorso un ciclo completo. Il punto iniziale del ciclo è convenzionale.' },
    { lesson: 'LEZIONE 02 · L’ONDA', level: 'INTERMEDIO', q: 'In una misura temporale con un microfono fermo, quale grandezza ricavi direttamente?', a: ['La lunghezza d’onda, senza altre informazioni.', 'La distanza tra due compressioni nello spazio.', 'Il periodo e la frequenza del segnale nel punto di osservazione.'], correct: 2, why: 'Con il microfono fermo fissiamo la posizione x e osserviamo p(x₀,t): la misura nel tempo permette di ricavare periodo e frequenza.' },
    { lesson: 'LEZIONE 02 · L’ONDA', level: 'BASE', q: 'Qual è la definizione di lunghezza d’onda?', a: ['La distanza tra due punti consecutivi che si trovano nella stessa fase.', 'Il tempo necessario per un ciclo.', 'La distanza percorsa dall’onda in un secondo.'], correct: 0, why: 'La lunghezza d’onda λ è una distanza nello spazio, misurata in metri. Può essere misurata tra due massimi consecutivi o due compressioni consecutive.' },
    { lesson: 'LEZIONE 02 · L’ONDA', level: 'INTERMEDIO', q: 'Nell’aria a 20 °C, assumendo v = 344 m/s, quale lunghezza d’onda ha un tono di 100 Hz?', a: ['0,344 m', '3,44 m', '34,4 m'], correct: 1, why: 'Da v = fλ ricaviamo λ = v/f = 344/100 = 3,44 m.' },
    { lesson: 'LEZIONE 02 · L’ONDA', level: 'BASE', q: 'Perché in genere le basse frequenze diffrangono maggiormente attorno agli ostacoli?', a: ['Perché viaggiano sempre più lentamente.', 'Perché hanno ampiezza necessariamente maggiore.', 'Perché nello stesso mezzo hanno lunghezze d’onda maggiori rispetto alle alte frequenze.'], correct: 2, why: 'A parità di mezzo, una frequenza minore corrisponde a una lunghezza d’onda maggiore. La diffrazione tende a essere più evidente quando la lunghezza d’onda è grande rispetto all’ostacolo o all’apertura.' },
    { lesson: 'LEZIONE 02 · L’ONDA', level: 'INTERMEDIO', q: 'Che cosa rappresenta la velocità v = fλ?', a: ['La velocità con cui oscillano le singole particelle d’aria.', 'La velocità con cui la perturbazione si propaga nel mezzo.', 'La velocità con cui il microfono converte il segnale.'], correct: 1, why: 'In un periodo T l’onda avanza di una lunghezza d’onda λ. La velocità della perturbazione è quindi λ/T = fλ, distinta dal moto locale delle particelle.' },
    { lesson: 'LEZIONE 02 · L’ONDA', level: 'INTERMEDIO', q: 'Qual è la differenza tra armonica e parziale?', a: ['Sono sempre sinonimi.', 'L’armonica è un multiplo intero della fondamentale; parziale è un termine più generale.', 'La parziale è sempre la componente fondamentale.'], correct: 1, why: 'Le armoniche hanno frequenze pari a multipli interi di f₀. Il termine parziale indica una componente del suono anche quando la sua frequenza non è un multiplo intero della fondamentale.' },
    { lesson: 'LEZIONE 02 · L’ONDA', level: 'BASE', q: 'Nel modello ideale del monocordo, che cosa accade dimezzando la lunghezza vibrante a tensione invariata?', a: ['La frequenza si dimezza.', 'La frequenza raddoppia e l’altezza sale di un’ottava.', 'La lunghezza d’onda nell’aria si dimezza direttamente.'], correct: 1, why: 'A tensione e caratteristiche della corda invariate, dimezzare la parte vibrante raddoppia la frequenza nel modello ideale. La lunghezza della corda non è la lunghezza d’onda del suono nell’aria.' },
    { lesson: 'LEZIONE 03 · FASE', level: 'BASE', q: 'Che cosa rappresenta la fase iniziale φ₀ nella funzione p′(t) = A sin(ωt + φ₀)?', a: ['La fase nell’istante scelto come t = 0.', 'L’inizio fisico necessario del suono.', 'La frequenza espressa in radianti.'], correct: 0, why: 'φ₀ è la fase nell’origine temporale scelta. Cambiando il riferimento temporale cambia il valore attribuito alla fase iniziale, non il fenomeno fisico.' },
    { lesson: 'LEZIONE 03 · FASE', level: 'INTERMEDIO', q: 'Qual è il significato della pulsazione ω?', a: ['La massima variazione di pressione.', 'La velocità di propagazione del suono.', 'La rapidità con cui avanza l’angolo di fase, in rad/s.'], correct: 2, why: 'ω = 2πf. Ogni ciclo corrisponde a 2π radianti; la pulsazione descrive quanti radianti di fase vengono percorsi in un secondo.' },
    { lesson: 'LEZIONE 03 · FASE', level: 'INTERMEDIO', q: 'Un segnale a 250 Hz viene ritardato di 1 ms. Qual è il modulo dello sfasamento?', a: ['180°', '90°', '360°'], correct: 1, why: 'Il periodo è T = 1/250 = 4 ms. Un ritardo di 1 ms è un quarto di periodo: 360°/4 = 90°.' },
    { lesson: 'LEZIONE 03 · FASE', level: 'BASE', q: 'Le fasi 0 e 2π descrivono:', a: ['La stessa posizione nel ciclo.', 'Due cicli differenti e non collegati.', 'Due frequenze diverse.'], correct: 0, why: 'Dopo un giro completo il punto torna nella stessa posizione. Le fasi che differiscono di un multiplo intero di 2π sono equivalenti modulo 2π.' },
    { lesson: 'LEZIONE 03 · FASE', level: 'INTERMEDIO', q: 'Due sinusoidi uguali sono sfasate di 90°. Qual è l’ampiezza della risultante?', a: ['0', '2A', '√2 A'], correct: 2, why: 'In quadratura, per due sinusoidi di uguale ampiezza A, Aᵣᵢₛ = √(A² + A²) = √2 A: è un risultato intermedio.' },
    { lesson: 'LEZIONE 04 · BATTIMENTI', level: 'INTERMEDIO', q: 'Nella formula di prostaferesi applicata alla somma di due sinusoidi, quale ruolo ha il fattore lento?', a: ['Determina la frequenza media.', 'Descrive l’inviluppo e la variazione dell’ampiezza.', 'Elimina la componente rapida.'], correct: 1, why: 'La somma diventa il prodotto di un fattore sinusoidale rapido e di un coseno più lento. Quest’ultimo modula l’ampiezza e determina l’inviluppo.' },
    { lesson: 'LEZIONE 04 · BATTIMENTI', level: 'BASE', q: 'Due toni hanno frequenze 256 Hz e 260 Hz. Qual è la frequenza media?', a: ['4 Hz', '516 Hz', '258 Hz'], correct: 2, why: 'La frequenza media è fₘ = (f₁ + f₂)/2 = (256 + 260)/2 = 258 Hz.' },
    { lesson: 'LEZIONE 04 · BATTIMENTI', level: 'INTERMEDIO', q: 'Due toni generano 5 battimenti al secondo. Quanto vale il periodo tra due massimi consecutivi dell’inviluppo?', a: ['0,2 s', '5 s', '2,5 s'], correct: 0, why: 'Tᵦ = 1/fᵦ = 1/5 s = 0,2 s.' },
    { lesson: 'LEZIONE 04 · BATTIMENTI', level: 'BASE', q: 'I battimenti sono un nuovo tono aggiunto alle due componenti?', a: ['Sì, sempre.', 'No: sono una variazione periodica dell’ampiezza risultante.', 'Sì, con frequenza pari alla frequenza media.'], correct: 1, why: 'Nel modello presentato, i battimenti sono la pulsazione dell’ampiezza dovuta alla somma di due componenti vicine, non una terza sinusoide aggiunta.' },
    { lesson: 'LEZIONE 04 · BATTIMENTI', level: 'INTERMEDIO', q: 'Se le ampiezze delle due onde in opposizione di fase sono diverse, che cosa resta?', a: ['Sempre zero.', 'La somma delle due ampiezze.', 'Una variazione residua pari alla differenza assoluta delle ampiezze.'], correct: 2, why: 'In opposizione esatta, il contributo minore compensa quello maggiore solo in parte: il residuo è |A₁ − A₂|.' },
    { lesson: 'LEZIONE 04 · BATTIMENTI', level: 'INTERMEDIO', q: 'Perché due microfoni che ricevono lo stesso segnale possono produrre una colorazione del suono quando vengono sommati?', a: ['Perché ogni microfono modifica necessariamente la frequenza fondamentale.', 'Perché il diverso percorso introduce un ritardo e una fase dipendente dalla frequenza.', 'Perché i segnali elettrici non possono essere sommati.'], correct: 1, why: 'Il percorso più lungo introduce un ritardo. Per una copia ritardata, la differenza di fase dipende dalla frequenza: alcune componenti si rinforzano e altre si attenuano. È il collegamento con l’effetto pettine.' }
  ];
  function shuffle(items) {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
    return out;
  }
  function startQuiz() {
    const filter = $('#review-filter')?.value || 'all';
    const pool = filter === 'all' ? questionBank : questionBank.filter(item => item.lesson.startsWith(`LEZIONE 0${filter}`));
    const count = filter === 'all' ? Math.min(12, pool.length) : Math.min(10, pool.length);
    state.quiz = { questions: shuffle(pool).slice(0, count), index: 0, correct: 0, answered: 0, locked: false, finished: false, filter };
    renderQuestion();
  }
  function renderQuestion() {
    const quiz = state.quiz;
    if (quiz.index >= quiz.questions.length) { renderQuizEnd(); return; }
    quiz.locked = false; quiz.finished = false;
    const item = quiz.questions[quiz.index];
    if (!item) { renderQuizEnd(); return; }
    $('#quiz-title').textContent = quiz.filter === 'all' ? 'Ripasso completo' : `Ripasso · Lezione 0${quiz.filter}`;
    $('#quiz-counter').textContent = `${quiz.index + 1} / ${quiz.questions.length}`;
    $('#quiz-progress-fill').style.width = `${quiz.index / quiz.questions.length * 100}%`;
    $('#quiz-topic').textContent = item.lesson;
    $('#quiz-difficulty').textContent = item.level;
    $('#question-text').textContent = item.q;
    $('#answer-list').innerHTML = item.a.map((answer, i) => `<button class="answer-option" data-answer="${i}"><span class="answer-letter">${String.fromCharCode(65 + i)}</span><span>${escapeHtml(answer)}</span></button>`).join('');
    $('#quiz-feedback').hidden = true; $('#quiz-feedback').className = 'quiz-feedback';
    $('#next-question').disabled = true; $('#next-question').innerHTML = 'Prossima domanda <span>→</span>';
    $('#skip-question').disabled = false;
    $$('.answer-option').forEach(btn => btn.addEventListener('click', () => selectAnswer(Number(btn.dataset.answer))));
    $('#session-score').textContent = quiz.answered ? `${quiz.correct}/${quiz.answered}` : '—';
    $('#session-score-label').textContent = quiz.answered ? 'Risposte corrette nella sessione.' : 'Completa le domande per vedere il risultato.';
  }
  function selectAnswer(index) {
    const quiz = state.quiz, item = quiz.questions[quiz.index];
    if (quiz.locked) return;
    quiz.locked = true; quiz.answered++;
    const correct = index === item.correct;
    if (correct) quiz.correct++;
    state.progress.answered++; if (correct) state.progress.correct++;
    saveProgress();
    $$('.answer-option').forEach((btn, i) => {
      btn.disabled = true;
      if (i === item.correct) btn.classList.add('correct');
      else if (i === index) btn.classList.add('incorrect');
    });
    const feedback = $('#quiz-feedback');
    feedback.hidden = false; feedback.classList.add(correct ? 'good' : 'bad');
    feedback.innerHTML = `<div class="feedback-title">${correct ? '✓ Esatto.' : '✕ Non proprio.'}</div><div>${escapeHtml(item.why)}</div>`;
    $('#next-question').disabled = false;
    $('#next-question').textContent = quiz.index === quiz.questions.length - 1 ? 'Mostra il risultato →' : 'Prossima domanda →';
    $('#skip-question').disabled = true;
    $('#session-score').textContent = `${quiz.correct}/${quiz.answered}`;
    $('#session-score-label').textContent = 'Risposte corrette nella sessione.';
  }
  function renderQuizEnd() {
    const quiz = state.quiz;
    quiz.finished = true;
    const percent = quiz.answered ? Math.round(100 * quiz.correct / quiz.answered) : 0;
    $('#quiz-title').textContent = 'Sessione completata';
    $('#quiz-counter').textContent = `${quiz.questions.length} / ${quiz.questions.length}`;
    $('#quiz-progress-fill').style.width = '100%';
    $('#quiz-topic').textContent = 'RISULTATO DEL RIPASSO'; $('#quiz-difficulty').textContent = 'FINE SESSIONE';
    $('#question-text').textContent = percent >= 80 ? 'Ottimo lavoro. I concetti principali sono ben presenti.' : percent >= 55 ? 'Buon punto di partenza. Rivedi le spiegazioni delle risposte che ti hanno messo in difficoltà.' : 'Questa sessione ti mostra da dove ripartire. Torna sui concetti e riprova con calma.';
    $('#answer-list').innerHTML = `<div class="result-readout"><div><span>RISPOSTE CORRETTE</span><strong>${quiz.correct}/${quiz.answered}</strong></div><div><span>PERCENTUALE</span><strong>${percent}%</strong></div><div><span>DOMANDE</span><strong>${quiz.questions.length}</strong></div></div><div class="formula-note" style="margin-top:15px"><span>↻</span><p>Il risultato è uno strumento di orientamento, non un voto. Puoi ripetere la sessione per consolidare i concetti.</p></div>`;
    $('#quiz-feedback').hidden = true;
    $('#next-question').disabled = false; $('#next-question').textContent = 'Ripeti il ripasso ↻';
    $('#skip-question').disabled = true;
    $('#session-score').textContent = `${quiz.correct}/${quiz.answered}`;
    $('#session-score-label').textContent = `${percent}% di risposte corrette in questa sessione.`;
  }
  $('#next-question').addEventListener('click', () => { if (state.quiz.finished) { startQuiz(); return; } if (!state.quiz.locked) return; state.quiz.index++; renderQuestion(); });
  $('#skip-question').addEventListener('click', () => { if (state.quiz.locked) return; state.quiz.index++; renderQuestion(); });
  $('#restart-quiz').addEventListener('click', startQuiz);
  $('#review-start').addEventListener('click', startQuiz);

  // Navigation --------------------------------------------------------------
  $$('[data-view]').forEach(btn => btn.addEventListener('click', () => showView(btn.dataset.view)));
  $$('[data-view-link]').forEach(btn => btn.addEventListener('click', event => { event.preventDefault(); showView(btn.dataset.viewLink); }));
  $$('[data-open-lab]').forEach(btn => btn.addEventListener('click', () => openLab(btn.dataset.openLab)));
  $$('.lab-tab').forEach(btn => btn.addEventListener('click', () => openLab(btn.dataset.lab)));
  $$('[data-review-from-lab]').forEach(button => button.addEventListener('click', () => {
    showView('review');
    renderReviewTheory(button.dataset.reviewFromLab);
    $('#view-review').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }));
  $$('[data-lesson]').forEach(btn => btn.addEventListener('click', () => openLesson(Number(btn.dataset.lesson))));
  $$('[data-phase-preset]').forEach(btn => btn.addEventListener('click', () => { phaseInputs.shift.value = btn.dataset.phasePreset; updatePhaseUI(); }));
  $$('[data-beat-preset]').forEach(btn => btn.addEventListener('click', () => { const fb = Number(btn.dataset.beatPreset); const f1 = Number(beatInputs.f1.value); beatInputs.f2.value = Math.min(600, f1 + fb); if (Number(beatInputs.f2.value) === f1) beatInputs.f1.value = Math.max(200, f1 - fb); updateBeatUI(); }));
  Object.values(phaseInputs).forEach(input => input.addEventListener('input', updatePhaseUI));
  Object.values(beatInputs).forEach(input => input.addEventListener('input', updateBeatUI));
  $('#reset-progress').addEventListener('click', () => {
    const okay = window.confirm('Vuoi azzerare le risposte e i laboratori registrati su questo dispositivo?');
    if (!okay) return;
    state.progress = { answered: 0, correct: 0, labs: [], lastView: 'home' }; saveProgress(); showToast('Progressi locali azzerati.');
  });
  window.addEventListener('resize', () => { window.clearTimeout(window.__sonoraResize); window.__sonoraResize = window.setTimeout(drawActiveLab, 90); });
  window.addEventListener('beforeunload', stopAudio);

  // Initial state -----------------------------------------------------------
  updateStats(); updatePhaseUI(); updateBeatUI(); updateMicUI(); startQuiz();
})();
