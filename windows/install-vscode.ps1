<#
.SYNOPSIS
    Installs the 22 KP colour themes in VS Code, as one extension.

.DESCRIPTION
    Separate from apply.ps1 on purpose: a theme switch leaves VS Code alone, and
    which theme VS Code shows stays yours (Sundial, or Ctrl+K Ctrl+T). Run this
    once, and again when the themes change; it does nothing when they have not.
    Builds a .vsix from the repo's vscode\*.json and installs it with VS Code's own CLI.
    The only setting it touches: the integrated terminal gets a Nerd Font for the
    Oh My Posh glyphs, and only when no terminal font is set yet.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File .\desktop\windows\install-vscode.ps1
#>
[CmdletBinding()]
param(
    [switch]$Force,
    [switch]$Pause,
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$Root = $PSScriptRoot
$Stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)

function Say([string]$step, [string]$text, [string]$colour = 'Gray') {
    Write-Host ('  {0,-11}' -f $step) -ForegroundColor Magenta -NoNewline
    Write-Host $text -ForegroundColor $colour
}

function Backup([string]$path) {
    if ((Test-Path $path) -and -not $DryRun) { Copy-Item $path "$path.kp-backup-$Stamp" -Force }
}

function Write-Text([string]$path, [string]$text) {
    if (-not $DryRun) { [System.IO.File]::WriteAllText($path, $text, $Utf8NoBom) }
}

# PowerShell 5 turns a native program's stderr into an error; read the exit code instead.
function Invoke-Native([string]$exe, [string[]]$arguments) {
    $old = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try { $output = & $exe @arguments 2>&1 | ForEach-Object { "$_" } }
    finally { $ErrorActionPreference = $old }
    return [pscustomobject]@{ Code = $LASTEXITCODE; Output = @($output) }
}

function Test-Font([string]$face) {
    foreach ($hive in 'HKLM:', 'HKCU:') {
        $key = "$hive\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Fonts"
        if ((Test-Path $key) -and ((Get-Item $key).GetValueNames() | Where-Object { $_ -like "$face*" })) { return $true }
    }
    return $false
}

Write-Host ''
Write-Host '  kp-themes: VS Code' -ForegroundColor Cyan
Write-Host ''

# ..\vscode in the installed kit, ..\..\vscode in the repo (desktop\windows\).
$vsSource = @((Join-Path (Split-Path $Root -Parent) 'vscode'), (Join-Path (Split-Path (Split-Path $Root -Parent) -Parent) 'vscode')) |
    Where-Object { Test-Path (Join-Path $_ 'kp-*-color-theme.json') } | Select-Object -First 1
$cli = @(
    (Get-Command 'code.cmd' -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty Source),
    (Join-Path $env:LOCALAPPDATA 'Programs\Microsoft VS Code\bin\code.cmd'),
    (Join-Path $env:ProgramFiles 'Microsoft VS Code\bin\code.cmd')
) | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1

