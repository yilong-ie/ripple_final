/* VineLedger interactive prototype - mock data only */

const SCENARIOS = [
  {
    id: "rioja", n: "01", label: "Rioja Reserve", tag: "La Rioja · ES",
    issuer: "Rioja Family Estate", spv: "Rioja Reserve 2027 SPV",
    project: "VineLedger Series A1", vintage: "2027 Reserve",
    currency: "VIN", target: "20.00", raised: "15.00", pct: 75,
    investor: "Atlas Family Office", jurisdiction: "France",
    lockup: 180, share: 12, subscription: "15", payout: "1.5",
    folio: "VL-2027-001",
  },
  {
    id: "bordeaux", n: "02", label: "Bordeaux Barrel", tag: "Bordeaux · FR",
    issuer: "Chateau Marais", spv: "Bordeaux Barrel 2028 SPV",
    project: "VineLedger Barrel Window", vintage: "2028 Barrel Lot",
    currency: "BDX", target: "28.00", raised: "18.00", pct: 64,
    investor: "Cygnet Capital", jurisdiction: "Luxembourg",
    lockup: 270, share: 10, subscription: "18", payout: "1.8",
    folio: "VL-2028-002",
  },
  {
    id: "douro", n: "03", label: "Douro Export", tag: "Douro · PT",
    issuer: "Quinta do Vale Azul", spv: "Douro Export 2027 SPV",
    project: "VineLedger Export Line", vintage: "2027 Export Allocation",
    currency: "DRO", target: "24.00", raised: "16.00", pct: 67,
    investor: "Northbridge Treasury", jurisdiction: "Germany",
    lockup: 120, share: 9, subscription: "16", payout: "1.35",
    folio: "VL-2027-003",
  },
];

const LIFECYCLE = [
  { k: "setup",       l: "Issuer Controls",  done: true },
  { k: "trustline",   l: "Trust Line",       done: true },
  { k: "authorize",   l: "Allow-list",       done: true },
  { k: "subscribe",   l: "Subscription",     done: true },
  { k: "issue",       l: "Token Delivery",   done: true },
  { k: "payout",      l: "Payout",           done: true },
  { k: "freeze",      l: "Freeze Hold",      done: false, optional: true },
  { k: "release",     l: "Release",          done: false, optional: true },
];

const POLICY = [
  { k: "Issuer Controls",    v: "Armed",   s: "passed" },
  { k: "KYC",                v: "Passed",  s: "passed" },
  { k: "Sanctions",          v: "Clear",   s: "passed" },
  { k: "Wallet Screening",   v: "Cleared", s: "passed" },
  { k: "Suitability",        v: "Passed",  s: "passed" },
  { k: "Jurisdiction",       v: "Approved",s: "passed" },
  { k: "Transfer Rules",     v: "Enforced",s: "passed" },
  { k: "Sales Report",       v: "Filed",   s: "passed" },
];

const WALLETS = [
  { role: "issuer",   name: "Issuer",   glyph: "I", addr: "rP4TyHw8a9QxEmBc2Vn5",  xrp: "39.78", tok: "0",     unit: "VIN" },
  { role: "treasury", name: "Treasury", glyph: "T", addr: "rK2dGp41FxVeHuQt9rLp",  xrp: "63.50", tok: "—",     unit: "VIN" },
  { role: "investor", name: "Investor", glyph: "A", addr: "rG7HfB9kPzNaYu3SxJwE",  xrp: "18.62", tok: "1,000", unit: "VIN" },
];

const FLOW = [
  { label: "Subscription",  v: "15.00 XRP",        note: "Atlas Family Office",        active: true },
  { label: "Treasury",      v: "15.00 XRP",        note: "Rioja Reserve 2027 SPV",     active: true },
  { label: "Token Delivery",v: "1,000 VIN",        note: "0.0150 XRP / token",         active: true },
  { label: "Sales",         v: "12.50 XRP",        note: "313 bottles reported",       active: true },
  { label: "Payout",        v: "1.50 XRP",         note: "12% revenue share",          active: true },
  { label: "Compliance",    v: "Clear",            note: "Transfers open",             active: false },
];

