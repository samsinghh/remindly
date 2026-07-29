# remindly

A tiny cli tool to set a one-off reminder mainly for macOS. The reminder
runs in the **background**, so you can close your terminal. When the time is
up, it shows a desktop notification (on macOS) and records the reminder in a
log file.

## Install

```sh
npm install -g remindly
```

## Usage

```sh
remind <duration> <message>
remind at <time> <message>
remind every <interval> <message>
remind list
remind cancel <number>
remind -v
remind --version
```

Duration formats:

| Suffix | Meaning | Example |
| ------ | ------- | ------- |
| `s`    | seconds | `10s`, `.5s` |
| `m`    | minutes | `30m`, `1.5m` |
| `h`    | hours   | `2h`, `1.5h` |

You can also combine units, like `1h2m3s`.

Or give a clock time instead - `5pm`, `5:30pm`, `9am`, `17:30`. 

## Examples

```sh
remind 30m "clock out of lunch"
remind 1h2m3s "check oven"
remind .5h "stretch"
remind 2h  "start homework"
remind at 5pm "standup"
remind at 5:30pm "leave for the gym"
remind every 1h "stand up"
```

## Repeating reminders

`remind every <interval> <message>`

```sh
$ remind every 1h "stand up"
Repeating reminder set (every 1h): stand up
```

Repeating reminders live in a background process, so they don't survive a reboot.

## Managing reminders

List what's pending, soonest first, then cancel by its number:

```sh
$ remind list
  1   in 28m 41s   clock out
  2   in 1h 5m     check oven

$ remind cancel 2
Cancelled: check oven
```

Use `remind cancel --all` to cancel everything.

## License

MIT
