/* LinguaLibre — main app logic. Unlimited lessons, no XP gating, no energy. */
const App = (() => {
  let courses = [], course = null, lesson = null, exIdx = 0, state = {}, answered = false;
  let chatHistory = [];
  const $ = (id) => document.getElementById(id);
  const store = {
    get: () => JSON.parse(localStorage.getItem("lingualibre") || "{}"),
    set: (s) => localStorage.setItem("lingualibre", JSON.stringify(s))
  };

  // ---------- boot ----------
  async function boot() {
    state = store.get();
    if (!state.completed) state.completed = {};   // lessonId -> times completed
    if (!state.days) state.days = [];             // practice days for streak (not gated!)
    const today = new Date().toDateString();
    if (!state.days.includes(today)) { /* recorded on lesson finish */ }
    store.set(state);

    const res = await fetch("/api/courses");
    courses = await res.json();
    renderCourseCards();
    const status = await (await fetch("/api/status")).json();
    if (!status.grokKeyConfigured) {
      $("view-practice").querySelector("p").innerHTML += " <b>(⚠️ Set XAI_API_KEY in .env to enable AI features.)</b>";
      $("view-tutor").querySelector("p").innerHTML += " <b>(⚠️ Set XAI_API_KEY in .env to enable AI features.)</b>";
    }
  }

  function renderCourseCards() {
    $("courseCards").innerHTML = courses.map((c) => `
      <div class="course-card" onclick="App.openCourse('${c.id}')">
        <div class="flag">${c.flag}</div>
        <h3>${c.name}</h3>
        <p>${c.units} units · ${c.lessons} lessons · 100% free & unlimited</p>
      </div>`).join("");
  }

  // ---------- navigation ----------
  function showHome() { switchView("home"); }
  function switchTab(tab) {
    if (tab === "learn" && !course) return showHome();
    if (tab === "profile") renderProfile();
    switchView(tab);
    document.querySelectorAll(".navbtn").forEach((b) => b.classList.toggle("active", b.dataset.view === tab));
  }
  function switchView(name) {
    document.querySelectorAll(".view").forEach((v) => v.classList.add("hidden"));
    $("view-" + name).classList.remove("hidden");
  }

  // ---------- skill tree ----------
  async function openCourse(id) {
    course = await (await fetch("/api/course/" + id)).json();
    $("courseTitle").textContent = `${course.flag} ${course.name}`;
    renderTree();
    switchView("learn");
  }

  function allLessonIds() { return course ? course.units.flatMap((u) => u.lessons.map((l) => l.id)) : []; }
  function isUnlocked(lessonId) {
    const ids = allLessonIds();
    const i = ids.indexOf(lessonId);
    // Everything after a started path is unlocked anyway — but we keep the classic path feel:
    // a lesson unlocks when the previous one has been attempted at least once. FIRST lesson always open.
    // NOTE: this is purely visual ordering — nothing is paywalled and you can replay anything forever.
    if (i <= 0) return true;
    return !!state.completed[ids[i - 1]];
  }

  function renderTree() {
    const total = allLessonIds().length;
    const done = allLessonIds().filter((id) => state.completed[id]).length;
    $("overallProgress").textContent = `${done}/${total} lessons complete`;
    const offsets = ["", "offset-1", "offset-2", "offset-3"];
    $("skillTree").innerHTML = course.units.map((u, ui) => `
      <div class="unit-label" style="background:${u.color}">Unit ${ui + 1}: ${u.title} — ${u.description}</div>
      <div class="circles-row">
        ${u.lessons.map((l, li) => {
          const complete = !!state.completed[l.id];
          const unlocked = complete || isUnlocked(l.id);
          const icon = complete ? "⭐" : unlocked ? "📘" : "🔒";
          return `<button class="skill-circle ${complete ? "done" : ""} ${!unlocked ? "locked" : ""} ${offsets[(li + ui) % 4]}"
                    style="background:${unlocked ? u.color : ""}"
                    onclick="App.startLesson('${l.id}')">
                    ${icon}<span class="tip">${l.title}${!unlocked ? " · finish previous lesson" : ""}</span>
                  </button>`;
        }).join("")}
      </div>`).join("");
  }

  // ---------- lesson player ----------
  function findLesson(id) { for (const u of course.units) for (const l of u.lessons) if (l.id === id) return l; }

  function startLesson(id) {
    lesson = findLesson(id);
    if (!lesson) return;
    if (!state.completed[id] && !isUnlocked(id)) { alert("Follow the path — finish the previous lesson first! (Everything is free, just ordered.)"); return; }
    exIdx = 0;
    $("lessonOverlay").classList.remove("hidden");
    $("completeOverlay").classList.add("hidden");
    renderExercise();
  }

  function quitLesson() { $("lessonOverlay").classList.add("hidden"); }

  function updateBar() {
    $("lessonBar").style.width = (exIdx / lesson.exercises.length) * 100 + "%";
    $("exCount").textContent = `${Math.min(exIdx + 1, lesson.exercises.length)}/${lesson.exercises.length}`;
  }

  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

  function renderExercise() {
    answered = false;
    updateBar();
    $("feedbackBar").classList.add("hidden");
    $("checkWrap").classList.remove("hidden");
    const ex = lesson.exercises[exIdx];
    const area = $("exerciseArea");
    const langCode = course.id === "de" ? "de-DE" : "en-US";

    if (ex.type === "select" || ex.type === "choice") {
      area.innerHTML = `<h2>${esc(ex.prompt)}</h2><div class="options-grid">` +
        shuffled(ex.options).map((o) => `<button class="option" onclick="App.pick(this,'${esc(o)}')">${esc(o)}</button>`).join("") + "</div>";
      state._pick = null;
    } else if (ex.type === "fillBlank") {
      area.innerHTML = `<h2>Fill in the blank</h2><div class="bubble">${esc(ex.prompt)}</div><div class="options-grid">` +
        shuffled(ex.options).map((o) => `<button class="option" onclick="App.pick(this,'${esc(o)}')">${esc(o)}</button>`).join("") + "</div>";
      state._pick = null;
    } else if (ex.type === "translate") {
      const bank = shuffled([...ex.wordBank, ...extraDistractors(ex)]);
      area.innerHTML = `<h2>${esc(ex.prompt)}</h2><div class="bubble">${esc(ex.hint || "")}</div>
        <div class="answer-line" id="ansLine"></div>
        <div class="wordbank">` + bank.map((w) => `<button class="chip" onclick="App.chip(this,'${esc(w)}')">${esc(w)}</button>`).join("") + "</div>";
      state._words = [];
    } else if (ex.type === "typeIn") {
      area.innerHTML = `<h2>Type what you hear / know</h2><div class="bubble">${esc(ex.prompt)}</div>
        <input class="type-input" id="typeInput" placeholder="Type here…" autocomplete="off" autocapitalize="off" />`;
      setTimeout(() => $("typeInput")?.focus(), 50);
    } else if (ex.type === "listen") {
      area.innerHTML = `<h2>Listen and choose</h2>
        <button class="speaker-btn" onclick="SFX.speak(${JSON.stringify(ex.audio)}, '${langCode}')">🔊</button>
        <div class="options-grid">` + shuffled(ex.options).map((o) => `<button class="option" onclick="App.pick(this,'${esc(o)}')">${esc(o)}</button>`).join("") + "</div>";
      state._pick = null;
      setTimeout(() => SFX.speak(ex.audio, langCode), 350);
    } else if (ex.type === "match") {
      const left = shuffled(ex.pairs.map((p) => p[0])), right = shuffled(ex.pairs.map((p) => p[1]));
      state._matchSel = null; state._matchDone = 0; state._pairs = ex.pairs;
      area.innerHTML = `<h2>Tap the matching pairs</h2><div class="match-cols">
        <div>` + left.map((t) => `<div class="match-item" data-side="0" data-text="${esc(t)}" onclick="App.matchPick(this)">${esc(t)}</div>`).join("") + `</div>
        <div>` + right.map((t) => `<div class="match-item" data-side="1" data-text="${esc(t)}" onclick="App.matchPick(this)">${esc(t)}</div>`).join("") + `</div>
      </div>`;
      $("checkWrap").classList.add("hidden"); // match self-completes
    }
  }

  function extraDistractors(ex) {
    // ensure word bank has a couple of extras beyond the answer words
    const need = Math.max(0, ex.answer.split(" ").length + 3 - ex.wordBank.length);
    return Array.from({ length: need }, (_, i) => ["der", "die", "das", "und", "oder", "mit", "sehr", "auch"][i % 8]);
  }

  function shuffled(arr) { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  // ----- interaction handlers -----
  function pick(btn, val) {
    if (answered) return;
    SFX.tap();
    document.querySelectorAll(".option.selected").forEach((b) => b.classList.remove("selected"));
    btn.classList.add("selected");
    state._pick = val;
  }
  function chip(btn, word) {
    if (answered || btn.classList.contains("used")) return;
    SFX.tap();
    btn.classList.add("used");
    state._words.push(word);
    const line = $("ansLine");
    const sp = document.createElement("button");
    sp.className = "chip"; sp.textContent = word;
    sp.onclick = () => { sp.remove(); btn.classList.remove("used"); state._words = state._words.filter((w, i) => !(w === word && i === state._words.indexOf(word))); };
    line.appendChild(sp);
  }
  function matchPick(el) {
    if (answered || el.classList.contains("paired")) return;
    SFX.tap();
    if (!state._matchSel) { el.classList.add("sel"); state._matchSel = el; return; }
    if (el === state._matchSel) { el.classList.remove("sel"); state._matchSel = null; return; }
    const a = state._matchSel, b = el;
    const pair = state._pairs.find((p) => (p[0] === a.dataset.text && p[1] === b.dataset.text) || (p[1] === a.dataset.text && p[0] === b.dataset.text));
    const sameSide = a.dataset.side === b.dataset.side;
    if (pair && !sameSide) {
      a.classList.remove("sel"); a.classList.add("paired"); b.classList.add("paired");
      state._matchDone++; state._matchSel = null;
      if (state._matchDone === state._pairs.length) { SFX.correct(); showFeedback(true, ""); nextExerciseDelayed(); }
    } else {
      b.classList.add("wrong-flash"); a.classList.add("wrong-flash");
      setTimeout(() => { b.classList.remove("wrong-flash"); a.classList.remove("wrong-flash", "sel"); state._matchSel = null; }, 500);
    }
  }

  // ----- checking -----
  function normalize(s) { return s.toLowerCase().trim().replace(/[.,!?;„“"']/g, "").replace(/\s+/g, " "); }

  function checkAnswer() {
    if (answered) return;
    const ex = lesson.exercises[exIdx];
    let ok = false, detail = "";
    if (ex.type === "translate") {
      const given = (state._words || []).join(" ");
      ok = normalize(given) === normalize(ex.answer);
      if (!ok) detail = `Correct answer: “${ex.answer}”`;
    } else if (ex.type === "typeIn") {
      const given = $("typeInput")?.value || "";
      if (!given.trim()) return;
      ok = ex.answer.some((a) => normalize(given) === normalize(a));
      if (!ok) detail = `Correct answer: “${ex.answer[0]}”`;
    } else {
      if (!state._pick) return;
      ok = normalize(state._pick) === normalize(ex.answer);
      if (!ok) detail = `Correct answer: “${ex.answer}”`;
      document.querySelectorAll(".option").forEach((b) => {
        if (normalize(b.textContent) === normalize(ex.answer)) b.classList.add("correct");
        else if (b.classList.contains("selected")) b.classList.add("wrong");
      });
    }
    showFeedback(ok, detail, ex);
  }

  function skipExercise() {
    if (answered) return;
    const ex = lesson.exercises[exIdx];
    const ans = ex.answer ? (Array.isArray(ex.answer) ? ex.answer[0] : ex.answer) : "";
    showFeedback(false, ans ? `Correct answer: “${ans}”` : "Skipped.", ex);
  }

  function showFeedback(ok, detail, ex) {
    answered = true;
    ok ? SFX.correct() : SFX.wrong();
    const fb = $("feedbackBar");
    fb.classList.remove("hidden", "good", "bad");
    fb.classList.add(ok ? "good" : "bad");
    $("fbIcon").textContent = ok ? "✅" : "❌";
    $("fbTitle").textContent = ok ? "Nice!" : "Not quite";
    $("fbDetail").textContent = detail;
    $("checkWrap").classList.add("hidden");
    // offer a word explanation via Grok when wrong (optional feature)
    if (!ok && ex && window._grokOn && ex.answer) addExplainButton(Array.isArray(ex.answer) ? ex.answer[0] : ex.answer);
  }

  function addExplainButton(word) {
    const d = $("fbDetail");
    const btn = document.createElement("button");
    btn.textContent = " 💡 Explain with AI";
    btn.style.cssText = "background:none;border:none;color:#1cb0f6;font-weight:800;cursor:pointer;margin-left:8px";
    btn.onclick = async () => {
      btn.disabled = true; btn.textContent = " …thinking";
      try {
        const r = await (await fetch("/api/explain", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ word, lang: course.id }) })).json();
        if (r.translation) d.textContent = `${word} → ${r.translation} · ${r.example} (${r.exampleTranslation}) · ${r.note}`;
        else d.textContent = "AI unavailable: " + (r.error || "");
      } catch (e) { d.textContent = "AI unavailable."; }
      btn.remove();
    };
    d.appendChild(btn);
  }

  function nextExerciseDelayed() { setTimeout(() => nextExercise(), 700); }

  function nextExercise() {
    exIdx++;
    if (exIdx >= lesson.exercises.length) return finishLesson();
    renderExercise();
  }

  function finishLesson() {
    state.completed[lesson.id] = (state.completed[lesson.id] || 0) + 1;
    const today = new Date().toDateString();
    if (!state.days.includes(today)) state.days.push(today);
    store.set(state);
    SFX.complete();
    $("completeStats").textContent = `“${lesson.title}” mastered. This was run #${state.completed[lesson.id]} — replay anytime.`;
    $("lessonOverlay").classList.add("hidden");
    $("completeOverlay").classList.remove("hidden");
  }
  function closeComplete() { $("completeOverlay").classList.add("hidden"); renderTree(); }

  // ---------- profile ----------
  function renderProfile() {
    const done = Object.keys(state.completed || {}).length;
    const replays = Object.values(state.completed || {}).reduce((a, b) => a + b - 1, 0);
    const days = (state.days || []).length;
    $("profileStats").innerHTML = `
      <div class="stat-box"><div class="num">${done}</div><div class="lbl">lessons completed</div></div>
      <div class="stat-box"><div class="num">${days}</div><div class="lbl">practice days 🔥 (streak — informational only)</div></div>
      <div class="stat-box"><div class="num">${replays}</div><div class="lbl">free replays — because limits don't exist here</div></div>
      <div class="stat-box"><div class="num">∞</div><div class="lbl">energy remaining, always</div></div>`;
  }
  function resetProgress() { if (confirm("Reset all local progress?")) { localStorage.removeItem("lingualibre"); location.reload(); } }

  // ---------- AI practice ----------
  async function generatePractice() {
    const topic = $("practiceTopic").value || "daily life";
    const area = $("practiceArea");
    area.innerHTML = "<p class='muted'>Generating with Grok…</p>";
    try {
      const r = await (await fetch("/api/practice", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lang: course ? course.id : "de", topic }) })).json();
      if (!r.exercises) throw new Error(r.error || "failed");
      area.innerHTML = r.exercises.map((e, i) => `
        <div class="practice-item" data-answer="${esc(e.target)}">
          <div class="q">${i + 1}. Translate: “${esc(e.source)}”</div>
          <input placeholder="Your translation…" />
          <button class="btn btn-green" style="margin-top:10px;padding:8px 16px;font-size:13px" onclick="App.checkPractice(this)">CHECK</button>
          <div class="verdict"></div>
        </div>`).join("");
    } catch (err) {
      area.innerHTML = `<p style="color:var(--red)">Could not reach Grok: ${esc(err.message)}. Add your XAI_API_KEY to .env and restart the server.</p>`;
    }
  }
  function checkPractice(btn) {
    const item = btn.closest(".practice-item");
    const given = item.querySelector("input").value;
    const ok = normalize(given) === normalize(item.dataset.answer);
    const v = item.querySelector(".verdict");
    v.style.color = ok ? "var(--green)" : "var(--red)";
    v.textContent = ok ? "✅ Correct!" : `❌ Expected: “${item.dataset.answer}”`;
    ok ? SFX.correct() : SFX.wrong();
  }

  // ---------- AI tutor ----------
  async function sendChat() {
    const input = $("chatInput"), msg = input.value.trim();
    if (!msg) return;
    input.value = "";
    logMsg("user", msg);
    chatHistory.push({ role: "user", content: msg });
    const thinking = logMsg("bot", "Lingo is typing…");
    try {
      const r = await (await fetch("/api/tutor", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: msg, history: chatHistory.slice(0, -1), lang: course ? course.id : "de" }) })).json();
      thinking.textContent = r.reply || ("Error: " + (r.error || "unknown"));
      chatHistory.push({ role: "assistant", content: thinking.textContent });
    } catch (e) {
      thinking.textContent = "Could not reach the Grok API. Check your XAI_API_KEY in .env.";
    }
  }
  function logMsg(role, text) {
    const d = document.createElement("div");
    d.className = "msg " + role; d.textContent = text;
    $("chatLog").appendChild(d);
    $("chatLog").scrollTop = 1e9;
    return d;
  }

  // probe grok availability once
  fetch("/api/status").then((r) => r.json()).then((s) => { window._grokOn = s.grokKeyConfigured; });

  return { boot, showHome, switchTab, openCourse, startLesson, quitLesson, pick, chip, matchPick, checkAnswer, skipExercise, nextExercise, closeComplete, generatePractice, checkPractice, sendChat, resetProgress };
})();

document.addEventListener("DOMContentLoaded", App.boot);
window.App = App;