const TIMELINE = [
  { k:"policy",  t:"14:12", title:"Hold released",             d:"Compliance review cleared the investor wallet; transfers restored." },
  { k:"business",t:"14:08", title:"Revenue share distributed", d:"Atlas Family Office received 1.50 XRP simulated distribution." },
  { k:"business",t:"14:04", title:"Sales report approved",     d:"Reporting cycle closed; payout window approved." },
  { k:"tx",      t:"13:58", title:"Issuer distributed tokens", d:"1,000 VIN delivered to approved investor wallet.", link:true },
  { k:"business",t:"13:52", title:"SPV treasury funded",       d:"Treasury received 15.00 XRP from Atlas Family Office." },
  { k:"policy",  t:"13:40", title:"KYC and allow-list complete",d:"Investor wallet authorized to receive VIN." },
  { k:"policy",  t:"13:28", title:"Wallet submitted for screening",d:"Atlas Family Office opened a trust line and entered review." },
  { k:"tx",      t:"13:14", title:"Investor created trust line",d:"TrustSet accepted on XRPL Testnet.", link:true },
  { k:"policy",  t:"13:02", title:"Policy gateway ready",      d:"RequireAuth and transfer restrictions active." },
  { k:"info",    t:"12:48", title:"Wallets funded",            d:"Issuer, treasury, and investor accounts received Testnet XRP." },
];

const METRICS = [
  { k: "Raise Target",     v: "20.00",     u:"XRP",  h: "Rioja Reserve 2027 SPV", tone:"" },
  { k: "Committed",        v: "15.00",     u:"XRP",  h: "75% placed", tone:"gold", delta:"↑ 3.0" },
  { k: "Token Supply",     v: "1,000",     u:"VIN",  h: "0.0150 XRP / token", tone:"" },
  { k: "Payout Yield",     v: "10.00",     u:"%",    h: "1.50 XRP sent", tone:"ok" },
  { k: "Active Holders",   v: "1",         u:"",     h: "1 approved wallet", tone:"" },
  { k: "Sales Report",     v: "12.50",     u:"XRP",  h: "Filed · approved", tone:"ok" },
];

/* ================= render ================= */
const $ = (s, r=document) => r.querySelector(s);
const h = (html) => { const t=document.createElement("template"); t.innerHTML=html.trim(); return t.content.firstChild; };

function renderScenarios(activeId) {
  const grid = $("#scenarioGrid");
  grid.innerHTML = SCENARIOS.map(s => `
    <button class="scenario-card ${s.id===activeId ? "is-active" : ""}" data-id="${s.id}">
      <span class="s-num">SCN · ${s.n}</span>
      <span class="s-tag">${s.tag}</span>
      <h3>${s.label}</h3>
      <dl>
        <div><dt>Issuer</dt><dd>${s.issuer}</dd></div>
        <div><dt>Target</dt><dd>${s.target} XRP</dd></div>
        <div><dt>Token</dt><dd>${s.currency}</dd></div>
      </dl>
    </button>
  `).join("");
  grid.addEventListener("click", (e) => {
    const card = e.target.closest("[data-id]");
    if (!card) return;
    const s = SCENARIOS.find(x => x.id === card.dataset.id);
    if (s) applyScenario(s);
  }, { once: true });
}

function renderLifeline() {
  $("#lifeline").innerHTML = LIFECYCLE.map((x, i) => {
    const cls = [x.done && "done", !x.done && i === 6 && "current", x.optional && "optional"].filter(Boolean).join(" ");
    return `
      <li class="${cls}">
        <span class="n"><span>${String(i+1).padStart(2,"0")}</span></span>
        <span class="l">${x.l}</span>
        <span class="s">${x.done ? "Complete" : x.optional ? "Optional" : "Pending"}</span>
      </li>`;
  }).join("");
}

function renderPolicy() {
  $("#policyGrid").innerHTML = POLICY.map(p => `
    <div class="policy-cell" data-s="${p.s}">
      <span class="pc-k">${p.k}</span>
      <span class="pc-v">${p.v}</span>
    </div>
  `).join("");
}

function renderWallets() {
  $("#walletList").innerHTML = WALLETS.map(w => `
    <div class="wallet" data-role="${w.role}">
      <div class="wallet-icon">${w.glyph}</div>
      <div class="wallet-body">
        <div class="wallet-role">${w.name} · XRPL</div>
        <div class="wallet-name">${w.name} Wallet</div>
        <div class="wallet-addr">${w.addr}…</div>
      </div>
      <div class="wallet-bal">
        <b>${w.xrp} <small style="font-size:11px;color:#6b5d54;font-family:'JetBrains Mono',mono">XRP</small></b>
        <small>${w.tok} ${w.unit}</small>
      </div>
    </div>
  `).join("");
}

function renderFlow() {
  $("#flowChain").innerHTML = FLOW.map((f, i) => `
    <li data-n="${i+1}" class="${f.active ? "active" : ""}">
      <div></div>
      <div class="flow-body">
        <span class="f-k">${f.label}</span>
        <b>${f.v}</b>
        <small>${f.note}</small>
      </div>
      <div class="flow-icon">
        <svg viewBox="0 0 20 20" width="18" height="18"><path d="M4 10 h10 M10 6 l4 4 -4 4" stroke="currentColor" stroke-width="1.3" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </div>
    </li>
  `).join("");
}

