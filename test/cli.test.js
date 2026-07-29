"use strict";

const test = require("node:test");
const assert = require("node:assert");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const CLI = path.join(__dirname, "..", "bin", "remind.js");

function run(...args) {
  const result = spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8" });
  return { code: result.status, stdout: result.stdout, stderr: result.stderr };
}

const HELP_HINT = 'To see a list of supported remind commands, run:\n  remind -h\n';

test("--help prints usage to stdout and exits 0", () => {
  const { code, stdout, stderr } = run("--help");
  assert.equal(code, 0);
  assert.equal(stderr, "");
  assert.match(stdout, /^Usage: remind <duration> <message>/);
  assert.match(stdout, /remind at <time> <message>/);
  assert.match(stdout, /remind every <interval> <message>/);
  assert.match(stdout, /remind cancel <number>/);
});

test("-h matches --help", () => {
  assert.equal(run("-h").stdout, run("--help").stdout);
});

test("--version prints name and version", () => {
  const { code, stdout } = run("--version");
  assert.equal(code, 0);
  assert.match(stdout, /^remindly \d+\.\d+\.\d+\n$/);
  assert.equal(run("-v").stdout, stdout);
});

test("no arguments exits 1 with the short usage line, not the full help", () => {
  const { code, stderr } = run();
  assert.equal(code, 1);
  assert.equal(stderr, `Usage: remind <duration> <message>\n\n${HELP_HINT}`);
  assert.ok(!stderr.includes("Duration formats:"), "should not dump full usage");
});

test("errors report the specific problem then point at -h", () => {
  const cases = [
    { args: ["banana", "x"], first: 'Invalid duration: "banana"' },
    { args: ["30m"], first: "Missing reminder message." },
    { args: ["at", "banana", "x"], first: 'Invalid time: "banana"' },
    { args: ["at", "25:00", "x"], first: 'Invalid time: "25:00"' },
    { args: ["at", "13pm", "x"], first: 'Invalid time: "13pm"' },
    { args: ["at", "5pm"], first: "Missing reminder message." },
    { args: ["every", "banana", "x"], first: 'Invalid interval: "banana"' },
    { args: ["every", "5s", "x"], first: "Repeat interval must be at least 10s." },
    { args: ["every", "1h"], first: "Missing reminder message." },
  ];

  for (const { args, first } of cases) {
    const { code, stdout, stderr } = run(...args);
    assert.equal(code, 1, `remind ${args.join(" ")} should exit 1`);
    assert.equal(stdout, "", `remind ${args.join(" ")} should print nothing to stdout`);
    assert.equal(stderr, `${first}\n\n${HELP_HINT}`);
  }
});

test("cancel without a target explains itself", () => {
  const { code, stderr } = run("cancel");
  assert.equal(code, 1);
  assert.equal(stderr, "Usage: remind cancel <number>|--all\n");
});
