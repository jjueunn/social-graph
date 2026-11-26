/* =========================================================
   SOCIAL GRAPH - graphs.js
   그래프별 계산, 그림 그리기(SVG), 해석 문구를 담은 파일입니다.

   그래프 하나는 아래 형식의 객체 하나입니다. (README의 '그래프 추가하기' 참고)
   {
     id, title, subjects: [과목 id], summary(카드 한 줄 설명), desc(상세 설명),
     initial()                       → 초기 상태
     controls(state, ui)             → 수치 조절 패널 구성
     normalize(state, key, prev)     → 값이 바뀐 뒤 합계·순서 맞추기 (안내 문구 반환)
     get/set(state, key, value)      → (선택) 특별한 방식으로 값을 읽고 쓸 때
     applyPreset(state, preset)      → (선택) 예시 적용 방식이 특별할 때
     compute(state)                  → 계산 결과
     draw(state, res, base, baseRes) → SVG 문자열
     legend(state, res, base)        → 범례 [{label, color, dash}]
     metrics(state, res)             → 주요 수치 [{label, value, digits, unit}]
     results(state, res)             → 현재 수치·계산 결과 HTML
     interpret(state, res, base, baseRes) → 해석 문구 배열
     concept, howto, preview         → 개념 설명 HTML, 활용 방법 배열, 카드 미리보기 SVG
   }
   ========================================================= */
