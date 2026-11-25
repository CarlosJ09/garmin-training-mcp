# Personal training log

Ask a desktop AI assistant about your running and strength sessions. This TypeScript MCP server runs locally over standard input/output. It needs Node.js 22.18 or newer. There are no packages to install. Run the commands below in PowerShell from this folder.

## Try the sample week

```powershell
node ./server.mts --demo --preview
```

This prints a fictional training week. To ask follow-up questions in a Codex chat, register the demo and start a fresh chat:

```powershell
codex mcp add training-demo -- node (Resolve-Path ./server.mts).Path --demo
```

Try “Use training-demo to summarize my last seven days.” Then ask “Compare my Park 5K runs after Leg day with my runs without recent lifting. Show the number of runs in each group.”

## Connect your own watch

1. Sync the watch with Garmin Connect as usual.
2. Create a personal key on the [Garmin Connect key page](https://connect.garmin.com/app/settings/personalApiToken). Keep the key out of chat, screenshots and the source tree.
3. Save it in your own account's Garmin key file. This is the same location the official Garmin CLI reads. To create a new file from a masked PowerShell prompt, run the following once. If you already have a valid Garmin key file, skip this step.

```powershell
$keyDir = Join-Path $env:USERPROFILE '.config/garmin'
$keyFile = Join-Path $keyDir 'connect-personal-api-key'
if (Test-Path -LiteralPath $keyFile) { throw 'A key file already exists. Use the existing key or update it yourself.' }
[void][IO.Directory]::CreateDirectory($keyDir)
$secret = Read-Host 'Garmin Personal API key' -AsSecureString
try {
    $credential = [pscredential]::new('Garmin', $secret)
    [IO.File]::WriteAllText($keyFile, $credential.GetNetworkCredential().Password)
} finally {
    $secret.Dispose()
    Remove-Variable secret, credential -ErrorAction SilentlyContinue
}
```

The file stores the key as plain text in your Windows profile. Alternatively, supply the server process with the environment variable `GARMIN_PERSONAL_API_KEY`. Garmin exchanges the key for a short-lived access token. The server caches the token in memory and sends requests only to Garmin.

4. Confirm that your latest synced workouts appear, then register the live server:

```powershell
node ./server.mts --preview
codex mcp add training-log -- node (Resolve-Path ./server.mts).Path
```

5. Start a fresh Codex chat. Ask “Use training-log to show my runs and gym sessions from the last seven days.” The assistant receives the workout summaries it requests. Other desktop clients with local stdio MCP support can launch `node` with the absolute server path as its first argument.

## What the tools measure

- `get_training_week` returns seven calendar dates ending today or on an explicit `end_date`. It includes recognized running and strength-training activities, recorded distance, session duration and average heart rate. Unrecorded session metrics appear as null. The default timezone for today's date is America/Santo_Domingo. Override it with `TRAINING_TIME_ZONE`.
- `compare_runs_after_strength` takes an exact `run_title`, an optional `strength_title` substring and a lookback of 1–90 days. The default is 42 days. Use a distinctive recurring title for a route you run regularly. Title matching cannot verify the GPS route. Each group includes its sample size, median session pace, median average heart rate and the underlying sessions. Pace uses recorded duration divided by distance.
- A gym session counts as recent if it started in the 24 hours before the run. If you ask about leg days, supply the label you actually use, such as `Piernas`. Runs after a strength session with an unmatched title go in the uncertain group. The tool cannot infer muscles trained from a generic Strength title. Exercise sets and reps are outside this version.
- Each question fetches the requested period after Garmin syncs. A missing key or failed request produces an error. Only the explicit `--demo` flag enables fictional data.

## Verification

```powershell
node --test ./training.test.mts
```

Tests cover weekly totals, ambiguous strength labels, paginated activity retrieval with a fake Garmin service, and MCP client requests over standard input/output.

Garmin documents personal access and its reference client here. [Personal API FAQ](https://developer.garmin.com/gc-developer-program/personal/personal-faq) · [Garmin reference client](https://github.com/garmin/connect-personal-api-python)
