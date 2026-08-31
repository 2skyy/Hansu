const navToggle = document.querySelector('.nav-toggle');
const siteNav = document.querySelector('.site-nav');

navToggle?.addEventListener('click', () => {
  const isOpen = siteNav.classList.toggle('open');
  navToggle.setAttribute('aria-expanded', String(isOpen));
});

/* '맨 위로'는 브라우저 기본 앵커 이동에 맡기지 않고 직접 처리한다.
   sticky 헤더나 고정 요소가 대상 위에 겹치면 브라우저가 "이미 보인다"고 판단해
   스크롤을 건너뛰는 경우가 있기 때문이다. */
document.querySelectorAll('a[href="#top"]').forEach((link) => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
    if (history.replaceState) history.replaceState(null, '', location.pathname + location.search);
  });
});

document.querySelectorAll('.site-nav a').forEach((link) => {
  link.addEventListener('click', () => {
    siteNav.classList.remove('open');
    navToggle?.setAttribute('aria-expanded', 'false');
  });
});

/* =====================================================================
   누적 러닝 기록 섹션 (#record)
   데이터는 data.js 의 window.HANSU_DATA 하나만 바라봅니다.
   실데이터로 바꿀 때 이 파일은 수정할 필요가 없습니다.
   ===================================================================== */