function renderTimeline() {
  $("#timeline").innerHTML = TIMELINE.map(t => `
    <li data-k="${t.k}">
      <div class="t-row">
        <span class="t-time">${t.t}<span class="t-kind">${t.k}</span></span>
      </div>
      <b>${t.title}</b>
      <small>${t.d}</small>
      ${t.link ? `<a href="#">View on explorer ↗</a>` : ""}
    </li>
  `).join("");
}

function renderTicker() {
  $("#tickerRow").innerHTML = METRICS.map((m, i) => `
    <div ${m.tone ? `data-tone="${m.tone}"` : ""}>
      <span class="tk">${m.k}</span>
      <span class="tv"><span class="tv-num" data-target="${m.v}">0</span>${m.u ? ` <small style="font-size:12px;color:rgba(249,238,216,.5);font-family:'JetBrains Mono',mono">${m.u}</small>`:""}${m.delta ? `<span class="delta">${m.delta}</span>`:""}</span>
      <span class="th">${m.h}</span>
    </div>
  `).join("");
  // count up each value after entrance
  setTimeout(() => {
    document.querySelectorAll(".tv-num").forEach((el, i) => {
      setTimeout(() => countUp(el, el.dataset.target), i * 120);
    });
  }, 400);
}

function countUp(el, target) {
  const clean = String(target).replace(/,/g, "");
  const isFloat = clean.includes(".");
  const end = parseFloat(clean);
  if (!isFinite(end)) { el.textContent = target; return; }
  const dur = 900;
  const t0 = performance.now();
  const fmt = (n) => {
    if (isFloat) return n.toFixed(2);
    return Math.round(n).toLocaleString();
  };
  function tick(now) {
    const p = Math.min(1, (now - t0) / dur);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = fmt(end * eased);
    if (p < 1) requestAnimationFrame(tick);
    else el.textContent = target;
  }
  requestAnimationFrame(tick);
}

// scroll reveal for cards lower on the page
function wireReveal() {
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.style.animation = "rise .6s ease both";
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.08 });
  document.querySelectorAll(".shell > .card, .shell > .dual-row > .card").forEach(el => {
    el.style.opacity = "0";
    io.observe(el);
  });
}

// ticker flash on tweak change (feels alive)
function flashTicker() {
  document.querySelectorAll("#tickerRow > div").forEach((d, i) => {
    setTimeout(() => {
      d.classList.remove("flash");
      void d.offsetWidth;
      d.classList.add("flash");
    }, i * 60);
  });
}

function setWineFill(pct) {
  const el = document.querySelector(".folio-art");
  if (el) el.style.setProperty("--fill", Math.max(0, Math.min(100, pct)));
}

function applyScenario(s) {
  $("#activeScenario").textContent = s.label;
  $("#scenarioPill").innerHTML = `<span class="pip"></span>${s.label} — <em>Live Preview</em>`;
  $("#dealTitle").innerHTML = `${s.project.split(" ").slice(0,-1).join(" ")} <span class="amp">${s.project.split(" ").slice(-1)}</span>`;
  $("#dealSub").textContent = `${s.issuer} · ${s.spv}`;
  $("#sIssuer").textContent = s.issuer;
  $("#sSpv").textContent = s.spv;
  $("#sVintage").textContent = s.vintage;
  $("#sJuris").textContent = s.tag;
  $("#sInv").textContent = s.investor;
  $("#sLock").textContent = `${s.lockup} days`;
  $("#targetNum").textContent = s.target;
  $("#commitPct").textContent = s.pct;
  $("#gap").textContent = (parseFloat(s.target) - parseFloat(s.raised)).toFixed(2);
  $("#folioNum").textContent = s.folio;

  // re-render scenarios with new active
  renderScenarios(s.id);
  // set arc
  setArc(s.pct);
  setWineFill(s.pct);
  setMsg(`Scenario loaded: ${s.label}. Ready for Testnet flow.`);
  flashTicker();
}

function setArc(pct) {
  // arc path from (10,60) to (110,60) along 180° semicircle
  const angle = Math.PI * (1 - pct / 100); // from π (left) to 0 (right)
  const cx = 60, cy = 60, r = 50;
  const x = cx - r * Math.cos(angle);
  const y = cy - r * Math.sin(angle);
  const large = pct > 50 ? 1 : 0;
  const arc = document.getElementById("arcFill");
  if (arc) arc.setAttribute("d", `M10 60 A50 50 0 0 ${large === 0 ? 0 : 1} ${x.toFixed(1)} ${y.toFixed(1)}`);
}

function setMsg(text) {
  $("#consoleMsg .msg-text").textContent = text;
}

