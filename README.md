# Personal training log

Ask your AI assistant about your running and strength sessions. This local [MCP](https://modelcontextprotocol.io) server fetches your workouts from the Garmin Connect Personal API when you ask. The assistant picks the tool and explains the result, and the server computes the numbers, so no LLM API key is needed.

Sync your watch as usual, then ask "How was my training week?". There's nothing to log by hand.

## How it works

The server is a short-lived local process, not a service you keep running. Your chat app starts it when it opens and talks to it over standard input/output, and the process exits when the app closes. Each question fetches the requested dates from Garmin at that moment. The Garmin access token lives only in memory.

```
Claude Desktop ──stdio──▶ src/stdio.ts ──▶ queries ──▶ training/ (pure analytics)
                                              └──────▶ garmin/   (Personal API client)
```

## Setup

Requirements: WSL with Node.js 22.18 or newer and pnpm. Node runs the TypeScript sources directly, so there's no build step.

```bash
pnpm install
pnpm preview:demo   # print a fictional training week
```

### Connect your Garmin account

1. Sync the watch with Garmin Connect as usual.
2. Create a personal key on the [Garmin Connect key page](https://connect.garmin.com/app/settings/personalApiToken). Garmin shows it only once. Keep it out of chat, screenshots and this folder.
3. Save it from a hidden prompt. The script refuses to overwrite an existing key file.

   ```bash
   ./scripts/save-garmin-key.sh
   ```

   The key is stored at `~/.config/garmin/connect-personal-api-key` (mode 600), the same file Garmin's own client reads. Alternatively, set `GARMIN_PERSONAL_API_KEY` in the server's environment.

4. Check that your latest workouts appear:

   ```bash
   pnpm preview
   ```

## Register with your AI client

The server always runs inside WSL, where the key file lives. Windows apps can't find an nvm-managed `node` by name, so `scripts/client-config.sh` prints an entry with this machine's absolute paths. Run it again after upgrading Node or moving the folder.

### Claude Desktop (Windows)

```bash
./scripts/client-config.sh claude-desktop
```

In Claude Desktop, open **Settings → Developer → Edit Config** and merge the output into the `"mcpServers"` object. Then quit Claude Desktop from the system tray, because closing the window leaves it running, and reopen it.

### Codex (Windows)

```bash
./scripts/client-config.sh codex
```

Paste the output into `%USERPROFILE%\.codex\config.toml` and restart Codex.

### Claude Code (inside WSL)

```bash
claude mcp add -s user training-log -- node "$PWD/src/stdio.ts"
```

For fictional data in any client, register a second entry with `--demo`, for example `./scripts/client-config.sh claude-desktop training-demo --demo`.

## Tools

- **`get_training_week`**: the seven calendar days ending today or on `end_date`. Returns the number of runs and strength sessions, recorded running kilometres and training minutes. Each session comes with its Garmin activity id, weekday, start time, duration, distance, pace and average heart rate. The server computes weekday and pace so the assistant never has to. Unrecorded metrics are null.
- **`compare_runs_after_strength`**: runs sharing an exact `run_title` over a lookback of 1–90 days (default 42). Runs are grouped by whether a strength session started in the previous 24 hours. Pass `strength_title` (for example `Piernas`) to count only matching gym sessions. A recent session with a non-matching title, such as a generic "Strength", puts the run in an *uncertain* group rather than the rested baseline. Each group reports its size, median pace and median heart rate, and every run used is listed.

Title matching doesn't verify route, distance or conditions. The server tells the assistant to describe differences as observations and to state sample sizes.

"Today" uses America/Santo_Domingo by default. Override it with `TRAINING_TIME_ZONE`. A missing key or failed Garmin request produces an error, never substitute data. Only `--demo` enables fictional data.

## Development

```bash
pnpm check        # type-check (tsc) and run all tests
pnpm test         # tests only
pnpm start        # run the stdio server (what MCP clients launch)
```

| Path | Responsibility |
|---|---|
| `src/stdio.ts`, `src/preview.ts` | Entry points: the MCP server over stdio, and a terminal preview |
| `src/server.ts` | MCP tool definitions and input schemas, independent of transport |
| `src/queries.ts` | Use cases: load activities for a date range and run an analysis |
| `src/context.ts` | Wiring: chooses Garmin or demo data from the config |
| `src/config.ts` | Command-line flags and environment |
| `src/garmin/` | Personal API client: token exchange, errors, activity search |
| `src/training/` | Pure analytics: date handling, session normalization, weekly summary, run comparison |
| `src/demo/` | Deterministic fictional history for `--demo` and tests |
| `test/` | One test file per module. `server.test.ts` drives the tools through a real MCP client |

Analytics code never touches the network, and the Garmin client never knows about training concepts. Tests replace the network with a fake `fetch` and the data source with fixtures. Dependencies are pinned, and `pnpm-workspace.yaml` refuses package versions published less than 14 days ago.

### Inspecting a strength session

To see which strength details Garmin returns for an activity, run the read-only probe. It saves the activity details, the linked workout and the original FIT file as a ZIP. The output is personal data, so write it outside this folder:

```bash
node scripts/inspect-activity.ts <activityId> ~/garmin-inspect
```

Activity ids appear in `pnpm preview` output.

## References

[Personal API FAQ](https://developer.garmin.com/gc-developer-program/personal/personal-faq) · [Garmin reference client](https://github.com/garmin/connect-personal-api-python) · [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk). The Personal API is for your own data. It isn't meant for apps serving other users.
