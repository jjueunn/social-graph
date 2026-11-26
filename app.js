/* =========================================================
   SOCIAL GRAPH - app.js
   모든 그래프에 공통으로 쓰이는 화면과 기능을 담당합니다.
   (화면 이동, 과목 필터, 수치 조절 패널, 예시, 초기화,
    변화 전후 비교, PNG 저장, 전체 화면)
   그래프별 계산과 그림은 graphs.js에 있습니다.
   ========================================================= */
(function () {
  const SG = window.SG;
  const u = SG.u;
  const app = document.getElementById("app");

  /* ---------------- 아이콘 (Lucide, ISC License) ---------------- */
  const ICON_PATHS = {
    chart: '<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="m19 9-5 5-4-4-3 3"/>',
    back: '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
    right: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
    reset: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>',
    maximize: '<path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/>',
    minimize: '<path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/><path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/>',
    compare: '<circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M13 6h3a2 2 0 0 1 2 2v7"/><path d="M11 18H8a2 2 0 0 1-2-2V9"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
    alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    book: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
    sliders: '<line x1="21" x2="14" y1="4" y2="4"/><line x1="10" x2="3" y1="4" y2="4"/><line x1="21" x2="12" y1="12" y2="12"/><line x1="8" x2="3" y1="12" y2="12"/><line x1="21" x2="16" y1="20" y2="20"/><line x1="12" x2="3" y1="20" y2="20"/><line x1="14" x2="14" y1="2" y2="6"/><line x1="8" x2="8" y1="10" y2="14"/><line x1="16" x2="16" y1="18" y2="22"/>',
    table: '<path d="M12 3v18"/><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/>',
    lightbulb: '<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/>',
    list: '<path d="M3 12h.01"/><path d="M3 18h.01"/><path d="M3 6h.01"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M8 6h13"/>',
    chevron: '<path d="m6 9 6 6 6-6"/>',
  };
  const icon = (name, size = 18) =>
    `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_PATHS[name]}</svg>`;

  const subjectLabel = (id) => (SG.subjects.find((s) => s.id === id) || {}).label || id;
  const esc = u.esc;

  /* ---------------- 작은 도우미 ---------------- */
  function getPath(obj, path) { return path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj); }
  function setPath(obj, path, v) {
    const ks = path.split("."); let o = obj;
    for (let i = 0; i < ks.length - 1; i++) o = o[ks[i]];
    o[ks[ks.length - 1]] = v;
  }
  const tail = u.tail; // 끝소리 받침 확인 (graphs.js의 도우미)
  function decimals(step) { const s = String(step); return s.includes(".") ? s.split(".")[1].length : 0; }
  function lerp(a, b, t) {
    if (typeof a === "number" && typeof b === "number") return a + (b - a) * t;
    if (Array.isArray(a) && Array.isArray(b) && a.length === b.length) return b.map((x, i) => lerp(a[i], x, t));
    if (a && b && typeof a === "object" && typeof b === "object" && !Array.isArray(b)) {
      const o = {}; Object.keys(b).forEach((k) => (o[k] = k in a ? lerp(a[k], b[k], t) : b[k])); return o;
    }
    return b;
  }
  const reduceMotion = () => window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let filter = "all";
  try { filter = localStorage.getItem("sg-filter") || "all"; } catch (e) { /* 저장소를 못 쓰는 환경 */ }

  /* ---------------- 상단 메뉴 ---------------- */
  function renderTopbar(route) {
    const nav = [["#/", "홈", "home"], ["#/explore", "그래프 탐색", "explore"], ["#/guide", "이용 안내", "guide"]];
    const active = route === "graph" ? "explore" : route;
    document.getElementById("topbar").innerHTML =
      `<div class="topbar-inner">
        <a class="logo" href="#/">${icon("chart", 22)}<span>SOCIAL GRAPH</span></a>
        <nav class="nav">${nav.map(([h, l, k]) => `<a href="${h}" class="${k === active ? "active" : ""}"${k === active ? ' aria-current="page"' : ""}>${l}</a>`).join("")}</nav>
      </div>`;
  }

  /* ---------------- 메인 / 그래프 탐색 ---------------- */
  function cardsHTML() {
    const list = SG.graphs.filter((g) => filter === "all" || g.subjects.includes(filter));
    if (!list.length) return `<div class="empty">${icon("info")}<p><b>${esc(subjectLabel(filter))}</b> 과목 그래프는 아직 준비 중이에요. 다른 과목을 골라 보세요.</p></div>`;
    return `<div class="cards">${list.map((g) => `
      <article class="card graph-card">
        <a class="card-preview" href="#/graph/${g.id}" tabindex="-1" aria-hidden="true">${g.preview}</a>
        <div class="card-body">
          <div class="tags">${g.subjects.map((s) => `<span class="tag">${esc(subjectLabel(s))}</span>`).join("")}</div>
          <h3>${esc(g.title)}</h3>
          <p>${esc(g.summary)}</p>
          <a class="btn primary" href="#/graph/${g.id}">탐구하기 ${icon("right", 16)}</a>
        </div>
      </article>`).join("")}</div>`;
  }
  function filterHTML() {
    return `<div class="filters" role="group" aria-label="과목별 필터">${SG.subjects.map((s) =>
      `<button type="button" class="chip${s.id === filter ? " active" : ""}" data-filter="${s.id}" aria-pressed="${s.id === filter}">${esc(s.label)}</button>`).join("")}</div>`;
  }
  function bindFilters() {
    app.querySelectorAll("[data-filter]").forEach((b) => b.addEventListener("click", () => {
      filter = b.dataset.filter;
      try { localStorage.setItem("sg-filter", filter); } catch (e) { /* 무시 */ }
      app.querySelectorAll("[data-filter]").forEach((x) => { x.classList.toggle("active", x === b); x.setAttribute("aria-pressed", x === b); });
      document.getElementById("cardArea").innerHTML = cardsHTML();
    }));
  }
  function viewHome() {
    app.innerHTML = `
      <section class="hero">
        <div class="wrap">
          <p class="eyebrow">고등학교 사회 교과 인터랙티브 그래프</p>
          <h1>사회 교과서 속 그래프를 움직이다.</h1>
          <p class="lead">수치를 직접 조절하고, 변화하는 그래프를 관찰하며 사회 현상의 원리를 이해해 보세요.</p>
          <ol class="steps">
            <li><span>1</span><div><b>그래프 고르기</b><p>과목별로 교과서 속 그래프를 찾아요.</p></div></li>
            <li><span>2</span><div><b>수치 조절하기</b><p>슬라이더와 입력창으로 값을 바꿔요.</p></div></li>
            <li><span>3</span><div><b>변화 비교하기</b><p>바뀌기 전과 후의 그래프를 겹쳐 봐요.</p></div></li>
          </ol>
        </div>
      </section>
      <section class="wrap section">
        <div class="section-head"><h2>그래프 탐색</h2><p class="muted">총 ${SG.graphs.length}개 그래프</p></div>
        ${filterHTML()}
        <div id="cardArea">${cardsHTML()}</div>
      </section>`;
    bindFilters();
  }
  function viewExplore() {
    app.innerHTML = `
      <section class="wrap section page-top">
        <div class="section-head"><div><h1 class="page-title">그래프 탐색</h1><p class="muted">과목을 고르면 관련 그래프만 보여요. 한 그래프가 여러 과목에 함께 속할 수 있어요.</p></div></div>
        ${filterHTML()}
        <div id="cardArea">${cardsHTML()}</div>
      </section>`;
    bindFilters();
  }

  /* ---------------- 이용 안내 ---------------- */
  function viewGuide(focusId) {
    app.innerHTML = `
      <section class="wrap section page-top guide">
        <h1 class="page-title">이용 안내</h1>
        <p class="lead">SOCIAL GRAPH는 교과서 속 정적인 그래프를 직접 움직여 보며 탐구하는 공간이에요. 회원가입 없이 바로 쓸 수 있고, 입력한 값은 어디에도 저장되거나 전송되지 않아요.</p>
        <div class="guide-grid">
          <div class="card pad"><h3>${icon("sliders")} 수치 조절</h3><p>슬라이더를 움직이거나 숫자를 직접 입력하면 그래프와 계산 결과가 바로 바뀌어요. 범위를 벗어난 값이나 성립할 수 없는 값은 자동으로 맞추고 안내 문구를 보여 줘요.</p></div>
          <div class="card pad"><h3>${icon("list")} 대표 예시</h3><p>대표적인 유형이나 사회적 상황을 버튼 하나로 불러와요. 수업 도입에서 여러 유형을 빠르게 비교할 때 좋아요.</p></div>
          <div class="card pad"><h3>${icon("compare")} 변화 전후 비교</h3><p>'비교 기준 저장'을 누르면 지금 그래프가 회색 점선으로 남아요. 이후 수치를 바꾸면 기준과 현재를 겹쳐 보고, 주요 수치의 증감을 표로 확인할 수 있어요.</p></div>
          <div class="card pad"><h3>${icon("reset")} 초기화</h3><p>모든 수치를 처음 값으로 되돌려요. 저장한 비교 기준은 그대로 남아요.</p></div>
          <div class="card pad"><h3>${icon("download")} 그래프 저장</h3><p>제목, 축 이름, 범례, 주요 수치, 자료 안내가 담긴 PNG 이미지로 저장해요. 활동지나 발표 자료에 넣을 수 있어요.</p></div>
          <div class="card pad"><h3>${icon("maximize")} 전체 화면</h3><p>교실 대형 화면에 그래프만 크게 띄워 설명할 수 있어요. 전체 화면에서도 예시와 비교 기능을 쓸 수 있어요. Esc 키로 빠져나와요.</p></div>
        </div>
        <div class="card pad notice-card">
          <h3>${icon("alert")} 자료에 대한 안내</h3>
          <p>모든 그래프의 초기값과 예시는 <b>학습용 가상 데이터</b>예요. 실제 통계와 혼동하지 않도록 그래프마다 표시해 두었어요. 실제 공공 통계를 넣으면 자료명, 조사 연도, 출처 기관, 출처 링크, 단위가 함께 표시되고, 그 값을 바꾼 결과는 '가상 실험 결과'로 구분돼요.</p>
        </div>
        <div class="card pad">
          <h3>${icon("lightbulb")} 수업 활용 팁</h3>
          <ul class="tips">
            <li>개념 설명 전에 예시로 그래프 모양만 먼저 보여 주고, 학생이 특징을 말하게 해 보세요.</li>
            <li>비교 기준을 저장한 뒤 "이 값이 늘어나면 어떻게 될까?"를 예상하게 하고 슬라이더를 움직여 확인해 보세요.</li>
            <li>그래프 아래 '지금 그래프 읽기'는 정해진 규칙에 따라 자동으로 바뀌는 해석이에요. 학생이 쓴 해석과 비교해 보세요.</li>
          </ul>
        </div>
        <div class="card pad uses-card" id="uses">
          <h3>${icon("list")} 그래프별 수업 활용 방법</h3>
          <p class="muted">그래프 이름을 누르면 수업에서 해 볼 수 있는 활동이 펼쳐져요.</p>
          <ul class="concepts uses">${SG.graphs.map((g) => `
            <li><details id="use-${g.id}"${g.id === focusId ? " open" : ""}>
              <summary><h3>${esc(g.title)} <span class="use-subjects">${g.subjects.map((s) => esc(subjectLabel(s))).join(" · ")}</span></h3><span class="concept-chev">${icon("chevron", 18)}</span></summary>
              <div class="use-body">
                <ol class="howto">${g.howto.map((h) => `<li>${esc(h)}</li>`).join("")}</ol>
                <a class="btn primary" href="#/graph/${g.id}">그래프 열기 ${icon("right", 16)}</a>
              </div>
            </details></li>`).join("")}
          </ul>
        </div>
      </section>`;
    if (focusId) {
      const el = document.getElementById("use-" + focusId);
      if (el) requestAnimationFrame(() => el.scrollIntoView({ block: "start" }));
      else window.scrollTo(0, 0);
    }
  }

  /* =========================================================
     그래프 탐구 화면
     ========================================================= */
  let cur = null;

  function viewGraph(id) {
    const g = SG.graphs.find((x) => x.id === id);
    if (!g) { app.innerHTML = `<section class="wrap section page-top"><div class="empty">${icon("alert")}<p>그래프를 찾을 수 없어요. <a href="#/explore">그래프 탐색</a>으로 돌아가 주세요.</p></div></section>`; return; }
    const data = SG.data[g.id] || {};
    cur = { g, data, state: g.initial(), base: null, msg: "", tab: null, panelSig: "", presetId: null, source: data.source || SG.VIRTUAL, dirty: false, anim: 0 };

    app.innerHTML = `
      <section class="wrap page-top graph-page">
        <a class="back" href="#/explore">${icon("back", 16)} 그래프 목록으로</a>
        <div class="graph-head">
          <div class="tags">${g.subjects.map((s) => `<span class="tag">${esc(subjectLabel(s))}</span>`).join("")}</div>
          <h1>${esc(g.title)}</h1>
          <p class="lead">${esc(g.desc)}</p>
          <a class="use-link" href="#/guide/${g.id}">${icon("list", 16)} 이 그래프 수업 활용 방법</a>
        </div>

        <div class="stage" id="stage">
          <div class="toolbar">
            <div class="presets" role="group" aria-label="대표 예시">
              <span class="toolbar-label">대표 예시</span>
              ${(data.presets || []).map((p) => `<button type="button" class="chip" data-preset="${p.id}">${esc(p.label)}</button>`).join("")}
            </div>
            <div class="actions">
              <button type="button" class="btn" id="btnBase">${icon("compare", 16)}<span>비교 기준 저장</span></button>
              <button type="button" class="btn hidden" id="btnClearBase">${icon("x", 16)}<span>비교 해제</span></button>
              <button type="button" class="btn" id="btnReset">${icon("reset", 16)}<span>초기화</span></button>
              <button type="button" class="btn" id="btnPng">${icon("download", 16)}<span>PNG 저장</span></button>
              <button type="button" class="btn" id="btnFull">${icon("maximize", 16)}<span>전체 화면</span></button>
            </div>
          </div>
          <div class="lab">
            <div class="card graph-card-main">
              <div class="graph-meta"><span class="source-badge" id="sourceBadge"></span><span class="base-badge hidden" id="baseBadge">점선: 비교 기준</span></div>
              <div class="graph-box" id="graphBox"></div>
              <div class="legend" id="legend"></div>
            </div>
            <aside class="card panel" id="panel" aria-label="수치 조절 패널"></aside>
          </div>
          <div class="card interpret">
            <h2>${icon("lightbulb")} 지금 그래프 읽기</h2>
            <ul id="interpret"></ul>
          </div>
        </div>

        <div class="bottom-grid">
          <section class="card pad"><h2>${icon("book")} 주요 개념</h2><div class="concept">${g.concept}</div></section>
          <section class="card pad"><h2>${icon("table")} 현재 수치 및 계산 결과</h2>
            <div id="resultTiles"></div>
            <button type="button" class="more-toggle" id="btnMore" aria-expanded="false" aria-controls="results"><span>자세히 보기</span>${icon("chevron", 18)}</button>
            <div id="results" class="results-detail" hidden></div>
          </section>
          <section class="card pad span-2"><h2>${icon("compare")} 변화 전후 비교</h2><div id="compare"></div></section>
        </div>
      </section>`;

    app.querySelectorAll("[data-preset]").forEach((b) => b.addEventListener("click", () => applyPreset(b.dataset.preset)));
    document.getElementById("btnMore").addEventListener("click", (e) => {
      const btn = e.currentTarget, open = btn.getAttribute("aria-expanded") !== "true";
      btn.setAttribute("aria-expanded", open);
      btn.querySelector("span").textContent = open ? "간단히 보기" : "자세히 보기";
      document.getElementById("results").hidden = !open;
    });
    document.getElementById("btnBase").addEventListener("click", saveBase);
    document.getElementById("btnClearBase").addEventListener("click", clearBase);
    document.getElementById("btnReset").addEventListener("click", resetAll);
    document.getElementById("btnPng").addEventListener("click", exportPNG);
    document.getElementById("btnFull").addEventListener("click", toggleFull);
    buildPanel(true);
    render();
  }

  /* ---------------- 값 읽기·쓰기 ----------------
     band.* (인구 10세 단위), q.* (한 번에 조절)는 그래프의 get/set으로 읽고 쓴다 */
  const special = (key) => /^(band|q)\./.test(key);
  const getVal = (key) => (cur.g.get && special(key) ? cur.g.get(cur.state, key) : getPath(cur.state, key));
  function setVal(key, v) { if (cur.g.set && special(key)) cur.g.set(cur.state, key, v); else setPath(cur.state, key, v); }

  /* ---------------- 수치 조절 패널 ----------------
     spec.quick이 있으면: 위에는 '한 번에 조절' 슬라이더, 칸별 슬라이더(tabs·groups)는 '세부 조절' 안에 접어 둔다 */
  function ctrlHTML(it) {
    const id = "c_" + it.key.replace(/\./g, "_");
    return `<div class="ctrl${it.readonly ? " readonly" : ""}" data-key="${it.key}">
          <div class="ctrl-top">
            <label for="${id}n">${esc(it.label)}${it.tag ? ` <span class="move-tag ${it.tagClass}">${esc(it.tag)}</span>` : ""}</label>
            <span class="num-wrap"><input id="${id}n" class="num" type="number" inputmode="decimal" min="${it.min}" max="${it.max}" step="${it.step}" ${it.readonly ? "readonly tabindex=\"-1\"" : ""} data-key="${it.key}" aria-label="${esc(it.label)} 값"><span class="unit">${esc(it.unit || "")}</span></span>
          </div>
          <input id="${id}" class="range" type="range" min="${it.min}" max="${it.max}" step="${it.step}" ${it.readonly ? "disabled" : ""} data-key="${it.key}" aria-label="${esc(it.label)}">
        </div>`;
  }
  function buildPanel(force) {
    const spec = cur.g.controls(cur.state);
    if (spec.tabs && !spec.tabs.some((t) => t.id === cur.tab)) cur.tab = spec.tabs[0].id;
    const groups = spec.groups.filter((gr) => !spec.tabs || gr.tab === cur.tab);
    const sig = JSON.stringify([cur.tab, (spec.top || []).map((t) => t.key + getPath(cur.state, t.key)), groups.map((gr) => gr.items.map((i) => i.key))]);
    if (!force && sig === cur.panelSig) return syncPanel();
    cur.panelSig = sig;
    const panel = document.getElementById("panel");
    let h = `<h2>${icon("sliders")} 수치 조절</h2>`;
    (spec.top || []).forEach((t) => {
      const val = getPath(cur.state, t.key);
      h += `<div class="seg-row"><span class="seg-label">${esc(t.label)}</span><div class="segment" role="group" aria-label="${esc(t.label)}">${t.options.map((o) =>
        `<button type="button" data-seg="${t.key}" data-val="${o.value}" class="${o.value === val ? "active" : ""}" aria-pressed="${o.value === val}">${esc(o.label)}</button>`).join("")}</div></div>`;
    });
    let d = "";
    if (spec.tabs) d += `<div class="tabs" role="tablist">${spec.tabs.map((t) => `<button type="button" role="tab" data-tab="${t.id}" class="${t.id === cur.tab ? "active" : ""}" aria-selected="${t.id === cur.tab}">${esc(t.label)}</button>`).join("")}</div>`;
    if (spec.note) d += `<p class="panel-note">${esc(spec.note)}</p>`;
    groups.forEach((gr) => {
      d += `<fieldset class="ctrl-group"><legend>${esc(gr.title)}</legend>${gr.note ? `<p class="panel-note">${esc(gr.note)}</p>` : ""}${gr.items.map(ctrlHTML).join("")}</fieldset>`;
    });
    if (spec.quick) {
      const q = spec.quick, open = !!cur.detailOpen;
      h += `<fieldset class="ctrl-group quick"><legend>${esc(q.title)}</legend>${q.note ? `<p class="panel-note">${esc(q.note)}</p>` : ""}${q.items.map(ctrlHTML).join("")}</fieldset>`;
      h += `<p class="panel-msg" id="panelMsg" role="status" aria-live="polite"></p>`;
      h += `<button type="button" class="more-toggle detail-toggle" id="btnDetail" aria-expanded="${open}" aria-controls="panelDetail"><span>${open ? "접기" : (spec.detailLabel || "세부 조절 (한 칸씩 바꾸기)")}</span>${icon("chevron", 18)}</button>`;
      h += `<div id="panelDetail" class="panel-detail"${open ? "" : " hidden"}>${d}</div>`;
    } else {
      h += d + `<p class="panel-msg" id="panelMsg" role="status" aria-live="polite"></p>`;
    }
    panel.innerHTML = h;
    cur.items = {};
    (spec.quick ? spec.quick.items : []).forEach((it) => (cur.items[it.key] = it));
    spec.groups.forEach((gr) => gr.items.forEach((it) => (cur.items[it.key] = it)));
    const bd = document.getElementById("btnDetail");
    if (bd) bd.addEventListener("click", () => {
      cur.detailOpen = !cur.detailOpen;
      bd.setAttribute("aria-expanded", cur.detailOpen);
      bd.querySelector("span").textContent = cur.detailOpen ? "접기" : (spec.detailLabel || "세부 조절 (한 칸씩 바꾸기)");
      document.getElementById("panelDetail").hidden = !cur.detailOpen;
    });

    panel.querySelectorAll("[data-seg]").forEach((b) => b.addEventListener("click", () => {
      setPath(cur.state, b.dataset.seg, b.dataset.val);
      buildPanel(); render();
    }));
    panel.querySelectorAll("[data-tab]").forEach((b) => b.addEventListener("click", () => { cur.tab = b.dataset.tab; buildPanel(); }));
    panel.querySelectorAll("input.range").forEach((el) => el.addEventListener("input", () => onValue(el.dataset.key, parseFloat(el.value), "range")));
    panel.querySelectorAll("input.num:not([readonly])").forEach((el) => {
      el.addEventListener("input", () => {
        const it = cur.items[el.dataset.key], v = parseFloat(el.value);
        if (el.value !== "" && isFinite(v) && v >= it.min && v <= it.max) onValue(el.dataset.key, v, "typing");
      });
      el.addEventListener("change", () => onValue(el.dataset.key, el.value === "" ? NaN : parseFloat(el.value), "commit"));
      el.addEventListener("keydown", (e) => { if (e.key === "Enter") el.blur(); });
    });
    syncPanel();
  }
  function syncPanel() {
    const panel = document.getElementById("panel");
    if (!panel) return;
    panel.querySelectorAll("input[data-key]").forEach((el) => {
      const it = cur.items[el.dataset.key];
      const v = getVal(el.dataset.key);
      const shown = Number(v).toFixed(decimals(it.step));
      if (el.classList.contains("num") && document.activeElement === el && cur.typing) return;
      el.value = shown;
    });
    const msg = document.getElementById("panelMsg");
    if (msg) { msg.textContent = cur.msg || ""; msg.classList.toggle("show", !!cur.msg); }
  }

  /* 값이 바뀌었을 때: 범위 확인 → 그래프별 규칙 적용 → 다시 그리기 */
  function onValue(key, v, how) {
    const it = cur.items[key];
    if (!it || it.readonly) return;
    cancelAnim();
    let msg = "";
    if (!isFinite(v)) {
      msg = "숫자를 입력해 주세요. 이전 값으로 되돌렸어요.";
      cur.msg = msg; cur.typing = false; syncPanel(); return;
    }
    if (v < it.min || v > it.max) {
      const c = u.clamp(v, it.min, it.max), dd = decimals(it.step), un = it.unit || "";
      const maxTxt = u.n(it.max, dd) + un, cTxt = u.n(c, dd) + un;
      msg = `입력할 수 있는 범위는 ${u.n(it.min, dd)}${un}~${maxTxt}${tail(maxTxt) ? "이에요" : "예요"}. ${cTxt}${tail(cTxt) === 1 ? "으로" : "로"} 맞췄어요.`;
      v = c;
    }
    const d = decimals(it.step);
    v = Math.round(v / it.step) * it.step;
    v = Number(v.toFixed(d));
    const prev = u.clone(cur.state);
    setVal(key, v);
    const m2 = cur.g.normalize ? cur.g.normalize(cur.state, key, prev) : null;
    cur.msg = [msg, m2].filter(Boolean).join(" ");
    cur.typing = how === "typing";
    cur.presetId = null;
    cur.dirty = true;
    render();
    buildPanel();
  }

  /* ---------------- 예시 · 초기화 · 비교 ---------------- */
  function applyPreset(pid) {
    const p = (cur.data.presets || []).find((x) => x.id === pid);
    if (!p) return;
    const target = cur.g.applyPreset ? cur.g.applyPreset(cur.state, p) : Object.assign(u.clone(cur.state), u.clone(p.state));
    if (p.baselineInitial) cur.base = cur.g.initial();
    cur.msg = p.baselineInitial ? "처음 상태를 비교 기준(점선)으로 함께 표시했어요." : "";
    cur.presetId = pid;
    cur.source = p.source || cur.data.source || SG.VIRTUAL;
    cur.dirty = false;
    animateTo(target);
  }
  function resetAll() {
    cur.msg = "모든 수치를 처음 값으로 되돌렸어요.";
    cur.presetId = null;
    cur.source = cur.data.source || SG.VIRTUAL;
    cur.dirty = false;
    animateTo(cur.g.initial());
  }
  function saveBase() {
    cancelAnim();
    cur.base = u.clone(cur.state);
    cur.msg = "지금 그래프를 비교 기준으로 저장했어요. 이제 수치를 바꿔 보세요.";
    render(); syncPanel();
  }
  function clearBase() { cur.base = null; cur.msg = ""; render(); syncPanel(); }

  /* 예시·초기화 때만 짧게(0.28초) 부드럽게 바뀌게 한다 */
  function cancelAnim() {
    if (!cur || !cur.animTarget) return;
    cancelAnimationFrame(cur.anim);
    clearTimeout(cur.animTimer);
    cur.anim = 0;
    cur.state = cur.animTarget;
    cur.animTarget = null;
  }
  function animateTo(target) {
    cancelAnim();
    const from = u.clone(cur.state);
    const finish = () => {
      if (!cur.animTarget) return;
      cancelAnimationFrame(cur.anim); clearTimeout(cur.animTimer);
      cur.anim = 0;
      cur.state = cur.animTarget; cur.animTarget = null;
      buildPanel(true); render();
    };
    cur.animTarget = u.clone(target);
    if (reduceMotion() || document.hidden) return finish();
    const t0 = performance.now(), dur = 280;
    const step = (now) => {
      const t = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - t, 3);
      if (t >= 1) return finish();
      cur.state = lerp(from, target, e);
      render(true); syncPanel();
      cur.anim = requestAnimationFrame(step);
    };
    cur.anim = requestAnimationFrame(step);
    // 화면이 잠시 멈춰 애니메이션 프레임이 오지 않아도 반드시 끝 상태로 맞춘다
    cur.animTimer = setTimeout(finish, dur + 80);
  }

  /* ---------------- 다시 그리기 ---------------- */
  function sourceText() {
    const s = cur.source || SG.VIRTUAL;
    if (s.type !== "real") return { html: `${icon("info", 14)} 학습용 가상 데이터`, plain: "학습용 가상 데이터 (실제 통계자료가 아닙니다)" };
    const orig = `${s.name} (${s.org}, ${s.year}${s.unit ? ", 단위: " + s.unit : ""})`;
    if (cur.dirty) return { html: `${icon("alert", 14)} 원본 자료를 바꾼 가상 실험 결과 · 원본: ${esc(orig)}`, plain: `원본 자료를 바꾼 가상 실험 결과 · 원본: ${orig}` };
    return { html: `${icon("info", 14)} 자료: ${esc(orig)}${s.url ? ` <a href="${esc(s.url)}" target="_blank" rel="noopener">출처 링크</a>` : ""}`, plain: `자료: ${orig}${s.url ? " " + s.url : ""}` };
  }
  function legendHTML(items) {
    return items.map((l) => `<span class="lg"><i style="${l.dash ? `border-top:3px dashed ${l.color};background:none;height:0` : `background:${l.color}`}"></i>${esc(l.label)}</span>`).join("");
  }
  function fmtMetric(m, v) {
    if (!isFinite(v)) return "-";
    const unit = m.unit === "%p" ? "%" : m.unit;
    return u.n(v, m.digits) + (unit || "");
  }
  function compareHTML(res, bres) {
    if (!cur.base) return `<p class="muted">아직 비교 기준이 없어요. 위의 <b>비교 기준 저장</b>을 누르면 지금 그래프가 점선으로 남고, 이후 수치를 바꾸면 여기에서 변화량을 확인할 수 있어요.</p>`;
    const now = cur.g.metrics(cur.state, res), before = cur.g.metrics(cur.base, bres);
    const rows = now.map((m) => {
      const b = before.find((x) => x.label === m.label);
      if (!b) return "";
      const diff = m.value - b.value;
      let dtxt = "-", cls = "";
      if (isFinite(diff)) {
        dtxt = u.signed(diff, m.digits);
        if (dtxt !== "변화 없음") dtxt += m.unit === "%p" ? "%p" : (m.unit || "");
        cls = diff > 0 && dtxt !== "변화 없음" ? "up" : diff < 0 && dtxt !== "변화 없음" ? "down" : "";
      }
      return `<tr><td>${esc(m.label)}</td><td>${fmtMetric(b, b.value)}</td><td><b>${fmtMetric(m, m.value)}</b></td><td class="diff ${cls}">${dtxt}</td></tr>`;
    }).join("");
    return `<table class="data-table compare-table"><thead><tr><th>항목</th><th>비교 기준</th><th>현재</th><th>증감</th></tr></thead><tbody>${rows}</tbody></table>
      <p class="small muted">그래프의 점선(회색)이 비교 기준, 실선(색)이 현재 상태예요.</p>`;
  }
  function render(light) {
    const g = cur.g, res = g.compute(cur.state);
    const bres = cur.base ? g.compute(cur.base) : null;
    cur.res = res; cur.bres = bres;
    const box = document.getElementById("graphBox");
    SG.viewWidth = box.clientWidth; // 그래프가 화면 폭에 맞춰 배치를 고를 수 있게 알려 준다
    box.innerHTML = g.draw(cur.state, res, cur.base, bres);
    document.getElementById("legend").innerHTML = legendHTML(g.legend(cur.state, res, cur.base));
    document.getElementById("sourceBadge").innerHTML = sourceText().html;
    document.getElementById("baseBadge").classList.toggle("hidden", !cur.base);
    document.getElementById("btnClearBase").classList.toggle("hidden", !cur.base);
    document.querySelector("#btnBase span").textContent = cur.base ? "비교 기준 다시 저장" : "비교 기준 저장";
    app.querySelectorAll("[data-preset]").forEach((b) => { b.classList.toggle("active", b.dataset.preset === cur.presetId); b.setAttribute("aria-pressed", b.dataset.preset === cur.presetId); });
    if (light) return;
    document.getElementById("interpret").innerHTML = g.interpret(cur.state, res, cur.base, bres).map((x) => `<li>${x}</li>`).join("");
    const tiles = g.metrics(cur.state, res).map((m) =>
      `<div class="stat"><span class="stat-label">${esc(m.label)}</span><span class="stat-value">${fmtMetric(m, m.value)}</span></div>`).join("");
    document.getElementById("resultTiles").innerHTML = `<div class="stat-tiles">${tiles}</div>`;
    document.getElementById("results").innerHTML = g.results(cur.state, res);
    document.getElementById("compare").innerHTML = compareHTML(res, bres);
  }

  /* ---------------- PNG 저장 ---------------- */
  function exportPNG() {
    const g = cur.g, svgStr = g.draw(cur.state, cur.res, cur.base, cur.bres);
    const img = new Image();
    const url = URL.createObjectURL(new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" }));
    img.onload = () => {
      const W = 1600, P = 64, inner = W - P * 2;
      const gw = img.width || 760, gh = img.height || 500;
      const scale = Math.min(inner / gw, 900 / gh);
      const dw = gw * scale, dh = gh * scale;
      const legend = g.legend(cur.state, cur.res, cur.base);
      const metrics = g.metrics(cur.state, cur.res);
      const font = (w, s) => `${w} ${s}px Pretendard, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif`;
      // 높이 계산을 위해 측정용 캔버스 사용
      const m = document.createElement("canvas").getContext("2d");
      const layoutRow = (items, size, gap, measure) => {
        const rows = [[]]; let x = 0;
        items.forEach((it) => { const w = measure(it); if (x + w > inner && rows[rows.length - 1].length) { rows.push([]); x = 0; } rows[rows.length - 1].push({ it, w }); x += w + gap; });
        return rows;
      };
      m.font = font(500, 24);
      const lRows = layoutRow(legend, 24, 36, (l) => 44 + m.measureText(l.label).width);
      m.font = font(700, 28);
      const mItems = metrics.map((x) => ({ label: x.label, value: fmtMetric(x, x.value) }));
      const mRows = layoutRow(mItems, 28, 20, (x) => { m.font = font(700, 30); const a = m.measureText(x.value).width; m.font = font(500, 20); return Math.max(a, m.measureText(x.label).width) + 48; });
      const H = P + 40 + 64 + 24 + dh + 32 + lRows.length * 40 + 24 + mRows.length * 104 + 28 + 70 + P / 2;
      const cv = document.createElement("canvas");
      cv.width = W; cv.height = Math.ceil(H);
      const c = cv.getContext("2d");
      c.fillStyle = "#FFFFFF"; c.fillRect(0, 0, W, H);
      let y = P;
      c.fillStyle = "#5B8FC9"; c.font = font(700, 22); c.textBaseline = "top";
      c.fillText("SOCIAL GRAPH · " + g.subjects.map(subjectLabel).join(" · "), P, y);
      y += 40;
      c.fillStyle = "#243447"; c.font = font(700, 48); c.fillText(g.title, P, y);
      y += 64 + 24;
      c.drawImage(img, P + (inner - dw) / 2, y, dw, dh);
      y += dh + 32;
      lRows.forEach((row) => {
        let x = P;
        row.forEach(({ it, w }) => {
          if (it.dash) { c.strokeStyle = it.color; c.lineWidth = 4; c.setLineDash([10, 7]); c.beginPath(); c.moveTo(x, y + 14); c.lineTo(x + 32, y + 14); c.stroke(); c.setLineDash([]); }
          else { c.fillStyle = it.color; c.fillRect(x, y + 4, 32, 20); }
          c.fillStyle = "#243447"; c.font = font(500, 24); c.fillText(it.label, x + 44, y + 1);
          x += w + 36;
        });
        y += 40;
      });
      y += 24;
      mRows.forEach((row) => {
        let x = P;
        row.forEach(({ it, w }) => {
          c.fillStyle = "#F7F9FC"; c.fillRect(x, y, w, 88);
          c.strokeStyle = "#DDEAF6"; c.lineWidth = 2; c.strokeRect(x, y, w, 88);
          c.fillStyle = "#788797"; c.font = font(500, 20); c.fillText(it.label, x + 24, y + 14);
          c.fillStyle = "#294B70"; c.font = font(700, 30); c.fillText(it.value, x + 24, y + 44);
          x += w + 20;
        });
        y += 104;
      });
      y += 28;
      c.strokeStyle = "#DDEAF6"; c.lineWidth = 2; c.beginPath(); c.moveTo(P, y); c.lineTo(W - P, y); c.stroke();
      y += 20;
      c.fillStyle = "#788797"; c.font = font(500, 20);
      c.fillText("자료: " + sourceText().plain + (cur.base ? " · 점선은 비교 기준" : ""), P, y);
      const d = new Date();
      const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      c.fillText("SOCIAL GRAPH에서 저장 · " + ds, P, y + 30);
      URL.revokeObjectURL(url);
      cv.toBlob((blob) => {
        if (!blob) { cur.msg = "이미지를 만들지 못했어요. 다른 브라우저에서 다시 시도해 주세요."; syncPanel(); return; }
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `social-graph_${g.id}_${ds}.png`;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
        cur.msg = "PNG 이미지를 저장했어요.";
        syncPanel();
      }, "image/png");
    };
    img.onerror = () => { URL.revokeObjectURL(url); cur.msg = "이미지를 만들지 못했어요."; syncPanel(); };
    img.src = url;
  }

  /* ---------------- 전체 화면 ---------------- */
  function isFull() { return document.fullscreenElement || document.webkitFullscreenElement || document.getElementById("stage")?.classList.contains("pseudo-full"); }
  function toggleFull() {
    const st = document.getElementById("stage");
    if (isFull()) {
      if (document.fullscreenElement) document.exitFullscreen();
      else if (document.webkitFullscreenElement) document.webkitExitFullscreen();
      else { st.classList.remove("pseudo-full"); document.body.classList.remove("no-scroll"); updateFullBtn(); redrawSoon(); }
      return;
    }
    const pseudo = () => { st.classList.add("pseudo-full"); document.body.classList.add("no-scroll"); updateFullBtn(); redrawSoon(); };
    const req = st.requestFullscreen || st.webkitRequestFullscreen;
    if (req) {
      let done = false;
      const fallback = () => { if (!done && !document.fullscreenElement && !document.webkitFullscreenElement) { done = true; pseudo(); } };
      try {
        const r = req.call(st);
        if (r && r.catch) r.catch(fallback);
      } catch (e) { fallback(); }
      // 브라우저가 전체 화면을 막고 아무 응답도 주지 않는 경우에도 화면 안에서 크게 보여 준다
      setTimeout(fallback, 500);
    } else pseudo();
  }
  function updateFullBtn() {
    const b = document.getElementById("btnFull");
    if (!b) return;
    const on = !!isFull();
    b.innerHTML = on ? `${icon("minimize", 16)}<span>전체 화면 끝내기</span>` : `${icon("maximize", 16)}<span>전체 화면</span>`;
  }
  let resizeTimer;
  function redrawSoon() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { if (cur && document.getElementById("graphBox")) render(true); }, 120);
  }
  window.addEventListener("resize", redrawSoon);
  document.addEventListener("fullscreenchange", () => {
    const st = document.getElementById("stage");
    if (document.fullscreenElement && st) { st.classList.remove("pseudo-full"); document.body.classList.remove("no-scroll"); }
    updateFullBtn(); redrawSoon();
  });
  document.addEventListener("webkitfullscreenchange", () => { updateFullBtn(); redrawSoon(); });
  document.addEventListener("keydown", (e) => {
    const st = document.getElementById("stage");
    if (e.key === "Escape" && st && st.classList.contains("pseudo-full")) { st.classList.remove("pseudo-full"); document.body.classList.remove("no-scroll"); updateFullBtn(); redrawSoon(); }
  });

  /* ---------------- 화면 이동 (주소의 # 뒤를 사용해 GitHub Pages 하위 경로에서도 동작) ---------------- */
  function route() {
    cancelAnim();
    const st = document.getElementById("stage");
    if (st && st.classList.contains("pseudo-full")) document.body.classList.remove("no-scroll");
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    const h = location.hash.replace(/^#/, "") || "/";
    const parts = h.split("/").filter(Boolean);
    if (parts[0] === "graph" && parts[1]) { renderTopbar("graph"); viewGraph(parts[1]); }
    else if (parts[0] === "explore") { renderTopbar("explore"); viewExplore(); }
    else if (parts[0] === "guide") { renderTopbar("guide"); viewGuide(parts[1]); if (parts[1]) return; }
    else { renderTopbar("home"); viewHome(); }
    window.scrollTo(0, 0);
  }
  window.addEventListener("hashchange", route);
  route();
})();
