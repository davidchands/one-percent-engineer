// Renders the state sent by the extension. Posts user intents back. No network, no storage.
// The submit form lives outside the re-rendered area so typing is never lost on refresh.
(function () {
  const vscode = acquireVsCodeApi();
  const app = document.getElementById("app");
  let state = null;
  let explanationDraft = (vscode.getState() || {}).explanation || "";
  let outsideHelp = false;

  const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const cmd = (command) => vscode.postMessage({ type: "command", command });
  const fmt = (ms) => {
    if (ms == null) return "n/a";
    const s = Math.floor(ms / 1000), m = Math.floor(s / 60), h = Math.floor(m / 60);
    return h ? `${h}h ${m % 60}m` : m ? `${m}m ${String(s % 60).padStart(2, "0")}s` : `${s}s`;
  };
  const list = (items, ordered) =>
    `<${ordered ? "ol" : "ul"}>${items.map((i) => `<li>${esc(i)}</li>`).join("")}</${ordered ? "ol" : "ul"}>`;
  const problem = (text) =>
    text.trim().split(/\n\s*\n/).map((para) => {
      const lines = para.split("\n");
      const out = [];
      let prose = [], code = [];
      const flush = () => {
        if (prose.length) out.push(`<p>${esc(prose.join(" ")).replace(/`([^`]+)`/g, "<code>$1</code>")}</p>`), (prose = []);
        if (code.length) out.push(`<pre class="code">${esc(code.join("\n"))}</pre>`), (code = []);
      };
      for (const l of lines) {
        if (/^\s{2,}/.test(l)) { if (prose.length) flush(); code.push(l.replace(/^\s{2}/, "")); }
        else { if (code.length) flush(); prose.push(l.trim()); }
      }
      flush();
      return out.join("");
    }).join("");

  function render() {
    if (!state) return (app.innerHTML = `<p class="muted">Loading…</p>`);
    if (state.status === "offline") {
      return (app.innerHTML = `
        <h1>Server not running</h1>
        <p class="muted">Start 1% Engineer from the project folder:</p>
        <pre>pnpm dev</pre>
        <button class="primary" data-cmd="onePercent.refresh">Retry</button>`);
    }
    if (state.status === "error") {
      return (app.innerHTML = `<div class="notice error">${esc(state.error)}</div><button data-cmd="onePercent.refresh">Retry</button>`);
    }
    const ch = state.challenge, a = state.attempt, t = state.today;
    if (!ch) return (app.innerHTML = `<h1>No challenge left</h1><p class="muted">Add challenges under content/challenges.</p>`);

    const open = a && a.status === "in_progress";
    const passed = a && a.status === "passed";
    const thinking = a && a.metrics.find((m) => m.key === "thinking");
    const timerRunning = Boolean(thinking && thinking.runningSince);
    const rationale = state.isToday && t && t.primary ? t.primary.rationale : null;
    const busy = state.busy;

    let html = "";
    if (!state.isToday) html += `<div class="notice small">Not today's objective. <button class="link" data-msg="backToToday">Back to today</button></div>`;
    html += `
      <div class="tags">
        <span class="tag accent">${esc(ch.type)}</span>
        <span class="tag">difficulty ${ch.difficulty}/5</span>
        ${passed ? `<span class="tag ok">passed${a.independence ? " · " + esc(a.independence.replace("_", " ")) : ""}</span>` : ""}
        ${!state.trackingEnabled ? `<span class="tag bad">tracking paused</span>` : ""}
      </div>
      <h1>${esc(ch.title)}</h1>
      <p class="muted">${esc(ch.objective)}</p>`;

    if (rationale) {
      html += `<details><summary>Why this, today${rationale.isPlaceholder ? " (placeholder)" : ""}</summary>
        <p class="small">${esc(rationale.summary)}</p>
        <p class="small muted"><b>Gap:</b> ${esc(rationale.gap)}<br><b>Measured by:</b> ${esc(rationale.howMeasured)}</p>
      </details>`;
    }

    if (busy) html += `<p class="busy">${esc(busy)}</p>`;
    if (state.notice) html += `<div class="notice error small">${esc(state.notice)}</div>`;

    // Primary actions
    html += `<div class="row" style="margin-top:10px">`;
    if (!open && passed) {
      html += `<button class="primary" data-msg="openJournal">Write journal entry</button>
               <button data-cmd="onePercent.start" ${busy ? "disabled" : ""}>Open files / new attempt</button>`;
    } else if (!open) {
      html += `<button class="primary" data-cmd="onePercent.start" ${busy ? "disabled" : ""}>Start challenge</button>`;
    } else {
      html += `<button data-cmd="onePercent.start" ${busy ? "disabled" : ""}>${state.filesExist ? "Open solution.mjs" : "Create files"}</button>
               <button class="primary" data-cmd="onePercent.runTests" ${busy ? "disabled" : ""}>Run tests</button>
               <button data-cmd="onePercent.toggleTimer" ${busy ? "disabled" : ""}>${timerRunning ? "Pause timer" : "Thinking timer"}</button>`;
    }
    html += `</div>`;
    if (open) html += `<p class="small muted">Files live in your practice folder. You can also run <code>node --test</code> there.</p>`;

    // Results
    if (state.lastRun) {
      const r = state.lastRun;
      html += `<h2>Tests · ${r.passed} passed · ${r.failed} failed${r.timedOut ? " · timed out" : ""}</h2>`;
      html += r.cases.map((c) => `
        <div class="case"><span class="icon ${c.passed ? "pass" : "fail"}">${c.passed ? "✓" : "✗"}</span>
          <span class="${c.passed ? "muted" : ""}">${esc(c.name)}${c.hidden ? ' <span class="muted small">(hidden)</span>' : ""}</span></div>
        ${c.message ? `<pre class="small">${esc(c.message)}</pre>` : ""}`).join("");
      if (state.lastSubmit && !state.lastSubmit.allPassed) {
        html += `<div class="notice small">Not all tests pass yet; the attempt stays open. Form a hypothesis, change one thing.</div>`;
      }
    }

    // Brief
    html += `<h2>Problem</h2>${problem(ch.problem)}`;
    html += `<h2>Requirements</h2>${list(ch.requirements, true)}`;
    html += `<h2>Constraints</h2>${list(ch.constraints)}`;
    html += `<details><summary>Examples</summary>${ch.examples.map((e) => `<pre>in  ${esc(e.input)}\nout ${esc(e.output)}${e.note ? "\n" + esc(e.note) : ""}</pre>`).join("")}</details>`;
    html += `<details><summary>Edge cases to investigate</summary>${list(ch.edgeCasesToConsider)}</details>`;
    html += `<details><summary>Before coding</summary>${list(ch.beforeCoding)}</details>`;

    // Hints
    const used = a ? a.hints.length : 0;
    html += `<h2>Hints · ${used} of ${ch.hintCount}</h2>`;
    html += (a ? a.hints : []).map((h, i) => `<div class="hint small"><b>#${i + 1}</b> ${esc(h)}</div>`).join("");
    if (open) {
      html += `<button data-cmd="onePercent.hint" ${busy || used >= ch.hintCount ? "disabled" : ""}>${used >= ch.hintCount ? "No hints left" : "Reveal next hint"}</button>
        <p class="small muted">Hint 4+ gives implementation detail: the attempt then counts as assisted.</p>`;
    }

    // Metrics
    if (a) {
      html += `<h2>Process metrics</h2>`;
      html += a.metrics.map((m) => {
        let v = m.count !== undefined ? String(m.count) : fmt(m.valueMs);
        if (m.key === "thinking" && m.runningSince) v = fmt((m.valueMs || 0) + (Date.now() - new Date(m.runningSince).getTime()));
        if (m.key === "elapsed" && open) v = fmt(Date.now() - new Date(a.startedAt).getTime());
        const live = (m.key === "thinking" && m.runningSince) || (m.key === "elapsed" && open) ? `data-live="${m.key}"` : "";
        return `<div class="metric small" title="${esc(m.caveat)}"><span>${esc(m.label)}</span><span><span class="mono" ${live}>${v}</span> <span class="prov ${m.provenance}">${m.provenance}</span></span></div>`;
      }).join("");
    }

    if (open) {
      html += `<details><summary>Truly stuck?</summary>
        <p class="small muted">Viewing the solution is allowed and recorded honestly.</p>
        <button class="danger" data-cmd="onePercent.viewSolution">Show solution</button></details>`;
    }

    html += `<h2>More</h2><div class="row small">
      <button class="link" data-cmd="onePercent.openInBrowser">Open in browser</button> ·
      <button class="link" data-cmd="onePercent.insertTaskComment">Task comment → current file</button> ·
      <button class="link" data-cmd="onePercent.toggleTracking">${state.trackingEnabled ? "Pause tracking" : "Resume tracking"}</button> ·
      <button class="link" data-cmd="onePercent.showCollectedData">What's collected?</button>
    </div>`;

    // Keep <details> sections the way the user left them across re-renders.
    const openDetails = new Set([...app.querySelectorAll("details[open] > summary")].map((s) => s.textContent));
    app.innerHTML = html + `<div id="submit-slot"></div>`;
    for (const s of app.querySelectorAll("details > summary")) if (openDetails.has(s.textContent)) s.parentElement.open = true;
    renderSubmit(open, ch, busy);
  }

  // The submit form is built once per attempt and re-attached, so a refresh never wipes your typing.
  let submitEl = null, submitFor = null;
  function renderSubmit(open, ch, busy) {
    const slot = document.getElementById("submit-slot");
    if (!open) return;
    const key = state.attempt.id;
    if (!submitEl || submitFor !== key) {
      submitFor = key;
      submitEl = document.createElement("div");
      submitEl.innerHTML = `
        <h2>Explanation checkpoint</h2>
        <p class="small">${esc(ch.explanationCheckpoint.trim())}</p>
        <textarea id="expl" placeholder="In your own words. Code without reasoning isn't evidence of understanding."></textarea>
        <label class="check small"><input type="checkbox" id="outside" />
          <span>I used help from outside 1% Engineer (AI, web search, a person). It can't see this.</span></label>
        <div class="row"><button class="primary" id="submit">Submit for evaluation</button><span id="count" class="small muted"></span></div>
        <p class="small muted">Submit runs the hidden tests too. Iterate with "Run tests" first.</p>`;
      const ta = submitEl.querySelector("#expl");
      ta.value = explanationDraft;
      const sync = () => {
        explanationDraft = ta.value;
        vscode.setState({ explanation: explanationDraft });
        const n = ta.value.trim().length;
        submitEl.querySelector("#count").textContent = n < 40 ? `${n}/40 characters` : "";
        submitEl.querySelector("#submit").disabled = n < 40 || Boolean(state.busy);
      };
      ta.addEventListener("input", sync);
      submitEl.querySelector("#outside").addEventListener("change", (e) => (outsideHelp = e.target.checked));
      submitEl.querySelector("#submit").addEventListener("click", () =>
        vscode.postMessage({ type: "submit", explanation: ta.value, usedOutsideHelp: outsideHelp }),
      );
      sync();
    }
    submitEl.querySelector("#submit").disabled = explanationDraft.trim().length < 40 || Boolean(busy);
    slot.replaceWith(submitEl);
  }

  app.addEventListener("click", (e) => {
    const el = e.target.closest("[data-cmd],[data-msg]");
    if (!el || el.disabled) return;
    if (el.dataset.cmd) cmd(el.dataset.cmd);
    else vscode.postMessage({ type: el.dataset.msg });
  });

  window.addEventListener("message", (e) => {
    if (e.data.type !== "state") return;
    const prevAttempt = state && state.attempt && state.attempt.id;
    state = e.data.state;
    if (state.attempt && state.attempt.status === "passed" && prevAttempt === state.attempt.id) {
      explanationDraft = "";
      vscode.setState({});
    }
    // Don't yank focus out of the explanation box mid-sentence; render when you leave it.
    const typing = document.activeElement && document.activeElement.id === "expl";
    if (typing && !state.busy) {
      document.activeElement.addEventListener("blur", render, { once: true });
      return;
    }
    render();
  });

  // Tick live timers by updating only their text: a full re-render would eat clicks and close <details>.
  setInterval(() => {
    const a = state && state.attempt;
    if (!a) return;
    for (const el of document.querySelectorAll("[data-live]")) {
      const m = a.metrics.find((x) => x.key === el.dataset.live);
      if (!m) continue;
      el.textContent =
        m.key === "elapsed"
          ? fmt(Date.now() - new Date(a.startedAt).getTime())
          : fmt((m.valueMs || 0) + (Date.now() - new Date(m.runningSince).getTime()));
    }
  }, 1000);

  vscode.postMessage({ type: "ready" });
})();
