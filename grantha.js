// Vedic Space Grantha · the reader page (a text, verse by verse).
// One copy serves every reader page. A page carries its text as plain markup and a small
// description of itself (<script id="page">): its data files, the other pages of the text,
// the chapter before and after. This script adds the behaviour: display switches, word by
// word (fetched from the data file when first shown), dictionary pop-up, focus mode,
// light/dark, the toolbar.

// whatever happens below, a page hidden for a reopening in focus mode is shown again
window.addEventListener("load", function(){ document.documentElement.classList.remove("pre-focus"); });

(function(){
  var P = JSON.parse(document.getElementById("page").textContent);
  var KEY = "vs-grantha-reader";
  var defaults = {iast:true, pd:false, wbw:false, lg:true, script:"deva"};
  var prefs = Object.assign({}, defaults);
  try { var s = JSON.parse(localStorage.getItem(KEY) || "{}"); Object.assign(prefs, s); } catch(e) {}
  function save(){ try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch(e) {} }

  function esc(s){ return String(s).replace(/[&<>"]/g, function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]; }); }
  function el(id){ return document.getElementById(id); }

  window.__vsNav = P.nav || null;   // the other pages of this text, for the toolbar picker
  window.__vsFlow = P.flow || null; // the chapter before and after this one

  // ---- dictionary entries: inside the page (self-contained copy) or in shared files under lex/
  var INLINE = P.inline || null;
  var LEX = (INLINE && INLINE.lex) || {};
  var LEXF = {};                  // headword → shared file under lex/; comes with the data files
  var HAS_LEX = !!P.lex;
  var chunks = {};                // file name → promise, so each file is fetched once
  function loadHeads(heads){
    var names = [];
    heads.forEach(function(k){ if (!LEX[k] && LEXF[k] && names.indexOf(LEXF[k]) < 0) names.push(LEXF[k]); });
    return Promise.all(names.map(function(n){
      if (!chunks[n]) chunks[n] = fetch("lex/" + n + ".json").then(function(r){
        if (!r.ok) throw new Error(r.status); return r.json();
      }).then(function(data){ Object.keys(data).forEach(function(k){ LEX[k] = data[k]; }); })
        .catch(function(e){ delete chunks[n]; throw e; });
      return chunks[n];
    }));
  }

  // ---- word by word: the words come from the text's data files (data/<text>/<chapter>.json, the same
  // files offered for reuse), fetched once, when the section is first shown.
  var DOCS = null, docsP = null;
  function loadDocs(){
    if (docsP) return docsP;
    var got = INLINE && INLINE.data ? Promise.resolve(INLINE.data)
      : Promise.all((P.files || []).map(function(f){
          return fetch(f).then(function(r){ if (!r.ok) throw new Error(r.status); return r.json(); }); }));
    docsP = got.then(function(docs){
      DOCS = docs;
      docs.forEach(function(d){ var m = d.lex_files || {}; Object.keys(m).forEach(function(k){ LEXF[k] = m[k]; }); });
      fillWords();
    });
    docsP.catch(function(){
      docsP = null;
      document.querySelectorAll("#verses .words").forEach(function(b){ b.classList.add("failed"); });
    });
    return docsP;
  }
  // each verse says where its words are: data-src = which data file, data-ref = which verse in it
  // ("inv" / "cls" = the chapter's unnumbered invocation or closing mantra)
  function wordsOf(art){
    var doc = DOCS[+art.dataset.src], ref = art.dataset.ref;
    if (ref === "inv") return doc.chapter.invocation.words;
    if (ref === "cls") return doc.chapter.closing.words;
    return doc.verses[+ref].words;
  }
  function fillWords(){
    document.querySelectorAll("#verses > .verse").forEach(function(art){
      var box = art.querySelector(".words");
      if (!box || box.firstChild) return;
      var wi = 0;
      box.innerHTML = wordsOf(art).map(function(w){
        var gr = w.grammar || {};
        var g = gr.sa_deva || gr.sa ? '<div class="wg"><span class="gd">' + esc(w.lemma.deva) + ' · ' + esc(gr.sa_deva || "") + '</span>' +
                '<span class="gi">' + esc(w.lemma.iast) + ' · ' + esc(gr.sa || "") + '</span>' +
                (gr.en ? '<br>' + esc(gr.en) : '') + '</div>' : '';
        var dict = HAS_LEX ? ' has-dict" tabindex="0" role="button" data-w="' + (wi++) : '';
        return '<div class="w' + dict + '"><div class="wd">' + esc(w.pada.deva) + '</div><div class="wi">' + esc(w.pada.iast) + '</div>' +
               '<div class="wm">' + esc(w.meaning || "") + '</div>' + g + '</div>';
      }).join("");
      box.classList.remove("failed");
    });
  }

  // ---- dictionary pop-up: click a word in the word-by-word section
  var back = el("dict-back"), lastFocus = null, showing = null;
  function openDict(card){
    var w = wordsOf(card.closest(".verse"))[+card.dataset.w], heads = w.dict || [];
    el("dict-w").textContent = w.pada.deva;
    el("dict-i").textContent = w.pada.iast + (w.lemma.iast && w.lemma.iast !== w.pada.iast ? "  ·  " + w.lemma.iast : "");
    el("dict-m").textContent = w.meaning || "";
    el("dict-body").innerHTML = '<p class="none">Loading…</p>';
    el("dict-body").scrollTop = 0;
    lastFocus = card;
    showing = card;
    back.classList.add("open");
    el("dict-x").focus();
    loadHeads(heads).then(function(){ if (showing === card) fill(heads); }, function(){
      if (showing === card) el("dict-body").innerHTML = '<p class="none">The dictionary could not be loaded. ' +
        (location.protocol === "file:" ? 'Pop-ups need the page to be opened from the website, not from a folder.'
                                       : 'Please check the connection and click the word again.') + '</p>';
    });
  }
  function fill(heads){
    var out = [];
    if (!heads.length) out.push('<p class="none">No entry in Monier-Williams or Apte for this form.</p>');
    heads.forEach(function(k){
      var e = LEX[k]; if (!e) return;
      out.push('<h3>' + esc(e.d) + '<i>' + esc(k) + '</i></h3>');
      out.push('<h4>Monier-Williams</h4>');
      if (e.m.length) e.m.forEach(function(r){
        out.push('<p>' + (r[0] ? '<span class="lx">' + esc(r[0]) + '</span>' : '') + esc(r[1]) + '</p>'); });
      else out.push('<p class="none">No entry.</p>');
      out.push('<h4>Apte</h4>');
      if (e.a.length) e.a.forEach(function(t){ out.push('<p>' + esc(t) + '</p>'); });
      else out.push('<p class="none">No entry.</p>');
      if (e.more) out.push('<p class="more">Long entry, shortened here.</p>');
    });
    el("dict-body").innerHTML = out.join("");
    el("dict-body").scrollTop = 0;
  }
  function closeDict(){
    if (!back.classList.contains("open")) return;
    back.classList.remove("open");
    showing = null;
    if (lastFocus) lastFocus.focus();
  }
  back.addEventListener("click", function(e){ if (e.target === back || e.target.closest("#dict-x")) closeDict(); });
  document.addEventListener("keydown", function(e){
    if (e.key === "Escape") closeDict();
    else if ((e.key === "Enter" || e.key === " ") && e.target.classList && e.target.classList.contains("has-dict")) {
      e.preventDefault(); openDict(e.target); }
  });
  el("verses").addEventListener("click", function(e){
    var card = e.target.closest(".w.has-dict");
    if (card && !window.getSelection().toString()) openDict(card);
  });

  // ---- display switches (remembered in the reader's browser)
  function apply(){
    document.body.classList.toggle("show-iast", !!prefs.iast);
    document.body.classList.toggle("show-pd", !!prefs.pd);
    document.body.classList.toggle("show-wbw", !!prefs.wbw);
    document.body.classList.toggle("show-lg", !!prefs.lg);
    document.body.classList.toggle("lg-iast", prefs.script === "iast");
    document.querySelectorAll("[data-pref]").forEach(function(b){
      b.setAttribute("aria-pressed", prefs[b.dataset.pref] ? "true" : "false"); });
    document.querySelectorAll("[data-script]").forEach(function(b){
      b.setAttribute("aria-pressed", prefs.script === b.dataset.script ? "true" : "false");
      b.closest(".seg").style.opacity = prefs.lg ? "1" : ".4"; });
    if (prefs.wbw) loadDocs().catch(function(){});
  }
  document.addEventListener("click", function(e){
    var b = e.target.closest("[data-pref]");
    if (b) { prefs[b.dataset.pref] = !prefs[b.dataset.pref]; save(); apply(); return; }
    var s = e.target.closest("[data-script]");
    if (s) { prefs.script = s.dataset.script; if (!prefs.lg) prefs.lg = true; save(); apply(); }
  });
  apply();
  window.VSGH = {words: loadDocs};   // for checks and for features to come
})();

// Sticky toolbar: once the display toggles scroll under it, a copy of them merges into the
// toolbar (the "Vedic Space" name folds away, the lotus stays). The copies share data-pref,
// so the page's own click handler and apply() keep both sets in sync.
(function(){
  var topbar = document.getElementById("topbar"), slot = document.getElementById("tb-slot");
  var bar = document.querySelector(".bar"), toTop = document.getElementById("to-top");
  // declared here, before anything can call onScroll(): a page reopened in focus mode calls it early
  var pageHead = document.querySelector(".wrap > header");
  bar.querySelectorAll(".sw, .theme-btn").forEach(function(b){ slot.appendChild(b.cloneNode(true)); });

  // Light/dark switch: follows the device until the reader picks one, then remembers it.
  var root = document.documentElement, dark = window.matchMedia("(prefers-color-scheme: dark)");
  function effective(){ return root.getAttribute("data-theme") || (dark.matches ? "dark" : "light"); }
  function paintThemeButtons(){
    var mode = effective(), label = mode === "dark" ? "Switch to light mode" : "Switch to dark mode";
    document.querySelectorAll("[data-theme-toggle]").forEach(function(b){
      b.setAttribute("data-mode", mode); b.setAttribute("aria-label", label); b.title = label; });
  }
  document.addEventListener("click", function(e){
    if (!e.target.closest("[data-theme-toggle]")) return;
    var next = effective() === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next);
    try { localStorage.setItem("vs-theme", next); } catch(err) {}
    paintThemeButtons();
  });
  if (dark.addEventListener) dark.addEventListener("change", paintThemeButtons);
  paintThemeButtons();

  // ---- Focus mode: one verse at a time; swipe, arrow keys or the soft arrows to move.
  var main = document.getElementById("verses");
  var verses = Array.prototype.slice.call(main.querySelectorAll(":scope > .verse"));
  var secOf = [], lastSec = null;
  Array.prototype.forEach.call(main.children, function(c){
    if (c.classList.contains("section")) lastSec = c;
    else if (c.classList.contains("verse")) secOf.push(lastSec);
  });
  var FKEY = "vs-grantha-focus", focusOn = false, idx = 0;
  var prevB = document.getElementById("fn-prev"), nextB = document.getElementById("fn-next");
  // the verse is remembered together with its page: every chapter page has a "v5" of its own
  function saveFocus(){ try { localStorage.setItem(FKEY, JSON.stringify({on: focusOn, v: verses[idx] && verses[idx].id, p: location.pathname})); } catch(e) {} }
  // A text spread over several pages: at the last verse the forward arrow leads into the next chapter
  // (and at the first verse the back arrow into the one before), which opens in focus mode too.
  var FLOW = window.__vsFlow, flowPrev = FLOW && FLOW.prev && FLOW.prev.h ? FLOW.prev : null,
      flowNext = FLOW && FLOW.next && FLOW.next.h ? FLOW.next : null;
  var leapPrev = document.getElementById("fn-leap-prev"), leapNext = document.getElementById("fn-leap-next");
  function leapText(box, to, label){
    box.hidden = !to;
    if (!to) return;
    box.querySelector(".k").textContent = label;
    box.querySelector(".d").textContent = to.d;
    box.title = to.e;
  }
  leapPrev.addEventListener("click", function(){ go(-1); });
  leapNext.addEventListener("click", function(){ go(1); });
  function show(i, dir){
    if (!verses.length) return;
    i = Math.max(0, Math.min(verses.length - 1, i));
    if (verses[idx]) verses[idx].classList.remove("cur", "in-next", "in-prev");
    idx = i;
    var v = verses[idx];
    v.classList.add("cur");
    if (dir) { void v.offsetWidth; v.classList.add(dir > 0 ? "in-next" : "in-prev"); }
    var s = secOf[idx];
    document.getElementById("fm-sec").textContent = s ? s.querySelector(".sd").textContent : "";
    document.getElementById("fm-n").textContent = v.dataset.label || ("Verse " + v.id.slice(1));
    document.getElementById("fn-count").textContent = (idx + 1) + " / " + verses.length;
    var atStart = idx === 0, atEnd = idx === verses.length - 1;
    prevB.disabled = atStart && !flowPrev;
    nextB.disabled = atEnd && !flowNext;
    prevB.classList.toggle("leap", atStart && !!flowPrev);
    nextB.classList.toggle("leap", atEnd && !!flowNext);
    prevB.setAttribute("aria-label", atStart && flowPrev ? "Previous: " + flowPrev.e : "Previous verse");
    nextB.setAttribute("aria-label", atEnd && flowNext ? "Next: " + flowNext.e : "Next verse");
    leapText(leapPrev, atStart && flowPrev, "Previous " + (FLOW ? FLOW.term : ""));
    leapText(leapNext, atEnd && flowNext, "Next " + (FLOW ? FLOW.term : ""));
    prevB.title = atStart && flowPrev ? "Previous: " + flowPrev.e : "";
    nextB.title = atEnd && flowNext ? "Next: " + flowNext.e : "";
    try { history.replaceState(null, "", "#" + v.id); } catch(e) {}
    window.scrollTo(0, 0);
    saveFocus();
    updateSec();
  }
  function nearestVerse(){
    var top = topbar.offsetHeight + 10, best = 0;
    verses.forEach(function(v, i){ if (v.getBoundingClientRect().top <= top + 80) best = i; });
    return best;
  }
  function setFocus(on, startAt){
    if (on && startAt == null) startAt = nearestVerse();   // measure before the other verses hide
    focusOn = on;
    document.body.classList.toggle("focus-mode", on);
    var label = on ? "Show full text" : "Focus: one verse at a time";
    document.querySelectorAll("[data-focus-toggle]").forEach(function(b){
      b.setAttribute("aria-pressed", on ? "true" : "false"); b.setAttribute("aria-label", label); b.title = label; });
    if (on) {
      show(startAt);
    } else {
      verses.forEach(function(v){ v.classList.remove("cur", "in-next", "in-prev"); });
      try { history.replaceState(null, "", location.pathname + location.search); } catch(e) {}
      var v = verses[idx];
      if (v) window.scrollTo(0, v.getBoundingClientRect().top + window.scrollY - topbar.offsetHeight - 8);
      saveFocus();
    }
    onScroll();
  }
  function go(d){
    if (!focusOn) return;
    var n = idx + d;
    if (n >= 0 && n < verses.length) { show(n, d); return; }
    var to = d > 0 ? flowNext : flowPrev;                 // past the edge: the neighbouring chapter, if it is ready
    if (to) location.href = to.h + (d > 0 ? "#first" : "#last");
  }
  prevB.addEventListener("click", function(){ go(-1); });
  nextB.addEventListener("click", function(){ go(1); });
  document.addEventListener("click", function(e){
    if (e.target.closest("[data-focus-toggle]")) setFocus(!focusOn);
    var th = e.target.closest("[data-thanks]");
    if (th) {                                   // namaste: open the citations, leaving focus mode if needed
      e.preventDefault();
      if (focusOn) setFocus(false);
      var c = document.getElementById("credits");
      var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.scrollTo({top: c.getBoundingClientRect().top + window.scrollY - topbar.offsetHeight - 8,
                       behavior: reduce || focusOn ? "auto" : "smooth"});
      th.blur();
    }
  });
  function dictOpen(){ return document.getElementById("dict-back").classList.contains("open"); }
  document.addEventListener("keydown", function(e){
    if (!focusOn || dictOpen() || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === "ArrowRight") { e.preventDefault(); go(1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
  });
  var sx = 0, sy = 0, tracking = false;
  document.addEventListener("touchstart", function(e){
    tracking = focusOn && !dictOpen() && e.touches.length === 1 && !e.target.closest(".topbar, .focus-nav");
    if (tracking) { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }
  }, {passive: true});
  document.addEventListener("touchend", function(e){
    if (!tracking) return;
    tracking = false;
    var dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
  }, {passive: true});

  // start in focus mode if the reader left it on, or if the link points at a verse (#v5)
  var saved = {};
  try { saved = JSON.parse(localStorage.getItem(FKEY) || "{}"); } catch(e) {}
  var hashI = -1;
  verses.forEach(function(v, i){ if ("#" + v.id === location.hash) hashI = i; });
  // arriving from the neighbouring chapter in focus mode: #first or #last
  var arriving = location.hash === "#first" || location.hash === "#last";
  if (arriving) hashI = location.hash === "#first" ? 0 : verses.length - 1;
  if (saved.on || arriving) {
    var si = hashI;
    if (si < 0 && saved.p === location.pathname) verses.forEach(function(v, i){ if (v.id === saved.v) si = i; });
    setFocus(true, si < 0 ? 0 : si);
    // coming from the neighbouring chapter, the verse slides in as it does within a chapter
    if (arriving && verses[idx]) verses[idx].classList.add(location.hash === "#last" || hashI > 0 ? "in-prev" : "in-next");
  }
  // A page opened at a verse (#v5, or #first / #last from the neighbouring chapter) is scrolled by the
  // browser to that verse once it has loaded, which hides the heading above it. In focus mode the
  // page always starts at the top.
  try { if ("scrollRestoration" in history) history.scrollRestoration = "manual"; } catch(e) {}
  function topIfFocus(){ if (focusOn) window.scrollTo(0, 0); }
  window.addEventListener("load", function(){ topIfFocus(); setTimeout(topIfFocus, 60); });
  window.addEventListener("pageshow", topIfFocus);
  window.addEventListener("hashchange", topIfFocus);

  // ---- Section picker: shown when the text has more than one section. The name in the toolbar is the
  // section being read (it changes with the scroll, or with the verse in focus mode); it opens a list.
  var secNav = document.getElementById("sec-nav"), secCur = document.getElementById("sec-cur");
  var secName = document.getElementById("sec-name"), secMenu = document.getElementById("sec-menu");
  var secs = Array.prototype.slice.call(main.querySelectorAll(":scope > .section")), shownSec = null;
  if (secs.length > 1) {
    secs.forEach(function(s, i){
      var b = document.createElement("button");
      b.className = "sec-item"; b.type = "button"; b.setAttribute("role", "menuitem"); b.dataset.sec = i;
      var sn = document.createElement("span"); sn.className = "sn"; sn.lang = "sa";
      if (s.dataset.short) { var sh = document.createElement("span"); sh.className = "sec-short"; sh.textContent = s.dataset.short; sn.appendChild(sh); }
      sn.appendChild(document.createTextNode(s.querySelector(".sd").textContent));
      var se = document.createElement("span"); se.className = "se"; se.textContent = s.querySelector(".si").textContent;
      b.appendChild(sn); b.appendChild(se); secMenu.appendChild(b);
    });
  }
  // A text spread over several pages (one adhyāya each): the picker then lists the pages. Those that
  // are ready are links; the name shown is this page's, once its title has scrolled out of view.
  var NAV = window.__vsNav;
  if (NAV) {
    NAV.forEach(function(n){
      var link = n.h && !n.cur, b = document.createElement(link ? "a" : "span");
      b.className = "sec-item" + (n.h ? "" : " off");
      if (link) b.href = n.h;
      b.setAttribute("role", "menuitem");
      if (n.cur) b.setAttribute("aria-current", "true");
      var sn = document.createElement("span"); sn.className = "sn"; sn.lang = "sa"; sn.textContent = n.d;
      var se = document.createElement("span"); se.className = "se"; se.textContent = n.e + (n.h ? "" : " · to come");
      b.appendChild(sn); b.appendChild(se); secMenu.appendChild(b);
      if (n.cur) { secName.textContent = n.d; secCur.title = n.e + " · go to another adhyāya"; }
    });
  }
  function currentSec(){
    if (focusOn) return secOf[idx] || null;
    var line = topbar.offsetHeight + 14, cur = null;
    secs.forEach(function(s){ if (s.getBoundingClientRect().top <= line) cur = s; });
    return cur;
  }
  function updateSec(){
    if (NAV && pageHead) { secNav.hidden = pageHead.getBoundingClientRect().bottom > topbar.offsetHeight; return; }
    if (!secs || secs.length < 2) return;       // also when called before the picker is set up
    var cur = currentSec();
    if (cur === shownSec) return;
    shownSec = cur;
    if (!cur) { openSec(false); secNav.hidden = true; return; }
    secNav.hidden = false;
    secName.textContent = cur.querySelector(".sd").textContent;
    var secShort = document.getElementById("sec-short");
    secShort.textContent = cur.dataset.short || "";
    secShort.hidden = !cur.dataset.short;
    secCur.title = cur.querySelector(".si").textContent + " · go to another section";
    Array.prototype.forEach.call(secMenu.children, function(b){
      b.setAttribute("aria-current", secs[+b.dataset.sec] === cur ? "true" : "false"); });
  }
  function openSec(on){
    secNav.classList.toggle("open", on);
    secCur.setAttribute("aria-expanded", on ? "true" : "false");
    if (on) { var c = secMenu.querySelector('[aria-current="true"]'); if (c) c.scrollIntoView({block: "nearest"}); }
  }
  secCur.addEventListener("click", function(){ openSec(!secNav.classList.contains("open")); });
  secMenu.addEventListener("click", function(e){
    var b = e.target.closest(".sec-item"); if (!b) return;
    if (NAV) { if (b.tagName !== "A") e.preventDefault(); else openSec(false); return; }   // links go to the other page
    var s = secs[+b.dataset.sec];
    openSec(false);
    if (focusOn) {                                  // go to the first verse of that section
      var first = secOf.indexOf(s);
      if (first >= 0 && first !== idx) show(first, first > idx ? 1 : -1);
    } else {
      var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.scrollTo({top: s.getBoundingClientRect().top + window.scrollY - topbar.offsetHeight - 2,
                       behavior: reduce ? "auto" : "smooth"});
    }
    secCur.blur();
  });
  document.addEventListener("click", function(e){ if (!e.target.closest("#sec-nav")) openSec(false); });
  document.addEventListener("keydown", function(e){
    if (e.key === "Escape" && secNav.classList.contains("open")) { openSec(false); secCur.focus(); } });

  document.getElementById("tb-title").textContent = document.getElementById("t-deva").textContent;

  var merged = false;
  function setMerged(on){
    if (on === merged) return;
    merged = on;
    topbar.classList.toggle("merged", on);
    if (on) slot.removeAttribute("inert"); else slot.setAttribute("inert", "");
  }
  function onScroll(){
    var y = window.scrollY || document.documentElement.scrollTop;
    topbar.classList.toggle("scrolled", y > 4 || document.body.classList.contains("focus-mode"));
    setMerged(bar.getBoundingClientRect().bottom <= topbar.offsetHeight);
    var show = y > Math.max(600, window.innerHeight * 0.8);
    toTop.classList.toggle("show", show);
    toTop.tabIndex = show ? 0 : -1;
    updateSec();
    // the text's name appears at the right once the title above has scrolled away (or in focus mode)
    topbar.classList.toggle("past-title", pageHead.getBoundingClientRect().bottom <= topbar.offsetHeight);
  }
  var ticking = false;
  window.addEventListener("scroll", function(){
    if (!ticking) { ticking = true; requestAnimationFrame(function(){ ticking = false; onScroll(); }); }
  }, {passive: true});
  window.addEventListener("resize", onScroll);
  onScroll();

  toTop.addEventListener("click", function(){
    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({top: 0, behavior: reduce ? "auto" : "smooth"});
    toTop.blur();
  });
})();

document.documentElement.classList.remove("pre-focus");
