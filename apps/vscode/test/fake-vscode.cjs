/**
 * A minimal fake of the `vscode` module: just the API surface the extension uses.
 *
 * It records what the extension does (commands registered, documents opened, messages shown)
 * and lets a test script the user's answers. Behaviour that matters is modelled faithfully:
 * a NON-modal notification with buttons never resolves on its own, exactly like real VS Code
 * (that's the behaviour that hid the "stuck on Submitting…" bug).
 */
const path = require("node:path");

function createFakeVscode(config) {
  const disposable = { dispose() {} };
  const rec = {
    commands: {},
    contexts: {},
    info: [],
    errors: [],
    docs: [],
    edits: [],
    viewProvider: null,
    views: {},
    onChange: null,
    /** Queued answers for prompts, consumed in order. */
    answers: { input: [], quick: [], modal: [], warn: [] },
  };

  const vscode = {
    StatusBarAlignment: { Left: 1, Right: 2 },
    ViewColumn: { Beside: -2 },
    ConfigurationTarget: { Global: 1 },
    ThemeColor: class {},
    Uri: {
      joinPath: (u, ...p) => ({ fsPath: path.join(u.fsPath, ...p) }),
      parse: (s) => ({ toString: () => s }),
      file: (p) => ({ fsPath: p }),
    },
    Range: class {
      constructor(start, end) {
        this.start = start;
        this.end = end;
      }
    },
    WorkspaceEdit: class {
      constructor() {
        this.ops = [];
      }
      replace(uri, range, text) {
        this.ops.push({ uri, range, text });
      }
    },
    env: { openExternal: async () => true },
    commands: {
      registerCommand: (id, fn) => ((rec.commands[id] = fn), disposable),
      executeCommand: async (id, key, value) => {
        if (id === "setContext") rec.contexts[key] = value;
      },
    },
    window: {
      activeTextEditor: undefined,
      createOutputChannel: () => ({ appendLine() {}, dispose() {} }),
      createStatusBarItem: () => ({ show() {}, hide() {}, dispose() {} }),
      registerWebviewViewProvider: (id, provider) => ((rec.views[id] = provider), (id === "onePercent.today" && (rec.viewProvider = provider)), disposable),
      showInformationMessage: (message, ...rest) => {
        rec.info.push(message);
        const modal = rest[0] && typeof rest[0] === "object" && rest[0].modal;
        return modal ? Promise.resolve(rec.answers.modal.shift()) : new Promise(() => {});
      },
      showWarningMessage: async () => rec.answers.warn.shift(),
      showErrorMessage: async (message) => rec.errors.push(message),
      showInputBox: async () => rec.answers.input.shift(),
      showQuickPick: async () => rec.answers.quick.shift(),
      setStatusBarMessage: () => disposable,
      showTextDocument: async (doc) => doc,
      onDidChangeActiveTextEditor: () => disposable,
    },
    workspace: {
      textDocuments: rec.docs,
      getConfiguration: () => ({
        get: (key, fallback) => config[key] ?? fallback,
        update: async (key, value) => (config[key] = value),
      }),
      onDidChangeTextDocument: (fn) => ((rec.onChange = fn), disposable),
      onDidChangeConfiguration: () => disposable,
      asRelativePath: (uri) => uri.fsPath,
      openTextDocument: async (arg) => {
        const doc =
          typeof arg === "string"
            ? { uri: { fsPath: arg }, isDirty: false }
            : { uri: { fsPath: "untitled" }, content: arg.content, language: arg.language };
        rec.docs.push(doc);
        return doc;
      },
      applyEdit: async (edit) => (rec.edits.push(edit), true),
    },
  };

  return { vscode, rec };
}

/** Fake webview: captures every state the extension sends to the sidebar. */
function attachFakeWebview(provider) {
  const states = [];
  provider.resolveWebviewView({
    webview: {
      options: {},
      cspSource: "vscode-resource:",
      asWebviewUri: (u) => u.fsPath,
      html: "",
      onDidReceiveMessage: () => ({ dispose() {} }),
      postMessage: async (m) => {
        if (m.type === "state") states.push(m.state);
        return true;
      },
    },
  });
  return { latest: () => states[states.length - 1], states };
}

function memento() {
  const m = new Map();
  return { get: (k) => m.get(k), update: async (k, v) => void m.set(k, v), keys: () => [...m.keys()] };
}

module.exports = { createFakeVscode, attachFakeWebview, memento };
