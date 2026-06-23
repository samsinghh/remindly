# remindly

A tiny cli tool to set a one-off reminder mainly for macOS. The reminder
runs in the **background**, so you can close your terminal. When the time is
up, it shows a desktop notification (on macOS) and records the reminder in a
log file.

```sh
remind 30m "clock out of lunch"
```

## Install

```sh
npm install -g remindly
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