if (-not $cli) { Say 'vscode' 'VS Code not found, skipped' 'DarkGray' }
elseif (-not $vsSource) { Say 'vscode' 'no vscode\kp-*-color-theme.json found (kit or repo), skipped' 'DarkGray' }
else {
    $files = @(Get-ChildItem $vsSource -Filter 'kp-*-color-theme.json' | Sort-Object Name)
    $sha = [Security.Cryptography.SHA256]::Create()
    $bytes = New-Object System.Collections.Generic.List[byte]
    foreach ($f in $files) { $bytes.AddRange([IO.File]::ReadAllBytes($f.FullName)) }
    $hash = -join ($sha.ComputeHash($bytes.ToArray())[0..7] | ForEach-Object { $_.ToString('x2') })
    $marker = Join-Path $Root '.vscode-installed'
    $installed = if (Test-Path $marker) { (Get-Content $marker -Raw).Trim() } else { '' }

    # The copy an older apply.ps1 put straight into the extensions folder.
    $legacy = Join-Path $HOME '.vscode\extensions\kp-soft.kp-themes-local-0.0.0'
    if ((Test-Path $legacy) -and -not $DryRun) { Remove-Item $legacy -Recurse -Force -ErrorAction SilentlyContinue }

    if ($installed -eq $hash -and -not $Force) {
        Say 'vscode' "$($files.Count) KP themes already installed"
    } elseif ($DryRun) {
        Say 'vscode' "would install $($files.Count) KP themes"
    } else {
        $contributes = foreach ($f in $files) {
            $json = Get-Content $f.FullName -Raw -Encoding UTF8 | ConvertFrom-Json
            [pscustomobject]@{
                label   = $json.name
                uiTheme = $(if ($json.type -eq 'light') { 'vs' } else { 'vs-dark' })
                path    = "./themes/$($f.Name)"
            }
        }
        $manifest = [pscustomobject]@{
            name        = 'kp-themes-local'
            displayName = 'KP Themes (local)'
            description = 'The kp-themes colour themes, installed by kp-themes install-vscode.ps1.'
            publisher   = 'kp-soft'
            version     = '1.0.0'
            engines     = [pscustomobject]@{ vscode = '^1.70.0' }
            categories  = @('Themes')
            contributes = [pscustomobject]@{ themes = @($contributes) }
        }
        $vsixManifest = @'
<?xml version="1.0" encoding="utf-8"?>
<PackageManifest Version="2.0.0" xmlns="http://schemas.microsoft.com/developer/vsx-schema/2011" xmlns:d="http://schemas.microsoft.com/developer/vsx-schema-design/2011">
  <Metadata>
<Identity Language="en-US" Id="kp-themes-local" Version="1.0.0" Publisher="kp-soft" />
<DisplayName>KP Themes (local)</DisplayName>
<Description xml:space="preserve">The kp-themes colour themes, installed by kp-themes install-vscode.ps1.</Description>
<Categories>Themes</Categories>
<Properties>
  <Property Id="Microsoft.VisualStudio.Code.Engine" Value="^1.70.0" />
</Properties>
  </Metadata>
  <Installation>
<InstallationTarget Id="Microsoft.VisualStudio.Code" />
  </Installation>
  <Dependencies />
  <Assets>
<Asset Type="Microsoft.VisualStudio.Code.Manifest" Path="extension/package.json" Addressable="true" />
  </Assets>
</PackageManifest>
'@
        $contentTypes = '<?xml version="1.0" encoding="utf-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension=".json" ContentType="application/json" /><Default Extension=".vsixmanifest" ContentType="text/xml" /></Types>'

        # Entries are named by hand: a .vsix needs forward slashes, which
        # ZipFile.CreateFromDirectory does not promise on .NET Framework.
        Add-Type -AssemblyName System.IO.Compression
        $vsix = Join-Path $env:TEMP 'kp-themes-local.vsix'
        if (Test-Path $vsix) { Remove-Item $vsix -Force }
        $stream = [IO.File]::Open($vsix, [IO.FileMode]::CreateNew)
        $zip = New-Object IO.Compression.ZipArchive($stream, [IO.Compression.ZipArchiveMode]::Create)
        try {
            $entries = [ordered]@{
                '[Content_Types].xml'    = $contentTypes
                'extension.vsixmanifest' = $vsixManifest
                'extension/package.json' = ($manifest | ConvertTo-Json -Depth 8)
            }
            foreach ($f in $files) { $entries["extension/themes/$($f.Name)"] = [IO.File]::ReadAllText($f.FullName) }
            foreach ($name in $entries.Keys) {
                $writer = New-Object IO.StreamWriter(($zip.CreateEntry($name)).Open(), $Utf8NoBom)
                try { $writer.Write($entries[$name]) } finally { $writer.Dispose() }
            }
        } finally { $zip.Dispose(); $stream.Dispose() }

        $r = Invoke-Native $cli @('--install-extension', $vsix, '--force')
        if ($r.Code -eq 0) {
            Set-Content -Path $marker -Value $hash -Encoding ASCII
            Say 'vscode' "$($files.Count) KP themes installed; pick one with Ctrl+K Ctrl+T or in Sundial"
        } else {
            Say 'vscode' "install failed: $(($r.Output | Select-Object -Last 2) -join ' ')" 'Yellow'
        }
        Remove-Item $vsix -Force -ErrorAction SilentlyContinue
    }

    # One setting, once: the integrated terminal needs a Nerd Font for the Oh My Posh
    # glyphs. The editor font and the active theme are left alone.
    $vsSettings = Join-Path $env:APPDATA 'Code\User\settings.json'
    if ((Test-Path $vsSettings) -and (Test-Font 'JetBrainsMono')) {
        $text = Get-Content $vsSettings -Raw -Encoding UTF8
        if ($text -notmatch '"terminal\.integrated\.fontFamily"') {
            $line = '"terminal.integrated.fontFamily": "''JetBrainsMono Nerd Font Mono'', ''JetBrainsMono Nerd Font'', monospace"'
            $brace = $text.IndexOf('{')
            $empty = $text.Substring($brace + 1).Trim().StartsWith('}')
            $insert = "`n  $line" + $(if ($empty) { "`n" } else { ',' })
            Backup $vsSettings | Out-Null
            Write-Text $vsSettings ($text.Insert($brace + 1, $insert))
            Say 'vscode' 'terminal font set to JetBrainsMono Nerd Font (editor font unchanged)'
        }
    }
}

Write-Host ''
if ($Pause) { Read-Host '  Press Enter to close' | Out-Null }
