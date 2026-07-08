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

## Examples

```sh
remind 30m "clock out of lunch"
remind 1h2m3s "check oven"
remind .5h "stretch"
remind 2h  "start homework"
```

## License

MIT
