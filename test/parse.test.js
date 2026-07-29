"use strict";

const test = require("node:test");
const assert = require("node:assert");

const {
  parseDuration,
  parseClockTime,
  formatClockTime,
  formatRemaining,
  describeKind,
  parseCommand,
} = require("../bin/remind.js");

const HOUR = 1000 * 60 * 60;
const DAY = HOUR * 24;

test("parseDuration: single units", () => {
  assert.equal(parseDuration("10s"), 10000);
  assert.equal(parseDuration("30m"), 1800000);
  assert.equal(parseDuration("2h"), 2 * HOUR);
});

test("parseDuration: fractional amounts", () => {
  assert.equal(parseDuration(".5s"), 500);
  assert.equal(parseDuration("1.5m"), 90000);
  assert.equal(parseDuration(".5h"), HOUR / 2);
});

test("parseDuration: combined units", () => {
  assert.equal(parseDuration("1h2m3s"), HOUR + 120000 + 3000);
  assert.equal(parseDuration("1h30m"), HOUR + 1800000);
});

test("parseDuration: rejects junk", () => {
  for (const input of ["", "banana", "30", "m", "30x", "1h banana", "30m ", " 30m", "1h2m3", "-5m"]) {
    assert.equal(parseDuration(input), null, `expected null for ${JSON.stringify(input)}`);
  }
});

test("parseDuration: rejects zero", () => {
  assert.equal(parseDuration("0s"), null);
  assert.equal(parseDuration("0h0m0s"), null);
});

test("parseClockTime: 12-hour input", () => {
  assert.equal(parseClockTime("5pm").label, "5:00 PM");
  assert.equal(parseClockTime("5:30pm").label, "5:30 PM");
  assert.equal(parseClockTime("9am").label, "9:00 AM");
  assert.equal(parseClockTime("9AM").label, "9:00 AM");
  assert.equal(parseClockTime("5 pm").label, "5:00 PM");
});

test("parseClockTime: midnight and noon", () => {
  assert.equal(parseClockTime("12am").label, "12:00 AM");
  assert.equal(parseClockTime("12pm").label, "12:00 PM");
  assert.equal(parseClockTime("12:30am").label, "12:30 AM");
});

test("parseClockTime: 24-hour input maps onto the same labels", () => {
  assert.equal(parseClockTime("17:30").label, "5:30 PM");
  assert.equal(parseClockTime("00:05").label, "12:05 AM");
  assert.equal(parseClockTime("13").label, "1:00 PM");
  assert.equal(parseClockTime("0").label, "12:00 AM");
});

test("parseClockTime: always resolves to the next occurrence", () => {
  for (const input of ["12am", "6am", "12pm", "6pm", "23:59"]) {
    const result = parseClockTime(input);
    assert.ok(result.ms > 0, `${input} should be in the future`);
    assert.ok(result.ms <= DAY, `${input} should be within 24h`);
  }
});

test("parseClockTime: rejects out-of-range and junk", () => {
  for (const input of ["banana", "", "25:00", "24:00", "13pm", "0pm", "0am", "5:70pm", "5:5pm", "-1", "5pmm", "5:30:00"]) {
    assert.equal(parseClockTime(input), null, `expected null for ${JSON.stringify(input)}`);
  }
});

test("formatClockTime: hour boundaries", () => {
  const at = (h, m) => {
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return formatClockTime(d);
  };
  assert.equal(at(0, 0), "12:00 AM");
  assert.equal(at(0, 5), "12:05 AM");
  assert.equal(at(11, 59), "11:59 AM");
  assert.equal(at(12, 0), "12:00 PM");
  assert.equal(at(13, 5), "1:05 PM");
  assert.equal(at(23, 59), "11:59 PM");
});

test("formatRemaining", () => {
  assert.equal(formatRemaining(0), "now");
  assert.equal(formatRemaining(-5000), "now");
  assert.equal(formatRemaining(9000), "9s");
  assert.equal(formatRemaining(65000), "1m 5s");
  assert.equal(formatRemaining(HOUR + 300000), "1h 5m");
  assert.equal(formatRemaining(2 * HOUR), "2h 0m");
});

test("describeKind", () => {
  assert.equal(describeKind({ kind: "every", label: "1h" }), "(every 1h)");
  assert.equal(describeKind({ kind: "at", label: "5:00 PM" }), "(at 5:00 PM)");
  assert.equal(describeKind({ kind: "in", label: "30m" }), "");
});

test("describeKind: falls back to durationArg for pre-1.1 records", () => {
  assert.equal(describeKind({ durationArg: "30m" }), "");
  assert.equal(describeKind({ kind: "every", durationArg: "1h" }), "(every 1h)");
});

test("parseCommand: relative duration", () => {
  const spec = parseCommand(["30m", "clock", "out"]);
  assert.equal(spec.kind, "in");
  assert.equal(spec.label, "30m");
  assert.equal(spec.ms, 1800000);
  assert.equal(spec.message, "clock out");
  assert.equal(spec.intervalMs, undefined);
});

test("parseCommand: at", () => {
  const spec = parseCommand(["at", "5pm", "standup"]);
  assert.equal(spec.kind, "at");
  assert.equal(spec.label, "5:00 PM");
  assert.equal(spec.message, "standup");
  assert.ok(spec.ms > 0 && spec.ms <= DAY);
});

test("parseCommand: at with a space before the meridiem", () => {
  const spec = parseCommand(["at", "5", "pm", "standup", "sync"]);
  assert.equal(spec.label, "5:00 PM");
  assert.equal(spec.message, "standup sync");
});

test("parseCommand: every", () => {
  const spec = parseCommand(["every", "1h", "stand", "up"]);
  assert.equal(spec.kind, "every");
  assert.equal(spec.label, "1h");
  assert.equal(spec.ms, HOUR);
  assert.equal(spec.intervalMs, HOUR);
  assert.equal(spec.message, "stand up");
});

test("parseCommand: every fires one interval out", () => {
  const spec = parseCommand(["every", "10s", "x"]);
  assert.equal(spec.ms, spec.intervalMs);
});
