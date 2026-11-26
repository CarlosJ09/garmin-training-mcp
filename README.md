# Personal training log

Ask a desktop AI assistant about your running and strength sessions. This TypeScript MCP server runs locally over standard input/output and fetches your workouts from the Garmin Connect Personal API when you ask. The AI client picks the tool and explains the result; the server computes the numbers and needs no LLM key.

It runs inside WSL with Node.js 22.18 or newer. There are no packages to install and no build step. Run the commands below in a WSL shell from the project folder:

```bash
node --version   # must be v22.18 or newer
```

## Try the sample week

```bash
node ./src/server.mts --demo --preview
```

This prints a fictional training week. Only the explicit `--demo` flag enables fictional data.

## Connect your own watch

1. Sync the watch with Garmin Connect as usual.
2. Create a personal key on the [Garmin Connect key page](https://connect.garmin.com/app/settings/personalApiToken). Garmin shows it once. Keep it out of chat, screenshots and this folder.
3. Save it from a hidden prompt into your Linux home directory. This is the same file the official Garmin client reads. The script refuses to overwrite an existing key file.

   ```bash
   ./scripts/save-garmin-key.sh
   ```

   The key is stored in plain text at `~/.config/garmin/connect-personal-api-key` and is readable only by your Linux user. Alternatively, set `GARMIN_PERSONAL_API_KEY` in the server's environment. The server exchanges the key for a 24-hour access token, keeps the token in memory, and talks only to Garmin.

4. Confirm your latest synced workouts appear:

   ```bash
   node ./src/server.mts --preview
   ```

## Register with your AI client

The launch command depends on where the client runs. The key file lives in WSL, so the server must always run inside WSL.

### Codex desktop app on Windows

A Windows app can't run `node` from WSL by name. If Node comes from a version manager such as nvm, `PATH` only includes it in interactive shells. The entry therefore points `wsl.exe` at your WSL distribution and the absolute Node binary. Generate it in WSL from this folder:

```bash
./scripts/codex-config.sh                        # live entry: training-log
./scripts/codex-config.sh training-demo --demo   # optional fictional-data entry
```

Paste the output into `%USERPROFILE%\.codex\config.toml`. It has this shape:

```toml
[mcp_servers.training-log]
command = "wsl.exe"
args = ["-d", "<distribution>", "--", "<absolute path to node>", "<project folder>/src/server.mts"]
```

Restart Codex and start a new chat. If you upgrade Node or move the folder, run the script again and replace the entry. Windows environment variables don't reach the WSL process. To change the time zone, insert `"env", "TRAINING_TIME_ZONE=<IANA zone>",` after `"--"`.

### A client running inside WSL

Launch `node` with the absolute server path. For example, with Claude Code, run this from this folder. `-s user` makes the server available in every folder:

```bash
claude mcp add -s user training-log -- node "$PWD/src/server.mts"
claude mcp get training-log   # should report: Connected
```

MCP servers load when a session starts. Open a new Claude Code session after registering.

### Try it

Ask "Use training-log to show my runs and gym sessions from the last seven days." Then ask a follow-up about one of the runs it lists.

## What the tools measure

- `get_training_week` returns seven calendar dates ending today or on an explicit `end_date`. It includes recognized running and strength-training activities with Garmin activity id, local weekday, recorded distance, session duration, run pace and average heart rate. Weekday and pace are computed by the server, so the assistant doesn't derive them itself. Unrecorded metrics appear as null. The default time zone is America/Santo_Domingo. Override it with `TRAINING_TIME_ZONE`.
- `compare_runs_after_strength` takes an exact `run_title`, an optional `strength_title` substring and a lookback of 1–90 days. The default is 42 days. Use a distinctive recurring title for a route you run regularly. Title matching can't verify the GPS route. Each group includes its sample size, median pace, median average heart rate and the underlying sessions. Pace is recorded duration divided by distance.
- A gym session counts as recent if it started within the 24 hours before the run. For leg days, supply the label you actually use, such as `Piernas`. Runs after a strength session with a non-matching title go in the uncertain group, because a generic "Strength" title says nothing about the muscles trained. Exercise sets and reps aren't covered yet.
- Each question fetches the requested period after Garmin syncs. A missing key or failed request produces an error, never substitute data.

## Inspecting a strength session

To see which strength details Garmin returns for one activity, run the read-only probe. It saves the activity details, the workout and the original activity ZIP. The output is personal data, so write it outside this folder:

```bash
node ./scripts/inspect-activity.mts <activityId> ~/garmin-inspect
```

Activity ids appear in `--preview` output.

## Verification

```bash
node --test ./src/training.test.mts
```

Tests cover weekly totals, ambiguous strength labels, token exchange (bare and JSON responses), paginated retrieval against a fake Garmin service, and MCP requests over standard input/output. They don't prove your watch records every field. Compare `--preview` output with Garmin Connect for that.

Garmin documents personal access and its reference client here: [Personal API FAQ](https://developer.garmin.com/gc-developer-program/personal/personal-faq) · [Garmin reference client](https://github.com/garmin/connect-personal-api-python). The Personal API is for your own data. It isn't meant for apps serving other users.
