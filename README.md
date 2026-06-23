# remindly

A tiny, no-frills command-line tool to set a one-off reminder. The reminder
runs in the **background**, so you can close your terminal. When the time is
up, it shows a desktop notification (on macOS) and records the reminder in a
log file.

```sh
remind 30m "clock out of lunch"
```

## Install

### From npm (once published)

```sh
npm install -g remindly
```

This makes the `remind` command available everywhere.

### From GitHub (no npm account needed)

```sh
npm install -g github:samsinghh/remindly
```

### For local development

From inside the project folder:

```sh
npm link      # adds the global `remind` command
npm unlink -g remindly   # removes it again
```

## Usage

```sh
remind <duration> <message>
```

Duration formats:

| Suffix | Meaning | Example |
| ------ | ------- | ------- |
| `s`    | seconds | `10s`   |
| `m`    | minutes | `30m`   |
| `h`    | hours   | `2h`    |

## Examples

```sh
remind 30m "clock out of lunch"
remind 10s "check oven"
remind 2h  "start homework"
```

Setting one returns immediately:

```txt
Reminder set for 30m: clock out of lunch
Running in the background — you can close this terminal.
```

When the timer fires you get a desktop notification (on macOS), and the
reminder is appended to the log file at `~/.remindly.log`:

```txt
[2026-06-23T19:50:35.302Z] REMINDER (30m): clock out of lunch
```

You can watch reminders as they fire with:

```sh
tail -f ~/.remindly.log
```

## How it works

- Parses the duration with a simple regex (`/^(\d+)(s|m|h)$/`).
- Joins everything after the duration into a single message.
- Spawns a **detached** copy of itself (`detached: true`, `stdio: "ignore"`,
  then `child.unref()`) so the timer outlives the terminal, and the original
  command exits right away.
- The background process waits with `setTimeout`.
- On macOS, shows a notification via `osascript`.
- Appends the fired reminder to `~/.remindly.log` on all platforms.

## Limitations

This is intentionally minimal:

- The background process lives only as long as your **computer stays on** and
  doesn't sleep through the whole interval. There's no persistence, so a
  reboot before the timer fires loses the reminder.
- No background daemon manager, no database.
- No way to list or cancel pending reminders yet.
- Desktop notifications are macOS-only; other platforms rely on the log file.

## License

MIT
