# DeepSeek Harness source bundle

This repository contains the original DeepSeek Harness source under `deepseek-harness-source/`, preserved without edits to its source files.

## Run the web application

Requirements: Node.js 24.9+.

### Linux / Ubuntu / macOS

```bash
chmod +x START-DEEPSEEK-HARNESS.sh
./START-DEEPSEEK-HARNESS.sh
```

### Windows PowerShell

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\START-DEEPSEEK-HARNESS.ps1
```

Then open `http://127.0.0.1:3080`.

The scripts run `pnpm install`, build the source, and start the original `dsh web` command. `node_modules` is intentionally not committed because native dependencies differ by operating system.

DeepSeek Harness is a developer preview. Configure provider credentials inside the application after startup. Do not commit API keys or other secrets.
