#!/usr/bin/env node

"use strict";

const { execFile, execFileSync, spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const pkg = require("../package.json");

const UNIT_MS = {
  s: 1000,
  m: 1000 * 60,
  h: 1000 * 60 * 60,
};

const LOG_FILE = path.join(os.homedir(), ".remindly.log");

const STATE_DIR = path.join(os.homedir(), ".remindly", "pending");

const WORKER_ENV = "REMINDLY_WORKER";

const MAX_SLEEP_MS = 15 * 1000;

const USAGE = `Usage: remind <duration> <message>

Commands:
  remind list             list pending reminders, soonest first
  remind cancel <number>  cancel the reminder with that number
  remind cancel --all     cancel every pending reminder

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
  const stream = code === 0 ? process.stdout : process.stderr;
  stream.write(USAGE + "\n");
  process.exit(code);
}

function printVersionAndExit() {
  process.stdout.write(`${pkg.name} ${pkg.version}\n`);
  process.exit(0);
}

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

function appendLog(line) {
  const stamp = new Date().toISOString();
  try {
    fs.appendFileSync(LOG_FILE, `[${stamp}] ${line}\n`);
  } catch (_) {
  }
}

function stateFile(pid) {
  return path.join(STATE_DIR, `${pid}.json`);
}

function writeState(record) {
  try {
    fs.mkdirSync(STATE_DIR, { recursive: true });
    fs.writeFileSync(stateFile(record.pid), JSON.stringify(record));
  } catch (_) {
  }
}

function removeState(pid) {
  try {
    fs.unlinkSync(stateFile(pid));
  } catch (_) {
  }
}

function livePids(pids) {
  const live = new Set();
  if (pids.length === 0) return live;

  let out;
  try {
    out = execFileSync("ps", ["-o", "pid=,command=", "-p", pids.join(",")], {
      encoding: "utf8",
    });
  } catch (_) {
    return live;
  }

  for (const line of out.split("\n")) {
    const match = line.match(/^\s*(\d+)\s+(.*)$/);
    if (match && match[2].includes("remind.js")) {
      live.add(Number(match[1]));
    }
  }

  return live;
}

function listPending() {
  let names;
  try {
    names = fs.readdirSync(STATE_DIR);
  } catch (_) {
    return [];
  }

  const records = [];
  for (const name of names) {
    if (!name.endsWith(".json")) continue;
    try {
      const record = JSON.parse(fs.readFileSync(path.join(STATE_DIR, name), "utf8"));
      if (typeof record.pid === "number" && typeof record.target === "number") {
        records.push(record);
        continue;
      }
    } catch (_) {
    }
    try {
      fs.unlinkSync(path.join(STATE_DIR, name));
    } catch (_) {
    }
  }

  const live = livePids(records.map((record) => record.pid));

  const pending = [];
  for (const record of records) {
    if (live.has(record.pid)) {
      pending.push(record);
    } else {
      removeState(record.pid);
    }
  }

  return pending.sort((a, b) => a.target - b.target);
}

function formatRemaining(ms) {
  if (ms <= 0) return "now";

  const totalSeconds = Math.round(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function runList() {
  const pending = listPending();

  if (pending.length === 0) {
    console.log("No pending reminders.");
    return;
  }

  const now = Date.now();
  const rows = pending.map((record, index) => ({
    number: `${index + 1}`,
    when: `in ${formatRemaining(record.target - now)}`,
    message: record.message,
  }));

  const numberWidth = Math.max(...rows.map((row) => row.number.length));
  const whenWidth = Math.max(...rows.map((row) => row.when.length));

  for (const row of rows) {
    console.log(
      `  ${row.number.padStart(numberWidth)}   ${row.when.padEnd(whenWidth)}   ${row.message}`
    );
  }
}

function cancelRecord(record) {
  try {
    process.kill(record.pid, "SIGTERM");
  } catch (_) {
  }
  removeState(record.pid);
}

function runCancel(args) {
  const target = args[0];

  if (!target) {
    process.stderr.write("Usage: remind cancel <number>|--all\n");
    process.exit(1);
  }

  const pending = listPending();
  if (pending.length === 0) {
    process.stderr.write("No pending reminders.\n");
    process.exit(1);
  }

  if (target === "--all" || target === "all") {
    for (const record of pending) {
      cancelRecord(record);
    }
    console.log(`Cancelled ${pending.length} reminder(s).`);
    return;
  }

  const number = Number(target);
  if (!Number.isInteger(number) || number < 1 || number > pending.length) {
    process.stderr.write(`No reminder #${target}. Run "remind list" to see them.\n`);
    process.exit(1);
  }

  const record = pending[number - 1];
  cancelRecord(record);
  console.log(`Cancelled: ${record.message}`);
}

function runWorker(durationArg, message, ms) {
  const target = Date.now() + ms;

  writeState({
    pid: process.pid,
    durationArg,
    message,
    target,
    createdAt: Date.now(),
  });

  for (const signal of ["SIGTERM", "SIGINT"]) {
    process.on(signal, () => {
      removeState(process.pid);
      process.exit(0);
    });
  }

  function tick() {
    const remaining = target - Date.now();
    if (remaining <= 0) {
      removeState(process.pid);
      appendLog(`REMINDER (${durationArg}): ${message}`);
      showNotification(message);
      process.exit(0);
      return;
    }
    setTimeout(tick, Math.min(remaining, MAX_SLEEP_MS));
  }

  tick();
}

function spawnBackground(args) {
  const child = spawn(process.execPath, [__filename, ...args], {
    detached: true,
    stdio: "ignore",
    env: Object.assign({}, process.env, { [WORKER_ENV]: "1" }),
  });

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

  if (args[0] === "list" || args[0] === "ls") {
    runList();
    return;
  }

  if (args[0] === "cancel" || args[0] === "rm") {
    runCancel(args.slice(1));
    return;
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

  if (process.env[WORKER_ENV] === "1") {
    runWorker(durationArg, message, ms);
    return;
  }

  spawnBackground(args);
  console.log(`Reminder set for ${durationArg}: ${message}`);
  console.log("Running in the background — you can close this terminal.");
}

main();
