$GraphifyArgs = @($args)
if ($GraphifyArgs.Count -gt 0 -and $GraphifyArgs[0] -eq '--') {
    if ($GraphifyArgs.Count -eq 1) {
        $GraphifyArgs = @()
    } else {
        $GraphifyArgs = $GraphifyArgs[1..($GraphifyArgs.Count - 1)]
    }
}

$graphify = Join-Path $PSScriptRoot '..\.cache\graphify-venv\Scripts\graphify.exe'

if (Test-Path -LiteralPath $graphify) {
    & $graphify @GraphifyArgs
    exit $LASTEXITCODE
}

$graphifyCommand = Get-Command graphify -ErrorAction SilentlyContinue
if ($graphifyCommand) {
    & $graphifyCommand.Source @GraphifyArgs
    exit $LASTEXITCODE
}

$setup = Join-Path $PSScriptRoot 'setup-graphify.ps1'
throw "Graphify CLI was not found. Run: & $setup"
