#!/usr/bin/env node

"use strict";

const { execFile, spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const pkg = require("../package.json");

// Map of duration suffixes to their length in milliseconds.
const UNIT_MS = {
  s: 1000,
  m: 1000 * 60,
  h: 1000 * 60 * 60,
};

// Where fired reminders are recorded, so they aren't lost when the
// terminal is closed before the timer fires.
const LOG_FILE = path.join(os.homedir(), ".remindly.log");

// Set on the detached child so it knows to wait + fire instead of re-spawning.
const WORKER_ENV = "REMINDLY_WORKER";

// The longest a single timer hop is allowed to run before we re-check the wall
// clock. setTimeout counts only awake time, so after the machine sleeps a plain
// countdown drifts late by the whole sleep duration. Re-arming in short hops and
// comparing against an absolute deadline bounds that drift to one hop.
const MAX_SLEEP_MS = 15 * 1000;

const USAGE = `Usage: remind <duration> <message>

Duration formats:
  Ns      seconds   (e.g. 10s, .5s)
  Nm      minutes   (e.g. 30m, 1.5m)
  Nh      hours     (e.g. 2h, 1.5h)
  NhNmNs  combined  (e.g. 1h2m3s)

Examples:
  remind 30m "clock out of lunch"
  remind 1h2m3s "check oven"
  remind 2h  "start homework"

The reminder runs in the background, so you can close this terminal.
Fired reminders are also appended to ${LOG_FILE}`;

function printUsageAndExit(code) {
  // Errors go to stderr, plain help goes to stdout.
  const stream = code === 0 ? process.stdout : process.stderr;
  stream.write(USAGE + "\n");
  process.exit(code);
}

function printVersionAndExit() {
  process.stdout.write(`${pkg.name} ${pkg.version}\n`);
  process.exit(0);
}

// Parse a duration string like "30m", "1.5h", or "1h2m3s" into milliseconds.
function parseDuration(input) {
  const segment = /(\d+(?:\.\d+)?|\.\d+)(s|m|h)/g;
  let cursor = 0;
  let total = 0;
  let match;

  while ((match = segment.exec(input)) !== null) {
    if (match.index !== cursor) return null;

    const amount = parseFloat(match[1]);
    const unit = match[2];

    total += amount * UNIT_MS[unit];
    cursor = segment.lastIndex;
  }

  if (cursor !== input.length || total <= 0) return null;

  return total;
}

function showNotification(message) {
  if (process.platform !== "darwin") return;

  const safe = message.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

  const script = `display dialog "${safe}" buttons {"OK"} default button "OK" with title "remindly"`;

  execFile("osascript", ["-e", script], (err) => {
    if (err) {
      appendLog(`Could not show popup: ${err.message}`);
    }
  });
}

// Append a timestamped line to the log file. Best-effort; never throws.
function appendLog(line) {
  const stamp = new Date().toISOString();
  try {
    fs.appendFileSync(LOG_FILE, `[${stamp}] ${line}\n`);
  } catch (_) {
    // If we can't write the log, there's nothing more we can do here.
  }
}

// The detached worker: wait until the absolute target time, then deliver the
// reminder. We re-arm in short hops and compare against a wall-clock deadline
// (Date.now() tracks real time, so it advances across system sleep) so sleeping
// the machine can't push the reminder late. stdout/stderr are ignored once
// detached, so the log file and notification are the output.
function runWorker(durationArg, message, ms) {
  const target = Date.now() + ms;

  function tick() {
    const remaining = target - Date.now();
    if (remaining <= 0) {
      appendLog(`REMINDER (${durationArg}): ${message}`);
      showNotification(message);
      process.exit(0);
      return;
    }
    setTimeout(tick, Math.min(remaining, MAX_SLEEP_MS));
  }

  tick();
}

// The foreground process: validate, then spawn a detached copy of itself
// that outlives this terminal, and exit right away.
function spawnBackground(args) {
  const child = spawn(process.execPath, [__filename, ...args], {
    detached: true,
    stdio: "ignore",
    env: Object.assign({}, process.env, { [WORKER_ENV]: "1" }),
  });

  // Let the parent exit without waiting on the child.
  child.unref();
}

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === "-h" || args[0] === "--help") {
    printUsageAndExit(args.length === 0 ? 1 : 0);
  }

  if (args[0] === "-v" || args[0] === "--version") {
    printVersionAndExit();
  }

  const durationArg = args[0];
  const message = args.slice(1).join(" ").trim();

  const ms = parseDuration(durationArg);
  if (ms === null) {
    process.stderr.write(`Invalid duration: "${durationArg}"\n\n`);
    printUsageAndExit(1);
  }

  if (!message) {
    process.stderr.write("Missing reminder message.\n\n");
    printUsageAndExit(1);
  }

  // If we're the detached child, do the actual waiting.
  if (process.env[WORKER_ENV] === "1") {
    runWorker(durationArg, message, ms);
    return;
  }

  // Otherwise we're the foreground command: hand off to the background and exit.
  spawnBackground(args);
  console.log(`Reminder set for ${durationArg}: ${message}`);
  console.log("Running in the background — you can close this terminal.");
}

main();
