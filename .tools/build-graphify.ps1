$ErrorActionPreference = 'Stop'

$graphify = Join-Path $PSScriptRoot 'graphify.ps1'

& $graphify extract . --code-only --force
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}

& $graphify cluster-only . --no-label
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}

& $graphify tree --label Adsup
exit $LASTEXITCODE
