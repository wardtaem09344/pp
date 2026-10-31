$ErrorActionPreference = 'Stop'
$Root = Join-Path $PSScriptRoot 'deepseek-harness-source'
Set-Location $Root

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw 'Node.js 24.9+ is required. Install it from https://nodejs.org/'
}
$nodeVersion = node -p "process.versions.node"
$major = [int]($nodeVersion.Split('.')[0])
$minor = [int]($nodeVersion.Split('.')[1])
if (($major -lt 24) -or (($major -eq 24) -and ($minor -lt 9))) {
  throw "Node.js 24.9+ is required; found $nodeVersion"
}

corepack enable
corepack prepare pnpm@11.28.5 --activate
pnpm install
pnpm run build
if (-not $env:DSH_HOME) { $env:DSH_HOME = Join-Path $Root '.dsh-home' }
$Port = if ($env:PORT) { $env:PORT } else { '3080' }
pnpm dsh web --no-open --host 127.0.0.1 --port $Port
