// Vedic Space Grantha · the library index and the contents page of a text.
(function(){
  var root = document.documentElement, dark = window.matchMedia("(prefers-color-scheme: dark)");
  function effective(){ return root.getAttribute("data-theme") || (dark.matches ? "dark" : "light"); }
  function paint(){
    var mode = effective(), label = mode === "dark" ? "Switch to light mode" : "Switch to dark mode";
    document.querySelectorAll("[data-theme-toggle]").forEach(function(b){
      b.setAttribute("data-mode", mode); b.setAttribute("aria-label", label); b.title = label; });
  }
  document.addEventListener("click", function(e){
    if (!e.target.closest("[data-theme-toggle]")) return;
    var next = effective() === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next);
    try { localStorage.setItem("vs-theme", next); } catch(err) {}
    paint();
  });
  if (dark.addEventListener) dark.addEventListener("change", paint);
  paint();
  var topbar = document.getElementById("topbar");

  // ---- Catalogue: folding groups, chapter lists, and the group picker in the toolbar
  var box = document.getElementById("groups");
  var groups = box ? Array.prototype.slice.call(box.querySelectorAll(".group")) : [];
  var MANY = 12, KEY = "vs-index-shut";
  var total = box ? +box.getAttribute("data-total") : 0, many = total > MANY;
  var saved = null;
  try { saved = JSON.parse(localStorage.getItem(KEY) || "null"); } catch(err) {}
  var allBtn = document.getElementById("cat-all");
  function paintAll(){
    var anyShut = groups.some(function(g){ return g.classList.contains("shut"); });
    allBtn.textContent = anyShut ? "Open all" : "Close all";
  }
  function setGroup(g, open, keep){
    g.classList.toggle("shut", !open);
    g.querySelector(".g-head").setAttribute("aria-expanded", open ? "true" : "false");
    if (keep) {
      var st = {}; groups.forEach(function(x){ st[x.getAttribute("data-name")] = x.classList.contains("shut"); });
      try { localStorage.setItem(KEY, JSON.stringify(st)); } catch(err) {}
    }
    paintAll();
  }
  // a small library shows every group open; a large one opens folded, so the headings read as a contents list.
  // What the reader opened or closed is remembered.
  groups.forEach(function(g){
    var name = g.getAttribute("data-name");
    var shut = saved && name in saved ? saved[name] : many;
    setGroup(g, !shut, false);
    g.querySelector(".g-head").addEventListener("click", function(){
      if (box.classList.contains("filtering")) return;
      setGroup(g, g.classList.contains("shut"), true); });
  });
  if (groups.length > 1) {
    document.getElementById("cat-tools").classList.add("on");
    allBtn.addEventListener("click", function(){
      var open = groups.some(function(g){ return g.classList.contains("shut"); });
      groups.forEach(function(g, i){ setGroup(g, open, i === groups.length - 1); });
    });
  }
  // ---- Filter: matches the titles of the texts (Devanāgarī, IAST, English).
  // Diacritics and case are ignored, so "katha" finds Kaṭha and "gita" finds Gītā. While a filter is on,
  // every group with a match is shown open; the folded state returns when the box is cleared.
  var fIn = document.getElementById("f-in"), fBox = document.getElementById("filter"), fCount = document.getElementById("f-count"),
      fNone = document.getElementById("f-none"), tools = document.getElementById("cat-tools");
  function plain(x){ return x.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); }
  var texts = [];
  groups.forEach(function(g){
    g.querySelectorAll(".text").forEach(function(t){
      var key = plain(t.getAttribute("data-k") || t.querySelector(".text-title").textContent);
      texts.push({el: t, g: g, key: key, toks: key.split(/[^0-9a-z\u0900-\u097f]+/).filter(Boolean)});
    });
  });
  // "har" finds Harivaṃśa and Hari-, not Atharvaveda; "gita" (four letters or more) also finds Anugītā
  function matches(t, words){
    return words.every(function(w){
      if (w.length >= 4 || /[\u0900-\u097f]/.test(w)) return t.key.indexOf(w) >= 0;
      return t.toks.some(function(k){ return k.indexOf(w) === 0; });
    });
  }
  function applyFilter(){
    var q = plain(fIn.value.trim()), on = q.length > 0, words = q.split(/\s+/), n = 0;
    box.classList.toggle("filtering", on); fBox.classList.toggle("has", on); tools.classList.toggle("busy", on);
    groups.forEach(function(g){ g._hits = 0; });
    texts.forEach(function(t){
      var hit = !on || matches(t, words);
      t.el.classList.toggle("nomatch", !hit);
      if (hit) { t.g._hits++; n++; }
    });
    groups.forEach(function(g){ g.classList.toggle("nomatch", on && !g._hits); });
    fCount.textContent = on ? (n === 1 ? "1 text" : n + " texts") : "";
    fNone.classList.toggle("on", on && !n);
    onScroll();
  }
  if (fIn) {
    fIn.addEventListener("input", applyFilter);
    fIn.addEventListener("keydown", function(e){ if (e.key === "Escape") { fIn.value = ""; applyFilter(); } });
    document.getElementById("f-clear").addEventListener("click", function(){ fIn.value = ""; applyFilter(); fIn.focus(); });
  }

  // chapter lists: open on a wide screen, folded on a phone
  var phone = window.matchMedia("(max-width: 640px)");
  document.querySelectorAll("details.ch").forEach(function(d){ if (phone.matches) d.removeAttribute("open"); });

  function goTo(el, g){
    if (g.classList.contains("shut")) setGroup(g, true, true);
    var y = el.getBoundingClientRect().top + window.scrollY - 64;
    window.scrollTo({top: y, behavior: "smooth"});
  }
  var nav = document.getElementById("sec-nav"), cur = document.getElementById("sec-cur"),
      nameEl = document.getElementById("sec-name"), menu = document.getElementById("sec-menu");
  function closeMenu(){ nav.classList.remove("open"); cur.setAttribute("aria-expanded", "false"); }
  function span(cls, txt){ var x = document.createElement("span"); if (cls) x.className = cls; x.textContent = txt; return x; }
  groups.forEach(function(g){
    var b = document.createElement("button");
    b.type = "button"; b.className = "sec-item g"; b.setAttribute("role", "menuitem");
    b.appendChild(span("", g.getAttribute("data-name")));
    b.appendChild(span("c", g.querySelectorAll(".text").length));
    b.addEventListener("click", function(){ stopFind(); closeMenu(); if (fIn.value) { fIn.value = ""; applyFilter(); } goTo(g, g); });
    menu.appendChild(b); g._item = b; g._rows = [];
    g.querySelectorAll(".text").forEach(function(t){
      var i = document.createElement("button");
      i.type = "button"; i.className = "sec-item t" + (t.classList.contains("planned") ? " off" : "");
      i.setAttribute("role", "menuitem");
      var d = span("d", t.querySelector(".td").textContent); d.lang = "sa";
      i.appendChild(d); i.appendChild(span("e", t.querySelector(".ti").textContent));
      i.addEventListener("click", function(){ stopFind(); closeMenu(); if (fIn.value) { fIn.value = ""; applyFilter(); } goTo(t, g); });
      menu.appendChild(i);
      var tx = null; texts.forEach(function(x){ if (x.el === t) tx = x; });
      g._rows.push({b: i, t: tx, el: t});
    });
  });
  var none = document.createElement("div"); none.className = "sec-none"; none.textContent = "No text of that name in the library yet.";
  menu.appendChild(none);

  // ---- Find in the toolbar
  var tbFind = document.getElementById("tb-find"), secFind = document.getElementById("sec-find");
  function filterMenu(){
    var q = plain(secFind.value.trim()), words = q.split(/\s+/), n = 0, first = null;
    groups.forEach(function(g){
      var hits = 0;
      g._rows.forEach(function(r){
        var hit = !q || matches(r.t, words);
        r.b.hidden = !hit;
        if (hit) { hits++; n++; if (!first) first = {r: r, g: g}; }
      });
      g._item.hidden = !hits;
    });
    none.classList.toggle("on", !n);
    return first;
  }
  function stopFind(){
    if (!nav.classList.contains("finding")) return;
    nav.classList.remove("finding"); secFind.hidden = true; secFind.value = "";
    tbFind.setAttribute("aria-pressed", "false"); tbFind.setAttribute("aria-label", "Find a text"); tbFind.title = "Find a text";
    filterMenu(); closeMenu();
  }
  function startFind(){
    nav.classList.add("finding", "open"); secFind.hidden = false; cur.setAttribute("aria-expanded", "true");
    tbFind.setAttribute("aria-pressed", "true"); tbFind.setAttribute("aria-label", "Close"); tbFind.title = "Close";
    filterMenu(); menu.scrollTop = 0; secFind.focus({preventScroll: true});
  }
  tbFind.addEventListener("click", function(e){
    e.stopPropagation();
    if (nav.classList.contains("finding")) stopFind(); else startFind();
  });
  secFind.addEventListener("input", function(){ filterMenu(); menu.scrollTop = 0; });
  secFind.addEventListener("keydown", function(e){
    if (e.key === "Escape") { e.stopPropagation(); stopFind(); tbFind.focus(); }
    else if (e.key === "Enter") { var f = filterMenu(); if (f && secFind.value.trim()) { stopFind(); goTo(f.r.el, f.g); } }
    else if (e.key === "ArrowDown") { var b = menu.querySelector(".sec-item.t:not([hidden])"); if (b) { e.preventDefault(); b.focus(); } }
  });
  cur.addEventListener("click", function(){
    var open = !nav.classList.contains("open");
    nav.classList.toggle("open", open); cur.setAttribute("aria-expanded", open ? "true" : "false");
    if (open) { var c = menu.querySelector('[aria-current="true"]'); if (c) c.scrollIntoView({block: "nearest"}); }
  });
  document.addEventListener("click", function(e){ if (!nav.contains(e.target)) { stopFind(); closeMenu(); } });
  document.addEventListener("keydown", function(e){ if (e.key === "Escape") { stopFind(); closeMenu(); } });

  function onScroll(){
    topbar.classList.toggle("scrolled", window.scrollY > 8);
    var now = null;
    for (var i = 0; i < groups.length; i++) {
      if (groups[i].classList.contains("nomatch")) continue;
      if (groups[i].getBoundingClientRect().top <= 90) now = groups[i]; else break;
    }
    if (now && box.getBoundingClientRect().bottom < 60) now = null;      // scrolled past the catalogue
    nav.hidden = !now; topbar.classList.toggle("in-cat", !!now);
    var boxGone = !fBox.offsetParent || fBox.getBoundingClientRect().bottom < 58;
    tbFind.hidden = !(now && boxGone);
    if (tbFind.hidden && !now) stopFind();
    if (!now) { closeMenu(); return; }
    nameEl.textContent = now.getAttribute("data-name");
    groups.forEach(function(g){ if (g._item) g._item.setAttribute("aria-current", g === now ? "true" : "false"); });
  }
  window.addEventListener("scroll", onScroll, {passive:true}); onScroll();
  function fromHash(){
    var id = decodeURIComponent(location.hash.slice(1)); if (!id) return;
    var t = document.getElementById(id), g = t && t.closest(".group");
    if (!g) return;
    if (g.classList.contains("shut")) setGroup(g, true, false);
    setTimeout(function(){ window.scrollTo({top: t.getBoundingClientRect().top + window.scrollY - 64, behavior: "instant"}); }, 0);
  }
  window.addEventListener("hashchange", fromHash); fromHash();
})();
