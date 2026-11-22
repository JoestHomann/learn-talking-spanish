param([string]$Python)

$ErrorActionPreference = 'Stop'
Push-Location -LiteralPath $PSScriptRoot
try {
    $venvPython = Join-Path $PSScriptRoot '.venv/Scripts/python.exe'
    if (-not (Test-Path -LiteralPath $venvPython)) {
        if ($Python) {
            & $Python -m venv .venv
        } else {
            py -3.12 -m venv .venv
        }
        if ($LASTEXITCODE -ne 0) {
            throw 'Python 3.12 (64 Bit) installieren oder mit -Python den Pfad angeben.'
        }
    }
    & $venvPython -m pip --disable-pip-version-check install -r requirements.txt
    if ($LASTEXITCODE -ne 0) { throw 'Die Installation der Sprachbibliotheken ist fehlgeschlagen.' }
    & $venvPython -B -m b1teacher.audio --prepare
    if ($LASTEXITCODE -ne 0) { throw 'Das Laden der Sprachmodelle ist fehlgeschlagen.' }
    Write-Host 'Bereit. Die App mit start.cmd öffnen.'
} finally {
    Pop-Location
}
