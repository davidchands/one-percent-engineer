// Renders the Build panel state sent by the extension. Posts user intents back. No network, no storage.
(function () {
  const vscode = acquireVsCodeApi();
  const app = document.getElementById("app");
  let state = null;

  const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const cmd = (command) => vscode.postMessage({ type: "command", command });
  const list = (items) => `<ul>${items.map((i) => `<li>${esc(i).replace(/`([^`]+)`/g, "<code>$1</code>")}</li>`).join("")}</ul>`;

  const STARTUP = {
    no_start_script: "Your package.json needs a \"start\" script, for example \"node server.js\".",
    exited: "Your app stopped right after it started. Its own output below usually says why.",
    timeout: "Your app didn't start listening on the PORT it was given within 10 seconds.",
  };

  function render() {
    if (!state) return (app.innerHTML = `<p class="muted">Loading…</p>`);
    if (state.status === "offline") {
      return (app.innerHTML = `<h1>Server not running</h1><p class="muted">Start 1% Engineer from its folder:</p><pre>pnpm dev</pre>
        <button class="primary" data-cmd="onePercent.build.refresh">Retry</button>`);
    }
    if (state.status === "error") {
      return (app.innerHTML = `<div class="notice error">${esc(state.error)}</div><button data-cmd="onePercent.build.refresh">Retry</button>`);
    }
    const p = state.project;
    if (!p) {
      return (app.innerHTML = `<h1>Build a real app</h1>
        <p class="muted">Pick a project and start it in the web app. Then this panel shows your current step and runs the checks on your code.</p>
        <button class="primary" data-cmd="onePercent.build.openInBrowser">Open the Build tab</button>`);
    }
    const busy = state.busy;
    let html = `<div class="tags"><span class="tag accent">${esc(p.title)}</span>
      <span class="tag">${p.progress.stepsPassed}/${p.progress.steps} steps</span></div>`;
    if (busy) html += `<p class="busy">${esc(busy)}</p>`;
    if (state.notice) html += `<div class="notice error small">${esc(state.notice)}</div>`;

    if (state.done) {
      html += `<h1>Roadmap complete</h1><p class="muted">Every step and decision is done. Nice work.</p>`;
    } else if (state.next && state.next.kind === "decision") {
      html += `<h1>Next: a decision</h1><p>${esc(state.nextTitle || state.next.id)}</p>
        <p class="muted small">You choose between options and say why. That happens in the web app, where there's room to compare.</p>
        <button class="primary" data-cmd="onePercent.build.openInBrowser">Decide in the browser</button>`;
    } else if (state.step) {
      const s = state.step, a = state.attempt;
      html += `<h1>${esc(s.title)}</h1><p class="muted">${esc(s.objective)}</p>`;
      if (s.status === "blocked") {
        html += `<div class="notice small">Needs a decision first: ${s.blockedBy.map((b) => esc(b.title)).join(", ")}.</div>
          <button class="primary" data-cmd="onePercent.build.openInBrowser">Open in the browser</button>`;
      } else {
        html += `<h2>Your task</h2><p>${esc(s.task.trim()).replace(/`([^`]+)`/g, "<code>$1</code>")}</p>`;
        html += `<h2>It must</h2>${list(s.requirements)}`;
        html += `<div class="row" style="margin-top:10px">`;
        if (!a) html += `<button class="primary" data-cmd="onePercent.build.start" ${busy ? "disabled" : ""}>Start this step</button>`;
        else html += `<button class="primary" data-cmd="onePercent.build.run" ${busy ? "disabled" : ""}>Run checks</button>
          <button data-cmd="onePercent.build.hint" ${busy || a.hintCount >= s.hintCount ? "disabled" : ""}>Hint (${a.hintCount}/${s.hintCount})</button>`;
        html += `<button data-cmd="onePercent.build.openFolder">Open project folder</button></div>`;
        if (a) html += `<p class="small muted">Checks start your app from your project folder (<code>npm start</code>), so save your files first. Submitting and explaining is done in the browser.</p>`;

        const r = state.lastCheck;
        if (r) {
          html += `<h2>Checks · ${r.passed} passed · ${r.failed} failed${r.timedOut ? " · timed out" : ""}</h2>`;
          if (STARTUP[r.startup]) html += `<div class="notice small">${esc(STARTUP[r.startup])}</div>`;
          html += r.cases.map((c) => `<div class="case"><span class="icon ${c.passed ? "pass" : "fail"}">${c.passed ? "✓" : "✗"}</span>
            <span class="${c.passed ? "muted" : ""}">${esc(c.name)}</span></div>${c.message ? `<pre class="small">${esc(c.message)}</pre>` : ""}`).join("");
          if (r.appOutput && (r.failed > 0 || r.startup !== "ok")) html += `<details><summary>What your app printed</summary><pre class="small">${esc(r.appOutput)}</pre></details>`;
          if (r.failed === 0 && r.passed > 0) html += `<div class="notice small">All checks pass. Open the step in the browser to explain it and submit.</div>
            <button class="primary" data-cmd="onePercent.build.openInBrowser">Submit in the browser</button>`;
        }
        if (a && a.hints.length) {
          html += `<h2>Hints</h2>` + a.hints.map((h, i) => `<div class="hint small"><b>#${i + 1}</b> ${esc(h)}</div>`).join("");
        }
      }
    }
    html += `<h2>More</h2><div class="row small"><button class="link" data-cmd="onePercent.build.openInBrowser">Open in browser</button></div>`;

    const open = new Set([...app.querySelectorAll("details[open] > summary")].map((x) => x.textContent));
    app.innerHTML = html;
    for (const x of app.querySelectorAll("details > summary")) if (open.has(x.textContent)) x.parentElement.open = true;
  }

  app.addEventListener("click", (e) => {
    const el = e.target.closest("[data-cmd]");
    if (el && !el.disabled) cmd(el.dataset.cmd);
  });
  window.addEventListener("message", (e) => {
    if (e.data.type !== "state") return;
    state = e.data.state;
    render();
  });
  vscode.postMessage({ type: "ready" });
})();
