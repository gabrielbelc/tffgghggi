(() => {
  'use strict';

  /* ---------- Constantes ---------- */
  const KEY = 'oneiros.dreams.v1';
  const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const CATEGORIES = {
    lucido: { label: 'Lúcido', color: '#00f0ff' },
    voo: { label: 'Voo', color: '#8b5cff' },
    pesadelo: { label: 'Pesadelo', color: '#ff3d7f' },
    recorrente: { label: 'Recorrente', color: '#ffb020' },
    premonicao: { label: 'Premonição', color: '#39ff88' },
    memoria: { label: 'Memória', color: '#8fa8ff' }
  };
  const EMOTIONS = ['Alegria', 'Medo', 'Paz', 'Confusão', 'Tristeza', 'Euforia'];
  const WEEKDAYS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
  const STOPWORDS = new Set(['para', 'como', 'mais', 'isso', 'esta', 'esse', 'essa', 'com', 'uma', 'que', 'foi', 'era', 'estava', 'muito', 'depois', 'quando', 'pelo', 'pela', 'dele', 'dela', 'entre', 'tinha', 'havia', 'sonho', 'sonhei', 'sobre', 'ainda', 'mas', 'não', 'nos', 'nas', 'uns', 'umas', 'você', 'eles', 'elas']);
  // [dias atrás, categoria, clareza, emoção, título, descrição]
  const DEMO = [
    [0, 'lucido', 9, 'Euforia', 'Cidade de cristal', 'Percebi que sonhava e voei sobre uma cidade feita de vidro e luz.'],
    [1, 'voo', 7, 'Paz', 'Montanhas flutuantes', 'Atravessei nuvens azuis sobre montanhas que flutuavam sem raízes.'],
    [2, 'pesadelo', 3, 'Medo', 'Corredor infinito', 'Um corredor sem fim e portas que se fechavam atrás de mim.'],
    [4, 'memoria', 6, 'Tristeza', 'Casa da infância', 'Visitei a casa onde cresci, mas as paredes eram de água.'],
    [5, 'recorrente', 5, 'Confusão', 'Prova esquecida', 'De novo a prova de matemática, e eu sem achar a sala.'],
    [7, 'premonicao', 8, 'Alegria', 'Encontro no parque', 'Vi um reencontro no parque com alguém que ainda não conheço.'],
    [9, 'voo', 8, 'Paz', 'Oceano de luz', 'Flutuei sobre um oceano de luz com música ao fundo.'],
    [12, 'lucido', 10, 'Euforia', 'Biblioteca do tempo', 'Controlei o cenário e abri livros que falavam comigo.'],
    [13, 'recorrente', 4, 'Medo', 'Corredor infinito', 'Mais uma vez o corredor sem fim, mas desta vez eu sabia onde estava.']
  ];

  /* ---------- Utilitários ---------- */
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => [...document.querySelectorAll(sel)];
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const pad = (n) => String(n).padStart(2, '0');
  const toKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return toKey(d); };
  const parseKey = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const fmtDate = (s) => parseKey(s).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const sortedDesc = (list) => [...list].reverse().sort((a, b) => b.date.localeCompare(a.date));
  const ranked = (obj) => Object.entries(obj).sort((a, b) => b[1] - a[1]);

  /* ---------- Estado e persistência ---------- */
  let dreams = load();
  let toastTimer;

  function load() {
    try {
      const data = JSON.parse(localStorage.getItem(KEY));
      return Array.isArray(data) ? data.filter((d) => d && CATEGORIES[d.category] && typeof d.date === 'string') : [];
    } catch {
      return [];
    }
  }

  function persist() {
    try {
      localStorage.setItem(KEY, JSON.stringify(dreams));
    } catch {
      toast('Não foi possível salvar neste navegador.', 'err');
    }
  }

  /* ---------- Feedback ---------- */
  function toast(msg, type = 'ok') {
    const el = $('#toast');
    el.textContent = msg;
    el.className = `toast show ${type}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
  }

  /* ---------- Navegação ---------- */
  function show(id) {
    $$('.tab').forEach((b) => b.classList.toggle('active', b.dataset.target === id));
    $$('.view').forEach((v) => v.classList.toggle('active', v.id === id));
    if (id === 'dashboard') renderDashboard();
    if (id === 'arquivo') renderList();
    if (id === 'analise') renderAnalysis();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ---------- Formulário ---------- */
  function setupForm() {
    const catOptions = Object.entries(CATEGORIES).map(([k, c]) => `<option value="${k}">${c.label}</option>`).join('');
    $('#f-category').innerHTML = catOptions;
    $('#filter-category').innerHTML = '<option value="all">Todas as categorias</option>' + catOptions;
    $('#f-emotion').innerHTML = EMOTIONS.map((e) => `<option>${e}</option>`).join('');
    $('#f-date').value = daysAgo(0);
    $('#f-date').max = daysAgo(0);
  }

  function handleSubmit(e) {
    e.preventDefault();
    const title = $('#f-title').value.trim();
    if (!title) {
      toast('Dê um título ao sonho.', 'err');
      return;
    }
    dreams.push({
      id: uid(),
      title,
      date: $('#f-date').value || daysAgo(0),
      category: $('#f-category').value,
      emotion: $('#f-emotion').value,
      clarity: Number($('#f-clarity').value),
      text: $('#f-text').value.trim()
    });
    persist();
    e.target.reset();
    $('#f-date').value = daysAgo(0);
    $('#clarity-out').textContent = $('#f-clarity').value;
    toast('Sonho registrado no arquivo.');
  }

  /* ---------- Arquivo ---------- */
  function card(d) {
    const c = CATEGORIES[d.category];
    return `<article class="dream glass" style="--c:${c.color}">
      <header><span class="tag">${c.label}</span><time>${fmtDate(d.date)}</time></header>
      <h3>${esc(d.title)}</h3>
      <p>${esc(d.text || 'Sem descrição.')}</p>
      <footer><span>${esc(d.emotion)} · Clareza ${d.clarity}/10</span>
        <button class="del" type="button" data-id="${esc(d.id)}" aria-label="Excluir sonho ${esc(d.title)}">Excluir</button>
      </footer>
    </article>`;
  }

  function renderList() {
    const q = $('#search').value.trim().toLowerCase();
    const cat = $('#filter-category').value;
    const items = sortedDesc(dreams).filter((d) =>
      (cat === 'all' || d.category === cat) &&
      (!q || `${d.title} ${d.text}`.toLowerCase().includes(q)));
    $('#list').innerHTML = items.map(card).join('');
    $('#empty').hidden = items.length > 0;
  }

  function deleteDream(e) {
    const btn = e.target.closest('.del');
    if (!btn || !confirm('Excluir este sonho?')) return;
    dreams = dreams.filter((d) => d.id !== btn.dataset.id);
    persist();
    renderList();
    toast('Sonho removido.');
  }

  /* ---------- Painel ---------- */
  function countUp(el, to, suffix = '') {
    if (REDUCE) {
      el.textContent = to + suffix;
      return;
    }
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min((now - start) / 800, 1);
      el.textContent = Math.round(to * (1 - (1 - p) ** 3)) + suffix;
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  function renderDashboard() {
    const s = analyze();
    countUp($('#stat-total'), s.total);
    countUp($('#stat-lucid'), s.total ? Math.round(((s.byCat.lucido || 0) / s.total) * 100) : 0, '%');
    $('#stat-clarity').textContent = s.total ? s.avg.toFixed(1) : '—';

    const counts = {};
    dreams.forEach((d) => { counts[d.date] = (counts[d.date] || 0) + 1; });
    $('#heatmap').innerHTML = Array.from({ length: 14 }, (_, i) => {
      const k = daysAgo(13 - i);
      const n = counts[k] || 0;
      return `<div class="cell l${Math.min(n, 3)}" title="${fmtDate(k)}: ${n} sonho(s)"></div>`;
    }).join('');
  }

  function loadDemo() {
    if (dreams.length && !confirm('Substituir seus sonhos atuais pela demonstração?')) return;
    dreams = DEMO.map(([ago, category, clarity, emotion, title, text]) => ({
      id: uid(), title, date: daysAgo(ago), category, emotion, clarity, text
    }));
    persist();
    renderDashboard();
    toast('Demonstração carregada.');
  }

  function clearAll() {
    if (!dreams.length || !confirm('Apagar todos os sonhos? Esta ação não pode ser desfeita.')) return;
    dreams = [];
    persist();
    renderDashboard();
    toast('Arquivo limpo.');
  }

  /* ---------- Análise de padrões ---------- */
  function analyze() {
    const s = { total: dreams.length, byCat: {}, byEmo: {}, byDay: Array(7).fill(0), words: {}, clarity: 0 };
    for (const d of dreams) {
      s.byCat[d.category] = (s.byCat[d.category] || 0) + 1;
      s.byEmo[d.emotion] = (s.byEmo[d.emotion] || 0) + 1;
      s.byDay[parseKey(d.date).getDay()]++;
      s.clarity += d.clarity;
      for (const w of `${d.title} ${d.text}`.toLowerCase().split(/[^\p{L}]+/u)) {
        if (w.length > 3 && !STOPWORDS.has(w)) s.words[w] = (s.words[w] || 0) + 1;
      }
    }
    s.avg = s.total ? s.clarity / s.total : 0;
    return s;
  }

  function renderAnalysis() {
    const s = analyze();
    const enough = s.total >= 3;
    $('#analysis-empty').hidden = enough;
    $('#analysis-body').hidden = !enough;
    if (!enough) return;

    const [catKey, catN] = ranked(s.byCat)[0];
    const [emo] = ranked(s.byEmo)[0];
    const dayIdx = s.byDay.indexOf(Math.max(...s.byDay));
    const day = WEEKDAYS[dayIdx];
    const pct = Math.round((catN / s.total) * 100);

    $('#m-cat').textContent = CATEGORIES[catKey].label;
    $('#m-day').textContent = day[0].toUpperCase() + day.slice(1);
    $('#m-emo').textContent = emo;
    $('#insight').textContent = `Seu território mais frequente é "${CATEGORIES[catKey].label}", com ${pct}% dos registros. Sonhos de ${day} aparecem com mais frequência, e a emoção dominante é ${emo.toLowerCase()}. Clareza média: ${s.avg.toFixed(1)}/10.`;

    $('#cat-bars').innerHTML = Object.entries(CATEGORIES).map(([k, c]) => {
      const n = s.byCat[k] || 0;
      return `<div class="bar"><span>${c.label}</span><div class="track"><i style="width:${(n / s.total) * 100}%;--c:${c.color}"></i></div><b>${n}</b></div>`;
    }).join('');

    const words = ranked(s.words).slice(0, 10);
    $('#words').innerHTML = words.length
      ? words.map(([w, n]) => `<span class="chip">${esc(w)}<b>${n}</b></span>`).join('')
      : '<span class="muted">Escreva descrições para revelar palavras recorrentes.</span>';
  }

  /* ---------- Campo de estrelas (canvas) ---------- */
  const canvas = $('#stars');
  const ctx = canvas.getContext('2d');
  // Posição definida em JS: o canvas nunca cobre a página, mesmo sem CSS
  Object.assign(canvas.style, { position: 'fixed', top: '0', left: '0', width: '100%', height: '100%', zIndex: '-1', pointerEvents: 'none' });
  let stars = [];
  let lastWidth = 0;

  function resizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    lastWidth = innerWidth;
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
    const count = Math.min(200, Math.round((innerWidth * innerHeight) / 9000));
    stars = Array.from({ length: count }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: (Math.random() * 1.3 + 0.3) * dpr,
      v: (Math.random() * 0.25 + 0.05) * dpr,
      f: Math.random() * 1.5 + 0.5,
      p: Math.random() * Math.PI * 2
    }));
    drawStars(0);
  }

  function drawStars(t) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#9ff7ff';
    for (const s of stars) {
      if (!REDUCE) {
        s.y += s.v;
        if (s.y > canvas.height) s.y = 0;
      }
      ctx.globalAlpha = 0.3 + 0.7 * Math.abs(Math.sin(t * s.f + s.p));
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function animate(ms) {
    drawStars(ms / 1000);
    requestAnimationFrame(animate);
  }

  /* ---------- Inicialização ---------- */
  setupForm();
  $$('.tab').forEach((b) => b.addEventListener('click', () => show(b.dataset.target)));
  $('#dream-form').addEventListener('submit', handleSubmit);
  $('#f-clarity').addEventListener('input', (e) => { $('#clarity-out').textContent = e.target.value; });
  $('#search').addEventListener('input', renderList);
  $('#filter-category').addEventListener('change', renderList);
  $('#list').addEventListener('click', deleteDream);
  $('#demo-btn').addEventListener('click', loadDemo);
  $('#clear-btn').addEventListener('click', clearAll);
  addEventListener('resize', () => { if (innerWidth !== lastWidth) resizeCanvas(); });
  resizeCanvas();
  if (!REDUCE) requestAnimationFrame(animate);
  renderDashboard();
})();