(function () {
  const D = window.HANSU_DATA;
  const record = document.getElementById('record');
  if (!D || !record) return;

  const NS = 'http://www.w3.org/2000/svg';
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const nf = (n, d = 0) =>
    Number(n).toLocaleString('ko-KR', { minimumFractionDigits: d, maximumFractionDigits: d });
  const el = (tag, attrs) => {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  };

  /* 고정 시드 난수 — 새로고침할 때마다 산 모양이 바뀌지 않도록 */
  function rng(seed) {
    let s = seed >>> 0;
    return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  }

  /* ---------------------------------------------------------------
     1. 파생 수치
  --------------------------------------------------------------- */
  const segs = D.segments;
  const byId = Object.fromEntries(segs.map((s) => [s.id, s]));
  const totalKm = segs.reduce((a, s) => a + s.km, 0);
  const totalLaps = Math.round(segs.reduce((a, s) => a + s.km / s.lengthKm, 0));
  const rateOf = (s) => Math.min(1, s.km / s.goalKm);

  /* ---------------------------------------------------------------
     2. 지도 지형 — 회화식 산세를 시드 난수로 생성
  --------------------------------------------------------------- */
  const RIDGES = [
    // 북한산 일대 (가장 크고 밀집)
    { pts: [[290, 250], [340, 196], [412, 152], [488, 132], [552, 158], [598, 206]], n: 30, h: [24, 56], w: [15, 29] },
    { pts: [[330, 300], [400, 262], [470, 246], [536, 258], [586, 288]], n: 20, h: [16, 34], w: [12, 21] },
    { pts: [[604, 168], [668, 196], [724, 240], [772, 296]], n: 16, h: [16, 36], w: [12, 22] },
    { pts: [[252, 196], [214, 250], [184, 308], [160, 362]], n: 15, h: [14, 32], w: [11, 20] },
    // 탕춘대 능선
    { pts: [[300, 330], [312, 380], [330, 424], [352, 462]], n: 13, h: [14, 28], w: [10, 18] },
    // 백악–인왕–낙산–남산 (도성 주변)
    { pts: [[430, 404], [490, 386], [552, 396], [600, 420]], n: 14, h: [16, 34], w: [11, 20] },
    { pts: [[368, 430], [352, 470], [352, 510], [366, 546]], n: 12, h: [14, 28], w: [10, 18] },
    { pts: [[640, 452], [664, 490], [672, 528]], n: 9, h: [12, 24], w: [9, 16] },
    { pts: [[440, 600], [500, 614], [560, 604], [606, 582]], n: 13, h: [14, 30], w: [10, 19] },
    // 원경 (좌우 여백)
    { pts: [[60, 300], [90, 360], [110, 420], [120, 480]], n: 12, h: [12, 26], w: [9, 17] },
    { pts: [[820, 340], [852, 400], [872, 460], [880, 520]], n: 12, h: [12, 26], w: [9, 17] },
    { pts: [[120, 560], [200, 580], [280, 592]], n: 10, h: [10, 22], w: [8, 15] },
    { pts: [[720, 570], [800, 578], [872, 588]], n: 10, h: [10, 22], w: [8, 15] },
    { pts: [[180, 120], [260, 96], [340, 88]], n: 10, h: [11, 24], w: [8, 16] },
  ];

  function samplePolyline(pts, n) {
    const segList = [];
    let total = 0;
    for (let i = 1; i < pts.length; i++) {
      const L = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      segList.push({ a: pts[i - 1], b: pts[i], L, start: total });
      total += L;
    }
    const out = [];
    for (let k = 0; k < n; k++) {
      const d = (k / Math.max(1, n - 1)) * total;
      const s = segList.find((x) => d <= x.start + x.L) || segList[segList.length - 1];
      const t = s.L === 0 ? 0 : (d - s.start) / s.L;
      out.push([s.a[0] + (s.b[0] - s.a[0]) * t, s.a[1] + (s.b[1] - s.a[1]) * t]);
    }
    return out;
  }

  function peakPath(x, y, w, h) {
    return (
      `M${x - w} ${y}` +
      `C${x - w * 0.62} ${y - h * 0.28},${x - w * 0.34} ${y - h * 0.94},${x} ${y - h}` +
      `C${x + w * 0.34} ${y - h * 0.94},${x + w * 0.62} ${y - h * 0.28},${x + w} ${y}Z`
    );
  }

  function drawTerrain() {
    const host = document.getElementById('hsTerrain');
    if (!host) return;
    const rand = rng(20260830);
    const peaks = [];
    RIDGES.forEach((ridge) => {
      samplePolyline(ridge.pts, ridge.n).forEach(([px, py]) => {
        const x = px + (rand() - 0.5) * 26;
        const y = py + (rand() - 0.5) * 20;
        const h = ridge.h[0] + rand() * (ridge.h[1] - ridge.h[0]);
        const w = ridge.w[0] + rand() * (ridge.w[1] - ridge.w[0]);
        peaks.push({ x, y, w, h });
      });
    });
    // 아래쪽 봉우리가 위에 오도록 — 회화식 지도의 겹침 표현
    peaks.sort((a, b) => a.y - b.y);
    const frag = document.createDocumentFragment();
    peaks.forEach((p) => {
      frag.appendChild(el('path', { class: 'hs-peak', d: peakPath(p.x, p.y, p.w, p.h) }));
      frag.appendChild(
        el('path', {
          class: 'hs-peak-line',
          d: `M${p.x} ${p.y - p.h * 0.88}L${p.x - p.w * 0.42} ${p.y - p.h * 0.06}`,
        })
      );
      frag.appendChild(
        el('path', {
          class: 'hs-peak-line',
          d: `M${p.x} ${p.y - p.h * 0.88}L${p.x + p.w * 0.4} ${p.y - p.h * 0.08}`,
        })
      );
    });
    host.appendChild(frag);
  }

  /* 도성 안 민가 + 궁궐 */
  function drawCity() {
    const host = document.getElementById('hsCity');
    if (!host) return;
    const rand = rng(8899);
    const frag = document.createDocumentFragment();
    // 궁궐·관아 — 맞배지붕 실루엣 (빈 사각형은 옛 지도에 어울리지 않는다)
    const palace = (x, y, w, h) =>
      `M${x} ${y + h}L${x} ${y + 7}L${x - 4} ${y + 7}L${x + w / 2} ${y - 5}` +
      `L${x + w + 4} ${y + 7}L${x + w} ${y + 7}L${x + w} ${y + h}Z`;
    frag.appendChild(el('path', { class: 'hs-palace', d: palace(470, 444, 62, 32) }));
    frag.appendChild(el('path', { class: 'hs-palace', d: palace(558, 472, 38, 22) }));
    // 성곽 안쪽 대략 타원 범위에만 민가를 찍는다
    for (let i = 0; i < 120; i++) {
      const a = rand() * Math.PI * 2;
      const r = Math.sqrt(rand());
      const x = 508 + Math.cos(a) * r * 108;
      const y = 508 + Math.sin(a) * r * 62;
      const w = 6 + rand() * 5;
      frag.appendChild(
        el('path', {
          class: 'hs-house',
          d: `M${x - w} ${y}L${x} ${y - w * 0.62}L${x + w} ${y}`,
        })
      );
    }
    host.appendChild(frag);
  }

  /* ---------------------------------------------------------------
     3. 성곽선 채우기 + 라벨
  --------------------------------------------------------------- */
  const wallsRoot = document.getElementById('hsWalls');
  const wallNodes = {};

  function setupWalls() {
    if (!wallsRoot) return;
    wallsRoot.querySelectorAll('.hs-wall').forEach((g) => {
      const id = g.dataset.wall;
      const fill = g.querySelector('.hs-wall-fill');
      const d = fill.getAttribute('d');
      // 네온 3겹 — 먹 그림자와 발광층을 코어 뒤에 깔아준다
      const shadow = el('path', { class: 'hs-wall-shadow', d });
      const glow = el('path', { class: 'hs-wall-glow', d });
      fill.parentNode.insertBefore(shadow, fill);
      fill.parentNode.insertBefore(glow, fill);

      const len = fill.getTotalLength();
      const layers = [shadow, glow, fill];
      layers.forEach((n) => {
        n.style.strokeDasharray = `${len}`;
        n.style.strokeDashoffset = `${len}`;
      });

      // 파티클이 따라 달릴 좌표를 미리 계산해 둔다 (매 프레임 계산하면 느리다)
      const SAMPLES = 480;
      const pts = [];
      for (let i = 0; i < SAMPLES; i++) {
        const pt = fill.getPointAtLength((i / (SAMPLES - 1)) * len);
        pts.push([pt.x, pt.y]);
      }
      wallNodes[id] = { g, fill, glow, shadow, layers, len, pts };
    });
  }

  function revealWalls() {
    segs.forEach((s) => {
      const node = wallNodes[s.id];
      if (!node) return;
      const off = node.len * (1 - rateOf(s));
      node.layers.forEach((n) => (n.style.strokeDashoffset = `${off}`));
    });
  }

  /* --- 성곽선 위를 흐르는 러너 빛 입자 -------------------------------
     참여 인원이 많은 구간일수록 더 많은 점이 흐릅니다.
     달린 구간(채워진 부분) 위에서만 움직입니다.
  ------------------------------------------------------------------ */
  const runners = [];
  let runnerRaf = null;

  function buildRunners() {
    const host = document.getElementById('hsRunners');
    if (!host) return;
    segs.forEach((s) => {
      const node = wallNodes[s.id];
      if (!node) return;
      const count = Math.max(3, Math.min(16, Math.round(s.runners / 90)));
      const rate = rateOf(s);
      for (let i = 0; i < count; i++) {
        const glow = el('circle', { class: 'hs-runner-glow', r: 7, fill: s.color, opacity: 1 });
        const core = el('circle', { class: 'hs-runner-core', r: 2.2, opacity: 0.98 });
        host.append(glow, core);
        runners.push({
          pts: node.pts,
          rate,
          glow,
          core,
          t: i / count,
          // 속도를 조금씩 다르게 줘야 줄지어 가는 느낌이 안 난다
          speed: 0.00013 + ((i * 37) % 11) * 0.000018,
        });
      }
    });
    // 첫 프레임 전에도 제자리에 있어야 한다.
    // 이걸 빼면 애니메이션이 돌기 전까지 전부 (0,0)에 뭉쳐 보인다.
    placeRunners();
  }

  function placeRunners() {
    runners.forEach((r) => {
      const idx = Math.round(r.t * r.rate * (r.pts.length - 1));
      const p = r.pts[Math.max(0, Math.min(r.pts.length - 1, idx))];
      r.glow.setAttribute('cx', p[0]);
      r.glow.setAttribute('cy', p[1]);
      r.core.setAttribute('cx', p[0]);
      r.core.setAttribute('cy', p[1]);
    });
  }

  function tickRunners() {
    runners.forEach((r) => {
      r.t += r.speed;
      if (r.t > 1) r.t -= 1;
    });
    placeRunners();
    runnerRaf = requestAnimationFrame(tickRunners);
  }

  // 모션 최소화를 켠 사용자에게는 점을 고정해 둔다 (지우지는 않는다)
  function setRunnersActive(on) {
    if (!runners.length || reduceMotion) return;
    if (on && runnerRaf === null) runnerRaf = requestAnimationFrame(tickRunners);
    if (!on && runnerRaf !== null) {
      cancelAnimationFrame(runnerRaf);
      runnerRaf = null;
    }
  }

  const LABEL_POS = { bukhan: [648, 116], tangchun: [178, 330], hanyang: [742, 590] };

  function drawWallLabels() {
    const host = document.getElementById('hsWallLabels');
    if (!host) return;
    segs.forEach((s) => {
      const pos = LABEL_POS[s.id];
      if (!pos) return;
      const g = el('g', { class: 'hs-wall-label', transform: `translate(${pos[0]} ${pos[1]})` });
      g.style.setProperty('--wl', s.color);
      const rect = el('rect', { x: 0, y: 0, rx: 13, ry: 13 });
      const name = el('text', { class: 'wl-name', x: 14, y: 20 });
      name.textContent = s.name;
      const km = el('text', { class: 'wl-km', x: 14, y: 39 });
      km.textContent = `${nf(s.km)} km · ${Math.round(rateOf(s) * 100)}%`;
      g.append(rect, name, km);
      host.appendChild(g);
      const w = Math.max(name.getComputedTextLength(), km.getComputedTextLength()) + 28;
      rect.setAttribute('width', w);
      rect.setAttribute('height', 50);
      // 오른쪽 라벨은 프레임 밖으로 나가지 않게 왼쪽으로 당긴다
      if (pos[0] + w > 962) g.setAttribute('transform', `translate(${962 - w} ${pos[1]})`);
    });
  }

  /* ---------------------------------------------------------------
     4. 범례 · 강조 · 툴팁
  --------------------------------------------------------------- */
  let focused = null;

  function applyFocus() {
    if (!wallsRoot) return;
    wallsRoot.classList.toggle('has-focus', Boolean(focused));
    wallsRoot.querySelectorAll('.hs-wall').forEach((g) => {
      g.classList.toggle('is-focused', g.dataset.wall === focused);
    });
    record.querySelectorAll('.legend-chip').forEach((c) => {
      c.setAttribute('aria-pressed', String(c.dataset.seg === focused));
    });
  }

  function buildLegend() {
    const host = record.querySelector('.map-legend');
    if (!host) return;
    segs.forEach((s) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'legend-chip';
      b.dataset.seg = s.id;
      b.style.setProperty('--chip', s.color);
      b.setAttribute('aria-pressed', 'false');
      b.innerHTML =
        `<span class="dot"></span>${s.name}<span class="chip-km">${nf(s.km)}km</span>`;
      b.addEventListener('click', () => {
        focused = focused === s.id ? null : s.id;
        applyFocus();
      });
      host.appendChild(b);
    });
  }

  const mapTip = document.getElementById('mapTip');
  const mapStage = record.querySelector('.map-stage');

  function bindWallHover() {
    if (!wallsRoot || !mapTip || !mapStage) return;
    wallsRoot.querySelectorAll('.hs-wall').forEach((g) => {
      const s = byId[g.dataset.wall];
      if (!s) return;
      const show = (e) => {
        const r = mapStage.getBoundingClientRect();
        mapTip.innerHTML =
          `<strong>${s.name} <span style="opacity:.6;font-weight:600">${s.hanja}</span></strong>` +
          `누적 <span class="tip-km">${nf(s.km)} km</span> · ${nf(s.runners)}명<br>` +
          `완주 환산 ${nf(s.km / s.lengthKm, 1)}회 · 목표 ${Math.round(rateOf(s) * 100)}%`;
        mapTip.hidden = false;
        mapTip.style.left = `${e.clientX - r.left}px`;
        mapTip.style.top = `${e.clientY - r.top - 14}px`;
      };
      g.addEventListener('pointerenter', show);
      g.addEventListener('pointermove', show);
      g.addEventListener('pointerleave', () => {
        mapTip.hidden = true;
      });
      g.addEventListener('click', () => {
        focused = focused === s.id ? null : s.id;
        applyFocus();
      });
    });
  }

  /* ---------------------------------------------------------------
     5. 표 · 환산 카드 · 최근 인증
  --------------------------------------------------------------- */
  function buildTable() {
    const body = document.getElementById('mapTableBody');
    if (!body) return;
    body.innerHTML = segs
      .map((s) => {
        const rate = Math.round(rateOf(s) * 100);
        return (
          `<tr style="--sc:${s.color}">` +
          `<th scope="row"><span class="seg-name"><i></i>${s.name}</span></th>` +
          `<td>${nf(s.km)} km</td>` +
          `<td>${nf(s.runners)}명</td>` +
          `<td>${nf(s.km / s.lengthKm, 1)}회</td>` +
          `<td><span class="rate-cell"><span class="bar"><span style="width:${rate}%"></span></span>` +
          `<span class="rate-num">${rate}%</span></span></td>` +
          `</tr>`
        );
      })
      .join('');
  }

  function buildScaleCards() {
    const host = document.getElementById('scaleGrid');
    if (!host) return;
    const hanyang = byId.hanyang;
    const roundTrips = totalKm / (D.scale.seoulBusanKm * 2);
    const earthPct = (totalKm / D.scale.earthCircumferenceKm) * 100;
    const cards = [
      {
        top: `한양도성 한 바퀴 ${hanyang.lengthKm}km 기준`,
        big: `${nf(hanyang.km / hanyang.lengthKm, 0)}바퀴`,
        sub: '참가자들이 도성을 돈 횟수입니다.',
      },
      {
        top: `서울–부산 ${D.scale.seoulBusanKm}km 기준`,
        big: `왕복 ${nf(roundTrips, 1)}번`,
        sub: '누적 거리를 한 줄로 이으면 이만큼입니다.',
      },
      {
        top: '지구 둘레 40,075km 기준',
        big: `${nf(earthPct, 1)}%`,
        sub: '지구 한 바퀴까지 남은 거리를 함께 채워요.',
      },
    ];
    host.innerHTML = cards
      .map((c) => `<article class="scale-card"><p>${c.top}</p><strong>${c.big}</strong><p>${c.sub}</p></article>`)
      .join('');
  }

  function buildRecent() {
    const host = document.getElementById('recentStrip');
    if (!host) return;
    host.innerHTML = D.recent
      .map((r) => {
        const s = byId[r.segment];
        const color = s ? s.color : 'var(--muted)';
        const name = s ? s.name : '';
        return `<li style="--sc:${color}"><i></i><b>${r.nick}</b><span>${name} ${nf(r.km, 1)}km</span></li>`;
      })
      .join('');
  }

  function buildMeta() {
    const host = document.getElementById('recordMeta');
    if (!host) return;
    const badge = D.isLive ? '' : '<span class="sample-badge">샘플 데이터</span>';
    host.innerHTML =
      `${badge}기준일 ${D.updatedAt}` +
      (D.isLive ? '' : ' · 실제 인증 데이터가 연결되면 자동으로 교체됩니다.');
  }

  /* ---------------------------------------------------------------
     6. 카운터 롤업
  --------------------------------------------------------------- */
  const COUNTS = { runners: D.totalRunners, km: totalKm, laps: totalLaps };

  function runCounters() {
    const nodes = record.querySelectorAll('[data-count]');
    if (reduceMotion) {
      nodes.forEach((n) => (n.textContent = nf(COUNTS[n.dataset.count] || 0)));
      return;
    }
    const dur = 1600;
    const t0 = performance.now();
    const step = (now) => {
      const p = Math.min(1, (now - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      nodes.forEach((n) => {
        n.textContent = nf(Math.round((COUNTS[n.dataset.count] || 0) * eased));
      });
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /* ---------------------------------------------------------------
     7. 주차별 누적 차트
  --------------------------------------------------------------- */
  const CW = 900;
  const CH = 320;
  const PAD = { l: 58, r: 62, t: 24, b: 46 };
  const PW = CW - PAD.l - PAD.r;
  const PH = CH - PAD.t - PAD.b;

  const cum = [];
  D.weekly.reduce((acc, w) => {
    const v = acc + w.km;
    cum.push({ ...w, cum: v });
    return v;
  }, 0);

  function niceMax(v) {
    const exp = Math.pow(10, Math.floor(Math.log10(v)));
    const f = v / exp;
    const step = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
    return step * exp;
  }
  const yMax = niceMax(cum[cum.length - 1].cum * 1.08);
  const xAt = (i) => PAD.l + (i / Math.max(1, cum.length - 1)) * PW;
  const yAt = (v) => PAD.t + PH - (v / yMax) * PH;

  function buildChart() {
    const grid = document.getElementById('chartGrid');
    const areaEl = document.getElementById('chartArea');
    const lineEl = document.getElementById('chartLine');
    const dotsEl = document.getElementById('chartDots');
    const axisEl = document.getElementById('chartAxis');
    const tip = document.getElementById('chartTip');
    const cross = document.getElementById('chartCross');
    const stage = document.getElementById('chartStage');
    const svg = record.querySelector('.chart-svg');
    if (!grid || !areaEl || !lineEl || !svg) return;

    // 눈금
    for (let i = 0; i <= 4; i++) {
      const v = (yMax / 4) * i;
      const y = yAt(v);
      grid.appendChild(el('line', { x1: PAD.l, x2: PAD.l + PW, y1: y, y2: y }));
      const t = el('text', { x: PAD.l - 12, y: y + 4, 'text-anchor': 'end' });
      t.textContent = nf(v);
      grid.appendChild(t);
    }

    const pts = cum.map((d, i) => [xAt(i), yAt(d.cum)]);
    const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('');
    lineEl.setAttribute('d', line);
    areaEl.setAttribute(
      'd',
      `${line}L${pts[pts.length - 1][0].toFixed(1)} ${(PAD.t + PH).toFixed(1)}L${pts[0][0].toFixed(1)} ${(PAD.t + PH).toFixed(1)}Z`
    );

    pts.forEach((p, i) => {
      const c = el('circle', { cx: p[0], cy: p[1], r: 5 });
      if (i === pts.length - 1) c.setAttribute('class', 'last-dot');
      dotsEl.appendChild(c);
    });

    // 마지막 값 직접 라벨 (모든 점에 숫자를 붙이지 않는다)
    const last = pts[pts.length - 1];
    const endLabel = el('text', { class: 'chart-end-label', x: last[0] + 12, y: last[1] + 4 });
    endLabel.textContent = `${nf(cum[cum.length - 1].cum)} km`;
    dotsEl.parentNode.appendChild(endLabel);

    // x축 라벨
    axisEl.innerHTML = cum
      .map(
        (d, i) =>
          `<span data-i="${i}" style="left:${((xAt(i) / CW) * 100).toFixed(2)}%">${d.label}${d.partial ? '*' : ''}</span>`
      )
      .join('');

    // 크로스헤어 + 툴팁
    const dots = Array.from(dotsEl.querySelectorAll('circle'));
    const clear = () => {
      dots.forEach((c, i) => c.classList.toggle('on', i === dots.length - 1));
      if (tip) tip.hidden = true;
      if (cross) cross.setAttribute('hidden', '');
    };
    const move = (e) => {
      const r = svg.getBoundingClientRect();
      const sx = ((e.clientX - r.left) / r.width) * CW;
      let best = 0;
      let bestD = Infinity;
      pts.forEach((p, i) => {
        const d = Math.abs(p[0] - sx);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      });
      const d = cum[best];
      dots.forEach((c, i) => c.classList.toggle('on', i === best));
      if (cross) {
        cross.removeAttribute('hidden');
        cross.setAttribute('x1', pts[best][0]);
        cross.setAttribute('x2', pts[best][0]);
        cross.setAttribute('y1', PAD.t);
        cross.setAttribute('y2', PAD.t + PH);
      }
      if (tip) {
        tip.hidden = false;
        tip.innerHTML =
          `<b>${nf(d.cum)} km</b>${d.label}${d.partial ? ' (진행 중)' : ''} · <i>+${nf(d.km)}km</i>`;
        const stageRect = stage.getBoundingClientRect();
        tip.style.left = `${((pts[best][0] / CW) * r.width) + (r.left - stageRect.left)}px`;
        tip.style.top = `${((pts[best][1] / CH) * r.height) + (r.top - stageRect.top)}px`;
      }
    };
    stage.addEventListener('pointermove', move);
    stage.addEventListener('pointerleave', clear);
    clear();

    // 표로 보기
    const tbody = document.getElementById('chartTableBody');
    if (tbody) {
      tbody.innerHTML = cum
        .map(
          (d) =>
            `<tr><th scope="row">${d.label}${d.partial ? ' (진행 중)' : ''}</th>` +
            `<td>${nf(d.km)} km</td><td>${nf(d.cum)} km</td></tr>`
        )
        .join('');
    }
  }


  /* ---------------------------------------------------------------
     9. 지오펜스 스탬프 인증
     브라우저 위치를 한 번만 읽어 인증 포인트와의 거리를 재고,
     radiusM 이내면 스탬프를 줍니다.
     ⚠️ 스탬프는 이 브라우저에만 저장됩니다 (localStorage).
        실제 운영에는 백엔드 저장이 필요합니다.
  --------------------------------------------------------------- */
  const GEO = D.geo;
  const STAMP_KEY = 'hansu.stamps.v1';
  const geoDebug = /[?&]geodebug=1(?:&|$)/.test(location.search);

  const loadStamps = () => {
    try {
      return JSON.parse(localStorage.getItem(STAMP_KEY)) || {};
    } catch (e) {
      return {};
    }
  };
  const saveStamps = (v) => {
    try {
      localStorage.setItem(STAMP_KEY, JSON.stringify(v));
    } catch (e) {
      /* 시크릿 모드 등에서 저장이 막혀도 화면은 계속 동작해야 한다 */
    }
  };

  // 두 좌표 사이 거리(m) — Haversine
  function metersBetween(a, b) {
    const R = 6371000;
    const rad = (x) => (x * Math.PI) / 180;
    const dLat = rad(b.lat - a.lat);
    const dLng = rad(b.lng - a.lng);
    const h =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  }
  const fmtDist = (m) => (m < 1000 ? `${Math.round(m)}m` : `${nf(m / 1000, 1)}km`);

  let activeCourse = 'all';
  let openStory = null;
  const courseById = Object.fromEntries((D.courses || []).map((c) => [c.id, c]));
  const pointsOf = (cid) =>
    cid === 'all' ? GEO.checkpoints : GEO.checkpoints.filter((c) => c.course === cid);
  const earnedCount = (cid) => {
    const st = loadStamps();
    return pointsOf(cid).filter((c) => st[c.id]).length;
  };

  function buildCourseTabs() {
    const host = document.getElementById('courseTabs');
    if (!host) return;
    const tabs = [{ id: 'all', name: '전체' }].concat(D.courses || []);
    host.innerHTML = tabs
      .map(
        (t) =>
          `<button class="course-tab" type="button" role="tab" data-course="${t.id}" ` +
          `aria-selected="${t.id === activeCourse}">${t.name}` +
          `<span class="tab-count">${earnedCount(t.id)}/${pointsOf(t.id).length}</span></button>`
      )
      .join('');
    host.querySelectorAll('.course-tab').forEach((b) => {
      b.addEventListener('click', () => {
        activeCourse = b.dataset.course;
        openStory = null;
        refreshCheckin();
      });
    });
  }

  function renderCourseInfo() {
    const host = document.getElementById('courseInfo');
    if (!host) return;
    const c = courseById[activeCourse];
    if (!c) {
      const total = (D.courses || []).reduce((a, x) => a + x.distanceKm, 0);
      host.innerHTML =
        `<p class="ci-route">순성길 ${(D.courses || []).length}개 구간 · 한 바퀴 ${nf(total, 1)}km</p>` +
        `<div class="ci-meta"><span>스탬프 ${GEO.checkpoints.length}곳</span>` +
        `<span>인증 반경 ${GEO.radiusM}m</span></div>` +
        `<p class="ci-desc">코스를 고르면 그 구간의 스탬프만 보입니다. 순서대로 돌지 않아도 되고, 원하는 구간부터 시작해도 됩니다.</p>`;
      return;
    }
    host.innerHTML =
      `<p class="ci-route">${c.from} → ${c.to}</p>` +
      `<div class="ci-meta"><span>${nf(c.distanceKm, 1)}km</span><span>${c.duration}</span>` +
      `<span class="ci-level">난이도 ${c.level}</span>` +
      `<span>스탬프 ${pointsOf(c.id).length}곳</span></div>` +
      `<p class="ci-desc">${c.summary} ${c.detail}</p>`;
  }

  function renderStamps(dists) {
    const host = document.getElementById('stampGrid');
    if (!host || !GEO) return;
    const stamps = loadStamps();
    host.innerHTML = pointsOf(activeCourse)
      .map((c) => {
        const done = Boolean(stamps[c.id]);
        const d = dists && dists[c.id];
        const near = d != null && d <= GEO.radiusM * 3;
        const course = courseById[c.course];
        return (
          `<li><button class="stamp${done ? ' done' : ''}${near && !done ? ' near' : ''}" ` +
          `type="button" data-cp="${c.id}" aria-expanded="${openStory === c.id}">` +
          `<span class="stamp-mark">${done ? '\u2713' : '\u00b7'}</span>` +
          `<span class="stamp-name">${c.name}</span>` +
          `<span class="stamp-course">${course ? course.name : ''}</span>` +
          (d == null ? '' : `<span class="stamp-dist">${fmtDist(d)}</span>`) +
          `<span class="stamp-lock">${done ? '이야기 열림' : '인증하면 열림'}</span>` +
          `</button></li>`
        );
      })
      .join('');
    host.querySelectorAll('.stamp').forEach((b) => {
      b.addEventListener('click', () => {
        openStory = openStory === b.dataset.cp ? null : b.dataset.cp;
        refreshCheckin(dists);
      });
    });
  }

  // 스탬프를 찍어야 그 자리의 이야기가 열린다 — 인증이 곧 배움의 열쇠
  function renderStory() {
    const panel = document.getElementById('storyPanel');
    if (!panel) return;
    const cp = openStory && GEO.checkpoints.find((c) => c.id === openStory);
    if (!cp) {
      panel.hidden = true;
      panel.innerHTML = '';
      return;
    }
    const done = Boolean(loadStamps()[cp.id]);
    const course = courseById[cp.course];
    panel.hidden = false;
    panel.innerHTML =
      `<div class="sp-top"><h4>${cp.name}</h4>` +
      `<span class="sp-course">${course ? course.name : ''}</span></div>` +
      (done
        ? `<p>${cp.story}</p>`
        : `<p class="sp-locked">아직 인증하지 않은 지점입니다. ${cp.name}에 도착해 ` +
          `${GEO.radiusM}m 안에서 인증하면 이곳의 이야기가 열립니다.</p>`) +
      `<button class="sp-close" type="button">닫기</button>`;
    panel.querySelector('.sp-close').addEventListener('click', () => {
      openStory = null;
      refreshCheckin();
    });
  }

  function renderProgress() {
    const n = document.getElementById('checkinProgress');
    if (!n) return;
    const got = earnedCount('all');
    const total = GEO.checkpoints.length;
    n.innerHTML =
      `스탬프 ${got}/${total} · 이야기 ${got}편 열림` +
      `<span class="cp-bar"><i style="width:${total ? (got / total) * 100 : 0}%"></i></span>`;
  }

  /* --- 지도 연동: 코스를 고르면 그 구간이 빛난다 ------------------- */
  const MAP_CENTER = [508, 505];
  const MAJOR_GATES = ['sukjeong', 'heunginjimun', 'sungnyemun', 'donuimun'];

  const hanyangPts = () => (wallNodes.hanyang ? wallNodes.hanyang.pts : null);

  // t 는 한 바퀴가 1 이므로 1을 넘으면 처음으로 돌아온다 (백악구간이 0을 지나감)
  function ptAtT(t) {
    const pts = hanyangPts();
    if (!pts) return null;
    const tt = ((t % 1) + 1) % 1;
    return pts[Math.min(pts.length - 1, Math.round(tt * (pts.length - 1)))];
  }

  // 라벨은 성곽선 바깥쪽으로 밀어내 선 위에 겹치지 않게 한다
  function outward(p, dist) {
    const dx = p[0] - MAP_CENTER[0];
    const dy = p[1] - MAP_CENTER[1];
    const L = Math.hypot(dx, dy) || 1;
    return [p[0] + (dx / L) * dist, p[1] + (dy / L) * dist, dy];
  }

  function drawCheckpointMarkers() {
    const host = document.getElementById('hsGates');
    if (!host || !GEO) return;
    host.innerHTML = '';
    const stamps = loadStamps();
    const inCourse = (c) => activeCourse === 'all' || c.course === activeCourse;
    GEO.checkpoints.forEach((c) => {
      if (c.t == null) return;
      const p = ptAtT(c.t);
      if (!p) return;
      const done = Boolean(stamps[c.id]);
      const g = el('g', {
        class: `hs-gate${done ? ' is-done' : ''}${inCourse(c) ? ' in-course' : ''}`,
      });
      const dot = el('circle', { r: done ? 6 : 5, cx: p[0], cy: p[1] });
      g.appendChild(dot);
      // 이름은 4대문 또는 선택한 코스의 지점에만 — 열 개를 다 쓰면 지도가 막힌다
      const named = activeCourse === 'all' ? MAJOR_GATES.indexOf(c.id) >= 0 : inCourse(c);
      if (named) {
        const [lx, ly, dy] = outward(p, 17);
        const t = el('text', { x: lx, y: ly + (dy > 0 ? 11 : -5), 'text-anchor': 'middle' });
        t.textContent = c.name;
        g.appendChild(t);
      }
      host.appendChild(g);
    });
  }

  function drawCourseArc() {
    const host = document.getElementById('hsCourse');
    if (!host) return;
    host.innerHTML = '';
    const c = courseById[activeCourse];
    const pts = hanyangPts();
    if (!c || !c.arc || !pts) return;
    const [a, b] = c.arc;
    const steps = Math.max(4, Math.round((b - a) * pts.length));
    const d = [];
    for (let i = 0; i <= steps; i++) {
      const p = ptAtT(a + ((b - a) * i) / steps);
      d.push(`${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`);
    }
    const path = d.join('');
    host.appendChild(el('path', { class: 'hs-course-glow', d: path }));
    host.appendChild(el('path', { class: 'hs-course-core', d: path }));
  }

  function syncMapToCourse() {
    drawCourseArc();
    drawCheckpointMarkers();
    const on = activeCourse !== 'all' && Boolean(courseById[activeCourse]);
    if (wallsRoot) wallsRoot.classList.toggle('course-mode', on);
    // 코스를 고르면 인증지점 이름이 주인공이 되므로 산 이름은 물러나게 한다
    const svg = record.querySelector('.map-svg');
    if (svg) svg.classList.toggle('course-mode', on);
  }

  function refreshCheckin(dists) {
    syncMapToCourse();
    buildCourseTabs();
    renderCourseInfo();
    renderStamps(dists);
    renderStory();
    renderProgress();
  }

  function setStatus(msg, kind) {
    const n = document.getElementById('checkinStatus');
    if (!n) return;
    n.textContent = msg;
    n.className = `checkin-status${kind ? ' ' + kind : ''}`;
  }

  function buildCheckin() {
    const panel = record.querySelector('.checkin-panel');
    if (!panel) return;
    if (!GEO || !GEO.checkpoints || !GEO.checkpoints.length) {
      panel.remove();
      return;
    }
    refreshCheckin();

    const note = document.getElementById('checkinNote');
    if (note) {
      const parts = [
        `인증 반경 ${GEO.radiusM}m · 스탬프 ${GEO.checkpoints.length}곳. 스탬프 카드를 누르면 그 자리의 이야기를 볼 수 있습니다.`,
        '스탬프는 <b>이 브라우저에만</b> 저장됩니다. 기기를 바꾸면 사라지고 운영자도 볼 수 없습니다 — 실제 운영하려면 백엔드 연결이 필요합니다.',
        '좌표는 공개 자료 기준 근사값입니다. 주소 끝에 <code>?geodebug=1</code>을 붙이면 모든 지점까지의 실측 거리가 표시되니, 현장에서 그 값으로 좌표와 반경을 보정하세요.',
      ];
      if (!window.isSecureContext) {
        parts.unshift(
          '⚠️ 지금은 보안 연결이 아니라 위치 기능이 차단됩니다. <code>localhost</code> 또는 https로 열어주세요.'
        );
      }
      note.innerHTML = parts.join('<br>');
    }

    const btn = document.getElementById('checkinBtn');
    if (!btn) return;
    btn.addEventListener('click', () => {
      if (!navigator.geolocation) {
        setStatus('이 브라우저는 위치 기능을 지원하지 않습니다.', 'err');
        return;
      }
      if (!window.isSecureContext) {
        setStatus('보안 연결(https 또는 localhost)에서만 위치를 읽을 수 있습니다.', 'err');
        return;
      }
      btn.disabled = true;
      setStatus('위치를 확인하는 중입니다…');
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          btn.disabled = false;
          const me = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          const acc = pos.coords.accuracy;

          const dists = {};
          let nearest = null;
          GEO.checkpoints.forEach((c) => {
            const m = metersBetween(me, c);
            dists[c.id] = m;
            if (!nearest || m < nearest.m) nearest = { c, m };
          });

          if (nearest.m <= GEO.radiusM) {
            const stamps = loadStamps();
            const already = Boolean(stamps[nearest.c.id]);
            stamps[nearest.c.id] = { at: new Date().toISOString(), m: Math.round(nearest.m) };
            saveStamps(stamps);
            // 찍은 지점이 보이도록 그 코스로 옮기고 이야기를 바로 펼친다
            activeCourse = nearest.c.course;
            openStory = nearest.c.id;
            refreshCheckin(geoDebug ? dists : { [nearest.c.id]: nearest.m });
            const total = earnedCount('all');
            setStatus(
              already
                ? `${nearest.c.name} 재인증 완료 (${fmtDist(nearest.m)}). 스탬프 ${total}/${GEO.checkpoints.length}`
                : `${nearest.c.name} 인증 완료! 이야기가 열렸습니다. 스탬프 ${total}/${GEO.checkpoints.length}`,
              'ok'
            );
          } else {
            refreshCheckin(geoDebug ? dists : { [nearest.c.id]: nearest.m });
            setStatus(
              `가장 가까운 곳은 ${nearest.c.name}이고 ${fmtDist(nearest.m)} 떨어져 있습니다. ` +
                `${GEO.radiusM}m 안으로 들어가면 인증됩니다. (위치 오차 약 ${Math.round(acc)}m)`,
              'warn'
            );
          }
        },
        (err) => {
          btn.disabled = false;
          const msg =
            err.code === 1
              ? '위치 권한이 거부되었습니다. 브라우저 설정에서 이 사이트의 위치 권한을 허용해 주세요.'
              : err.code === 2
              ? '위치를 가져오지 못했습니다. 실내나 지하에서는 실패할 수 있습니다.'
              : '위치 확인이 시간 초과되었습니다. 하늘이 보이는 곳에서 다시 시도해 주세요.';
          setStatus(msg, 'err');
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    });
  }

  /* ---------------------------------------------------------------
     8. 초기화
  --------------------------------------------------------------- */
  drawTerrain();
  drawCity();
  setupWalls();
  buildRunners();
  drawWallLabels();
  buildLegend();
  bindWallHover();
  buildTable();
  buildScaleCards();
  buildRecent();
  buildMeta();
  buildChart();
  buildCheckin();

  // 지도가 화면 밖이면 파티클을 멈춘다 (배터리·CPU 절약)
  if ('IntersectionObserver' in window && mapStage) {
    new IntersectionObserver(
      (entries) => entries.forEach((en) => setRunnersActive(en.isIntersecting)),
      { threshold: 0 }
    ).observe(mapStage);
  } else {
    setRunnersActive(true);
  }

  // 섹션이 화면에 들어올 때 한 번만 애니메이션
  let played = false;
  const play = () => {
    if (played) return;
    played = true;
    runCounters();
    revealWalls();
  };
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) {
            play();
            io.disconnect();
          }
        });
      },
      { threshold: 0.18 }
    );
    io.observe(record);
  } else {
    play();
  }
})();

