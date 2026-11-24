/**
 * The "Today" sidebar. The extension owns all state and sends it here; the webview only renders
 * it and posts back user intents. No network access from the webview itself (strict CSP).
 */
import * as vscode from "vscode";
import { randomBytes } from "node:crypto";
export type Incoming = { type: string; command?: string; explanation?: string; usedOutsideHelp?: boolean };

/** One sidebar panel: a webview that renders whatever state the extension sends it. */
export class PanelView implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;
  private last?: unknown;

  constructor(
    private extensionUri: vscode.Uri,
    private onMessage: (msg: Incoming) => void,
    private script = "panel.js",
  ) {}

  resolveWebviewView(view: vscode.WebviewView) {
    this.view = view;
    const media = vscode.Uri.joinPath(this.extensionUri, "media");
    view.webview.options = { enableScripts: true, localResourceRoots: [media] };
    const nonce = randomBytes(16).toString("base64");
    const css = view.webview.asWebviewUri(vscode.Uri.joinPath(media, "panel.css"));
    const js = view.webview.asWebviewUri(vscode.Uri.joinPath(media, this.script));
    view.webview.html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${view.webview.cspSource}; script-src 'nonce-${nonce}';" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="stylesheet" href="${css}" />
</head>
<body>
  <div id="app"></div>
  <script nonce="${nonce}" src="${js}"></script>
</body>
</html>`;
    view.webview.onDidReceiveMessage((m: Incoming) => this.onMessage(m));
    if (this.last) this.update(this.last);
  }

  update(state: unknown) {
    this.last = state;
    this.view?.webview.postMessage({ type: "state", state });
  }
}