(function () {
  const SG = window.SG;

  /* ---------------- 공통 도우미 ---------------- */
  const FONT = "Pretendard, 'Noto Sans KR', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif";
  const C = {
    text: "#243447", muted: "#788797", grid: "#E3E9F0", axis: "#B5C0CC",
    main: "#294B70", accent: "#5B8FC9", sub: "#DDEAF6", base: "#9AA5B1",
    blue: "#2F6DB5", orange: "#D9822B", green: "#2E8B6A", red: "#C2474B",
    purple: "#6B5CA5", rose: "#C8566B", male: "#3E74B5"
  };

  const u = {
    C, FONT,
    clone: (o) => JSON.parse(JSON.stringify(o)),
    clamp: (v, a, b) => Math.min(b, Math.max(a, v)),
    r1: (v) => Math.round(v * 10) / 10,
    esc: (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"),
    n: (v, d = 0) => (isFinite(v) ? Number(v).toLocaleString("ko-KR", { minimumFractionDigits: d, maximumFractionDigits: d }) : "-"),
    p: (v, d = 1) => (isFinite(v) ? u.n(v, d) + "%" : "-"),
    sum: (a) => a.reduce((x, y) => x + y, 0),
    svg: (w, h, body) =>
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" font-family="${FONT}" role="img">` +
      `<rect width="${w}" height="${h}" fill="#FFFFFF"/>${body}</svg>`,
    t: (x, y, s, o = {}) =>
      `<text x="${x}" y="${y}" fill="${o.fill || C.text}" font-size="${o.size || 15}" font-weight="${o.weight || 400}" text-anchor="${o.anchor || "start"}"${o.baseline ? ` dominant-baseline="${o.baseline}"` : ""}>${u.esc(s)}</text>`,
    line: (x1, y1, x2, y2, o = {}) =>
      `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${o.stroke || C.axis}" stroke-width="${o.width || 1}"${o.dash ? ` stroke-dasharray="${o.dash}"` : ""}/>`,
    rect: (x, y, w, h, o = {}) =>
      `<rect x="${x}" y="${y}" width="${Math.max(0, w)}" height="${Math.max(0, h)}" fill="${o.fill || "none"}"${o.stroke ? ` stroke="${o.stroke}" stroke-width="${o.width || 1.5}"` : ""}${o.dash ? ` stroke-dasharray="${o.dash}"` : ""}${o.opacity != null ? ` fill-opacity="${o.opacity}"` : ""}/>`,
    /* 증감 표시: +1.2, −0.5, 변화 없음 */
    signed: (v, d = 1) => {
      const r = Math.round(v * Math.pow(10, d)) / Math.pow(10, d);
      if (r === 0) return "변화 없음";
      return (r > 0 ? "+" : "−") + u.n(Math.abs(r), d);
    },
    /* 끝소리 받침: 0 = 없음, 1 = 있음, 2 = ㄹ 받침 (숫자는 읽는 소리 기준: 1 일, 3 삼, 0 십·백 …) */
    tail: (str) => {
      const ch = String(str).trim().slice(-1);
      const digit = { 0: 1, 1: 2, 2: 0, 3: 1, 4: 0, 5: 0, 6: 1, 7: 2, 8: 2, 9: 0 };
      if (ch in digit) return digit[ch];
      const code = ch.charCodeAt(0) - 0xac00;
      if (code >= 0 && code <= 11171) { const j = code % 28; return j === 0 ? 0 : j === 8 ? 2 : 1; }
      return 0;
    },
    /* 받침에 따라 '이/가', '을/를', '과/와', '으로/로' 고르기 */
    josa: (word, pair) => {
      const t = u.tail(word), [a, b] = pair.split("/");
      if (pair === "으로/로") return word + (t === 1 ? a : b);
      return word + (t ? a : b);
    },
    /* '…이에요/…예요' */
    ieyo: (word) => word + (u.tail(word) ? "이에요" : "예요"),
    niceMax: (v) => {
      if (v <= 0) return 1;
      const e = Math.pow(10, Math.floor(Math.log10(v)));
      const f = v / e;
      const n = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
      return n * e;
    }
  };
  SG.u = u;
  SG.graphs = [];
  const add = (g) => SG.graphs.push(g);
  /* '한 번에 조절'용: 여러 칸의 합을 target으로 맞춘다.
     기존 비율대로 늘리거나 줄이고, 합이 0이면 똑같이 나눈다. 반올림 오차는 가장 큰 칸에서 보정 */
  function fillTo(vals, target, digits = 0) {
    const f = Math.pow(10, digits), sum = u.sum(vals);
    const raw = sum > 0 ? vals.map((v) => (v * target) / sum) : vals.map(() => target / vals.length);
    const out = raw.map((v) => Math.round(v * f) / f);
    const diff = Math.round((target - u.sum(out)) * f) / f;
    if (diff !== 0 && out.length) { const k = out.indexOf(Math.max(...out)); out[k] = Math.round((out[k] + diff) * f) / f; }
    return out;
  }
  /* 개념 설명: [용어, 짧은 설명, 작은 그림(선택)] 목록을 카드로 만든다.
     설명 안에서 <mark>…</mark>로 감싼 부분은 형광펜처럼 강조된다. note는 화면 안내(점선 상자) */
  const CHEVRON = `<svg class="concept-chev" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>`;
  const K = (items, note) =>
    `<ul class="concepts">${items.map(([t, d, fig]) =>
      `<li><details><summary><h3>${t}</h3>${CHEVRON}</summary>` +
      `<div class="concept-body">${fig ? `<div class="concept-fig">${fig}</div>` : ""}<p>${d}</p></div></details></li>`).join("")}</ul>` +
    (note ? `<p class="note">${note}</p>` : "");

  /* ---------- 개념 카드용 작은 그림 (80 × 56) ---------- */
  const mini = (body) => `<svg viewBox="0 0 80 56" width="80" height="56" aria-hidden="true" font-family="${FONT}">${body}</svg>`;
  const R = (x, y, w, h, fill) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/>`;
  const Ln = (x1, y1, x2, y2, c, w = 2, dash) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${c}" stroke-width="${w}"${dash ? ` stroke-dasharray="${dash}"` : ""} stroke-linecap="round"/>`;
  const Tx = (x, y, s, c = C.muted, a = "middle", size = 9) => `<text x="${x}" y="${y}" font-size="${size}" font-weight="600" fill="${c}" text-anchor="${a}">${s}</text>`;
  const Dot = (x, y, c, r = 3.5) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/>`;
  const Ar = (x1, y1, x2, y2, c, w = 2) => {
    const a = Math.atan2(y2 - y1, x2 - x1), s = 6;
    const p = (d) => `${(x2 - s * Math.cos(a + d)).toFixed(1)},${(y2 - s * Math.sin(a + d)).toFixed(1)}`;
    return Ln(x1, y1, x2 - 3 * Math.cos(a), y2 - 3 * Math.sin(a), c, w) + `<path d="M${x2},${y2} L${p(0.5)} L${p(-0.5)} Z" fill="${c}"/>`;
  };
  const layers = (ws) => ws.map((w, i) => R(40 - w / 2, 5 + i * 16, w, 14, [C.main, C.accent, "#A9C6E6"][i])).join("");
  const axes = Ln(10, 4, 10, 50, C.axis, 1.5) + Ln(10, 50, 76, 50, C.axis, 1.5);
  const pyr = (ws) => ws.map((w, i) => R(39 - w, 44 - i * 9.5, w, 8, C.male) + R(41, 44 - i * 9.5, w, 8, C.rose)).join("");
  const levels = [14, 28, 42].map((y) => Ln(6, y, 74, y, C.grid, 1)).join("");
  const box = Ln(14, 4, 14, 50, C.axis, 1.5) + Ln(14, 50, 60, 50, C.axis, 1.5);
  const lorenzPts = "14,50 23,48 32,45 41,40 50,31 60,4";
  const FIG = {
    strataBase: mini(layers([60, 60, 60]) + Tx(40, 15, "상", "#fff") + Tx(40, 31, "중", "#fff") + Tx(40, 47, "하", C.text)),
    strataShape: mini(layers([22, 62, 40]) + Tx(76, 30, "%", C.muted, "end", 10)),
    pyramid: mini(layers([16, 40, 72])),
    diamond: mini(layers([22, 70, 26])),
    hourglass: mini(layers([48, 14, 62])),
    mobility: mini(levels + Ar(28, 44, 28, 10, C.green, 2.5) + Ar(52, 10, 52, 44, C.red, 2.5)),
    between: mini(levels + Dot(14, 42, C.main) + Dot(66, 14, C.main) + Ar(18, 40, 62, 16, C.green) + Tx(14, 54, "부모") + Tx(66, 54, "자녀")),
    within: mini(levels + `<polyline points="10,42 26,42 30,28 48,28 52,14 68,14" fill="none" stroke="${C.green}" stroke-width="2.5" stroke-linejoin="round"/>` + Dot(10, 42, C.main) + Dot(68, 14, C.main) + Tx(40, 54, "한 사람의 일생")),
    reproduce: mini(levels + Dot(14, 28, C.main) + Dot(66, 28, C.main) + Ar(18, 28, 62, 28, "#8C97A3", 2.5) + Tx(14, 44, "부모") + Tx(66, 44, "자녀")),
    openClosed: mini(Ar(6, 12, 32, 38, C.green) + Ar(6, 38, 32, 12, C.red) + Tx(19, 52, "개방") + Ln(40, 4, 40, 44, C.grid, 1) + Ar(48, 14, 74, 14, "#8C97A3") + Ar(48, 34, 74, 34, "#8C97A3") + Tx(61, 52, "폐쇄")),
    laws: mini(axes + Ln(14, 8, 72, 46, C.blue, 2.5) + Ln(14, 46, 72, 8, C.orange, 2.5) + Tx(74, 44, "D", C.blue, "end") + Tx(74, 14, "S", C.orange, "end")),
    qdChange: mini(axes + Ln(14, 8, 72, 46, C.blue, 2.5) + Dot(26, 16, C.main) + Ar(29, 18, 54, 34, C.main, 1.5) + Dot(57, 36, C.main) + Tx(50, 14, "곡선 위 이동", C.main, "middle", 8)),
    dChange: mini(axes + Ln(12, 10, 50, 46, C.base, 2, "4 3") + Ln(30, 8, 72, 46, C.blue, 2.5) + Ar(30, 30, 50, 30, C.main, 2) + Tx(46, 12, "곡선 이동", C.main, "start", 8)),
    qsChange: mini(axes + Ln(14, 46, 72, 8, C.orange, 2.5) + Dot(26, 38, C.main) + Ar(29, 36, 54, 20, C.main, 1.5) + Dot(57, 18, C.main) + Tx(40, 12, "곡선 위 이동", C.main, "middle", 8)),
    sChange: mini(axes + Ln(12, 46, 50, 10, C.base, 2, "4 3") + Ln(30, 46, 72, 8, C.orange, 2.5) + Ar(30, 30, 50, 30, C.main, 2) + Tx(76, 46, "곡선 이동", C.main, "end", 8)),
    equilibrium: mini(axes + Ln(14, 8, 72, 46, C.blue, 2) + Ln(14, 46, 72, 8, C.orange, 2) + Ln(10, 27, 43, 27, C.main, 1, "2 2") + Ln(43, 27, 43, 50, C.main, 1, "2 2") + Dot(43, 27, C.main, 4) + Tx(49, 24, "E", C.main, "start", 10)),
    popBase: mini(pyr([30, 25, 19, 13, 7]) + Tx(10, 8, "남", C.male, "middle", 9) + Tx(70, 8, "여", C.rose, "middle", 9)),
    popPyramid: mini(pyr([32, 25, 18, 11, 5])),
    popBell: mini(pyr([24, 24, 23, 19, 11])),
    popPot: mini(pyr([13, 19, 24, 22, 14])),
    ages: mini(R(4, 16, 16, 16, "#A9C6E6") + R(20, 16, 42, 16, C.main) + R(62, 16, 14, 16, C.rose) + Tx(12, 44, "0~14") + Tx(41, 44, "15~64") + Tx(69, 44, "65+")),
    aging: mini(R(6, 20, 20, 12, C.sub) + R(26, 20, 20, 12, "#A9C6E6") + R(46, 20, 17, 12, C.accent) + R(63, 20, 13, 12, C.main) + [[26, "7"], [46, "14"], [63, "20"]].map(([x, s]) => Ln(x, 16, x, 36, C.text, 1.5) + Tx(x, 46, s + "%", C.text)).join("")),
    lorenzCurve: mini(box + Ln(14, 50, 60, 4, C.muted, 1.5, "3 3") + `<polyline points="${lorenzPts}" fill="none" stroke="${C.purple}" stroke-width="2.5" stroke-linejoin="round"/>`),
    equalityLine: mini(box + Ln(14, 50, 60, 4, C.text, 2.5) + Tx(26, 16, "평등", C.text, "middle", 9)),
    gini: mini(box + `<polygon points="${lorenzPts}" fill="${C.purple}" fill-opacity="0.25"/>` + Ln(14, 50, 60, 4, C.muted, 1.5, "3 3") + `<polyline points="${lorenzPts}" fill="none" stroke="${C.purple}" stroke-width="2"/>` + Tx(38, 34, "A", C.purple, "middle", 11) + Tx(54, 46, "B", C.muted, "middle", 11)),
    quintile: mini(R(14, 36, 16, 10, C.accent) + R(48, 4, 16, 42, C.main) + Ln(8, 46, 72, 46, C.axis, 1.5) + Tx(22, 55, "하위") + Tx(56, 55, "상위") + Tx(39, 30, "÷", C.text, "middle", 12)),
    climateGraph: mini([10, 12, 18, 24, 28, 34, 44, 40, 30, 20, 14, 10].map((h, i) => R(6 + i * 6, 50 - h, 4, h, C.accent)).join("") + `<polyline points="${[40, 38, 32, 26, 20, 16, 12, 11, 17, 24, 32, 38].map((y, i) => `${8 + i * 6},${y}`).join(" ")}" fill="none" stroke="${C.red}" stroke-width="2"/>`),
    range: mini(`<polyline points="${[44, 42, 36, 28, 20, 14, 10, 10, 16, 26, 36, 42].map((y, i) => `${6 + i * 5.2},${y}`).join(" ")}" fill="none" stroke="${C.red}" stroke-width="2"/>` + Dot(37.2, 10, C.red, 3) + Dot(6, 44, C.red, 3) + Ln(62, 10, 74, 10, C.text, 1, "2 2") + Ln(62, 44, 74, 44, C.text, 1, "2 2") + Ar(70, 27, 70, 12, C.text, 1.5) + Ar(70, 27, 70, 42, C.text, 1.5)),
    seasonal: mini([6, 6, 8, 10, 14, 30, 44, 40, 18, 10, 6, 6].map((h, i) => R(6 + i * 6, 46 - h, 4, h, i >= 5 && i <= 7 ? C.main : "#C8D9EC")).join("") + Ln(4, 46, 76, 46, C.axis, 1) + Tx(45, 54, "여름 집중", C.main, "middle", 8))
  };
  /* 계산식: 한 줄에 하나씩 */
  const F = (lines) => `<ul class="formula">${lines.map(([name, expr]) => `<li><span>${name}</span><code>${expr}</code></li>`).join("")}</ul>`;
  const CLASS3 = ["상층", "중층", "하층"];

  /* =========================================================
     6-1. 사회 계층 구조
     ========================================================= */
  const STRATA_TYPES = {
    pyramid: {
      name: "피라미드형",
      text: "상층이 가장 적고 하층이 가장 많은 구조예요. 소수의 상층이 부와 권력을 차지하는 형태로, 신분제가 있던 전근대 사회나 산업화 초기 사회에서 주로 나타나요. 계층 간 불평등과 갈등이 생기기 쉬워요."
    },
    diamond: {
      name: "다이아몬드형",
      text: "중층의 비율이 가장 높고 상층과 하층은 상대적으로 적은 구조예요. 산업화 이후 중산층이 늘어난 현대 사회에서 나타나며, 두터운 중층이 계층 간 갈등을 완화해 사회가 비교적 안정적이에요."
    },
    inverted: {
      name: "역피라미드형",
      text: "상층의 비율이 가장 높고 하층이 가장 적은 구조예요. 현실에서는 찾아보기 어려운 형태로, 사회 구성원 대부분이 높은 지위를 누리는 가설적인 구조로 설명되곤 해요."
    },
    hourglass: {
      name: "모래시계형",
      text: "중층이 가장 적고 상층과 하층이 상대적으로 많은 구조예요. 중층이 줄어 계층 양극화가 심해진 사회에서 나타나며, 계층 간 갈등이 커지고 사회 통합이 어려워질 수 있어요."
    },
    other: {
      name: "기타 형태",
      text: "계층 간 비율 차이가 뚜렷하지 않아 교과서의 대표 유형 가운데 하나로 분류하기 어려워요. 억지로 분류하지 않고 기타 형태로 표시했어요."
    }
  };
  /* 세 계층 사이 차이가 3%p 이상일 때만 대소 관계로 인정해 유형을 정한다 */
  function strataType(s) {
    const T = 3, U = s.upper, M = s.middle, L = s.lower;
    if (L - M >= T && M - U >= T) return "pyramid";
    if (U - M >= T && M - L >= T) return "inverted";
    if (M - U >= T && M - L >= T) return "diamond";
    if (U - M >= T && L - M >= T) return "hourglass";
    return "other";
  }

  add({
    id: "strata",
    title: "사회 계층 구조",
    subjects: ["sociology"],
    summary: "상층·중층·하층의 비율에 따라 달라지는 계층 구조의 유형과 특징을 살펴봐요.",
    desc: "한 사회의 구성원이 상층, 중층, 하층에 어떤 비율로 분포하는지에 따라 계층 구조의 모양이 달라져요. 상층과 중층 비율을 조절하면 하층 비율은 자동으로 계산되어 합계가 항상 100%로 유지돼요.",
    initial: () => u.clone(SG.data.strata.initial),
    controls: () => ({
      groups: [{
        title: "계층별 인구 비율",
        note: "세 계층의 합은 항상 100%예요. 하층 비율은 100%에서 상층과 중층을 뺀 값으로 자동 계산돼요.",
        items: [
          { key: "upper", label: "상층", min: 0, max: 100, step: 1, unit: "%" },
          { key: "middle", label: "중층", min: 0, max: 100, step: 1, unit: "%" },
          { key: "lower", label: "하층 (자동 계산)", min: 0, max: 100, step: 1, unit: "%", readonly: true }
        ]
      }]
    }),
    normalize(s, key) {
      s.upper = Math.round(s.upper);
      s.middle = Math.round(s.middle);
      let msg = null;
      if (s.upper + s.middle > 100) {
        if (key === "upper") s.upper = 100 - s.middle; else s.middle = 100 - s.upper;
        const name = key === "upper" ? "상층" : "중층";
        msg = `상층과 중층의 합은 100%를 넘을 수 없어요. ${name} 비율을 ${key === "upper" ? s.upper : s.middle}%로 맞췄어요.`;
      }
      s.lower = 100 - s.upper - s.middle;
      return msg;
    },
    compute: (s) => ({ type: strataType(s) }),
    draw(s, res, base) {
      const W = 760, H = 440, top = 40, bh = 104, gap = 10, cx = W / 2;
      const vals = [s.upper, s.middle, s.lower];
      const bvals = base ? [base.upper, base.middle, base.lower] : [];
      const scale = 600 / Math.max(60, ...vals, ...bvals);
      const colors = [C.main, C.accent, "#A9C6E6"];
      const textCol = ["#FFFFFF", "#FFFFFF", C.text];
      let b = "";
      vals.forEach((v, i) => {
        const y = top + i * (bh + gap), w = v * scale;
        b += u.rect(cx - w / 2, y, w, bh, { fill: colors[i] });
        if (base) {
          const bw = bvals[i] * scale;
          b += u.rect(cx - bw / 2, y + 1, bw, bh - 2, { stroke: "#6B7682", width: 2, dash: "7 5" });
        }
        const label = `${CLASS3[i]} ${u.n(v)}%`;
        if (w >= 150) b += u.t(cx, y + bh / 2 + 7, label, { anchor: "middle", size: 22, weight: 700, fill: textCol[i] });
        else b += u.t(cx + Math.max(w, base ? bvals[i] * scale : 0) / 2 + 14, y + bh / 2 + 7, label, { size: 20, weight: 700 });
      });
      b += u.t(cx, H - 14, `계층 구조 유형: ${STRATA_TYPES[res.type].name}`, { anchor: "middle", size: 17, weight: 600, fill: C.main });
      return u.svg(W, H, b);
    },
    legend: (s, r, base) => [
      { label: "상층", color: C.main }, { label: "중층", color: C.accent }, { label: "하층", color: "#A9C6E6" }
    ].concat(base ? [{ label: "비교 기준", color: "#6B7682", dash: true }] : []),
    metrics: (s) => [
      { label: "상층 비율", value: s.upper, digits: 0, unit: "%p" },
      { label: "중층 비율", value: s.middle, digits: 0, unit: "%p" },
      { label: "하층 비율", value: s.lower, digits: 0, unit: "%p" }
    ],
    results(s, res) {
      return `<p class="result-line"><span>세 계층의 합계</span><b>${u.p(s.upper + s.middle + s.lower, 0)}</b></p>
        <p class="result-line"><span>현재 유형</span><b>${STRATA_TYPES[res.type].name}</b></p>`;
    },
    interpret(s, res, base, bres) {
      const out = [`<b>${STRATA_TYPES[res.type].name}</b> — ${STRATA_TYPES[res.type].text}`];
      const largest = [["상층", s.upper], ["중층", s.middle], ["하층", s.lower]].sort((a, b) => b[1] - a[1]);
      if (largest[0][1] - largest[1][1] >= 3) out.push(`가장 많은 계층은 ${largest[0][0]}(${largest[0][1]}%)이에요.`);
      if (s.middle >= 50) out.push(`중층이 전체의 절반 이상(${s.middle}%)을 차지해요.`);
      if (base) {
        const d = s.middle - base.middle;
        if (d !== 0) out.push(`비교 기준보다 중층 비율이 ${Math.abs(d)}%p ${d > 0 ? "늘었어요" : "줄었어요"}.`);
        if (bres.type !== res.type) out.push(`계층 구조가 ${STRATA_TYPES[bres.type].name}에서 ${u.josa(STRATA_TYPES[res.type].name, "으로/로")} 바뀌었어요.`);
      }
      return out;
    },
    concept: K([
      ["사회 계층", "부, 권력, 위신 같은 <mark>사회적 희소가치를 가진 정도</mark>에 따라 구성원이 나뉜 위치", FIG.strataBase],
      ["계층 구조", "각 계층이 <mark>사회 전체에서 차지하는 비율</mark>을 나타낸 모양. 사회의 불평등 정도와 안정성을 짐작할 수 있어요.", FIG.strataShape],
      ["피라미드형", "<mark>하층이 가장 많고 상층이 가장 적음.</mark> 소수가 희소가치를 차지하는 전근대·산업화 초기 사회", FIG.pyramid],
      ["다이아몬드형", "<mark>중층이 가장 많음.</mark> 중산층이 두터워 비교적 안정적인 현대 사회", FIG.diamond],
      ["모래시계형", "<mark>중층이 가장 적음.</mark> 계층 양극화가 심해진 사회", FIG.hourglass]
    ], "세 계층 사이의 차이가 3%p 이상일 때만 크기 차이로 보고 유형을 표시해요. 판단하기 어려우면 '기타 형태'로 표시해요."),
    howto: [
      "예시로 네 가지 대표 유형을 차례로 띄워 모양을 비교해 보세요.",
      "다이아몬드형을 비교 기준으로 저장한 뒤 중층을 줄여 모래시계형으로 바뀌는 과정을 관찰해 보세요.",
      "중층 비율이 줄어들 때 사회에 어떤 변화가 생길지 토의해 보세요."
    ],
    preview: `<svg viewBox="0 0 200 120"><rect x="80" y="14" width="40" height="28" fill="${C.main}"/><rect x="55" y="46" width="90" height="28" fill="${C.accent}"/><rect x="25" y="78" width="150" height="28" fill="#A9C6E6"/></svg>`
  });

  /* =========================================================
     6-2. 사회 계층 이동표
     ========================================================= */
  const MOVE_COLORS = { up: C.green, down: C.red, stay: "#8C97A3" };
  const cellKind = (i, j) => (j < i ? "up" : j > i ? "down" : "stay"); // 0=상층, 2=하층

  function mobilityCompute(s) {
    const m = s.m;
    const row = m.map((r) => u.sum(r));
    const col = [0, 1, 2].map((j) => m[0][j] + m[1][j] + m[2][j]);
    const N = u.sum(row);
    let up = 0, down = 0, stay = 0;
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
      const k = cellKind(i, j);
      if (k === "up") up += m[i][j]; else if (k === "down") down += m[i][j]; else stay += m[i][j];
    }
    const pct = (x, d) => (d > 0 ? (x / d) * 100 : NaN);
    return {
      N, row, col, up, down, stay, move: up + down,
      upR: pct(up, N), downR: pct(down, N), stayR: pct(stay, N), moveR: pct(up + down, N),
      rowR: row.map((x) => pct(x, N)), colR: col.map((x) => pct(x, N)),
      rowStayR: [0, 1, 2].map((i) => pct(m[i][i], row[i]))
    };
  }

  add({
    id: "mobility",
    title: "사회 계층 이동표",
    subjects: ["sociology"],
    summary: "부모 세대와 자녀 세대의 계층을 비교해 세대 간 이동과 계층 재생산을 탐구해요.",
    desc: "행은 부모 세대의 계층, 열은 자녀 세대의 계층이에요. 각 칸에는 '부모가 ○층이고 자녀가 □층인 사람'의 수를 넣어요. 상승 이동, 하강 이동, 계층 유지 인원과 비율이 자동으로 계산돼요.",
    initial: () => u.clone(SG.data.mobility.initial),
    controls: () => ({
      quick: {
        title: "한 번에 조절",
        note: "전체 인원은 그대로 두고 여러 칸을 함께 바꿔요. 칸 하나하나는 아래 '세부 조절'에서 바꿀 수 있어요.",
        items: [
          { key: "q.stay", label: "계층 유지 비율", min: 0, max: 100, step: 1, unit: "%" },
          { key: "q.up", label: "이동한 사람 중 상승 이동", min: 0, max: 100, step: 1, unit: "%" }
        ]
      },
      groups: [0, 1, 2].map((i) => ({
        title: `부모 세대 ${CLASS3[i]}`,
        items: [0, 1, 2].map((j) => {
          const k = cellKind(i, j);
          return {
            key: `m.${i}.${j}`, label: `자녀 ${CLASS3[j]}`, min: 0, max: 500, step: 1, unit: "명",
            tag: { up: "상승", down: "하강", stay: "유지" }[k], tagClass: k
          };
        })
      })),
      note: "칸 색깔: 초록 = 상승 이동, 빨강 = 하강 이동, 회색 = 계층 유지"
    }),
    /* 한 번에 조절: 계층 유지 비율, 이동한 사람 중 상승 이동 비율 */
    get(s, key) {
      const r = mobilityCompute(s);
      if (key === "q.stay") return r.N > 0 ? r.stayR : 0;
      return r.move > 0 ? (r.up / r.move) * 100 : 0;
    },
    set(s, key, v) {
      const r = mobilityCompute(s);
      const cells = (kind) => { const out = []; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) if (cellKind(i, j) === kind) out.push([i, j]); return out; };
      const put = (cs, target) => fillTo(cs.map(([i, j]) => s.m[i][j]), target).forEach((x, k) => (s.m[cs[k][0]][cs[k][1]] = x));
      if (key === "q.stay") {
        const D = Math.round((r.N * v) / 100), mv = r.N - D;
        const U = Math.round(r.move > 0 ? (mv * r.up) / r.move : mv / 2);
        put(cells("stay"), D); put(cells("up"), U); put(cells("down"), mv - U);
      } else {
        const U = Math.round((r.move * v) / 100);
        put(cells("up"), U); put(cells("down"), r.move - U);
      }
    },
    normalize(s, key) {
      if (/^q\./.test(key)) return mobilityCompute(s).N === 0 ? "전체 인원이 0명이라 비율을 바꿀 수 없어요. 세부 조절에서 인원을 먼저 넣어 주세요." : null;
      const [, i, j] = key.split(".").map(Number);
      s.m[i][j] = Math.round(s.m[i][j]);
      return null;
    },
    compute: mobilityCompute,
    draw(s, r, base, br) {
      const W = 760, H = 560;
      let b = "";
      b += u.t(258, 30, "부모 세대", { anchor: "end", size: 17, weight: 700, fill: C.main });
      b += u.t(494, 30, "자녀 세대", { anchor: "start", size: 17, weight: 700, fill: C.main });
      if (r.N === 0) {
        b += u.t(W / 2, 200, "인원을 입력하면 이동 흐름이 나타나요.", { anchor: "middle", size: 18, fill: C.muted });
        return u.svg(W, H, b);
      }
      const top = 48, avail = 330, gap = 18, nodeW = 16;
      const usable = avail - gap * 2;
      const scale = usable / r.N;
      const lx = 250, rx = 494;
      const ly = [], ry = [];
      let y = top;
      for (let i = 0; i < 3; i++) { ly.push(y); y += r.row[i] * scale + gap; }
      y = top;
      for (let j = 0; j < 3; j++) { ry.push(y); y += r.col[j] * scale + gap; }
      const outOff = [0, 0, 0], inOff = [0, 0, 0];
      // 흐름 (출발 계층 순서 → 도착 계층 순서로 쌓아 교차를 줄임)
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          const v = s.m[i][j];
          if (v <= 0) continue;
          const h = v * scale;
          const y0 = ly[i] + outOff[i], y1 = ry[j] + inOff[j];
          outOff[i] += h; inOff[j] += h;
          const x0 = lx + nodeW, x1 = rx, xm = (x0 + x1) / 2;
          b += `<path d="M${x0},${y0} C${xm},${y0} ${xm},${y1} ${x1},${y1} L${x1},${y1 + h} C${xm},${y1 + h} ${xm},${y0 + h} ${x0},${y0 + h} Z" fill="${MOVE_COLORS[cellKind(i, j)]}" fill-opacity="0.45"/>`;
        }
      }
      for (let i = 0; i < 3; i++) {
        const h = r.row[i] * scale;
        b += u.rect(lx, ly[i], nodeW, h, { fill: C.main });
        b += u.t(lx - 12, ly[i] + h / 2 - 3, CLASS3[i], { anchor: "end", size: 17, weight: 700 });
        b += u.t(lx - 12, ly[i] + h / 2 + 17, `${u.n(r.row[i])}명 (${u.p(r.rowR[i])})`, { anchor: "end", size: 14, fill: C.muted });
      }
      for (let j = 0; j < 3; j++) {
        const h = r.col[j] * scale;
        b += u.rect(rx, ry[j], nodeW, h, { fill: C.main });
        b += u.t(rx + nodeW + 12, ry[j] + h / 2 - 3, CLASS3[j], { size: 17, weight: 700 });
        b += u.t(rx + nodeW + 12, ry[j] + h / 2 + 17, `${u.n(r.col[j])}명 (${u.p(r.colR[j])})`, { size: 14, fill: C.muted });
      }
      // 아래: 상승·하강·유지 비율 막대 (비교 기준과 나란히)
      const by = 418, bx = 200, bwMax = 440;
      b += u.line(40, by - 22, W - 40, by - 22, { stroke: C.grid });
      const rows = [["상승 이동", "upR", "up"], ["하강 이동", "downR", "down"], ["계층 유지", "stayR", "stay"]];
      rows.forEach(([label, key, kind], k) => {
        const yy = by + k * 46;
        b += u.t(bx - 16, yy + 16, label, { anchor: "end", size: 16, weight: 600 });
        if (base && br.N > 0) {
          b += u.rect(bx, yy - 4, (br[key] / 100) * bwMax, 8, { fill: C.base });
          b += u.rect(bx, yy + 8, (r[key] / 100) * bwMax, 18, { fill: MOVE_COLORS[kind] });
        } else {
          b += u.rect(bx, yy + 2, (r[key] / 100) * bwMax, 22, { fill: MOVE_COLORS[kind] });
        }
        b += u.t(bx + (r[key] / 100) * bwMax + 10, yy + 20, u.p(r[key]), { size: 16, weight: 700 });
      });
      b += u.t(bx, H - 8, "비율의 분모: 전체 조사 인원" + (base ? " · 회색 막대: 비교 기준" : ""), { size: 13, fill: C.muted });
      return u.svg(W, H, b);
    },
    legend: (s, r, base) => [
      { label: "상승 이동", color: C.green }, { label: "하강 이동", color: C.red }, { label: "계층 유지", color: "#8C97A3" }
    ].concat(base ? [{ label: "비교 기준", color: C.base }] : []),
    metrics: (s, r) => [
      { label: "전체 인원", value: r.N, digits: 0, unit: "명" },
      { label: "상승 이동 비율", value: r.upR, digits: 1, unit: "%p" },
      { label: "하강 이동 비율", value: r.downR, digits: 1, unit: "%p" },
      { label: "세대 간 이동 비율", value: r.moveR, digits: 1, unit: "%p" },
      { label: "계층 유지 비율", value: r.stayR, digits: 1, unit: "%p" }
    ],
    results(s, r) {
      const cells = (i) => [0, 1, 2].map((j) => `<td class="cell-${cellKind(i, j)}">${u.n(s.m[i][j])}</td>`).join("");
      const N = u.n(r.N);
      return `<table class="data-table mobility-table">
        <thead><tr><th>부모 \\ 자녀</th><th>상층</th><th>중층</th><th>하층</th><th>합계</th></tr></thead>
        <tbody>${[0, 1, 2].map((i) => `<tr><th>${CLASS3[i]}</th>${cells(i)}<td class="total">${u.n(r.row[i])}</td></tr>`).join("")}
        <tr class="sum"><th>합계</th>${r.col.map((c) => `<td>${u.n(c)}</td>`).join("")}<td>${N}</td></tr></tbody></table>
        <dl class="calc-list">
          <div><dt>전체 조사 인원</dt><dd>${N}명</dd></div>
          <div><dt>부모 세대 계층 비율 <small>분모: 전체 ${N}명</small></dt><dd>상층 ${u.p(r.rowR[0])} · 중층 ${u.p(r.rowR[1])} · 하층 ${u.p(r.rowR[2])}</dd></div>
          <div><dt>자녀 세대 계층 비율 <small>분모: 전체 ${N}명</small></dt><dd>상층 ${u.p(r.colR[0])} · 중층 ${u.p(r.colR[1])} · 하층 ${u.p(r.colR[2])}</dd></div>
          <div><dt>상승 이동 <small>분모: 전체 ${N}명</small></dt><dd>${u.n(r.up)}명 (${u.p(r.upR)})</dd></div>
          <div><dt>하강 이동 <small>분모: 전체 ${N}명</small></dt><dd>${u.n(r.down)}명 (${u.p(r.downR)})</dd></div>
          <div><dt>세대 간 이동 (상승 + 하강) <small>분모: 전체 ${N}명</small></dt><dd>${u.n(r.move)}명 (${u.p(r.moveR)})</dd></div>
          <div><dt>계층 유지 <small>분모: 전체 ${N}명</small></dt><dd>${u.n(r.stay)}명 (${u.p(r.stayR)})</dd></div>
          <div><dt>부모 계층별 유지 비율 <small>분모: 해당 부모 계층 인원</small></dt><dd>상층 ${u.p(r.rowStayR[0])} · 중층 ${u.p(r.rowStayR[1])} · 하층 ${u.p(r.rowStayR[2])}</dd></div>
        </dl>`;
    },
    interpret(s, r, base, br) {
      if (r.N === 0) return ["표에 인원을 입력해 주세요."];
      const out = [];
      if (r.stayR >= 60) out.push(`계층 유지 비율이 ${u.p(r.stayR)}로 높아요. 부모의 계층이 자녀에게 이어지는 <b>계층 재생산</b> 경향이 강한, 비교적 <b>폐쇄적인</b> 계층 구조에 가까워요.`);
      else if (r.moveR >= 50) out.push(`세대 간 이동 비율이 ${u.p(r.moveR)}로 절반 이상이에요. 부모와 다른 계층으로 이동한 사람이 많은, 비교적 <b>개방적인</b> 계층 구조에 가까워요.`);
      else out.push(`세대 간 이동 비율은 ${u.p(r.moveR)}, 계층 유지 비율은 ${u.p(r.stayR)}예요.`);
      if (r.up > r.down) out.push(`상승 이동(${u.p(r.upR)})이 하강 이동(${u.p(r.downR)})보다 많아요.`);
      else if (r.down > r.up) out.push(`하강 이동(${u.p(r.downR)})이 상승 이동(${u.p(r.upR)})보다 많아요.`);
      else out.push("상승 이동과 하강 이동의 인원이 같아요.");
      const parentMid = r.rowR[1], childMid = r.colR[1];
      const dm = childMid - parentMid;
      if (Math.abs(dm) >= 1) out.push(`중층의 비율이 부모 세대 ${u.p(parentMid)}에서 자녀 세대 ${u.p(childMid)}로 ${dm > 0 ? "늘었어요" : "줄었어요"}.`);
      if (r.rowStayR[2] >= 60) out.push(`부모가 하층인 사람 중 ${u.p(r.rowStayR[2])}가 자녀 세대에서도 하층이에요.`);
      if (base && br.N > 0) {
        const d = r.moveR - br.moveR;
        if (Math.abs(d) >= 0.05) out.push(`비교 기준보다 세대 간 이동 비율이 ${u.n(Math.abs(d), 1)}%p ${d > 0 ? "높아졌어요" : "낮아졌어요"}.`);
      }
      return out;
    },
    concept: K([
      ["사회 이동", "개인이나 집단의 <mark>계층적 위치가 바뀌는 것.</mark> 위로 가면 상승 이동, 아래로 가면 하강 이동", FIG.mobility],
      ["세대 간 이동", "<mark>부모와 자녀 세대 사이</mark>에서 계층이 달라지는 것 (이 표가 다루는 이동)", FIG.between],
      ["세대 내 이동", "<mark>한 사람의 일생 동안</mark> 계층이 바뀌는 것", FIG.within],
      ["계층 재생산", "부모의 계층이 자녀에게 <mark>그대로 이어지는</mark> 현상", FIG.reproduce],
      ["개방적 · 폐쇄적 구조", "<mark>이동 비율이 높으면 개방적</mark>, <mark>유지 비율이 높으면 폐쇄적</mark> 계층 구조에 가까워요.", FIG.openClosed]
    ], "표 읽는 법: 대각선 칸 = 계층 유지, 대각선 왼쪽 아래 = 상승 이동, 오른쪽 위 = 하강 이동"),
    howto: [
      "'계층 유지가 많은 사회'와 '계층 이동이 활발한 사회' 예시를 번갈아 띄우고 흐름 굵기를 비교해 보세요.",
      "각 비율의 분모가 '전체 인원'인지 '해당 부모 계층 인원'인지 확인하며 문제를 풀어 보세요.",
      "한 칸의 인원만 바꿨을 때 어떤 비율이 함께 변하는지 관찰해 보세요."
    ],
    preview: `<svg viewBox="0 0 200 120"><rect x="40" y="14" width="8" height="26" fill="${C.main}"/><rect x="40" y="46" width="8" height="34" fill="${C.main}"/><rect x="40" y="86" width="8" height="22" fill="${C.main}"/><rect x="152" y="14" width="8" height="30" fill="${C.main}"/><rect x="152" y="50" width="8" height="36" fill="${C.main}"/><rect x="152" y="92" width="8" height="16" fill="${C.main}"/><path d="M48,14 C100,14 100,14 152,14 L152,34 C100,34 100,40 48,40Z" fill="${C.green}" fill-opacity=".45"/><path d="M48,50 C100,50 100,56 152,56 L152,80 C100,80 100,74 48,74Z" fill="#8C97A3" fill-opacity=".45"/><path d="M48,88 C100,88 100,96 152,96 L152,106 C100,106 100,104 48,104Z" fill="${C.red}" fill-opacity=".45"/></svg>`
  });

  /* =========================================================
     6-3. 수요와 공급 곡선
     수요: Qd = A − P,  공급: Qs = (B − 100) + P
     균형: A − P = (B − 100) + P  →  P* = (A − B + 100) / 2,  Q* = (A + B − 100) / 2
     ========================================================= */
  const marketEq = (A, B) => ({ P: (A - B + 100) / 2, Q: (A + B - 100) / 2 });
  const PU = () => SG.data.market.priceUnit;

  add({
    id: "market",
    title: "수요와 공급 곡선",
    subjects: ["economics"],
    summary: "수요와 공급이 변할 때 곡선이 이동하고 균형가격과 균형거래량이 바뀌는 과정을 관찰해요.",
    desc: "수요 수준과 공급 수준을 바꾸면 수요 곡선과 공급 곡선이 좌우로 이동하고, 두 곡선이 만나는 균형점이 새로 정해져요. 기준값은 둘 다 100이에요.",
    initial: () => u.clone(SG.data.market.initial),
    controls: () => ({
      groups: [{
        title: "곡선 이동",
        note: "값을 키우면 곡선이 오른쪽으로(증가), 줄이면 왼쪽으로(감소) 이동해요. 가격이 아닌 요인의 변화를 뜻해요.",
        items: [
          { key: "demand", label: "수요 수준", min: 60, max: 140, step: 1, unit: "" },
          { key: "supply", label: "공급 수준", min: 60, max: 140, step: 1, unit: "" }
        ]
      }]
    }),
    normalize(s) { s.demand = Math.round(s.demand); s.supply = Math.round(s.supply); return null; },
    compute: (s) => marketEq(s.demand, s.supply),
    draw(s, r, base, br) {
      const W = 760, H = 520, x0 = 92, x1 = 720, y0 = 30, y1 = 450;
      const X = (q) => x0 + (q / 100) * (x1 - x0);
      const Y = (p) => y1 - (p / 100) * (y1 - y0);
      let b = "";
      for (let k = 0; k <= 100; k += 20) {
        b += u.line(X(k), y0, X(k), y1, { stroke: C.grid });
        b += u.line(x0, Y(k), x1, Y(k), { stroke: C.grid });
        b += u.t(X(k), y1 + 24, u.n(k), { anchor: "middle", size: 14, fill: C.muted });
        b += u.t(x0 - 10, Y(k) + 5, u.n(k * PU()), { anchor: "end", size: 14, fill: C.muted });
      }
      b += u.line(x0, y0, x0, y1, { stroke: C.text, width: 1.5 }) + u.line(x0, y1, x1, y1, { stroke: C.text, width: 1.5 });
      b += u.t((x0 + x1) / 2, H - 14, "수량 Q (개)", { anchor: "middle", size: 15, weight: 600 });
      b += `<text transform="translate(22 ${(y0 + y1) / 2}) rotate(-90)" fill="${C.text}" font-size="15" font-weight="600" text-anchor="middle">가격 P (원)</text>`;
      // 선분: 그래프 영역(0~100) 안의 부분만 그린다
      const dSeg = (A) => { const pa = Math.max(0, A - 100), pb = Math.min(100, A); return [[A - pa, pa], [A - pb, pb]]; };
      const sSeg = (B) => { const pa = Math.max(0, 100 - B), pb = Math.min(100, 200 - B); return [[B - 100 + pa, pa], [B - 100 + pb, pb]]; };
      const seg = (pts, color, o = {}) => u.line(X(pts[0][0]), Y(pts[0][1]), X(pts[1][0]), Y(pts[1][1]), { stroke: color, width: o.width || 3.5, dash: o.dash });
      const endLabel = (pts, txt, color, which) => {
        const pt = pts[which];
        return u.t(X(pt[0]) + 8, Y(pt[1]) + (which === 1 ? 16 : -8), txt, { size: 17, weight: 700, fill: color });
      };
      if (base) {
        b += seg(dSeg(base.demand), C.base, { width: 2.5, dash: "8 6" }) + seg(sSeg(base.supply), C.base, { width: 2.5, dash: "8 6" });
        b += `<circle cx="${X(br.Q)}" cy="${Y(br.P)}" r="6" fill="#FFFFFF" stroke="${C.base}" stroke-width="2.5"/>`;
        b += u.t(X(br.Q) - 10, Y(br.P) - 12, "E₀", { anchor: "end", size: 15, weight: 700, fill: C.muted });
        // 곡선 이동 방향 화살표
        const arrow = (qa, qb, p, color) => {
          if (Math.abs(qb - qa) < 3 || qa < 2 || qb < 2 || qa > 98 || qb > 98) return "";
          const dir = qb > qa ? 1 : -1, ya = Y(p);
          return u.line(X(qa) + dir * 6, ya, X(qb) - dir * 10, ya, { stroke: color, width: 2 }) +
            `<path d="M${X(qb) - dir * 2},${ya} l${-dir * 10},-6 l0,12 Z" fill="${color}"/>`;
        };
        b += arrow(base.demand - 80, s.demand - 80, 80, C.blue);
        b += arrow(base.supply - 100 + 20, s.supply - 100 + 20, 20, C.orange);
      }
      const dp = dSeg(s.demand), sp = sSeg(s.supply);
      b += seg(dp, C.blue) + seg(sp, C.orange);
      b += endLabel(dp, "D", C.blue, 0) + endLabel(sp, "S", C.orange, 1);
      // 균형점과 보조선
      b += u.line(x0, Y(r.P), X(r.Q), Y(r.P), { stroke: C.main, dash: "4 4", width: 1.5 });
      b += u.line(X(r.Q), Y(r.P), X(r.Q), y1, { stroke: C.main, dash: "4 4", width: 1.5 });
      b += `<circle cx="${X(r.Q)}" cy="${Y(r.P)}" r="7" fill="${C.main}"/>`;
      const lx = X(r.Q) + 14, alignEnd = r.Q > 70;
      b += u.t(alignEnd ? X(r.Q) - 14 : lx, Y(r.P) - 14, `E (${u.n(r.P * PU())}원, ${u.n(r.Q, r.Q % 1 ? 1 : 0)}개)`, { size: 16, weight: 700, fill: C.main, anchor: alignEnd ? "end" : "start" });
      return u.svg(W, H, b);
    },
    legend: (s, r, base) => [
      { label: "수요 곡선 D", color: C.blue }, { label: "공급 곡선 S", color: C.orange }, { label: "균형점 E", color: C.main }
    ].concat(base ? [{ label: "비교 기준 곡선 · E₀", color: C.base, dash: true }] : []),
    metrics: (s, r) => [
      { label: "균형가격", value: r.P * PU(), digits: 0, unit: "원" },
      { label: "균형거래량", value: r.Q, digits: 1, unit: "개" },
      { label: "수요 수준", value: s.demand, digits: 0, unit: "" },
      { label: "공급 수준", value: s.supply, digits: 0, unit: "" }
    ],
    results(s, r) {
      const A = s.demand, B = s.supply, k = B - 100;
      const sf = k === 0 ? "P" : k > 0 ? `${k} + P` : `P − ${Math.abs(k)}`;
      return `<dl class="calc-list">
        <div><dt>수요 함수</dt><dd>Qd = ${A} − P</dd></div>
        <div><dt>공급 함수</dt><dd>Qs = ${sf}</dd></div>
        <div><dt>균형 조건 Qd = Qs</dt><dd>${A} − P = ${sf} → P = ${u.n(r.P, 1)}</dd></div>
        <div><dt>균형가격</dt><dd><b>${u.n(r.P * PU())}원</b> <small>(그래프 가격 1단위 = ${PU()}원)</small></dd></div>
        <div><dt>균형거래량</dt><dd><b>${u.n(r.Q, 1)}개</b></dd></div>
      </dl>`;
    },
    interpret(s, r, base, br) {
      const ref = base || SG.data.market.initial;
      const refR = base ? br : marketEq(ref.demand, ref.supply);
      const refName = base ? "비교 기준" : "처음 상태(수요 100, 공급 100)";
      const dA = s.demand - ref.demand, dB = s.supply - ref.supply;
      const dP = (r.P - refR.P) * PU(), dQ = r.Q - refR.Q;
      if (dA === 0 && dB === 0) return [`지금은 ${u.josa(refName, "과/와")} 같아요. 수요 수준이나 공급 수준을 바꿔 보세요.`, `균형가격은 ${u.n(r.P * PU())}원, 균형거래량은 ${u.n(r.Q, 1)}개예요.`];
      const out = [];
      if (dA !== 0) out.push(`${refName}보다 <b>수요가 ${dA > 0 ? "증가" : "감소"}</b>해 수요 곡선이 ${dA > 0 ? "오른쪽" : "왼쪽"}으로 이동했어요.`);
      if (dB !== 0) out.push(`${refName}보다 <b>공급이 ${dB > 0 ? "증가" : "감소"}</b>해 공급 곡선이 ${dB > 0 ? "오른쪽" : "왼쪽"}으로 이동했어요.`);
      const pTxt = Math.abs(dP) < 0.5 ? "그대로예요" : `${u.n(Math.abs(dP))}원 ${dP > 0 ? "상승" : "하락"}했어요`;
      const qTxt = Math.abs(dQ) < 0.05 ? "그대로예요" : `${u.n(Math.abs(dQ), 1)}개 ${dQ > 0 ? "증가" : "감소"}했어요`;
      out.push(`그 결과 균형가격은 ${pTxt}. 균형거래량은 ${qTxt}.`);
      if (dA !== 0 && dB === 0) out.push(`이때 공급 곡선은 움직이지 않았어요. 가격이 ${dA > 0 ? "올라" : "내려"} 공급 곡선 위에서 균형점이 이동한 것이므로 <b>공급량이 ${dA > 0 ? "증가" : "감소"}</b>한 것이지, 공급 자체가 변한 것은 아니에요.`);
      if (dB !== 0 && dA === 0) out.push(`이때 수요 곡선은 움직이지 않았어요. 가격이 ${dB > 0 ? "내려" : "올라"} 수요 곡선 위에서 균형점이 이동한 것이므로 <b>수요량이 ${dB > 0 ? "증가" : "감소"}</b>한 것이지, 수요 자체가 변한 것은 아니에요.`);
      if (dA !== 0 && dB !== 0) out.push("수요와 공급이 함께 변하면, 두 곡선이 이동한 방향과 크기에 따라 균형가격과 균형거래량의 변화가 달라져요.");
      return out;
    },
    concept: K([
      ["수요 법칙 · 공급 법칙", "가격이 오르면 <mark>수요량은 줄고</mark>(곡선이 오른쪽 아래로), <mark>공급량은 늘어요</mark>(곡선이 오른쪽 위로).", FIG.laws],
      ["수요량의 변화", "그 상품의 <mark>가격</mark>이 변해 수요 곡선 <mark>위에서</mark> 점이 움직이는 것", FIG.qdChange],
      ["수요의 변화", "소득, 선호, 관련 상품 가격, 소비자 수 등 <mark>가격 이외의 요인</mark>으로 수요 곡선 <mark>자체가 이동</mark>하는 것", FIG.dChange],
      ["공급량의 변화", "그 상품의 <mark>가격</mark>이 변해 공급 곡선 <mark>위에서</mark> 점이 움직이는 것", FIG.qsChange],
      ["공급의 변화", "생산 비용, 기술 수준, 공급자 수 등 <mark>가격 이외의 요인</mark>으로 공급 곡선 <mark>자체가 이동</mark>하는 것", FIG.sChange],
      ["시장 균형", "<mark>수요량 = 공급량</mark>인 점. 이때의 가격이 균형가격, 거래량이 균형거래량", FIG.equilibrium]
    ], "슬라이더는 곡선 자체를 옮기므로 '수요(공급)의 변화'를 나타내요. 곡선은 개념 이해를 위한 직선 모형이에요."),
    howto: [
      "'수요 증가' 예시를 누르면 처음 상태가 비교 기준으로 함께 표시돼요. 점선과 실선의 균형점을 비교해 보세요.",
      "수요가 증가할 때 공급 곡선은 움직이지 않는데 공급량은 늘어나는 이유를 설명해 보세요.",
      "수요와 공급을 동시에 늘려 균형가격이 오르는 경우와 내리는 경우를 각각 만들어 보세요."
    ],
    preview: `<svg viewBox="0 0 200 120"><line x1="30" y1="10" x2="30" y2="108" stroke="${C.axis}"/><line x1="30" y1="108" x2="190" y2="108" stroke="${C.axis}"/><line x1="40" y1="16" x2="176" y2="104" stroke="${C.blue}" stroke-width="3"/><line x1="40" y1="104" x2="176" y2="16" stroke="${C.orange}" stroke-width="3"/><circle cx="108" cy="60" r="5" fill="${C.main}"/></svg>`
  });

  /* =========================================================
     6-4. 인구 피라미드 (내부 5세 단위 17구간, 화면 10세 단위 9구간)
     ========================================================= */
  const BANDS = ["0~9세", "10~19세", "20~29세", "30~39세", "40~49세", "50~59세", "60~69세", "70~79세", "80세 이상"];
  const bandGroups = (b) => (b < 8 ? [2 * b, 2 * b + 1] : [16]);
  const bandVal = (arr, b) => bandGroups(b).reduce((x, g) => x + arr[g], 0);

  function popCompute(s) {
    const tot = (a, from, to) => { let x = 0; for (let g = from; g <= to; g++) x += a[g]; return x; };
    const male = u.sum(s.male), female = u.sum(s.female), total = male + female;
    const youth = tot(s.male, 0, 2) + tot(s.female, 0, 2);      // 0~14세
    const working = tot(s.male, 3, 12) + tot(s.female, 3, 12);  // 15~64세
    const old = tot(s.male, 13, 16) + tot(s.female, 13, 16);    // 65세 이상
    const pct = (x) => (total > 0 ? (x / total) * 100 : NaN);
    return {
      male, female, total, youth, working, old,
      youthR: pct(youth), workingR: pct(working), oldR: pct(old),
      youthDep: working > 0 ? (youth / working) * 100 : NaN,
      oldDep: working > 0 ? (old / working) * 100 : NaN,
      totalDep: working > 0 ? ((youth + old) / working) * 100 : NaN,
      agingIdx: youth > 0 ? (old / youth) * 100 : NaN,
      sexRatio: female > 0 ? (male / female) * 100 : NaN,
      bands: BANDS.map((_, b) => ({ m: bandVal(s.male, b), f: bandVal(s.female, b) }))
    };
  }

  add({
    id: "population",
    title: "인구 피라미드",
    subjects: ["integrated", "geography"],
    summary: "연령대별 인구를 바꾸며 인구 구조의 유형과 고령화 지표를 살펴봐요.",
    desc: "남성은 왼쪽, 여성은 오른쪽에 연령대별 인구를 막대로 나타내요. 유소년·생산연령·고령 인구 비율은 5세 단위 내부 자료로 정확하게 계산해요. (단위: 천 명)",
    initial: () => u.clone(SG.data.population.presets[0].state),
    controls: () => ({
      quick: {
        title: "한 번에 조절",
        note: "생산연령 인구(15~64세)는 그대로 두고, 남녀의 해당 연령대를 기존 모양대로 함께 늘리거나 줄여요.",
        items: [
          { key: "q.youth", label: "유소년 인구 비율 (0~14세)", min: 0, max: 60, step: 0.1, unit: "%" },
          { key: "q.old", label: "고령 인구 비율 (65세 이상)", min: 0, max: 60, step: 0.1, unit: "%" }
        ]
      },
      tabs: [{ id: "m", label: "남성" }, { id: "f", label: "여성" }],
      groups: [
        { tab: "m", title: "남성 연령대별 인구", note: "10세 단위로 조절하면 그 안의 5세 구간은 기존 비율대로 나뉘어요.", items: BANDS.map((name, b) => ({ key: `band.m.${b}`, label: name, min: 0, max: 6000, step: 10, unit: "천 명" })).reverse() },
        { tab: "f", title: "여성 연령대별 인구", note: "10세 단위로 조절하면 그 안의 5세 구간은 기존 비율대로 나뉘어요.", items: BANDS.map((name, b) => ({ key: `band.f.${b}`, label: name, min: 0, max: 6000, step: 10, unit: "천 명" })).reverse() }
      ]
    }),
    get(s, key) {
      if (key === "q.youth" || key === "q.old") {
        const r = popCompute(s), x = key === "q.youth" ? r.youthR : r.oldR;
        return isFinite(x) ? x : 0;
      }
      const [, sex, b] = key.split(".");
      return bandVal(sex === "m" ? s.male : s.female, +b);
    },
    set(s, key, v) {
      if (key === "q.youth" || key === "q.old") {
        /* 생산연령 인구 W는 고정. 목표 비율 y, e를 만족하는 전체 인구 T = W ÷ (1 − y − e) */
        const r = popCompute(s), LIMIT = 90;
        let y = isFinite(r.youthR) ? r.youthR : 0, e = isFinite(r.oldR) ? r.oldR : 0;
        if (key === "q.youth") y = v; else e = v;
        if (y + e > LIMIT) {
          if (key === "q.youth") y = LIMIT - e; else e = LIMIT - y;
          s._msg = `유소년과 고령 인구 비율의 합은 ${LIMIT}%를 넘을 수 없어서 ${u.n(key === "q.youth" ? y : e, 1)}%로 맞췄어요.`;
        }
        if (r.working <= 0) { s._msg = "생산연령 인구가 0이라 비율을 바꿀 수 없어요. 세부 조절에서 인구를 먼저 넣어 주세요."; return; }
        const T = r.working / (1 - (y + e) / 100);
        const put = (from, to, target) => {
          const idx = []; for (let g = from; g <= to; g++) idx.push(g);
          const vals = idx.map((g) => s.male[g]).concat(idx.map((g) => s.female[g]));
          const out = fillTo(vals, Math.round(target));
          idx.forEach((g, k) => { s.male[g] = out[k]; s.female[g] = out[k + idx.length]; });
        };
        put(0, 2, (y / 100) * T);
        put(13, 16, (e / 100) * T);
        return;
      }
      const [, sex, bs] = key.split(".");
      const arr = sex === "m" ? s.male : s.female, gs = bandGroups(+bs);
      v = Math.round(v);
      if (gs.length === 1) { arr[gs[0]] = v; return; }
      const a = arr[gs[0]], c = arr[gs[1]];
      const first = a + c > 0 ? Math.round((v * a) / (a + c)) : Math.round(v / 2);
      arr[gs[0]] = first; arr[gs[1]] = v - first;
    },
    normalize(s) { const m = s._msg || null; delete s._msg; return m; },
    compute: popCompute,
    draw(s, r, base, br) {
      const W = 760, H = 540, top = 52, bottom = 478, cx = W / 2, half = 44, maxW = 300;
      const rows = BANDS.length, rh = (bottom - top) / rows, bh = rh * 0.76;
      let maxV = 0;
      r.bands.forEach((x) => (maxV = Math.max(maxV, x.m, x.f)));
      if (base) br.bands.forEach((x) => (maxV = Math.max(maxV, x.m, x.f)));
      const nm = u.niceMax(maxV || 1);
      const sc = maxW / nm;
      let b = "";
      // 눈금
      [0, 0.5, 1].forEach((f) => {
        const d = f * maxW;
        b += u.line(cx - half - d, top - 6, cx - half - d, bottom, { stroke: C.grid });
        b += u.line(cx + half + d, top - 6, cx + half + d, bottom, { stroke: C.grid });
        b += u.t(cx - half - d, bottom + 22, u.n(nm * f), { anchor: "middle", size: 13, fill: C.muted });
        b += u.t(cx + half + d, bottom + 22, u.n(nm * f), { anchor: "middle", size: 13, fill: C.muted });
      });
      b += u.t(cx - half - maxW / 2, 30, "남성", { anchor: "middle", size: 18, weight: 700, fill: C.male });
      b += u.t(cx + half + maxW / 2, 30, "여성", { anchor: "middle", size: 18, weight: 700, fill: C.rose });
      r.bands.forEach((x, bi) => {
        const y = bottom - (bi + 1) * rh + (rh - bh) / 2;
        const wm = x.m * sc, wf = x.f * sc;
        b += u.rect(cx - half - wm, y, wm, bh, { fill: C.male });
        b += u.rect(cx + half, y, wf, bh, { fill: C.rose });
        if (base) {
          const bm = br.bands[bi].m * sc, bf = br.bands[bi].f * sc;
          b += u.rect(cx - half - bm, y + 1, bm, bh - 2, { stroke: "#4F5964", width: 1.8, dash: "6 4" });
          b += u.rect(cx + half, y + 1, bf, bh - 2, { stroke: "#4F5964", width: 1.8, dash: "6 4" });
        }
        b += u.t(cx, y + bh / 2 + 5, BANDS[bi].replace("세 이상", "+").replace("세", ""), { anchor: "middle", size: 13, weight: 600, fill: C.text });
      });
      b += u.t(cx, H - 10, "인구 (천 명)", { anchor: "middle", size: 14, weight: 600 });
      return u.svg(W, H, b);
    },
    legend: (s, r, base) => [{ label: "남성", color: C.male }, { label: "여성", color: C.rose }].concat(base ? [{ label: "비교 기준", color: "#4F5964", dash: true }] : []),
    metrics: (s, r) => [
      { label: "총인구", value: r.total, digits: 0, unit: "천 명" },
      { label: "유소년 인구 비율", value: r.youthR, digits: 1, unit: "%p" },
      { label: "생산연령인구 비율", value: r.workingR, digits: 1, unit: "%p" },
      { label: "고령 인구 비율", value: r.oldR, digits: 1, unit: "%p" },
      { label: "노령화 지수", value: r.agingIdx, digits: 1, unit: "" }
    ],
    results(s, r) {
      const rows = r.bands.map((x, i) => `<tr><td>${BANDS[i]}</td><td>${u.n(x.m)}</td><td>${u.n(x.f)}</td><td>${u.n(x.m + x.f)}</td><td>${u.p(r.total ? ((x.m + x.f) / r.total) * 100 : NaN)}</td></tr>`).reverse().join("");
      return `<table class="data-table"><thead><tr><th>연령대</th><th>남성</th><th>여성</th><th>합계</th><th>비율</th></tr></thead>
        <tbody>${rows}<tr class="sum"><td>합계</td><td>${u.n(r.male)}</td><td>${u.n(r.female)}</td><td>${u.n(r.total)}</td><td>100%</td></tr></tbody></table>
        <p class="small muted">단위: 천 명</p>
        <dl class="calc-list">
          <div><dt>유소년 인구 (0~14세) <small>분모: 총인구</small></dt><dd>${u.n(r.youth)}천 명 (${u.p(r.youthR)})</dd></div>
          <div><dt>생산연령인구 (15~64세) <small>분모: 총인구</small></dt><dd>${u.n(r.working)}천 명 (${u.p(r.workingR)})</dd></div>
          <div><dt>고령 인구 (65세 이상) <small>분모: 총인구</small></dt><dd>${u.n(r.old)}천 명 (${u.p(r.oldR)})</dd></div>
          <div><dt>총부양비 <small>(유소년+고령) ÷ 생산연령 × 100</small></dt><dd>${u.n(r.totalDep, 1)}</dd></div>
          <div><dt>유소년 부양비 · 노년 부양비</dt><dd>${u.n(r.youthDep, 1)} · ${u.n(r.oldDep, 1)}</dd></div>
          <div><dt>노령화 지수 <small>고령 ÷ 유소년 × 100</small></dt><dd>${u.n(r.agingIdx, 1)}</dd></div>
          <div><dt>성비 <small>여성 100명당 남성</small></dt><dd>${u.n(r.sexRatio, 1)}</dd></div>
        </dl>`;
    },
    interpret(s, r, base, br) {
      if (!r.total) return ["인구를 입력해 주세요."];
      const out = [];
      if (r.youthR >= 30 && r.oldR < 7) out.push(`유소년 인구 비율(${u.p(r.youthR)})이 높고 고령 인구 비율(${u.p(r.oldR)})이 낮아 <b>피라미드형</b>에 가까운 특징을 보여요. 출생률과 사망률이 모두 높은 개발도상국에서 흔한 구조예요.`);
      else if (r.oldR >= 14 && r.youthR < r.oldR) out.push(`고령 인구 비율(${u.p(r.oldR)})이 유소년 인구 비율(${u.p(r.youthR)})보다 높아 <b>항아리형</b>에 가까운 특징을 보여요. 출생률이 낮아 유소년층이 줄어드는 구조로, 앞으로 인구가 감소할 가능성이 있어요.`);
      else if (r.youthR >= 15 && r.youthR < 30 && r.oldR >= 7 && r.oldR < 20) out.push(`유소년·고령 인구 비율의 차이가 크지 않아 <b>종형</b>에 가까운 특징을 보여요. 출생률과 사망률이 모두 낮아 인구 증가가 정체된 구조예요.`);
      else out.push(`유소년 인구 비율 ${u.p(r.youthR)}, 고령 인구 비율 ${u.p(r.oldR)}예요. 대표 유형 중 하나로 단정하기 어려운 구조예요.`);
      if (r.oldR >= 20) out.push(`고령 인구 비율이 20% 이상으로, 국제 연합(UN) 기준 <b>초고령 사회</b>에 해당하는 수준이에요.`);
      else if (r.oldR >= 14) out.push(`고령 인구 비율이 14% 이상 20% 미만으로, UN 기준 <b>고령 사회</b>에 해당하는 수준이에요.`);
      else if (r.oldR >= 7) out.push(`고령 인구 비율이 7% 이상 14% 미만으로, UN 기준 <b>고령화 사회</b>에 해당하는 수준이에요.`);
      if (r.agingIdx > 100) out.push(`노령화 지수가 ${u.josa(u.n(r.agingIdx, 1), "으로/로")} 100을 넘어, 고령 인구가 유소년 인구보다 많아요.`);
      out.push(`생산연령인구 100명이 부양하는 인구(총부양비)는 약 ${u.n(r.totalDep, 1)}명이에요.`);
      if (base && br.total) {
        const d = r.oldR - br.oldR;
        if (Math.abs(d) >= 0.05) out.push(`비교 기준보다 고령 인구 비율이 ${u.n(Math.abs(d), 1)}%p ${d > 0 ? "높아졌어요" : "낮아졌어요"}.`);
      }
      return out;
    },
    concept: K([
      ["인구 피라미드", "<mark>성별·연령별 인구 구성</mark>을 나타낸 그래프. 왼쪽 남성, 오른쪽 여성, 아래쪽이 낮은 연령", FIG.popBase],
      ["피라미드형", "<mark>출생률·사망률이 모두 높아</mark> 아래가 넓은 모양", FIG.popPyramid],
      ["종형", "<mark>출생률·사망률이 모두 낮아</mark> 인구가 정체된 모양", FIG.popBell],
      ["항아리형(방추형)", "<mark>출생률이 매우 낮아</mark> 유소년층이 줄어든 모양", FIG.popPot],
      ["연령 구분", "유소년 <mark>0~14세</mark> · 생산연령 <mark>15~64세</mark> · 고령 <mark>65세 이상</mark>", FIG.ages],
      ["고령화 단계 (UN)", "고령 인구 비율 <mark>7%</mark> 이상 고령화 사회 · <mark>14%</mark> 이상 고령 사회 · <mark>20%</mark> 이상 초고령 사회", FIG.aging]
    ], "그래프는 10세 단위로 보여 주지만, 지표는 5세 단위 자료로 계산해 15세·65세 경계를 정확히 지켜요. 미래 인구 예측 기능은 없어요."),
    howto: [
      "피라미드형 → 종형 → 항아리형 예시를 차례로 띄워 인구 변천 과정을 설명해 보세요.",
      "종형을 비교 기준으로 저장한 뒤 0~9세 인구를 줄이면 어떤 지표가 어떻게 변하는지 관찰해 보세요.",
      "고령 인구 비율이 14%와 20%를 넘는 지점을 직접 만들어 보세요."
    ],
    preview: `<svg viewBox="0 0 200 120">${[0, 1, 2, 3, 4, 5].map((i) => { const w = 70 - i * 11; return `<rect x="${96 - w}" y="${96 - i * 16}" width="${w}" height="12" fill="${C.male}"/><rect x="104" y="${96 - i * 16}" width="${w}" height="12" fill="${C.rose}"/>`; }).join("")}</svg>`
  });

  /* =========================================================
     6-5. 로렌츠 곡선과 지니계수 (5분위 자료)
     ========================================================= */
  const QNAMES = ["하위 20%", "하위 20~40%", "하위 40~60%", "하위 60~80%", "상위 20%"];
  function lorenzCompute(s) {
    const L = [0];
    s.s.forEach((v, i) => L.push(L[i] + v / 100));
    L[5] = 1; // 반올림 오차 보정 (합계는 항상 100%)
    let B = 0;
    for (let k = 1; k <= 5; k++) B += 0.2 * (L[k - 1] + L[k]) / 2;
    const gini = Math.max(0, 1 - 2 * B);
    return { L, B, A: 0.5 - B, gini, ratio: s.s[0] > 0 ? s.s[4] / s.s[0] : Infinity, bottom40: s.s[0] + s.s[1] };
  }

  add({
    id: "lorenz",
    title: "로렌츠 곡선과 지니계수",
    subjects: ["economics"],
    summary: "소득 분위별 점유율을 바꾸며 로렌츠 곡선의 모양과 지니계수의 변화를 확인해요.",
    desc: "인구를 소득이 낮은 순서로 5개 집단(5분위)으로 나누고, 각 집단이 전체 소득에서 차지하는 비율을 조절해요. 상위 20% 점유율은 합계가 100%가 되도록 자동 계산돼요.",
    initial: () => u.clone(SG.data.lorenz.initial),
    controls: () => ({
      groups: [{
        title: "소득 분위별 점유율",
        note: "아래 집단의 점유율은 바로 위 집단보다 클 수 없어요. 합계는 항상 100%예요.",
        items: QNAMES.map((name, i) => ({ key: `s.${i}`, label: name + (i === 4 ? " (자동 계산)" : ""), min: 0, max: 100, step: 0.1, unit: "%", readonly: i === 4 }))
      }]
    }),
    normalize(st, key, prev) {
      const s = st.s, i = +key.split(".")[1];
      s[i] = u.r1(s[i]);
      let msg = null;
      const others = u.sum(s.slice(0, 4)) - s[i];
      const R = u.r1(100 - others);                       // s[i] + s[4] = R
      const lo = i > 0 ? s[i - 1] : 0;
      const hiNext = i < 3 ? s[i + 1] : Infinity;
      const hiTop = i === 3 ? u.r1(R / 2) : u.r1(R - s[3]); // 상위 20% ≥ 하위 60~80%
      const hi = Math.min(hiNext, hiTop);
      if (s[i] < lo) { s[i] = lo; msg = `${QNAMES[i]}의 점유율은 바로 아래 집단(${QNAMES[i - 1]}, ${u.n(lo, 1)}%)보다 작을 수 없어서 ${u.n(lo, 1)}%로 맞췄어요.`; }
      else if (s[i] > hi) {
        s[i] = Math.max(lo, hi);
        msg = hi === hiNext
          ? `${QNAMES[i]}의 점유율은 바로 위 집단(${QNAMES[i + 1]}, ${u.n(hiNext, 1)}%)보다 클 수 없어서 ${u.n(s[i], 1)}%로 맞췄어요.`
          : `상위 20%의 점유율이 바로 아래 집단보다 작아지지 않도록 ${QNAMES[i]}를 ${u.n(s[i], 1)}%로 맞췄어요.`;
      }
      s[4] = u.r1(100 - u.sum(s.slice(0, 4)));
      return msg;
    },
    compute: lorenzCompute,
    draw(st, r, base, br) {
      const W = 760, H = 520, x0 = 86, y1 = 450, size = 410, x1 = x0 + size, y0 = y1 - size;
      const X = (v) => x0 + v * size, Y = (v) => y1 - v * size;
      let b = "";
      for (let k = 0; k <= 100; k += 20) {
        b += u.line(X(k / 100), y0, X(k / 100), y1, { stroke: C.grid }) + u.line(x0, Y(k / 100), x1, Y(k / 100), { stroke: C.grid });
        b += u.t(X(k / 100), y1 + 22, k, { anchor: "middle", size: 13, fill: C.muted });
        b += u.t(x0 - 10, Y(k / 100) + 5, k, { anchor: "end", size: 13, fill: C.muted });
      }
      b += u.line(x0, y0, x0, y1, { stroke: C.text, width: 1.5 }) + u.line(x0, y1, x1, y1, { stroke: C.text, width: 1.5 });
      b += u.t((x0 + x1) / 2, H - 12, "인구 누적 비율 (%) · 소득 하위부터", { anchor: "middle", size: 14, weight: 600 });
      b += `<text transform="translate(26 ${(y0 + y1) / 2}) rotate(-90)" fill="${C.text}" font-size="14" font-weight="600" text-anchor="middle">소득 누적 점유율 (%)</text>`;
      const pts = r.L.map((v, k) => `${X(k / 5)},${Y(v)}`).join(" ");
      b += `<polygon points="${pts}" fill="${C.purple}" fill-opacity="0.16"/>`;
      // 완전 불평등선, 완전 평등선
      b += `<polyline points="${X(0)},${Y(0)} ${X(1)},${Y(0)} ${X(1)},${Y(1)}" fill="none" stroke="${C.muted}" stroke-width="1.5" stroke-dasharray="2 4"/>`;
      b += u.line(X(0), Y(0), X(1), Y(1), { stroke: C.muted, width: 2, dash: "8 6" });
      b += u.t(X(0.53), Y(0.62), "완전 평등선", { size: 13, fill: C.muted, anchor: "end" });
      if (base) b += `<polyline points="${br.L.map((v, k) => `${X(k / 5)},${Y(v)}`).join(" ")}" fill="none" stroke="${C.base}" stroke-width="2.5" stroke-dasharray="8 6"/>`;
      b += `<polyline points="${pts}" fill="none" stroke="${C.purple}" stroke-width="3.5"/>`;
      r.L.forEach((v, k) => { if (k > 0 && k < 5) b += `<circle cx="${X(k / 5)}" cy="${Y(v)}" r="5" fill="${C.purple}"/>` + u.t(X(k / 5) - 8, Y(v) - 10, `${u.n(v * 100, 1)}`, { size: 13, fill: C.purple, weight: 700, anchor: "end" }); });
      if (r.A > 0.02) b += u.t(X(0.62), (Y(0.62) + Y((r.L[3] + r.L[4]) / 2)) / 2 + 6, "A", { anchor: "middle", size: 18, weight: 700, fill: C.purple });
      b += u.t(X(0.84), Y(r.L[4] / 3) + 6, "B", { anchor: "middle", size: 18, weight: 700, fill: C.muted });
      // 오른쪽 요약
      const sx = 540;
      b += u.t(sx, 110, "지니계수 (근사값)", { size: 15, fill: C.muted, weight: 600 });
      b += u.t(sx, 156, u.n(r.gini, 3), { size: 42, weight: 700, fill: C.purple });
      if (base) b += u.t(sx, 186, `비교 기준 ${u.n(br.gini, 3)}`, { size: 15, fill: C.muted });
      b += u.t(sx, 236, "지니계수 = A ÷ (A + B)", { size: 14, fill: C.text });
      b += u.t(sx, 260, `A = ${u.n(r.A, 3)}, B = ${u.n(r.B, 3)}`, { size: 14, fill: C.text });
      b += u.t(sx, 310, "5분위 배율", { size: 15, fill: C.muted, weight: 600 });
      b += u.t(sx, 342, isFinite(r.ratio) ? `${u.n(r.ratio, 2)}배` : "계산 불가", { size: 24, weight: 700 });
      b += u.t(sx, 366, "상위 20% ÷ 하위 20%", { size: 13, fill: C.muted });
      return u.svg(W, H, b);
    },
    legend: (s, r, base) => [
      { label: "로렌츠 곡선", color: C.purple }, { label: "완전 평등선", color: C.muted, dash: true }, { label: "A: 평등선과 곡선 사이 면적", color: "#D9D4EC" }
    ].concat(base ? [{ label: "비교 기준 곡선", color: C.base, dash: true }] : []),
    metrics: (s, r) => [
      { label: "지니계수", value: r.gini, digits: 3, unit: "" },
      { label: "하위 20% 점유율", value: s.s[0], digits: 1, unit: "%p" },
      { label: "상위 20% 점유율", value: s.s[4], digits: 1, unit: "%p" },
      { label: "5분위 배율", value: isFinite(r.ratio) ? r.ratio : NaN, digits: 2, unit: "배" }
    ],
    results(st, r) {
      const s = st.s;
      return `<table class="data-table"><thead><tr><th>소득 집단</th><th>점유율</th><th>누적 점유율</th></tr></thead><tbody>
        ${QNAMES.map((q, i) => `<tr><td>${q}</td><td>${u.p(s[i])}</td><td>${u.p(r.L[i + 1] * 100)}</td></tr>`).join("")}
        <tr class="sum"><td>합계</td><td>${u.p(u.sum(s))}</td><td></td></tr></tbody></table>
        <dl class="calc-list">
          <div><dt>로렌츠 곡선 아래 면적 B <small>사다리꼴 5개의 합</small></dt><dd>${u.n(r.B, 4)}</dd></div>
          <div><dt>완전 평등선과 곡선 사이 면적 A <small>0.5 − B</small></dt><dd>${u.n(r.A, 4)}</dd></div>
          <div><dt>지니계수 <small>A ÷ (A + B) = 1 − 2B</small></dt><dd><b>${u.n(r.gini, 3)}</b></dd></div>
          <div><dt>5분위 배율 <small>상위 20% ÷ 하위 20%</small></dt><dd>${isFinite(r.ratio) ? u.n(r.ratio, 2) + "배" : "하위 20% 점유율이 0이라 계산할 수 없어요"}</dd></div>
        </dl>
        <p class="small muted">5분위 집계 자료로 계산한 근사값이에요. 같은 분위 안의 소득 차이는 반영되지 않아 실제 지니계수보다 작게 나오며, 이 방식의 최댓값은 0.8이에요.</p>`;
    },
    interpret(st, r, base, br) {
      const s = st.s, out = [];
      if (r.gini < 0.0005) out.push("모든 집단이 소득의 20%씩을 차지해 로렌츠 곡선이 완전 평등선과 겹쳐요. 지니계수는 0이에요.");
      else out.push(`지니계수는 <b>${u.ieyo(u.n(r.gini, 3))}</b>. 0에 가까울수록 평등하고 1에 가까울수록 불평등해요. 로렌츠 곡선이 완전 평등선에서 멀어질수록 A 면적이 커지고 지니계수도 커져요.`);
      out.push(`상위 20%가 전체 소득의 ${u.p(s[4])}를 차지하고, 하위 40%는 ${u.p(r.bottom40)}를 차지해요.`);
      if (isFinite(r.ratio) && r.gini >= 0.0005) out.push(`상위 20%의 소득 점유율은 하위 20%의 ${u.n(r.ratio, 2)}배예요(5분위 배율).`);
      if (base) {
        const d = r.gini - br.gini;
        if (Math.abs(d) >= 0.0005) out.push(`비교 기준(${u.n(br.gini, 3)})보다 지니계수가 ${u.n(Math.abs(d), 3)} ${d > 0 ? "커져 소득 분배가 더 불평등해졌어요" : "작아져 소득 분배가 더 평등해졌어요"}.`);
      }
      return out;
    },
    concept: K([
      ["로렌츠 곡선", "소득이 낮은 사람부터 늘어놓고, <mark>인구 누적 비율(가로)</mark>에 따른 <mark>소득 누적 점유율(세로)</mark>을 그린 곡선", FIG.lorenzCurve],
      ["완전 평등선", "모든 사람의 소득이 같을 때의 대각선. <mark>곡선이 이 선에서 멀수록 불평등</mark>해요.", FIG.equalityLine],
      ["지니계수", "<mark>A ÷ (A + B)</mark>. 0이면 완전 평등, 1에 가까울수록 불평등", FIG.gini],
      ["5분위 배율", "<mark>상위 20% 점유율 ÷ 하위 20% 점유율</mark>. 클수록 불평등", FIG.quintile]
    ], "이 화면의 지니계수는 5분위 자료로 계산한 근사값이에요. 실제보다 작게 나오고, 최댓값은 0.8이에요."),
    howto: [
      "'완전 평등' 예시에서 시작해 하위 20%의 점유율을 조금씩 줄이며 곡선과 지니계수의 변화를 관찰해 보세요.",
      "현재 상태를 비교 기준으로 저장한 뒤, 재분배 정책으로 하위 집단의 점유율이 늘어난 상황을 만들어 보세요.",
      "지니계수가 같아도 로렌츠 곡선의 모양이 다를 수 있는지 탐구해 보세요."
    ],
    preview: `<svg viewBox="0 0 200 120"><line x1="40" y1="108" x2="140" y2="8" stroke="${C.muted}" stroke-dasharray="5 4"/><polygon points="40,108 60,101 80,91 100,74 120,51 140,8" fill="${C.purple}" fill-opacity=".16"/><polyline points="40,108 60,101 80,91 100,74 120,51 140,8" fill="none" stroke="${C.purple}" stroke-width="3"/><line x1="40" y1="8" x2="40" y2="108" stroke="${C.axis}"/><line x1="40" y1="108" x2="140" y2="108" stroke="${C.axis}"/></svg>`
  });

  /* =========================================================
     6-6. 기후 그래프 (지역 A, 지역 B)
     ========================================================= */
  const MONTHS = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];
  function climateStats(reg) {
    const t = reg.temp, p = reg.prec;
    const mean = u.sum(t) / 12, total = u.sum(p);
    const maxT = Math.max(...t), minT = Math.min(...t), maxP = Math.max(...p), minP = Math.min(...p);
    const which = (arr, v) => arr.map((x, i) => (x === v ? MONTHS[i] : null)).filter(Boolean).join(", ");
    const share = (idx) => (total > 0 ? (idx.reduce((x, i) => x + p[i], 0) / total) * 100 : 0);
    return {
      mean, total, range: maxT - minT, maxT, minT, maxP, minP,
      hot: which(t, maxT), cold: which(t, minT), wet: which(p, maxP), dry: which(p, minP),
      summerShare: share([5, 6, 7]), winterShare: share([11, 0, 1]),
      dryMonths: p.filter((x) => x < 50).length
    };
  }
  const presetById = (id) => SG.data.climate.presets.find((p) => p.id === id);
  const regionFrom = (p) => ({ name: p.label, temp: p.temp.slice(), prec: p.prec.slice() });
  /* 보기: "a" = 지역 A만, "b" = 지역 B만, "both" = A·B 나란히. 한 지역만 볼 때는 그 지역을 편집한다 */
  const climEd = (s) => (s.view === "both" ? s.edit : s.view);
  const climShown = (s) => (s.view === "both" ? ["a", "b"] : [s.view]);

  function climateChart(ox, oy, w, h, reg, bReg, sc, title, st) {
    const px = ox + 62, pw = w - 124, py = oy + 46, ph = h - 46 - 92;
    const bw = pw / 12;
    const TY = (v) => py + ph * (sc.tMax - v) / (sc.tMax - sc.tMin);
    const PY = (v) => py + ph * (1 - v / sc.pMax);
    let b = u.t(ox + w / 2, oy + 24, title, { anchor: "middle", size: 18, weight: 700 });
    const n = (sc.tMax - sc.tMin) / 10;
    for (let k = 0; k <= n; k++) {
      const tv = sc.tMin + k * 10, y = TY(tv);
      b += u.line(px, y, px + pw, y, { stroke: tv === 0 ? C.axis : C.grid, width: tv === 0 ? 1.5 : 1 });
      b += u.t(px - 8, y + 5, tv, { anchor: "end", size: 13, fill: C.red });
      b += u.t(px + pw + 8, y + 5, u.n(sc.pMax * k / n), { size: 13, fill: C.blue });
    }
    b += u.t(px - 8, py - 14, "기온(℃)", { anchor: "end", size: 13, weight: 600, fill: C.red });
    b += u.t(ox + w - 6, py - 14, "강수량(mm)", { anchor: "end", size: 13, weight: 600, fill: C.blue });
    reg.prec.forEach((v, i) => {
      const x = px + i * bw + bw * 0.2;
      b += u.rect(x, PY(v), bw * 0.6, py + ph - PY(v), { fill: C.accent, opacity: 0.85 });
      if (bReg) b += u.rect(x, PY(bReg.prec[i]), bw * 0.6, py + ph - PY(bReg.prec[i]), { stroke: "#4F5964", width: 1.5, dash: "4 3" });
      b += u.t(px + i * bw + bw / 2, py + ph + 20, i + 1, { anchor: "middle", size: 13, fill: C.muted });
    });
    b += u.t(px + pw / 2, py + ph + 40, "월", { anchor: "middle", size: 13, fill: C.muted });
    const linePts = (arr) => arr.map((v, i) => `${px + i * bw + bw / 2},${TY(v)}`).join(" ");
    if (bReg) b += `<polyline points="${linePts(bReg.temp)}" fill="none" stroke="${C.base}" stroke-width="2.5" stroke-dasharray="7 5"/>`;
    b += `<polyline points="${linePts(reg.temp)}" fill="none" stroke="${C.red}" stroke-width="3"/>`;
    reg.temp.forEach((v, i) => (b += `<circle cx="${px + i * bw + bw / 2}" cy="${TY(v)}" r="4" fill="${C.red}"/>`));
    b += u.t(ox + w / 2, oy + h - 18, `연평균 ${u.n(st.mean, 1)}℃ · 연 강수량 ${u.n(st.total)}mm · 연교차 ${u.n(st.range, 1)}℃`, { anchor: "middle", size: 15, weight: 600, fill: C.main });
    return b;
  }

  add({
    id: "climate",
    title: "기후 그래프",
    subjects: ["integrated", "geography"],
    summary: "월별 기온과 강수량을 바꾸며 기후 특성을 읽고, 두 지역의 기후 그래프를 비교해요.",
    desc: "월평균 기온은 꺾은선, 월 강수량은 막대로 나타내요. 지역 A와 B를 하나씩 보거나 나란히 놓고 비교할 수 있어요. 예시와 수치 조절은 지금 보고 있는 지역(나란히 볼 때는 고른 지역)에 적용돼요.",
    initial() {
      const d = SG.data.climate;
      return { view: "a", edit: "a", a: regionFrom(presetById(d.initialA)), b: regionFrom(presetById(d.initialB)) };
    },
    controls: (s) => {
      const E = climEd(s), L = E.toUpperCase();
      return {
      top: [
        { key: "view", label: "보기", type: "segment", options: [{ value: "a", label: "지역 A" }, { value: "b", label: "지역 B" }, { value: "both", label: "A·B 나란히" }] }
      ].concat(s.view === "both" ? [{ key: "edit", label: "바꿀 지역", type: "segment", options: [{ value: "a", label: "지역 A" }, { value: "b", label: "지역 B" }] }] : []),
      quick: {
        title: `지역 ${L} · 한 번에 조절`,
        note: "12개월 값을 그래프 모양을 유지한 채 함께 바꿔요. 달마다 바꾸려면 아래 '세부 조절'을 열어 주세요.",
        items: [
          { key: "q.mean", label: "연평균 기온", min: -30, max: 35, step: 0.1, unit: "℃" },
          { key: "q.range", label: "기온의 연교차", min: 0, max: 60, step: 0.1, unit: "℃" },
          { key: "q.total", label: "연 강수량", min: 0, max: 6000, step: 10, unit: "mm" }
        ]
      },
      tabs: [{ id: "t", label: "월평균 기온" }, { id: "p", label: "월 강수량" }],
      groups: [
        { tab: "t", title: `지역 ${L} · 월평균 기온`, items: MONTHS.map((m, i) => ({ key: `${E}.temp.${i}`, label: m, min: -50, max: 40, step: 0.1, unit: "℃" })) },
        { tab: "p", title: `지역 ${L} · 월 강수량`, items: MONTHS.map((m, i) => ({ key: `${E}.prec.${i}`, label: m, min: 0, max: 1000, step: 1, unit: "mm" })) }
      ]
      };
    },
    /* 한 번에 조절: 편집 중인 지역의 연평균 기온(평행 이동), 연교차(평균 중심으로 늘이기), 연 강수량(비율대로) */
    get(s, key) {
      const st = climateStats(s[climEd(s)]);
      return key === "q.mean" ? st.mean : key === "q.range" ? st.range : st.total;
    },
    set(s, key, v) {
      const reg = s[climEd(s)], st = climateStats(reg);
      const fixT = (t) => u.r1(u.clamp(t, -50, 40));
      if (key === "q.mean") reg.temp = reg.temp.map((t) => fixT(t + v - st.mean));
      else if (key === "q.range") {
        reg.temp = st.range >= 0.05
          ? reg.temp.map((t) => fixT(st.mean + ((t - st.mean) * v) / st.range))
          : reg.temp.map((_, i) => fixT(st.mean - (v / 2) * Math.cos((2 * Math.PI * i) / 12))); // 1월이 가장 춥고 7월이 가장 더운 모양
      } else reg.prec = fillTo(reg.prec, Math.round(v)).map((p) => u.clamp(p, 0, 1000));
      if (!/\(수정\)$/.test(reg.name)) reg.name = reg.name + " (수정)";
    },
    normalize(s, key) {
      const parts = key.split(".");
      if (parts.length === 3) {
        const reg = s[parts[0]];
        const i = +parts[2];
        if (parts[1] === "temp") reg.temp[i] = u.r1(reg.temp[i]); else reg.prec[i] = Math.round(reg.prec[i]);
        if (!/\(수정\)$/.test(reg.name)) reg.name = reg.name + " (수정)";
      }
      return null;
    },
    applyPreset(s, p) {
      const ns = u.clone(s);
      ns[climEd(ns)] = regionFrom(p);
      return ns;
    },
    compute: (s) => ({ a: climateStats(s.a), b: climateStats(s.b) }),
    draw(s, r, base) {
      const keys = climShown(s), show = keys.length === 2;
      const all = keys.map((k) => s[k]).concat(base ? keys.map((k) => base[k]) : []);
      const temps = [].concat(...all.map((x) => x.temp)), precs = [].concat(...all.map((x) => x.prec));
      const tMin = Math.min(-40, Math.floor(Math.min(...temps) / 10) * 10);
      const tMax = Math.max(40, Math.ceil(Math.max(...temps) / 10) * 10);
      const n = (tMax - tMin) / 10;
      const step = Math.ceil(Math.max(400, ...precs) / n / 25) * 25;
      const sc = { tMin, tMax, pMax: step * n };
      if (!show) { const k = keys[0]; return u.svg(760, 540, climateChart(0, 0, 760, 540, s[k], base && base[k], sc, `지역 ${k.toUpperCase()} · ${s[k].name}`, r[k])); }
      // 그래프 영역이 좁으면(태블릿·휴대폰) 두 그래프를 위아래로, 넓으면 좌우로 놓는다
      if ((SG.viewWidth || 1200) < 900) return u.svg(760, 1080,
        climateChart(0, 0, 760, 540, s.a, base && base.a, sc, `지역 A · ${s.a.name}`, r.a) +
        u.line(30, 540, 730, 540, { stroke: C.grid }) +
        climateChart(0, 540, 760, 540, s.b, base && base.b, sc, `지역 B · ${s.b.name}`, r.b));
      return u.svg(1240, 540,
        climateChart(0, 0, 620, 540, s.a, base && base.a, sc, `지역 A · ${s.a.name}`, r.a) +
        u.line(620, 30, 620, 500, { stroke: C.grid }) +
        climateChart(620, 0, 620, 540, s.b, base && base.b, sc, `지역 B · ${s.b.name}`, r.b));
    },
    legend: (s, r, base) => [{ label: "월평균 기온", color: C.red }, { label: "월 강수량", color: C.accent }].concat(base ? [{ label: "비교 기준", color: "#4F5964", dash: true }] : []),
    metrics(s, r) {
      const one = (k, st) => [
        { label: `${k} 연평균 기온`, value: st.mean, digits: 1, unit: "℃" },
        { label: `${k} 연 강수량`, value: st.total, digits: 0, unit: "mm" },
        { label: `${k} 기온의 연교차`, value: st.range, digits: 1, unit: "℃" }
      ];
      return [].concat(...climShown(s).map((k) => one(`지역 ${k.toUpperCase()}`, r[k])));
    },
    results(s, r) {
      const regs = climShown(s).map((k) => [`지역 ${k.toUpperCase()}`, s[k], r[k]]);
      const head = regs.map(([k]) => `<th>${k}</th>`).join("");
      const row = (label, f) => `<tr><td>${label}</td>${regs.map(([, , st]) => `<td>${f(st)}</td>`).join("")}</tr>`;
      const monthly = (reg, key, unit, d) => reg[key].map((v, i) => `<tr><td>${MONTHS[i]}</td><td>${u.n(v, d)}${unit}</td></tr>`).join("");
      return `<table class="data-table"><thead><tr><th>항목</th>${head}</tr></thead><tbody>
        ${row("가장 더운 달", (st) => `${st.hot} (${u.n(st.maxT, 1)}℃)`)}
        ${row("가장 추운 달", (st) => `${st.cold} (${u.n(st.minT, 1)}℃)`)}
        ${row("강수량이 가장 많은 달", (st) => `${st.wet} (${u.n(st.maxP)}mm)`)}
        ${row("강수량이 가장 적은 달", (st) => `${st.dry} (${u.n(st.minP)}mm)`)}
        </tbody></table>
        ${F([["연평균 기온", "12개월 평균 기온의 평균"], ["연 강수량", "12개월 강수량의 합"], ["기온의 연교차", "가장 더운 달 − 가장 추운 달"]])}
        <details class="raw"><summary>지역 ${climEd(s).toUpperCase()} 월별 자료 보기</summary>
        <table class="data-table"><thead><tr><th>월</th><th>기온</th></tr></thead><tbody>${monthly(s[climEd(s)], "temp", "℃", 1)}</tbody></table>
        <table class="data-table"><thead><tr><th>월</th><th>강수량</th></tr></thead><tbody>${monthly(s[climEd(s)], "prec", "mm", 0)}</tbody></table></details>`;
    },
    interpret(s, r, base) {
      const out = [];
      const describe = (k, st) => {
        const parts = [];
        if (st.range <= 5) parts.push(`기온의 연교차가 ${u.n(st.range, 1)}℃로 매우 작아 일 년 내내 기온이 비슷해요`);
        else if (st.range >= 30) parts.push(`기온의 연교차가 ${u.n(st.range, 1)}℃로 매우 커요`);
        else parts.push(`기온의 연교차는 ${u.n(st.range, 1)}℃예요`);
        if (st.minT >= 18) parts.push("가장 추운 달도 평균 기온이 18℃ 이상이에요");
        if (st.maxT < 10) parts.push("가장 더운 달도 평균 기온이 10℃ 미만이에요");
        if (st.minT < 0) parts.push(`평균 기온이 영하인 달이 ${s[k === "지역 A" ? "a" : "b"].temp.filter((x) => x < 0).length}개 있어요`);
        if (st.total < 250) parts.push(`연 강수량이 ${u.n(st.total)}mm로 매우 적어요`);
        if (st.summerShare >= 50) parts.push(`6~8월에 연 강수량의 ${u.n(st.summerShare, 0)}%가 집중돼요`);
        if (st.winterShare >= 40 && st.summerShare < 15) parts.push(`비가 주로 12~2월에 내리고(${u.n(st.winterShare, 0)}%) 6~8월은 건조해요`);
        if (st.total >= 250 && st.dryMonths === 0) parts.push("모든 달의 강수량이 50mm 이상이에요");
        else if (st.dryMonths > 0 && st.total >= 250) parts.push(`강수량이 50mm 미만인 달이 ${st.dryMonths}개 있어요`);
        if (/12월|1월|2월/.test(st.hot) && !/6월|7월|8월/.test(st.hot) && st.range > 5) parts.push("가장 더운 달이 12~2월이라 남반구 지역일 가능성이 있어요");
        return `<b>${k}</b>: ${parts.join(". ")}.`;
      };
      const keys = climShown(s);
      keys.forEach((k) => out.push(describe(`지역 ${k.toUpperCase()}`, r[k])));
      if (keys.length === 2) {
        const dT = r.a.mean - r.b.mean, dP = r.a.total - r.b.total;
        out.push(`두 지역을 비교하면 연평균 기온은 지역 ${dT >= 0 ? "A" : "B"}가 ${u.n(Math.abs(dT), 1)}℃ 높고, 연 강수량은 지역 ${dP >= 0 ? "A" : "B"}가 ${u.n(Math.abs(dP))}mm 많아요.`);
      }
      if (base) keys.forEach((k) => {
        const d = r[k].total - climateStats(base[k]).total;
        if (d !== 0) out.push(`비교 기준보다 지역 ${k.toUpperCase()}의 연 강수량이 ${u.n(Math.abs(d))}mm ${d > 0 ? "많아졌어요" : "적어졌어요"}.`);
      });
      out.push('<span class="muted">이 화면은 기후 유형을 자동으로 판정하지 않아요. 그래프의 특징을 근거로 어떤 기후인지 직접 추론해 보세요.</span>');
      return out;
    },
    concept: K([
      ["기후 그래프", "<mark>월평균 기온(꺾은선, 왼쪽 축)</mark>과 <mark>월 강수량(막대, 오른쪽 축)</mark>을 함께 나타낸 그래프", FIG.climateGraph],
      ["기온의 연교차", "<mark>가장 더운 달 − 가장 추운 달</mark>의 평균 기온 차이. 적도 부근은 작고, 고위도·대륙 내부는 커요.", FIG.range],
      ["강수의 계절 분포", "연 강수량만큼 중요해요. <mark>여름에 집중</mark>되는지, <mark>겨울에 많고 여름이 건조</mark>한지 살펴보세요.", FIG.seasonal]
    ], "예시는 각 기후의 일반적 특성을 반영한 가상 학습용 자료예요. 특정 도시의 실제 관측값이 아니에요."),
    howto: [
      "지역 A와 B에 서로 다른 기후 예시를 넣고 'A·B 나란히'로 비교해 보세요.",
      "기온과 강수량의 세로축이 서로 다른 단위라는 점에 주의하며 그래프를 읽어 보세요.",
      "예시 이름을 가린 채 그래프만 보여 주고 어떤 기후인지 근거를 들어 추론해 보세요."
    ],
    preview: `<svg viewBox="0 0 200 120">${[30, 26, 34, 46, 58, 70, 88, 84, 62, 44, 34, 28].map((h, i) => `<rect x="${24 + i * 13}" y="${108 - h}" width="8" height="${h}" fill="${C.accent}" fill-opacity=".85"/>`).join("")}<polyline points="${[78, 74, 64, 52, 42, 34, 28, 26, 36, 48, 62, 74].map((y, i) => `${28 + i * 13},${y}`).join(" ")}" fill="none" stroke="${C.red}" stroke-width="3"/></svg>`
  });

  /* =========================================================
     6-7. 선거 제도와 의석 배분 (소선거구제 · 비례대표제)
     ========================================================= */
  const PARTY_COLORS = [C.main, C.orange, C.green, C.purple];
  const ED = () => SG.data.election;
  const PN = () => ED().parties;
  /* 이름 여러 개를 '·'로 잇기: ["C당", "D당"] → "C당·D당" */
  const joinNames = (idx) => idx.map((k) => PN()[k]).join("·");

  /* 최대 잔여 방식: 득표 비례 몫의 정수 부분을 먼저 주고,
     남는 의석은 소수점 아래가 큰 정당부터 1석씩 (같으면 앞 순서 정당) */
  function largestRemainder(votes, seats) {
    const tot = u.sum(votes);
    if (tot <= 0) return { seats: votes.map(() => 0), quota: votes.map(() => 0) };
    const quota = votes.map((v) => (v * seats) / tot);
    const out = quota.map((q) => Math.floor(q + 1e-9));
    let left = seats - u.sum(out);
    const order = quota.map((q, i) => [q - out[i], i]).filter(([, i]) => votes[i] > 0)
      .sort((a, b) => b[0] - a[0] || a[1] - b[1]);
    for (let k = 0; left > 0 && k < order.length; k++, left--) out[order[k][1]]++;
    return { seats: out, quota };
  }

  function electionCompute(s) {
    const d = ED(), v = s.v.map((x) => Math.max(0, x)), VT = u.sum(v) || 1;
    const voteShare = v.map((x) => (x * 100) / VT);
    const districts = d.offsets.map((off, i) => {
      const raw = voteShare.map((x, k) => Math.max(0, x + s.spread * off[k]));
      const t = u.sum(raw) || 1;
      const share = raw.map((x) => (x * 100) / t);
      let w = 0;
      share.forEach((x, k) => { if (x > share[w] + 1e-9) w = k; });
      const tie = share.filter((x) => Math.abs(x - share[w]) < 1e-9).length > 1;
      return { name: `${i + 1}지역구`, share, winner: w, tie, wasted: 100 - share[w] };
    });
    const DS = districts.length, PS = d.prSeats, TS = DS + PS;
    const dist = voteShare.map((_, k) => districts.filter((x) => x.winner === k).length);
    const eligible = voteShare.map((x) => x > 0 && x >= s.threshold);
    const lr = largestRemainder(voteShare.map((x, k) => (eligible[k] ? x : 0)), PS);
    const pr = lr.seats, total = dist.map((x, k) => x + pr[k]);
    const ri = u.clamp(Math.round(+s.ruling || 0), 0, voteShare.length - 1); // 여당(대통령 소속 정당)
    const pct = (arr, n) => arr.map((x) => (x * 100) / n);
    const dis = (seatPct) => u.sum(seatPct.map((x, k) => Math.abs(x - voteShare[k]))) / 2;
    const distPct = pct(dist, DS), prPct = pct(pr, PS), totPct = pct(total, TS);
    return {
      districts, dist, pr, quota: lr.quota, total, eligible, voteShare, distPct, prPct, totPct, DS, PS, TS,
      wastedDist: u.sum(districts.map((x) => x.wasted)) / DS,
      wastedPr: u.sum(voteShare.filter((_, k) => !eligible[k])),
      disDist: dis(distPct), disPr: dis(prPct), disTot: dis(totPct),
      ruling: ri, maj: Math.floor(TS / 2) + 1, majD: Math.floor(DS / 2) + 1,
      rulingMajority: total[ri] >= Math.floor(TS / 2) + 1, rulingDistMajority: dist[ri] >= Math.floor(DS / 2) + 1
    };
  }

  /* 개념 카드 그림 */
  const ELFIG = {
    smd: mini(Ln(6, 50, 74, 50, C.axis, 1.5) + R(14, 14, 14, 36, C.main) + R(34, 22, 14, 28, "#C9D1DA") + R(54, 34, 14, 16, "#C9D1DA") + Tx(21, 10, "당선 1명", C.main, "middle", 8)),
    wasted: mini(R(6, 16, 30, 16, C.main) + R(36, 16, 38, 16, "#C9D1DA") + Tx(21, 46, "당선") + Tx(55, 46, "사표", C.red)),
    pr: mini(R(6, 8, 27, 12, C.main) + R(33, 8, 24, 12, C.orange) + R(57, 8, 17, 12, C.green) + Ar(40, 22, 40, 34, C.text, 1.5) +
      R(6, 36, 27, 12, C.main) + R(33, 36, 24, 12, C.orange) + R(57, 36, 17, 12, C.green)),
    threshold: mini(Ln(6, 50, 74, 50, C.axis, 1.5) + R(12, 12, 12, 38, C.main) + R(32, 22, 12, 28, C.orange) + R(52, 40, 12, 10, "#C9D1DA") +
      Ln(6, 34, 74, 34, C.red, 1.5, "3 2") + Tx(76, 30, "기준", C.red, "end", 8)),
    dispro: mini(R(6, 10, 28, 12, C.main) + R(34, 10, 24, 12, C.orange) + R(58, 10, 16, 12, C.green) + Tx(6, 7, "표", C.muted, "start", 7) +
      R(6, 34, 42, 12, C.main) + R(48, 34, 26, 12, C.orange) + Tx(6, 31, "의석", C.muted, "start", 7)),
    majority: mini(R(6, 20, 28, 16, C.main) + R(34, 20, 40, 16, "#C9D1DA") + Ln(40, 12, 40, 44, C.red, 1.5, "3 2") +
      Tx(40, 9, "과반", C.red, "middle", 8) + Tx(20, 50, "여당", C.main, "middle", 8) + Tx(56, 50, "야당", C.muted, "middle", 8))
  };

  add({
    id: "election",
    title: "선거 제도와 의석 배분",
    subjects: ["politics"],
    summary: "같은 득표율이라도 소선거구제와 비례대표제에서 의석이 어떻게 달라지는지 비교해요.",
    desc: "정당별 득표율을 정하면 지역구 10석(1등만 당선)과 비례대표 10석(득표율대로)으로 의석을 나누고, 여당이 과반을 차지했는지 보여 줘요.",
    initial: () => u.clone(ED().initial),
    controls: () => ({
      top: [{ key: "ruling", label: "여당 (대통령이 속한 정당)", type: "segment", options: PN().map((n, k) => ({ value: String(k), label: n })) }],
      quick: {
        title: "정당별 득표율",
        note: "D당은 100%에서 나머지를 뺀 값으로 자동 계산돼요.",
        items: PN().map((n, i) => ({ key: `v.${i}`, label: n + (i === 3 ? " (자동 계산)" : ""), min: 0, max: 100, step: 1, unit: "%", readonly: i === 3 }))
      },
      detailLabel: "선거 조건 바꾸기",
      groups: [
        {
          title: "선거 조건",
          items: [
            { key: "threshold", label: "봉쇄 조항 (비례대표 최소 득표율)", min: 0, max: 10, step: 1, unit: "%" },
            { key: "spread", label: "지역별 지지 차이", min: 0, max: 2, step: 0.1, unit: "배" }
          ]
        }
      ],
      note: "봉쇄 조항: 득표율이 이 값보다 낮은 정당은 비례대표 의석을 받지 못해요. 지역별 지지 차이: 0이면 모든 지역구의 지지율이 전국 득표율과 같아져요."
    }),
    normalize(s, key) {
      let msg = null;
      if (/^v\.\d$/.test(key)) {
        const i = +key.split(".")[1];
        s.v[i] = Math.round(s.v[i]);
        const others = u.sum(s.v.slice(0, 3)) - s.v[i];
        if (others + s.v[i] > 100) {
          s.v[i] = 100 - others;
          msg = `A당~C당 득표율의 합은 100%를 넘을 수 없어서 ${PN()[i]} 득표율을 ${s.v[i]}%로 맞췄어요.`;
        }
      }
      s.v[3] = 100 - u.sum(s.v.slice(0, 3));
      s.threshold = Math.round(s.threshold);
      s.spread = u.r1(s.spread);
      return msg;
    },
    compute: electionCompute,
    draw(s, r, base, br) {
      const W = 760, H = 370, lx = 20, x0 = 236, bw = 504, P = PN(), ri = r.ruling;
      let b = "";
      const rows = [
        ["득표율", "정당이 얻은 표", r.voteShare, null, base && br.voteShare, null],
        ["지역구 의석", `1등만 당선 · ${r.DS}석`, r.distPct, r.dist, base && br.distPct, base && br.dist],
        ["비례대표 의석", `득표율대로 · ${r.PS}석`, r.prPct, r.pr, base && br.prPct, base && br.pr],
        ["전체 의석", `합계 ${r.TS}석`, r.totPct, r.total, base && br.totPct, base && br.total]
      ];
      rows.forEach(([label, sub, pcts, seats, bp], i) => {
        const y = 20 + i * 70, h = 42;
        b += u.t(lx, y + 18, label, { size: 15, weight: 700 }) + u.t(lx, y + 36, sub, { size: 12, fill: C.muted });
        let x = x0;
        pcts.forEach((p, k) => {
          const w = (p * bw) / 100;
          if (w <= 0) return;
          b += u.rect(x, y, w, h, { fill: PARTY_COLORS[k] });
          const txt = seats ? `${seats[k]}석` : `${u.n(p, 0)}%`;
          if (w >= 24) b += u.t(x + w / 2, y + h / 2 + 6, txt, { anchor: "middle", size: w >= 38 ? 15 : 12, weight: 700, fill: "#FFFFFF" });
          if (k === ri) b += u.rect(x + 1.5, y + 1.5, w - 3, h - 3, { stroke: C.text, width: 3 });
          x += w;
        });
        b += u.rect(x0, y, bw, h, { stroke: C.grid, width: 1 });
        if (bp) {
          let bx = x0;
          bp.forEach((p, k) => { const w = (p * bw) / 100; if (w > 0) b += u.rect(bx, y + h + 4, w, 7, { fill: PARTY_COLORS[k], opacity: 0.45 }); bx += w; });
        }
      });
      // 여당 과반 여부
      const sy = 20 + 4 * 70 + 8, ok = r.rulingMajority;
      const verdict = `여당 ${P[ri]} ${r.total[ri]}석 (과반 ${r.maj}석 필요) → ${ok ? "여대야소" : "여소야대"}`;
      b += u.rect(x0, sy, bw, 40, { fill: ok ? "#E3F1EA" : "#F8E4E4" });
      b += u.t(x0 + bw / 2, sy + 26, verdict, { anchor: "middle", size: 17, weight: 700, fill: ok ? C.green : C.red });
      b += u.t(lx, sy + 26, "국회 구성", { size: 15, weight: 700 });
      // 지역구별 당선 결과는 '현재 수치 및 계산 결과 > 자세히 보기'의 표에서 확인
      return u.svg(W, H, b);
    },
    legend: (s, r, base) => PN().map((n, k) => ({ label: n + (k === r.ruling ? " (여당)" : ""), color: PARTY_COLORS[k] }))
      .concat(base ? [{ label: "비교 기준 (막대 아래 얇은 띠)", color: C.base, dash: true }] : []),
    metrics: (s, r) => [
      { label: "여당 전체 의석", value: r.total[r.ruling], digits: 0, unit: "석" },
      { label: "지역구 사표 비율", value: r.wastedDist, digits: 1, unit: "%p" },
      { label: "비례대표 사표 비율", value: r.wastedPr, digits: 1, unit: "%p" }
    ],
    results(s, r) {
      const P = PN();
      const head = P.map((n) => `<th>${n}</th>`).join("");
      return `<table class="data-table"><thead><tr><th>정당</th><th>득표율</th><th>지역구</th><th>비례대표</th><th>전체 (의석률)</th></tr></thead><tbody>
        ${P.map((n, k) => `<tr><td>${n}${k === r.ruling ? " <small class=\"muted\">여당</small>" : ""}</td><td>${u.p(r.voteShare[k], 0)}</td><td>${r.dist[k]}석</td><td>${r.pr[k]}석${r.eligible[k] ? "" : " <small class=\"muted\">기준 미달</small>"}</td><td>${r.total[k]}석 (${u.p(r.totPct[k], 0)})</td></tr>`).join("")}
        <tr class="sum"><td>합계</td><td>${u.p(u.sum(r.voteShare), 0)}</td><td>${r.DS}석</td><td>${r.PS}석</td><td>${r.TS}석</td></tr></tbody></table>
        <div class="table-scroll"><table class="data-table"><thead><tr><th>지역구</th>${head}<th>당선</th></tr></thead><tbody>
        ${r.districts.map((d) => `<tr><td>${d.name}</td>${d.share.map((x, k) => `<td>${k === d.winner ? `<b>${u.n(x, 0)}%</b>` : `${u.n(x, 0)}%`}</td>`).join("")}<td>${P[d.winner]}</td></tr>`).join("")}
        </tbody></table></div>
        <dl class="calc-list">
          <div><dt>과반 기준 <small>전체 의석의 절반보다 많은 의석 = ${r.TS}석 ÷ 2 + 1</small></dt><dd>${r.maj}석 · 여당 ${P[r.ruling]} ${r.total[r.ruling]}석 → ${r.rulingMajority ? "여대야소" : "여소야대"}</dd></div>
          <div><dt>지역구 사표 비율 <small>지역구마다 낙선자가 얻은 득표율의 평균</small></dt><dd>${u.p(r.wastedDist)}</dd></div>
          <div><dt>비례대표 사표 비율 <small>봉쇄 조항(${s.threshold}%)에 못 미친 정당의 득표율 합</small></dt><dd>${u.p(r.wastedPr)}</dd></div>
          <div><dt>불비례 정도 <small>정당마다 |의석률 − 득표율|을 더한 뒤 ÷ 2</small></dt><dd>지역구 ${u.n(r.disDist, 1)}%p · 비례 ${u.n(r.disPr, 1)}%p · 전체 ${u.n(r.disTot, 1)}%p</dd></div>
          <div><dt>비례대표 의석 계산 <small>기준을 넘은 정당끼리 득표 비례로 나눈 몫 → 정수 부분 먼저, 남는 의석은 소수점 아래가 큰 순서</small></dt><dd>${P.map((n, k) => r.eligible[k] ? `${n} ${u.n(r.quota[k], 2)} → ${r.pr[k]}석` : null).filter(Boolean).join("<br>")}</dd></div>
        </dl>
        <p class="small muted">지역구마다 유권자 수가 같다고 가정했어요. 득표율이 같으면 앞 순서 정당이 이긴 것으로 계산해요. 실제 우리나라 국회의원 선거의 비례대표 의석 배분 방식은 이보다 복잡하며, 여기서는 지역구와 비례대표를 따로 계산해 더하는 방식으로 단순화했어요.</p>`;
    },
    interpret(s, r, base, br) {
      const P = PN(), out = [], ri = r.ruling;
      // 1. 여당 과반 여부
      out.push(r.rulingMajority
        ? `여당 ${u.josa(P[ri], "은/는")} ${r.TS}석 중 <b>${r.total[ri]}석</b>으로 과반(${r.maj}석)을 넘었어요 → <b>여대야소</b>.`
        : `여당 ${u.josa(P[ri], "은/는")} ${r.TS}석 중 <b>${r.total[ri]}석</b>이라 과반(${r.maj}석)에 못 미쳐요 → <b>여소야대</b>. 법안을 처리하려면 야당의 협조가 필요해요.`);
      if (r.rulingDistMajority !== r.rulingMajority)
        out.push(`지역구만 보면 ${r.rulingDistMajority ? "과반이" : "과반이 아니"}지만(${r.DS}석 중 ${r.dist[ri]}석), 비례대표를 더하면 ${r.rulingMajority ? "과반이 돼요" : "과반이 깨져요"}.`);
      // 2. 소선거구제의 효과
      const top = r.voteShare.indexOf(Math.max(...r.voteShare));
      const shut = r.voteShare.map((x, k) => (x > 0 && r.dist[k] === 0 ? k : -1)).filter((k) => k >= 0);
      out.push(`지역구에서 1위 ${u.josa(P[top], "은/는")} 득표율 ${u.p(r.voteShare[top], 0)}로 의석 ${u.p(r.distPct[top], 0)}를 얻었어요.` +
        (shut.length ? ` ${u.josa(joinNames(shut), "은/는")} 지역구 의석이 하나도 없어요.` : ""));
      // 3. 비례대표와 봉쇄 조항
      const cut = r.voteShare.map((x, k) => (x > 0 && !r.eligible[k] ? k : -1)).filter((k) => k >= 0);
      if (cut.length) out.push(`${u.josa(joinNames(cut), "은/는")} 봉쇄 조항(${s.threshold}%)에 못 미쳐 비례대표 의석을 받지 못했어요.`);
      else if (r.disPr + 0.05 < r.disDist) out.push("비례대표 의석은 득표율에 가깝게 나뉘었어요.");
      if (r.districts.some((d) => d.tie)) out.push('<span class="muted">득표율이 같은 지역구는 앞 순서 정당이 당선된 것으로 계산했어요.</span>');
      if (base) {
        const ch = r.total.map((x, k) => [k, x - br.total[k]]).filter(([, d]) => d !== 0);
        out.push(ch.length ? `비교 기준보다 전체 의석이 ${ch.map(([k, d]) => `${P[k]} ${d > 0 ? "+" : "−"}${Math.abs(d)}석`).join(", ")} 바뀌었어요.` : "전체 의석은 비교 기준과 같아요.");
      }
      return out;
    },
    concept: K([
      ["소선거구제", "한 선거구에서 <mark>가장 많은 표를 얻은 1명만 당선</mark>돼요. 큰 정당에 유리해 양당제가 자리 잡기 쉽지만, 작은 정당은 불리해요.", ELFIG.smd],
      ["사표", "<mark>당선에 반영되지 못한 표</mark>. 소선거구제에서는 낙선자에게 간 표가 모두 사표가 되어 사표가 많아요.", ELFIG.wasted],
      ["비례대표제", "<mark>정당 득표율에 비례해 의석을 나눠요.</mark> 사표가 적고 작은 정당도 의석을 얻기 쉽지만, 정당이 많아져 정국이 불안정해질 수 있어요.", ELFIG.pr],
      ["봉쇄 조항", "비례대표 의석을 받으려면 <mark>일정 비율 이상 득표</mark>해야 한다는 기준. 너무 많은 정당이 난립하는 것을 막아요.", ELFIG.threshold],
      ["득표율과 의석률", "두 값의 차이가 클수록 <mark>유권자의 표가 의석에 고르게 반영되지 못한</mark> 거예요.", ELFIG.dispro],
      ["여대야소 · 여소야대", "대통령이 속한 정당(<mark>여당</mark>)이 국회 의석의 <mark>과반을 차지하면 여대야소</mark>, 차지하지 못하면 여소야대예요. 여소야대에서는 정부 정책이나 법안 처리에 야당의 협조가 더 필요해요.", ELFIG.majority]
    ], "지역구 10곳과 각 지역구의 지지율 차이는 가상으로 만든 값이에요. 중·대선거구제는 다루지 않아요."),
    howto: [
      "'지역 차이 없음' 예시를 눌러, 지지율이 모든 지역에서 같을 때 1위 정당이 지역구를 얼마나 차지하는지 확인해 보세요.",
      "'양당 경쟁'과 '다당 경쟁'에서 사표 비율과 불비례 정도가 어떻게 달라지는지 비교해 보세요.",
      "봉쇄 조항을 0%에서 10%까지 올리며 어느 정당이 비례대표 의석을 잃는지, 그 장단점은 무엇인지 토의해 보세요.",
      "여당을 바꿔 가며 같은 선거 결과가 여대야소인지 여소야대인지 확인하고, 지역구만 봤을 때와 비례대표까지 더했을 때 결과가 달라지는 경우를 찾아보세요."
    ],
    preview: `<svg viewBox="0 0 200 120"><rect x="20" y="22" width="64" height="26" fill="${C.main}"/><rect x="84" y="22" width="56" height="26" fill="${C.orange}"/><rect x="140" y="22" width="27" height="26" fill="${C.green}"/><rect x="167" y="22" width="13" height="26" fill="${C.purple}"/><rect x="20" y="70" width="96" height="26" fill="${C.main}"/><rect x="116" y="70" width="64" height="26" fill="${C.orange}"/></svg>`
  });
})();
