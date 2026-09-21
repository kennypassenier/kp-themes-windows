<#
.SYNOPSIS
    Installs the kp-themes kit on this Windows PC, from the repo.

.DESCRIPTION
    The kit is what the double-click files run: ~\.config\kp-themes\ with
      Themes\    one .cmd per theme: the whole desktop in that theme
      Tools\     the one-off jobs (VS Code themes, the right-click menu, WSL, updating)
      windows\   the scripts and this platform's files per theme
      shared\    what Linux uses too: FireDragon, Starship, fish, wallpapers, fonts
      linux\wsl\ the scripts that set up Arch in WSL
      vscode\    the VS Code themes, for install-vscode.ps1

    It is a copy, so a theme switch never depends on where the repo is or what
    branch it is on. This script refreshes it:
      -FromWsl   builds desktop/ in the clone in WSL (~/Projects/kp-themes; fonts
                 and wallpapers are not in git) and copies it from there
      -Source    copies from that desktop\ folder, already built
      (neither)  copies from the desktop\ folder this script is in

    Once, when it is not set yet: the Windows 10 right-click menu (-ContextMenu).
    Last, it applies -Theme, or the theme applied last.

.EXAMPLE
    .\install.ps1 -FromWsl                         what Tools\Update from repo.cmd runs
.EXAMPLE
    .\desktop\windows\install.ps1 -Theme lapis     from a clone on this disk
#>
[CmdletBinding()]
param(
    [switch]$FromWsl,
    [string]$Source = '',
    [string]$Distro = 'archlinux',
    [string]$Theme = '',
    # Classic: the full menu at once, as in Windows 10. Keep: leave it as it is.
    [ValidateSet('Classic', 'Keep')]
    [string]$ContextMenu = 'Classic',
    [switch]$NoApply,
    [switch]$Pause
)

$ErrorActionPreference = 'Stop'
$Kit = Join-Path $HOME '.config\kp-themes'

# An error ends the script, but not before the window has shown it.
trap {
    Write-Host ''
    Write-Host "  Install stopped: $($_.Exception.Message)" -ForegroundColor Red
    if ($Pause) { Write-Host '  Press a key to close.' -ForegroundColor DarkGray; [void][Console]::ReadKey($true) }
    break
}

function Say([string]$step, [string]$text, [string]$colour = 'Gray') {
    Write-Host ('  {0,-11}' -f $step) -ForegroundColor Magenta -NoNewline
    Write-Host $text -ForegroundColor $colour
}

function Finish { if ($Pause) { Write-Host '  Press a key to close.' -ForegroundColor DarkGray; [void][Console]::ReadKey($true) } }

# robocopy /MIR: the destination becomes an exact copy, so files a newer layout
# dropped disappear too. Exit codes below 8 are success.
function Mirror([string]$from, [string]$to, [string[]]$extra = @()) {
    if (-not (Test-Path $from)) { throw "missing: $from" }
    $roboArgs = @($from, $to, '/MIR', '/NFL', '/NDL', '/NJH', '/NJS', '/NP', '/R:1', '/W:1') + $extra
    & robocopy.exe @roboArgs | Out-Null
    if ($LASTEXITCODE -ge 8) { throw "robocopy $from -> $to failed ($LASTEXITCODE)" }
}

Write-Host ''
Write-Host '  kp-themes: install the kit' -ForegroundColor Cyan
Write-Host ''

