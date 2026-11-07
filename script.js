/* =========================================================
   Lit Windows · NYC room type predictor
   Talks to the FastAPI server: GET /  and  POST /predict
   ========================================================= */
(() => {
  "use strict";

  /* ---------- Config ---------- */
  const DEFAULT_API = "https://nyc-airbnb-room-type-predictor-ftf2.onrender.com";
  // The model's classes_ are alphabetical, and /predict returns probabilities in this order.
  const CLASSES = [
    { name: "Entire home/apt", color: "#ffc36b" },
    { name: "Private room",    color: "#5fd0d6" },
    { name: "Shared room",     color: "#ff7a9c" },
  ];

  const BOROUGHS = {
    "Manhattan": [
      "Battery Park City", "Chelsea", "Chinatown", "Civic Center", "East Harlem", "East Village",
      "Financial District", "Flatiron District", "Gramercy", "Greenwich Village", "Harlem",
      "Hell's Kitchen", "Inwood", "Kips Bay", "Little Italy", "Lower East Side", "Marble Hill",
      "Midtown", "Morningside Heights", "Murray Hill", "NoHo", "Nolita", "Roosevelt Island", "SoHo",
      "Stuyvesant Town", "Theater District", "Tribeca", "Two Bridges", "Upper East Side",
      "Upper West Side", "Washington Heights", "West Village",
    ],
    "Brooklyn": [
      "Bath Beach", "Bay Ridge", "Bedford-Stuyvesant", "Bensonhurst", "Bergen Beach", "Boerum Hill",
      "Borough Park", "Brighton Beach", "Brooklyn Heights", "Brownsville", "Bushwick", "Canarsie",
      "Carroll Gardens", "Clinton Hill", "Cobble Hill", "Columbia St", "Coney Island", "Crown Heights",
      "Cypress Hills", "DUMBO", "Downtown Brooklyn", "Dyker Heights", "East Flatbush", "East New York",
      "Flatbush", "Flatlands", "Fort Greene", "Fort Hamilton", "Gowanus", "Gravesend", "Greenpoint",
      "Kensington", "Manhattan Beach", "Midwood", "Mill Basin", "Navy Yard", "Park Slope",
      "Prospect Heights", "Prospect-Lefferts Gardens", "Red Hook", "Sea Gate", "Sheepshead Bay",
      "South Slope", "Sunset Park", "Vinegar Hill", "Williamsburg", "Windsor Terrace",
    ],
    "Queens": [
      "Arverne", "Astoria", "Bay Terrace", "Bayside", "Bayswater", "Belle Harbor", "Bellerose",
      "Breezy Point", "Briarwood", "Cambria Heights", "College Point", "Corona", "Ditmars Steinway",
      "Douglaston", "East Elmhurst", "Edgemere", "Elmhurst", "Far Rockaway", "Flushing", "Forest Hills",
      "Fresh Meadows", "Glendale", "Hollis", "Holliswood", "Howard Beach", "Jackson Heights", "Jamaica",
      "Jamaica Estates", "Jamaica Hills", "Kew Gardens", "Kew Gardens Hills", "Laurelton", "Little Neck",
      "Long Island City", "Maspeth", "Middle Village", "Neponsit", "Ozone Park", "Queens Village",
      "Rego Park", "Richmond Hill", "Ridgewood", "Rockaway Beach", "Rosedale", "South Ozone Park",
      "Springfield Gardens", "St. Albans", "Sunnyside", "Whitestone", "Woodhaven", "Woodside",
    ],
    "Bronx": [
      "Allerton", "Baychester", "Belmont", "Bronxdale", "Castle Hill", "City Island", "Claremont Village",
      "Clason Point", "Co-op City", "Concourse", "Concourse Village", "East Morrisania", "Eastchester",
      "Edenwald", "Fieldston", "Fordham", "Highbridge", "Hunts Point", "Kingsbridge", "Longwood", "Melrose",
      "Morris Heights", "Morris Park", "Morrisania", "Mott Haven", "Mount Eden", "Mount Hope",
      "North Riverdale", "Norwood", "Olinville", "Parkchester", "Pelham Bay", "Pelham Gardens",
      "Port Morris", "Riverdale", "Schuylerville", "Soundview", "Spuyten Duyvil", "Throgs Neck",
      "Tremont", "Unionport", "University Heights", "Van Nest", "Wakefield", "West Farms",
      "Westchester Square", "Williamsbridge", "Woodlawn",
    ],
    "Staten Island": [
      "Arden Heights", "Arrochar", "Bay Terrace, Staten Island", "Bull's Head", "Castleton Corners",
      "Clifton", "Concord", "Dongan Hills", "Eltingville", "Emerson Hill", "Graniteville", "Grant City",
      "Great Kills", "Grymes Hill", "Howland Hook", "Huguenot", "Lighthouse Hill", "Mariners Harbor",
      "Midland Beach", "New Brighton", "New Dorp", "New Dorp Beach", "New Springville", "Oakwood",
      "Port Richmond", "Prince's Bay", "Randall Manor", "Rosebank", "Rossville", "Shore Acres",
      "Silver Lake", "South Beach", "St. George", "Stapleton", "Todt Hill", "Tompkinsville", "Tottenville",
      "West Brighton", "Westerleigh", "Willowbrook",
    ],
  };

  // Rough borough centres, used for the map labels and for example listings.
  const BORO_CENTER = {
    "Manhattan":     { lat: 40.7685, lng: -73.9822 },
    "Brooklyn":      { lat: 40.6500, lng: -73.9496 },
    "Queens":        { lat: 40.7282, lng: -73.7949 },
    "Bronx":         { lat: 40.8448, lng: -73.8648 },
    "Staten Island": { lat: 40.5795, lng: -74.1502 },
  };

  const PRESETS = {
    studio: {
      neighbourhood_group: "Manhattan", neighbourhood: "Upper West Side",
      latitude: 40.7870, longitude: -73.9754, price: 220, minimum_nights: 3,
      number_of_reviews: 48, reviews_per_month: 1.4, calculated_host_listings_count: 1, availability_365: 210,
    },
    room: {
      neighbourhood_group: "Brooklyn", neighbourhood: "Bedford-Stuyvesant",
      latitude: 40.6872, longitude: -73.9418, price: 65, minimum_nights: 2,
      number_of_reviews: 22, reviews_per_month: 0.9, calculated_host_listings_count: 2, availability_365: 120,
    },
    bunk: {
      neighbourhood_group: "Manhattan", neighbourhood: "Hell's Kitchen",
      latitude: 40.7615, longitude: -73.9850, price: 40, minimum_nights: 1,
      number_of_reviews: 12, reviews_per_month: 0.8, calculated_host_listings_count: 6, availability_365: 330,
    },
  };

  const NUM_FIELDS = [
    "latitude", "longitude", "price", "minimum_nights", "number_of_reviews",
    "reviews_per_month", "calculated_host_listings_count", "availability_365",
  ];

  // Mirrors the Pydantic constraints in main.py
  const RULES = {
    latitude:  { min: -90,  max: 90,  int: false, label: "Latitude" },
    longitude: { min: -180, max: 180, int: false, label: "Longitude" },
    price:     { gt: 0,                int: false, label: "Price" },
    minimum_nights: { min: 1, max: 365, int: true, label: "Minimum nights" },
    number_of_reviews: { min: 0,        int: true, label: "Total reviews" },
    reviews_per_month: { min: 0,        int: false, label: "Reviews per month" },
    calculated_host_listings_count: { min: 0, int: true, label: "Host's listings" },
    availability_365: { min: 0, max: 365, int: true, label: "Days available" },
  };

  /* ---------- Helpers ---------- */
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } },
    del(k)    { try { localStorage.removeItem(k); } catch { /* storage unavailable */ } },
  };

  const state = {
    borough: "Manhattan",
    apiUrl: store.get("lw_api", DEFAULT_API).replace(/\/+$/, ""),
    history: [],
  };
  try { state.history = JSON.parse(store.get("lw_history", "[]")) || []; } catch { state.history = []; }

  const form = $("#predictForm");
  const el = (id) => document.getElementById(id);

  /* =========================================================
     Skyline (hero). One orchestrated moment: windows light up
     left to right on load, then flicker very slowly.
     ========================================================= */
  const sky = (() => {
    const canvas = el("skyline");
    const ctx = canvas.getContext("2d");
    let W = 0, H = 0, buildings = [], stars = [], t0 = performance.now(), mouseX = 0.5, raf;

    function rand(seed) { // small deterministic PRNG so the skyline is stable between resizes
      let s = seed;
      return () => (s = (s * 16807) % 2147483647) / 2147483647;
    }

    function build() {
      const r = rand(42);
      buildings = [];
      stars = Array.from({ length: 60 }, () => ({ x: r(), y: r() * 0.55, s: r() * 1.2 + 0.3, p: r() * 6 }));
      const layers = [
        { depth: 0.4, hMin: 0.12, hMax: 0.30, wMin: 26, wMax: 56, shade: "#0e1530", win: 0.35, speed: 6 },
        { depth: 1.0, hMin: 0.10, hMax: 0.38, wMin: 34, wMax: 78, shade: "#0a0f26", win: 0.55, speed: 14 },
      ];
      layers.forEach((L) => {
        let x = -20;
        while (x < W + 40) {
          const w = L.wMin + r() * (L.wMax - L.wMin);
          const h = (L.hMin + r() * (L.hMax - L.hMin)) * H;
          const b = { x, w, h, L, wins: [] };
          const cw = 7, ch = 9, gx = 6, gy = 8;
          const cols = Math.max(1, Math.floor((w - 8) / (cw + gx)));
          const rows = Math.max(1, Math.floor((h - 12) / (ch + gy)));
          for (let i = 0; i < cols; i++) {
            for (let j = 0; j < rows; j++) {
              if (r() < L.win) {
                const c = r();
                b.wins.push({
                  ox: 6 + i * (cw + gx), oy: 8 + j * (ch + gy), cw, ch,
                  color: c < 0.7 ? "#ffc36b" : c < 0.88 ? "#5fd0d6" : "#ff7a9c",
                  on: r() * 1800 + (x / W) * 1800, // reveal time, ms, sweeps left to right
                  ph: r() * 10,
                  flick: r() < 0.06,
                });
              }
            }
          }
          buildings.push(b);
          x += w + 2 + r() * 8;
        }
      });
    }

    function resize() {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = rect.width; H = rect.height;
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      build();
      draw(performance.now());
    }

    function draw(now) {
      const t = now - t0;
      ctx.clearRect(0, 0, W, H);

      stars.forEach((s) => {
        const a = 0.25 + 0.25 * Math.sin(now / 1800 + s.p);
        ctx.fillStyle = `rgba(210,220,255,${a})`;
        ctx.fillRect(s.x * W, s.y * H, s.s, s.s);
      });

      buildings.forEach((b) => {
        const shift = (mouseX - 0.5) * 14 * b.L.depth;
        const bx = b.x + shift;
        const by = H - b.h;
        ctx.fillStyle = b.L.shade;
        ctx.fillRect(bx, by, b.w, b.h);
        ctx.fillStyle = "rgba(255,255,255,.03)";
        ctx.fillRect(bx, by, b.w, 1);

        b.wins.forEach((w) => {
          if (t < w.on) return;
          let a = Math.min(1, (t - w.on) / 400);
          if (w.flick) a *= 0.55 + 0.45 * Math.sin(now / 900 + w.ph);
          ctx.globalAlpha = a * (b.L.depth === 1 ? 0.95 : 0.55);
          ctx.fillStyle = w.color;
          ctx.fillRect(bx + w.ox, by + w.oy, w.cw, w.ch);
        });
        ctx.globalAlpha = 1;
      });
    }

    function loop(now) {
      draw(now);
      raf = requestAnimationFrame(loop);
    }

    function start() {
      resize();
      if (reduceMotion) { t0 = -99999; draw(performance.now()); return; }
      raf = requestAnimationFrame(loop);
      // Pause when off-screen to save battery
      new IntersectionObserver(([e]) => {
        cancelAnimationFrame(raf);
        if (e.isIntersecting) raf = requestAnimationFrame(loop);
      }).observe(canvas);
    }

    window.addEventListener("resize", () => { resize(); });
    document.querySelector(".hero").addEventListener("pointermove", (e) => {
      mouseX = e.clientX / window.innerWidth;
    });

    return { start };
  })();

  /* =========================================================
     Borough control + neighbourhood combobox
     ========================================================= */
  const seg = el("boroSeg");
  Object.keys(BOROUGHS).forEach((b) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "seg__btn";
    btn.setAttribute("role", "radio");
    btn.textContent = b;
    btn.dataset.value = b;
    btn.addEventListener("click", () => setBorough(b, { resetHood: true, recenter: true }));
    seg.appendChild(btn);
  });

  function setBorough(b, { resetHood = false, recenter = false } = {}) {
    state.borough = b;
    $$(".seg__btn", seg).forEach((x) => x.setAttribute("aria-checked", String(x.dataset.value === b)));
    if (resetHood) { hoodInput.value = ""; }
    if (recenter) {
      setCoords(BORO_CENTER[b].lat, BORO_CENTER[b].lng);
    }
    map.redraw();
    closeList();
  }

  const hoodInput = el("hoodInput");
  const hoodList = el("hoodList");
  let activeIdx = -1;

  function renderList() {
    const q = hoodInput.value.trim().toLowerCase();
    const items = BOROUGHS[state.borough].filter((n) => n.toLowerCase().includes(q));
    hoodList.innerHTML = "";
    activeIdx = -1;
    if (!items.length) {
      const li = document.createElement("li");
      li.className = "combo__empty";
      li.textContent = `No match in ${state.borough}. Try another spelling.`;
      hoodList.appendChild(li);
    }
    items.forEach((n, i) => {
      const li = document.createElement("li");
      li.className = "combo__item";
      li.setAttribute("role", "option");
      li.id = `hood-${i}`;
      li.dataset.value = n;
      const idx = q ? n.toLowerCase().indexOf(q) : -1;
      if (idx >= 0) {
        li.append(n.slice(0, idx));
        const m = document.createElement("mark");
        m.textContent = n.slice(idx, idx + q.length);
        li.append(m, n.slice(idx + q.length));
      } else {
        li.textContent = n;
      }
      li.addEventListener("mousedown", (e) => { e.preventDefault(); pickHood(n); });
      hoodList.appendChild(li);
    });
    hoodList.hidden = false;
    hoodInput.setAttribute("aria-expanded", "true");
  }

  function closeList() {
    hoodList.hidden = true;
    hoodInput.setAttribute("aria-expanded", "false");
    hoodInput.removeAttribute("aria-activedescendant");
  }

  function pickHood(n) {
    hoodInput.value = n;
    clearError("neighbourhood");
    closeList();
  }

  function moveActive(d) {
    const items = $$(".combo__item", hoodList);
    if (!items.length) return;
    activeIdx = (activeIdx + d + items.length) % items.length;
    items.forEach((x, i) => x.setAttribute("aria-selected", String(i === activeIdx)));
    items[activeIdx].scrollIntoView({ block: "nearest" });
    hoodInput.setAttribute("aria-activedescendant", items[activeIdx].id);
  }

  hoodInput.addEventListener("focus", renderList);
  hoodInput.addEventListener("input", () => { clearError("neighbourhood"); renderList(); });
  hoodInput.addEventListener("blur", () => setTimeout(closeList, 100));
  hoodInput.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); if (hoodList.hidden) renderList(); moveActive(1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); moveActive(-1); }
    else if (e.key === "Enter" && !hoodList.hidden && activeIdx >= 0) {
      e.preventDefault();
      pickHood($$(".combo__item", hoodList)[activeIdx].dataset.value);
    } else if (e.key === "Escape") closeList();
  });

  /* =========================================================
     Schematic map: click to set coordinates
     ========================================================= */
  const map = (() => {
    const canvas = el("mapCanvas");
    const ctx = canvas.getContext("2d");
    const B = { latMin: 40.49, latMax: 40.92, lngMin: -74.27, lngMax: -73.68 };
    let pin = null, pulse = 0, raf = null;

    const toXY = (lat, lng) => ({
      x: ((lng - B.lngMin) / (B.lngMax - B.lngMin)) * canvas.width,
      y: (1 - (lat - B.latMin) / (B.latMax - B.latMin)) * canvas.height,
    });
    const toLL = (x, y) => ({
      lat: B.latMin + (1 - y / canvas.height) * (B.latMax - B.latMin),
      lng: B.lngMin + (x / canvas.width) * (B.lngMax - B.lngMin),
    });

    function draw() {
      const w = canvas.width, h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // dot grid
      ctx.fillStyle = "rgba(120,140,210,.16)";
      for (let x = 20; x < w; x += 28) for (let y = 20; y < h; y += 28) ctx.fillRect(x, y, 2, 2);

      // borough markers
      ctx.font = "500 15px 'Instrument Sans', system-ui, sans-serif";
      ctx.textAlign = "center";
      Object.entries(BORO_CENTER).forEach(([name, c]) => {
        const p = toXY(c.lat, c.lng);
        const active = name === state.borough;
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, active ? 70 : 46);
        g.addColorStop(0, active ? "rgba(255,195,107,.28)" : "rgba(120,140,210,.14)");
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(p.x, p.y, active ? 70 : 46, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = active ? "#ffc36b" : "#7f8cb8";
        ctx.fillText(name, p.x, p.y + 4);
      });

      // pin
      if (pin) {
        const p = toXY(pin.lat, pin.lng);
        const r = 8 + (reduceMotion ? 0 : (pulse % 1) * 16);
        ctx.strokeStyle = `rgba(255,195,107,${reduceMotion ? 0.4 : 1 - (pulse % 1)})`;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = "#ffc36b";
        ctx.beginPath(); ctx.arc(p.x, p.y, 6, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "#0b0f24"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(p.x, p.y, 6, 0, Math.PI * 2); ctx.stroke();
      }
    }

    function tick() { pulse += 0.012; draw(); raf = requestAnimationFrame(tick); }

    canvas.addEventListener("click", (e) => {
      const r = canvas.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * canvas.width;
      const y = ((e.clientY - r.top) / r.height) * canvas.height;
      const ll = toLL(x, y);
      setCoords(ll.lat, ll.lng);
      pulse = 0;
    });

    return {
      setPin(lat, lng) {
        pin = Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
        if (!raf && !reduceMotion) raf = requestAnimationFrame(tick); else draw();
      },
      redraw: draw,
    };
  })();

  function setCoords(lat, lng) {
    el("latitude").value = (+lat).toFixed(5);
    el("longitude").value = (+lng).toFixed(5);
    clearError("latitude"); clearError("longitude");
    map.setPin(+lat, +lng);
  }
  ["latitude", "longitude"].forEach((id) => el(id).addEventListener("input", () => {
    map.setPin(parseFloat(el("latitude").value), parseFloat(el("longitude").value));
  }));

  /* =========================================================
     Sliders, number boxes, steppers
     ========================================================= */
  function paintRange(r) {
    const pct = ((r.value - r.min) / (r.max - r.min)) * 100;
    r.style.setProperty("--pct", `${Math.min(100, Math.max(0, pct))}%`);
  }

  $$(".slider-field").forEach((wrap) => {
    const id = wrap.dataset.field;
    const range = el(id), num = el(`${id}_num`);
    range.addEventListener("input", () => { num.value = range.value; paintRange(range); clearError(id); });
    num.addEventListener("input", () => {
      clearError(id);
      if (num.value !== "") {
        // let the thumb follow, but keep typed values beyond the slider max
        range.value = Math.min(+num.value, +range.max);
        paintRange(range);
      }
    });
  });

  $$(".stepper button").forEach((b) => b.addEventListener("click", () => {
    const input = el(b.dataset.target);
    const step = parseFloat(b.dataset.step);
    const decimals = String(step).includes(".") ? 2 : 0;
    const next = Math.max(0, (parseFloat(input.value) || 0) + step);
    input.value = next.toFixed(decimals).replace(/\.00$/, "");
    clearError(b.dataset.target);
    input.dispatchEvent(new Event("input"));
  }));

  /* =========================================================
     Form values
     ========================================================= */
  function fillForm(v) {
    setBorough(v.neighbourhood_group);
    hoodInput.value = v.neighbourhood;
    NUM_FIELDS.forEach((k) => {
      el(k).value = v[k];
      const n = el(`${k}_num`);
      if (n) n.value = v[k];
      if (el(k).type === "range") paintRange(el(k));
    });
    map.setPin(+v.latitude, +v.longitude);
    clearAllErrors();
  }

  function readForm() {
    const v = { neighbourhood_group: state.borough, neighbourhood: hoodInput.value.trim() };
    NUM_FIELDS.forEach((k) => {
      const num = el(`${k}_num`);
      const raw = (num ? num.value : el(k).value);
      v[k] = raw === "" ? NaN : Number(raw);
    });
    return v;
  }

  $$("[data-preset]").forEach((b) => b.addEventListener("click", () => {
    fillForm(PRESETS[b.dataset.preset]);
    toast("Example loaded. Press Predict to see the result.", "ok");
  }));

  el("resetBtn").addEventListener("click", () => {
    fillForm(PRESETS.studio);
    resetResult();
  });

  /* ---------- Validation ---------- */
  function showError(name, msg) {
    const p = $(`[data-error-for="${name}"]`);
    if (p) p.textContent = msg;
    const input = name === "neighbourhood" ? hoodInput : (el(`${name}_num`) || el(name));
    if (input) input.classList.add("is-invalid");
  }
  function clearError(name) {
    const p = $(`[data-error-for="${name}"]`);
    if (p) p.textContent = "";
    const input = name === "neighbourhood" ? hoodInput : (el(`${name}_num`) || el(name));
    if (input) input.classList.remove("is-invalid");
    if (el(name)) el(name).classList.remove("is-invalid");
  }
  function clearAllErrors() {
    $$(".field__error").forEach((p) => (p.textContent = ""));
    $$(".is-invalid").forEach((i) => i.classList.remove("is-invalid"));
  }

  function validate(v) {
    const errs = {};
    if (!v.neighbourhood) errs.neighbourhood = "Choose a neighbourhood.";
    else if (!BOROUGHS[v.neighbourhood_group].includes(v.neighbourhood))
      errs.neighbourhood = `Pick a neighbourhood from the ${v.neighbourhood_group} list.`;

    NUM_FIELDS.forEach((k) => {
      const r = RULES[k], x = v[k];
      if (Number.isNaN(x)) { errs[k] = `${r.label} is required.`; return; }
      if (r.int && !Number.isInteger(x)) { errs[k] = `${r.label} must be a whole number.`; return; }
      if (r.gt !== undefined && !(x > r.gt)) { errs[k] = `${r.label} must be more than ${r.gt}.`; return; }
      if (r.min !== undefined && x < r.min) { errs[k] = `${r.label} must be at least ${r.min}.`; return; }
      if (r.max !== undefined && x > r.max) { errs[k] = `${r.label} must be at most ${r.max}.`; return; }
    });
    return errs;
  }

  /* =========================================================
     API
     ========================================================= */
  const pill = el("apiPill");
  function setApiState(s, label) {
    pill.dataset.state = s;
    el("apiLabel").textContent = label;
  }

  async function ping() {
    setApiState("check", "Checking API…");
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 4000);
      const res = await fetch(`${state.apiUrl}/`, { signal: ctrl.signal });
      clearTimeout(timer);
      if (!res.ok) throw new Error(String(res.status));
      setApiState("ok", "API connected");
      return true;
    } catch {
      setApiState("bad", "API offline");
      return false;
    }
  }

  const dialog = el("apiDialog");
  pill.addEventListener("click", () => { el("apiUrl").value = state.apiUrl; dialog.showModal(); });
  el("apiCancel").addEventListener("click", () => dialog.close());
  el("apiForm").addEventListener("submit", async () => {
    const val = el("apiUrl").value.trim().replace(/\/+$/, "");
    if (val) { state.apiUrl = val; store.set("lw_api", val); }
    const ok = await ping();
    toast(ok ? "Connected to the API." : "Could not reach that address. Check that the server is running.", ok ? "ok" : "error");
  });

  async function predict(payload) {
    let res;
    try {
      res = await fetch(`${state.apiUrl}/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch {
      const e = new Error(`Cannot reach the API at ${state.apiUrl}. Start the server with: uvicorn main:app --port 2100 --reload`);
      e.network = true;
      throw e;
    }
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const e = new Error("The server rejected the input.");
      e.status = res.status;
      e.detail = data && data.detail;
      throw e;
    }
    return data;
  }

  /* =========================================================
     Result: tower of lit windows
     ========================================================= */
  const tower = el("tower");
  const WINDOWS = 100;
  for (let i = 0; i < WINDOWS; i++) {
    const d = document.createElement("div");
    d.className = "win";
    d.style.setProperty("--i", i);
    tower.appendChild(d);
  }
  const wins = $$(".win", tower);

  // Largest-remainder rounding so the windows always add up to exactly 100
  function allocate(probs) {
    const raw = probs.map((p) => p * WINDOWS);
    const base = raw.map(Math.floor);
    let left = WINDOWS - base.reduce((a, b) => a + b, 0);
    raw.map((r, i) => ({ i, f: r - Math.floor(r) }))
       .sort((a, b) => b.f - a.f)
       .forEach(({ i }) => { if (left-- > 0) base[i]++; });
    return base;
  }

  function lightTower(probs) {
    const counts = allocate(probs);
    // bottom row first, filling left to right: reads like a stacked bar
    const order = [];
    for (let r = 9; r >= 0; r--) for (let c = 0; c < 10; c++) order.push(r * 10 + c);
    const assign = [];
    counts.forEach((n, cls) => { for (let k = 0; k < n; k++) assign.push(cls); });

    wins.forEach((w) => { w.classList.remove("on"); });
    order.forEach((winIdx, k) => {
      const w = wins[winIdx];
      const delay = reduceMotion ? 0 : k * 14 + Math.random() * 90;
      setTimeout(() => { w.dataset.c = assign[k]; w.classList.add("on"); }, delay);
    });
  }

  function countUp(node, to, ms = 900) {
    if (reduceMotion) { node.textContent = to.toFixed(1); return; }
    const t0 = performance.now();
    const step = (now) => {
      const p = Math.min(1, (now - t0) / ms);
      const e = 1 - Math.pow(1 - p, 3);
      node.textContent = (to * e).toFixed(1);
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function showResult(data, meta) {
    const probs = data.Probability;
    const top = probs.indexOf(Math.max(...probs));
    const label = data.Predicted_room_type || CLASSES[top].name;
    const topIdx = CLASSES.findIndex((c) => c.name === label);
    const best = topIdx >= 0 ? topIdx : top;

    el("resultTitle").textContent = label;
    el("resultSub").textContent = `${meta.neighbourhood}, ${meta.neighbourhood_group} at $${meta.price} a night.`;

    const verdict = el("verdict");
    verdict.hidden = false;
    verdict.style.setProperty("--vc", CLASSES[best].color);
    countUp(el("verdictPct"), probs[best] * 100);
    el("verdictText").innerHTML = "";
    const strong = document.createElement("strong");
    strong.textContent = label;
    const second = [...probs.keys()].filter((i) => i !== best).sort((a, b) => probs[b] - probs[a])[0];
    const gap = (probs[best] - probs[second]) * 100;
    const note = document.createElement("span");
    note.textContent = gap < 15
      ? `Close call with ${CLASSES[second].name.toLowerCase()}.`
      : probs[best] > 0.85 ? "The model is very sure." : "The model leans this way.";
    el("verdictText").append(strong, note);

    $$(".bar").forEach((li) => {
      const i = +li.dataset.class;
      li.classList.toggle("is-top", i === best);
      $(".bar__val", li).textContent = `${(probs[i] * 100).toFixed(1)}%`;
      requestAnimationFrame(() => { $(".bar__fill", li).style.width = `${probs[i] * 100}%`; });
    });

    lightTower(probs);
  }

  function resetResult() {
    el("resultTitle").textContent = "No prediction yet";
    el("resultSub").textContent = "Fill in the listing and press Predict. Each lit window is 1% of the model's confidence.";
    el("verdict").hidden = true;
    wins.forEach((w) => w.classList.remove("on"));
    $$(".bar").forEach((li) => {
      li.classList.remove("is-top");
      $(".bar__val", li).textContent = "–";
      $(".bar__fill", li).style.width = "0";
    });
  }

  /* ---------- History ---------- */
  function renderHistory() {
    const panel = el("historyPanel"), list = el("historyList");
    list.innerHTML = "";
    panel.hidden = state.history.length === 0;
    state.history.forEach((h, idx) => {
      const li = document.createElement("li");
      const b = document.createElement("button");
      b.type = "button";
      b.className = "history__item";
      const dot = document.createElement("i");
      dot.className = "history__dot";
      dot.style.background = CLASSES[h.best].color;
      const txt = document.createElement("span");
      txt.textContent = `${h.label} · ${h.input.neighbourhood}`;
      const pct = document.createElement("small");
      pct.textContent = `${(h.prob * 100).toFixed(0)}%`;
      b.append(dot, txt, pct);
      b.addEventListener("click", () => {
        fillForm(h.input);
        showResult(h.data, h.input);
      });
      li.appendChild(b);
      list.appendChild(li);
    });
  }

  function pushHistory(input, data) {
    const probs = data.Probability;
    const best = probs.indexOf(Math.max(...probs));
    state.history.unshift({ input, data, best, prob: probs[best], label: CLASSES[best].name });
    state.history = state.history.slice(0, 5);
    store.set("lw_history", JSON.stringify(state.history));
    renderHistory();
  }

  el("clearHistory").addEventListener("click", () => {
    state.history = [];
    store.del("lw_history");
    renderHistory();
  });

  /* =========================================================
     Submit
     ========================================================= */
  const submitBtn = el("submitBtn");

  submitBtn.addEventListener("click", (e) => {
    if (reduceMotion) return;
    const r = submitBtn.getBoundingClientRect();
    const d = Math.max(r.width, r.height);
    const s = document.createElement("span");
    s.className = "ripple";
    s.style.cssText = `width:${d}px;height:${d}px;left:${e.clientX - r.left - d / 2}px;top:${e.clientY - r.top - d / 2}px`;
    submitBtn.appendChild(s);
    setTimeout(() => s.remove(), 600);
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearAllErrors();
    const v = readForm();
    const errs = validate(v);
    if (Object.keys(errs).length) {
      Object.entries(errs).forEach(([k, m]) => showError(k, m));
      form.classList.remove("shake"); void form.offsetWidth; form.classList.add("shake");
      const first = $(".is-invalid");
      if (first) first.focus({ preventScroll: false });
      toast("Fix the highlighted fields and try again.", "error");
      return;
    }

    submitBtn.classList.add("is-loading");
    tower.classList.add("is-loading");
    wins.forEach((w) => w.classList.remove("on"));
    el("resultTitle").textContent = "Reading the listing…";
    el("resultSub").textContent = "Checking the details against thousands of New York listings.";
    el("verdict").hidden = true;
    if (window.innerWidth <= 920) el("resultPanel").scrollIntoView({ behavior: "smooth", block: "start" });

    try {
      // small floor so the scanning animation is visible even on a fast local server
      const [data] = await Promise.all([predict(v), new Promise((r) => setTimeout(r, reduceMotion ? 0 : 700))]);
      tower.classList.remove("is-loading");
      showResult(data, v);
      pushHistory(v, data);
      setApiState("ok", "API connected");
    } catch (err) {
      tower.classList.remove("is-loading");
      resetResult();
      if (err.network) {
        setApiState("bad", "API offline");
        toast(err.message, "error");
      } else if (err.status === 422 && Array.isArray(err.detail)) {
        err.detail.forEach((d) => {
          const field = d.loc && d.loc[d.loc.length - 1];
          if (typeof field === "string") showError(field, d.msg);
        });
        toast("The server rejected some values. Check the highlighted fields.", "error");
      } else {
        toast(`Something went wrong on the server (${err.status || "unknown"}). Check the terminal running FastAPI.`, "error");
      }
    } finally {
      submitBtn.classList.remove("is-loading");
    }
  });

  /* ---------- Toasts ---------- */
  function toast(msg, kind = "") {
    const t = document.createElement("div");
    t.className = `toast ${kind ? "toast--" + kind : ""}`;
    t.textContent = msg;
    el("toasts").appendChild(t);
    setTimeout(() => { t.classList.add("leaving"); setTimeout(() => t.remove(), 320); }, 4200);
  }

  /* ---------- Init ---------- */
  fillForm(PRESETS.studio);
  renderHistory();
  sky.start();
  ping();
  window.addEventListener("load", () => map.redraw());
})();
