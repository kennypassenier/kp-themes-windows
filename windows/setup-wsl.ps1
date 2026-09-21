<#
.SYNOPSIS
    Installs Arch Linux in WSL and turns it into a Garuda-like dev shell.

.DESCRIPTION
    Run it twice if WSL itself is not installed yet:
      1st run  installs the WSL platform (needs administrator rights, then a reboot)
      2nd run  installs Arch and, in it:
               - ..\linux\wsl\bootstrap-arch.sh as root: pacman, Chaotic-AUR, paru, the
                 CLI tools, your user (asks for a Linux password), /etc/wsl.conf
               - ..\linux\wsl\clone-kp-themes.sh as you: clones kp-themes into
                 ~/Projects/kp-themes (plus the branches in -Bundle, a git bundle, if
                 given) and runs desktop/linux/install.sh (fish, Starship, fonts, the
                 wallpapers built)
               then applies the theme from that clone, with Arch as the default tab in
               Windows Terminal. From then on the clone is the only copy: the files to
               double-click are in its desktop\windows\launchers\.

    Safe to run again: every step checks before it changes anything.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File .\desktop\windows\setup-wsl.ps1
.EXAMPLE
    .\desktop\windows\setup-wsl.ps1 -User kenny -Theme cyberpunk
#>
[CmdletBinding()]
param(
    [string]$User = $env:USERNAME.ToLower(),
    [string]$Distro = 'archlinux',
    # The theme to apply; the last one applied when left out.
    [string]$Theme = '',
    # A git bundle with work that is not on GitHub yet, fetched into the clone.
    [string]$Bundle = '',
    [switch]$Pause
)

# Continue, not Stop: wsl.exe writes progress to stderr, which PowerShell 5 would
# turn into a terminating error. Each step below checks $LASTEXITCODE instead.
$ErrorActionPreference = 'Continue'
$Here = $PSScriptRoot
# desktop\windows\ beside desktop\linux\, in a copy of the repo on this disk.
$Base = Split-Path $Here -Parent
$LinuxWsl = Join-Path $Base 'linux\wsl'
$State = Join-Path $env:LOCALAPPDATA 'kp-themes'
if (-not $Theme) {
    $current = Join-Path $State 'current.txt'
    $Theme = if (Test-Path $current) { (Get-Content $current -Raw).Trim() } else { 'synthwave' }
}

function Finish { if ($Pause) { Write-Host '  Press a key to close.' -ForegroundColor DarkGray; [void][Console]::ReadKey($true) } }

function Say([string]$text, [string]$colour = 'Gray') { Write-Host "  $text" -ForegroundColor $colour }