/* =====================================================================
   어린이 배움 (#kids)
   문구는 전부 data.js 의 education 에 있습니다. 여기는 그리기만 합니다.
   ===================================================================== */
(function () {
  const D = window.HANSU_DATA;
  const kids = document.getElementById('kids');
  if (!D || !D.education || !kids) return;
  const E = D.education;
  const nf = (n) => Number(n).toLocaleString('ko-KR');

  const steps = document.getElementById('kidsSteps');
  if (steps && E.steps) {
    steps.innerHTML = E.steps
      .map(
        (s) =>
          `<li><span class="step-no" aria-hidden="true">${s.no}</span>` +
          `<h3>${s.title}</h3><p>${s.desc}</p></li>`
      )
      .join('');
  }

  // details/summary 를 쓰면 열고 닫기와 키보드 조작이 브라우저 기본으로 해결된다
  const qna = document.getElementById('kidsQna');
  if (qna && E.qna) {
    qna.innerHTML = E.qna
      .map(
        (x) =>
          `<details class="qna-item"><summary class="qna-q">` +
          `<span class="q-mark" aria-hidden="true">?</span>${x.q}` +
          `<span class="q-caret" aria-hidden="true">▾</span></summary>` +
          `<p class="qna-a">${x.a}</p></details>`
      )
      .join('');
  }

  const stats = document.getElementById('kidsStats');
  if (stats && E.stats) {
    stats.innerHTML = E.stats
      .map(
        (s) =>
          `<div class="kids-stat"><strong>${nf(s.value)}<em>${s.unit}</em></strong>` +
          `<span>${s.label}</span></div>`
      )
      .join('');
  }
})();