# --- Where from ------------------------------------------------------------------
if ($FromWsl) {
    $old = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        # wsl.exe hands back text with carriage returns; the home is /home/<user>.
        $linuxHome = ((& wsl.exe -d $Distro -e sh -c 'echo $HOME') -join '').Trim()
        if ($LASTEXITCODE -ne 0 -or -not $linuxHome) { throw "WSL distro '$Distro' is not there; run Tools\Setup WSL (Arch).cmd first." }
        Say 'build' "fonts and wallpapers in ${Distro}:~/Projects/kp-themes (a minute)"
        & wsl.exe -d $Distro -e bash -c 'cd ~/Projects/kp-themes && bash desktop/linux/install.sh --build-only'
        if ($LASTEXITCODE -ne 0) { throw "the build in WSL failed (exit $LASTEXITCODE); scroll up for the error." }
    } finally { $ErrorActionPreference = $old }
    $Source = "\\wsl.localhost\$Distro" + ($linuxHome -replace '/', '\') + '\Projects\kp-themes\desktop'
} elseif (-not $Source) {
    $Source = Split-Path $PSScriptRoot -Parent
}
$Source = $Source.TrimEnd('\')
if (-not (Test-Path (Join-Path $Source 'windows\launchers'))) {
    throw "$Source is not a built desktop\ folder of kp-themes (no windows\launchers). Use -FromWsl, or -Source <repo>\desktop."
}
if ((Resolve-Path $Source).Path -eq (Resolve-Path $Kit -ErrorAction SilentlyContinue).Path) {
    throw 'This is the installed kit itself; update it with -FromWsl or -Source <repo>\desktop.'
}
if (-not (Test-Path (Join-Path $Source 'shared\fonts'))) {
    Say 'build' 'no fonts or wallpapers in the source (npm run build:desktop); themes still switch without them' 'Yellow'
}
Say 'source' $Source

# --- The kit ----------------------------------------------------------------------
New-Item -ItemType Directory -Path $Kit -Force | Out-Null
# windows\ keeps its per-PC state (which VS Code themes are installed).
Mirror (Join-Path $Source 'windows') (Join-Path $Kit 'windows') @('/XD', (Join-Path $Source 'windows\launchers'), '/XF', '.vscode-installed')
Mirror (Join-Path $Source 'shared') (Join-Path $Kit 'shared')
Mirror (Join-Path $Source 'linux\wsl') (Join-Path $Kit 'linux\wsl')
Mirror (Join-Path $Source 'windows\launchers\Themes') (Join-Path $Kit 'Themes')
Mirror (Join-Path $Source 'windows\launchers\Tools') (Join-Path $Kit 'Tools')
$vscode = Join-Path (Split-Path $Source -Parent) 'vscode'
if (Test-Path $vscode) { Mirror $vscode (Join-Path $Kit 'vscode') }
Say 'kit' "${Kit}: Themes, Tools, windows, shared, linux\wsl, vscode"

# What the first versions of the kit left at its root.
foreach ($name in 'fonts', 'windhawk', 'windhawk-cyberpunk', 'install-fonts.ps1', 'windhawk-export.reg') {
    $path = Join-Path $Kit $name
    if (Test-Path $path) { Remove-Item $path -Recurse -Force; Say 'kit' "removed the old $name" }
}

# --- The right-click menu, once ---------------------------------------------------------
# Set means: the key is there and its default value is the empty string.
$menuKey = Get-Item 'HKCU:\Software\Classes\CLSID\{86ca1aa0-34aa-4e8b-a509-50c905bae2a2}\InprocServer32' -ErrorAction SilentlyContinue
$classic = $menuKey -and ($null -ne $menuKey.GetValue('', $null))
if ($ContextMenu -eq 'Classic' -and -not $classic) {
    # apply.ps1 restarts Explorer at the end, which makes it show.
    & (Join-Path $Kit 'windows\context-menu.ps1') -Style Classic -NoRestart:(-not $NoApply) | Out-Null
    Say 'menu' 'right-click menu: Windows 10 style (Tools has the switch back)'
}

# --- The theme ----------------------------------------------------------------------
if (-not $NoApply) {
    if (-not $Theme) {
        $current = Join-Path $Kit 'current.txt'
        $Theme = if (Test-Path $current) { (Get-Content $current -Raw).Trim() } else { '' }
    }
    Write-Host ''
    # Without a theme apply.ps1 shows the list and asks.
    & (Join-Path $Kit 'windows\apply.ps1') -Theme $Theme
}

Write-Host ''
Write-Host '  Kit installed. Double-click a file in Themes\ to switch.' -ForegroundColor Cyan
Write-Host ''
Finish