function Test-Admin {
    $id = [Security.Principal.WindowsIdentity]::GetCurrent()
    return (New-Object Security.Principal.WindowsPrincipal($id)).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

# wsl.exe prints UTF-16; PowerShell reads it with a NUL after every letter.
function Get-Distros {
    return @(& wsl.exe --list --quiet 2>$null | ForEach-Object { ($_ -replace "`0", '').Trim() } | Where-Object { $_ })
}

# Everything this window shows also goes to %LOCALAPPDATA%\kp-themes\logs,
# and the Linux scripts write theirs there too, so a failed run can be read afterwards.
$Logs = Join-Path $State 'logs'
New-Item -ItemType Directory -Path $Logs -Force | Out-Null
$env:KP_LOG_DIR = $Logs
# WSLENV hands KP_LOG_DIR to Linux as a Linux path (/p).
$env:WSLENV = (@($env:WSLENV, 'KP_LOG_DIR/p') | Where-Object { $_ }) -join ':'
try { Start-Transcript -Path (Join-Path $Logs "setup-wsl-$(Get-Date -Format 'yyyyMMdd-HHmmss').log") | Out-Null } catch { }

try {
    Write-Host ''
    Write-Host "  WSL: $Distro for $User, Garuda-style" -ForegroundColor Cyan
    Write-Host ''

    # 1. The WSL platform itself. `wsl --version` answers once the Store WSL is
    # installed, with or without a distro; `wsl --status` can fail while there is none.
    & wsl.exe --version *> $null
    if ($LASTEXITCODE -ne 0) {
        if (-not (Test-Admin)) {
            Say 'WSL is not installed yet. Restarting this script as administrator...' 'Yellow'
            Start-Process powershell.exe -Verb RunAs -ArgumentList @('-ExecutionPolicy', 'Bypass', '-NoExit', '-File', "`"$PSCommandPath`"", '-User', $User, '-Distro', $Distro, '-Theme', $Theme)
            return
        }
        Say 'Installing the WSL platform...'
        & wsl.exe --install --no-distribution
        Say 'Reboot Windows, then run this script again (no administrator needed the second time).' 'Yellow'
        return
    }
    & wsl.exe --update *> $null

    # 2. Arch Linux.
    if ((Get-Distros) -notcontains $Distro) {
        Say "Installing $Distro..."
        & wsl.exe --install $Distro --no-launch
        if ((Get-Distros) -notcontains $Distro) {
            # Older wsl.exe builds register the distro on first launch only.
            & wsl.exe -d $Distro -u root -- true
        }
    }
    if ((Get-Distros) -notcontains $Distro) { throw "$Distro did not install; run 'wsl --list --online' to see what this Windows build offers." }

    # 3. The root half, with its own folder as the working directory.
    Say 'Bootstrapping (pacman, Chaotic-AUR, paru, the CLI tools). This takes a few minutes.'
    & wsl.exe -d $Distro -u root --cd $LinuxWsl -e bash ./bootstrap-arch.sh $User
    if ($LASTEXITCODE -ne 0) { throw "bootstrap-arch.sh failed (exit $LASTEXITCODE); scroll up for the pacman error, fix it, and run this script again." }

    # 4. Restart so /etc/wsl.conf (systemd, default user) takes effect.
    & wsl.exe --terminate $Distro | Out-Null

    # 5. The user half: ~/Projects/kp-themes and its Linux install.
    Say 'Cloning kp-themes into ~/Projects and setting up the shell.'
    # PowerShell 5 drops an empty argument, so 'none' stands for no bundle.
    $bundleArg = if ($Bundle -and (Test-Path $Bundle)) { $Bundle } else { 'none' }
    # -e, not --: -- hands the line to the login shell (fish), which chokes on a Windows path.
    & wsl.exe -d $Distro -u $User --cd $LinuxWsl -e bash ./clone-kp-themes.sh $bundleArg $Theme
    if ($LASTEXITCODE -ne 0) { throw "clone-kp-themes.sh failed (exit $LASTEXITCODE); scroll up for the error." }

    # 6. The theme on the whole desktop, from the clone.
    $linuxHome = ((& wsl.exe -d $Distro -u $User -e sh -c 'echo $HOME') -join '').Trim()
    $clone = "\\wsl.localhost\$Distro" + ($linuxHome -replace '/', '\') + '\Projects\kp-themes'
    & (Join-Path $clone 'desktop\windows\apply.ps1') -Theme $Theme

    Say "Done. The repo is $clone; double-click a theme in desktop\windows\launchers\Themes." 'Cyan'

    # What WSL says about itself, for the log.
    Say ((& wsl.exe --list --verbose 2>&1 | ForEach-Object { ($_ -replace "`0", '').TrimEnd() } | Where-Object { $_ }) -join ' | ') 'DarkGray'
} catch {
    Say ((& wsl.exe --list --verbose 2>&1 | ForEach-Object { ($_ -replace "`0", '').TrimEnd() } | Where-Object { $_ }) -join ' | ') 'DarkGray'
    Write-Host ''
    Write-Host "  Setup stopped: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "  The log is in $Logs; running this again is safe, it picks up where it stopped." -ForegroundColor Yellow
    # Keep the window open on an error, even without -Pause.
    $Pause = $true
} finally {
    try { Stop-Transcript | Out-Null } catch { }
    Finish
}
