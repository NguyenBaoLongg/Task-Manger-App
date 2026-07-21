param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]] $SpecifyArgs
)

$specify = Join-Path $PSScriptRoot 'specify-venv\Scripts\specify.exe'

if (-not (Test-Path -LiteralPath $specify)) {
    throw "Project-local Specify CLI was not found at: $specify"
}

& $specify @SpecifyArgs
exit $LASTEXITCODE
