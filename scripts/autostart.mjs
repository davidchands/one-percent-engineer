#!/usr/bin/env node
/**
 * Runs the 1% Engineer server automatically on macOS, using a LaunchAgent.
 *
 *   node scripts/autostart.mjs install    build the web app, start now and at every login
 *   node scripts/autostart.mjs uninstall  stop it and remove the LaunchAgent
 *   node scripts/autostart.mjs start      start it now (if installed)
 *   node scripts/autostart.mjs stop       stop it until next login (e.g. to use `pnpm dev`)
 *   node scripts/autostart.mjs restart    restart, e.g. after changing server code or content
 *   node scripts/autostart.mjs status     is it running?
 *
 * Why a LaunchAgent: it's macOS's built-in way to run a program for one user at login.
 * It runs only while you're logged in, only on 127.0.0.1, and writes logs to ~/Library/Logs.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { homedir, userInfo } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const LABEL = "dev.onepercent.engineer";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PLIST = join(homedir(), "Library/LaunchAgents", `${LABEL}.plist`);
const LOG_DIR = join(homedir(), "Library/Logs/one-percent-engineer");
const DOMAIN = `gui/${userInfo().uid}`;
const URL = "http://127.0.0.1:4100";

if (process.platform !== "darwin") {
  console.error("Auto-start uses macOS LaunchAgents, so it only works on a Mac.");
  process.exit(1);
}

const launchctl = (...args) => spawnSync("launchctl", args, { encoding: "utf8" });
const isLoaded = () => launchctl("print", `${DOMAIN}/${LABEL}`).status === 0;
const xml = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

async function waitUntilUp(ms = 20_000) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    try {
      if ((await fetch(`${URL}/api/health`)).ok) return true;
    } catch {
      /* not yet */
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
}

function portOwner() {
  const r = spawnSync("lsof", ["-nP", "-iTCP:4100", "-sTCP:LISTEN", "-t"], { encoding: "utf8" });
  return r.stdout.trim();
}

function plist() {
  // Absolute paths: LaunchAgents don't load your shell profile, so `node` may not be on PATH.
  const node = realpathSync(process.execPath);
  const tsx = join(ROOT, "apps/server/node_modules/tsx/dist/cli.mjs");
  if (!existsSync(tsx)) throw new Error("tsx not found. Run `pnpm install` first.");
  const args = [node, tsx, join(ROOT, "apps/server/src/server.ts")];
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
${args.map((a) => `    <string>${xml(a)}</string>`).join("\n")}
  </array>
  <key>WorkingDirectory</key><string>${xml(ROOT)}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>NODE_OPTIONS</key><string>--disable-warning=ExperimentalWarning</string>
    <key>PATH</key><string>${xml(dirname(node))}:/usr/bin:/bin</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><dict><key>SuccessfulExit</key><false/></dict>
  <key>ThrottleInterval</key><integer>10</integer>
  <key>StandardOutPath</key><string>${xml(join(LOG_DIR, "server.log"))}</string>
  <key>StandardErrorPath</key><string>${xml(join(LOG_DIR, "server.log"))}</string>
</dict>
</plist>
`;
}

async function start() {
  if (isLoaded()) return console.log("Already running.");
  const owner = portOwner();
  if (owner) {
    console.error(`Port 4100 is already in use (process ${owner}). If that's \`pnpm dev\`, stop it with Ctrl+C first.`);
    process.exit(1);
  }
  const r = launchctl("bootstrap", DOMAIN, PLIST);
  if (r.status !== 0) throw new Error(`launchctl bootstrap failed: ${r.stderr.trim()}`);
  console.log((await waitUntilUp()) ? `Running at ${URL}` : `Started, but not answering yet. Logs: ${join(LOG_DIR, "server.log")}`);
}

function stop() {
  if (!isLoaded()) return console.log("Not running.");
  launchctl("bootout", `${DOMAIN}/${LABEL}`);
  console.log("Stopped (starts again at next login). `pnpm autostart:start` to start it now.");
}

const command = process.argv[2];
switch (command) {
  case "install": {
    console.log("Building the web app…");
    execFileSync("pnpm", ["--filter", "@1pe/web", "build"], { cwd: ROOT, stdio: "inherit" });
    mkdirSync(dirname(PLIST), { recursive: true });
    mkdirSync(LOG_DIR, { recursive: true });
    if (isLoaded()) launchctl("bootout", `${DOMAIN}/${LABEL}`);
    writeFileSync(PLIST, plist());
    console.log(`LaunchAgent written: ${PLIST}`);
    await start();
    break;
  }
  case "uninstall":
    if (isLoaded()) launchctl("bootout", `${DOMAIN}/${LABEL}`);
    rmSync(PLIST, { force: true });
    console.log("Auto-start removed. Your data in data/ is untouched.");
    break;
  case "start":
    if (!existsSync(PLIST)) throw new Error("Not installed. Run `pnpm autostart:install`.");
    await start();
    break;
  case "stop":
    stop();
    break;
  case "restart":
    if (!isLoaded()) throw new Error("Not running. Use `pnpm autostart:start`.");
    launchctl("kickstart", "-k", `${DOMAIN}/${LABEL}`);
    console.log((await waitUntilUp()) ? `Restarted: ${URL}` : `Restarting… Logs: ${join(LOG_DIR, "server.log")}`);
    break;
  case "status": {
    const loaded = isLoaded();
    let healthy = false;
    try {
      healthy = (await fetch(`${URL}/api/health`)).ok;
    } catch {
      /* down */
    }
    console.log(`Installed: ${existsSync(PLIST) ? "yes" : "no"}\nLoaded:    ${loaded ? "yes" : "no"}\nAnswering: ${healthy ? `yes (${URL})` : "no"}\nLogs:      ${join(LOG_DIR, "server.log")}`);
    break;
  }
  default:
    console.log("Usage: node scripts/autostart.mjs install|uninstall|start|stop|restart|status");
    process.exit(command ? 1 : 0);
}