/* ================= sequence buttons ================= */
const SEQ_MSGS = {
  trustline:"Submitting TrustSet from investor wallet...",
  authorize:"Allow-listing wallet via issuer TrustSet + tfSetfAuth...",
  subscribe:"Receiving subscription payment into treasury...",
  issue:"Issuing 1,000 VIN to approved investor wallet...",
  payout:"Distributing 1.50 XRP revenue share from treasury...",
  freeze:"Freezing trust line · compliance hold enacted.",
  release:"Clearing freeze · manual review complete.",
};

document.addEventListener("click", (e) => {
  const b = e.target.closest(".seq-btn");
  if (b) {
    b.classList.remove("is-done");
    b.classList.add("is-busy");
    setMsg(SEQ_MSGS[b.dataset.k] || "Running step...");
    setTimeout(() => { b.classList.remove("is-busy"); b.classList.add("is-done"); }, 520);
    return;
  }
  const tab = e.target.closest(".tab");
  if (tab) {
    const name = tab.dataset.tab;
    tab.parentElement.querySelectorAll(".tab").forEach(t => t.classList.toggle("is-active", t === tab));
    document.querySelectorAll("[data-tab].tab-panel").forEach(p => p.classList.toggle("is-active", p.dataset.tab === name));
  }
});

$("#autoRunBtn").addEventListener("click", () => {
  const btns = [...document.querySelectorAll(".seq-btn:not(.seq-danger):not(.seq-safe)")];
  btns.forEach(b => b.classList.remove("is-done", "is-busy"));
  let i = 0;
  setMsg("Auto-run started · streaming XRPL operations...");
  const step = () => {
    if (i >= btns.length) { setMsg("Happy path complete. All steps confirmed on XRPL Testnet."); flashTicker(); return; }
    const b = btns[i];
    b.classList.add("is-busy");
    setMsg(SEQ_MSGS[b.dataset.k]);
    setTimeout(() => {
      b.classList.remove("is-busy");
      b.classList.add("is-done");
      i++; step();
    }, 620);
  };
  step();
});

$("#launchBtn").addEventListener("click", () => {
  document.querySelectorAll(".seq-btn").forEach(b => b.classList.remove("is-done"));
  setMsg("Fresh deal launched. Issuer + treasury + investor wallets funded on Testnet.");
});

/* ================= tweaks ================= */
const tweaks = {
  ...TWEAK_DEFAULTS,
  ...(JSON.parse(localStorage.getItem("vl_tweaks") || "{}")),
};

function applyTweaks() {
  document.documentElement.style.setProperty("--wine", tweaks.accent);
  document.documentElement.style.setProperty("--wine-deep", shade(tweaks.accent, -30));
  document.documentElement.style.setProperty("--gold", tweaks.gold);
  document.body.dataset.paper = tweaks.paper;
  document.body.dataset.density = tweaks.density;
  document.body.dataset.grain = tweaks.grain;
  localStorage.setItem("vl_tweaks", JSON.stringify(tweaks));
}
function shade(hex, p) {
  const n = parseInt(hex.slice(1),16);
  let r=(n>>16)&255, g=(n>>8)&255, b=n&255;
  r = Math.max(0, Math.min(255, r + (r*p/100)));
  g = Math.max(0, Math.min(255, g + (g*p/100)));
  b = Math.max(0, Math.min(255, b + (b*p/100)));
  return "#"+[r,g,b].map(x=>Math.round(x).toString(16).padStart(2,"0")).join("");
}

function wireTweaks(id, key) {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-v]");
    if (!b) return;
    el.querySelectorAll("button").forEach(x => x.classList.toggle("is-active", x === b));
    tweaks[key] = b.dataset.v;
    applyTweaks();
    postEdit({ [key]: b.dataset.v });
  });
  // mark active
  const active = el.querySelector(`button[data-v="${tweaks[key]}"]`);
  if (active) {
    el.querySelectorAll("button").forEach(x => x.classList.remove("is-active"));
    active.classList.add("is-active");
  }
}

function postEdit(edits) {
  try { window.parent.postMessage({ type: "__edit_mode_set_keys", edits }, "*"); } catch {}
}

// edit-mode host protocol
window.addEventListener("message", (ev) => {
  const d = ev.data;
  if (!d || !d.type) return;
  if (d.type === "__activate_edit_mode") $("#tweaks").hidden = false;
  if (d.type === "__deactivate_edit_mode") $("#tweaks").hidden = true;
});
window.parent.postMessage({ type: "__edit_mode_available" }, "*");

$("#tweaksClose").addEventListener("click", () => { $("#tweaks").hidden = true; });

/* ================= boot ================= */
renderScenarios("rioja");
renderLifeline();
renderPolicy();
renderWallets();
renderFlow();
renderTimeline();
renderTicker();
setArc(75);
setWineFill(75);
wireTweaks("swAccent", "accent");
wireTweaks("swGold", "gold");
wireTweaks("swPaper", "paper");
wireTweaks("segDensity", "density");
wireTweaks("segGrain", "grain");
applyTweaks();