/* =====================================================================
   성곽 이야기 카드 · 아이들이 그린 성곽
   ===================================================================== */
(function () {
  const D = window.HANSU_DATA;
  if (!D) return;
  const NS = 'http://www.w3.org/2000/svg';

  /* --- 카드에 들어갈 그림 (간단한 선 그림으로 직접 그린다) --- */
  const GLYPHS = {
    wall:
      '<path d="M8 44h48M8 44V30h6v-6h6v6h6v-6h6v6h6v-6h6v6h6v14" />' +
      '<path d="M14 44V34M26 44V34M38 44V34M50 44V34" opacity=".5" />',
    mountain:
      '<path d="M6 46l12-20 8 12 10-18 14 26z" />' +
      '<path d="M18 26l4 6M40 20l4 7" opacity=".5" />',
    stone:
      '<rect x="8" y="18" width="20" height="12" rx="2" />' +
      '<rect x="32" y="18" width="24" height="12" rx="2" />' +
      '<rect x="8" y="34" width="26" height="12" rx="2" />' +
      '<rect x="38" y="34" width="18" height="12" rx="2" />',
    gate:
      '<path d="M6 22h52l-6-6H12z" /><path d="M12 22v24h40V22" />' +
      '<path d="M26 46V34a6 6 0 0 1 12 0v12" />',
    three:
      '<path d="M32 50a22 22 0 0 1 0-36" /><path d="M32 46a16 16 0 0 1 0-26" opacity=".72" />' +
      '<path d="M32 42a10 10 0 0 1 0-16" opacity=".45" /><path d="M32 14v36" opacity=".3" />',
    walk:
      '<path d="M8 48c10-4 16-14 24-14s14 8 24 6" />' +
      '<circle cx="30" cy="18" r="5" /><path d="M30 23v10l-6 8M30 33l7 8" />',
  };
  const glyphSvg = (kind) =>
    `<svg class="deck-glyph" viewBox="0 0 64 64" aria-hidden="true">${GLYPHS[kind] || GLYPHS.wall}</svg>`;

  /* --- 이야기 카드 덱 --- */
  const cards = D.storyCards || [];
  const cardEl = document.getElementById('deckCard');
  if (cardEl && cards.length) {
    const dots = document.getElementById('deckDots');
    let idx = 0;

    const render = () => {
      const c = cards[idx];
      cardEl.innerHTML =
        `<div class="deck-no" aria-hidden="true">${c.no}</div>` +
        glyphSvg(c.glyph) +
        `<h4>${c.title}</h4><p>${c.body}</p>` +
        (c.tip ? `<p class="deck-tip">${c.tip}</p>` : '') +
        `<p class="deck-count">${idx + 1} / ${cards.length}</p>`;
      if (dots) {
        dots.querySelectorAll('button').forEach((b, i) =>
          b.setAttribute('aria-selected', String(i === idx))
        );
      }
    };
    const go = (n) => {
      idx = (n + cards.length) % cards.length;
      render();
    };

    if (dots) {
      dots.innerHTML = cards
        .map(
          (c, i) =>
            `<button class="deck-dot" type="button" role="tab" aria-selected="${i === 0}" ` +
            `aria-label="${i + 1}번째 카드: ${c.title}"></button>`
        )
        .join('');
      dots.querySelectorAll('button').forEach((b, i) => b.addEventListener('click', () => go(i)));
    }
    const prev = document.getElementById('deckPrev');
    const next = document.getElementById('deckNext');
    if (prev) prev.addEventListener('click', () => go(idx - 1));
    if (next) next.addEventListener('click', () => go(idx + 1));

    // 좌우 화살표로도 넘길 수 있게
    const stage = cardEl.closest('.deck-stage');
    if (stage) {
      stage.setAttribute('tabindex', '0');
      stage.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') { go(idx - 1); e.preventDefault(); }
        if (e.key === 'ArrowRight') { go(idx + 1); e.preventDefault(); }
      });
    }
    render();
  }

  /* --- 아이들이 그린 성곽 --- */
  const grid = document.getElementById('galleryGrid');
  if (grid && D.gallery && D.gallery.length) {
    // 실제 작품 사진이 없을 때 쓰는 자리 그림. 항목마다 모양이 달라지도록 시드를 준다.
    const doodle = (seed) => {
      let s = (seed * 2654435761) >>> 0;
      const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
      const cx = 60, cy = 46, pts = [];
      for (let i = 0; i < 11; i++) {
        const a = (i / 11) * Math.PI * 2;
        const r = 22 + rnd() * 12;
        pts.push([cx + Math.cos(a) * r * 1.25, cy + Math.sin(a) * r * 0.8]);
      }
      const loop = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(0)} ${p[1].toFixed(0)}`).join('') + 'Z';
      let marks = '';
      for (let i = 0; i < 5; i++) {
        const x = 22 + rnd() * 76, y = 22 + rnd() * 48;
        marks += `<path d="M${x - 4} ${y}l4-5 4 5z" />`;
      }
      return (
        `<svg class="gal-doodle" viewBox="0 0 120 92" aria-hidden="true">` +
        `<path class="gal-loop" d="${loop}" />${marks}` +
        `<path class="gal-line" d="M10 78q30-10 55 2t45-8" /></svg>`
      );
    };

    grid.innerHTML = D.gallery
      .map((g, i) => {
        const art = g.image
          ? `<img src="${g.image}" alt="${g.nick} 어린이가 그린 성곽 지도" loading="lazy" />`
          : doodle(i + 7);
        return (
          `<li class="gal-item${g.image ? ' has-photo' : ''}">` +
          `<div class="gal-frame">${art}</div>` +
          `<p class="gal-cap">${g.caption}</p>` +
          `<p class="gal-by">${g.nick} · ${g.grade}</p></li>`
        );
      })
      .join('');

    const note = document.getElementById('galleryNote');
    if (note) {
      const hasPhoto = D.gallery.some((g) => g.image);
      note.innerHTML = hasPhoto
        ? '※ 보호자 동의를 받은 작품만 올립니다. 이름은 성 없이 표기합니다.'
        : '※ 아직 실제 작품 사진이 없어 자리 그림으로 대신했습니다. ' +
          '<code>data.js</code>의 각 항목에 <code>image</code> 경로를 넣으면 사진으로 바뀝니다.<br>' +
          '※ 작품을 올릴 때는 보호자 동의를 먼저 받고, 이름은 성 없이, 학교명은 넣지 마세요.';
    }
  }
})();
