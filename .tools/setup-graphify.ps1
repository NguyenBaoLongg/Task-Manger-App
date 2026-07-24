param(
    [string] $Python
)

$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$venv = Join-Path $repoRoot '.cache\graphify-venv'
$venvPython = Join-Path $venv 'Scripts\python.exe'

if (-not $Python) {
    $pythonCommand = Get-Command python -ErrorAction SilentlyContinue
    if ($pythonCommand) {
        $Python = $pythonCommand.Source
    }
}

if (-not $Python) {
    $pyCommand = Get-Command py -ErrorAction SilentlyContinue
    if ($pyCommand) {
        & $pyCommand.Source -3 -m venv $venv
    }
}

if (-not (Test-Path -LiteralPath $venvPython)) {
    if (-not $Python) {
        throw 'Python 3.10+ is required to create the Graphify environment.'
    }

    & $Python -m venv $venv
}

& $venvPython -m pip install --upgrade 'graphifyy[sql]'
& (Join-Path $venv 'Scripts\graphify.exe') --help
