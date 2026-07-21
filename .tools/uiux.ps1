param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]] $UiUxArgs
)

$python = 'C:\Users\Acer\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
$searchScript = Join-Path $PSScriptRoot '..\.agents\skills\ui-ux-pro-max\scripts\search.py'

if (-not (Test-Path -LiteralPath $python)) {
    $pythonCommand = Get-Command python -ErrorAction SilentlyContinue
    if (-not $pythonCommand) {
        throw 'Python 3 is required. Install it or reload the Codex workspace runtime.'
    }
    $python = $pythonCommand.Source
}

if (-not (Test-Path -LiteralPath $searchScript)) {
    throw "UI/UX Pro Max search script was not found at: $searchScript"
}

& $python $searchScript @UiUxArgs
exit $LASTEXITCODE
