<#
.SYNOPSIS
    Switches the right-click menu between the Windows 10 and the Windows 11 style.

.DESCRIPTION
    Windows 11 shows a short menu and hides the rest behind "Show more options".
    An empty InprocServer32 key for the new menu's COM class makes Explorer fall
    back to the full Windows 10 menu. The key lives under HKCU, so no
    administrator rights are needed and it is only this user's menu.

    Explorer reads the key when it starts, so the script restarts Explorer.

.EXAMPLE
    .\context-menu.ps1 -Style Classic     the full menu at once (Windows 10)
.EXAMPLE
    .\context-menu.ps1 -Style Modern      back to the Windows 11 menu
#>
[CmdletBinding()]
param(
    [ValidateSet('Classic', 'Modern')]
    [string]$Style = 'Classic',
    [switch]$NoRestart,
    [switch]$Pause
)

$ErrorActionPreference = 'Stop'
$key = 'HKCU:\Software\Classes\CLSID\{86ca1aa0-34aa-4e8b-a509-50c905bae2a2}'

# A log per run in %LOCALAPPDATA%\kp-themes\logs, with what decides whether the
# menu changes: which user and hive, the Windows build, the key as it is after
# the write, and the programs known to take over Explorer's menus.
$logs = Join-Path $env:LOCALAPPDATA 'kp-themes\logs'
New-Item -ItemType Directory -Path $logs -Force | Out-Null
try { Start-Transcript -Path (Join-Path $logs "context-menu-$(Get-Date -Format 'yyyyMMdd-HHmmss').log") | Out-Null } catch { }

function Show-State([string]$when) {
    $os = Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion'
    $id = [Security.Principal.WindowsIdentity]::GetCurrent()
    $admin = (New-Object Security.Principal.WindowsPrincipal($id)).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    Write-Host "  [$when] user $($id.Name), elevated $admin, Windows $($os.DisplayVersion) build $($os.CurrentBuild).$($os.UBR)"
    $sub = Get-Item "$key\InprocServer32" -ErrorAction SilentlyContinue
    if ($sub) {
        $v = $sub.GetValue('', $null)
        $shown = if ($null -eq $v) { '(value not set)' } else { "'$v' ($($sub.GetValueKind('')))" }
        Write-Host "  [$when] InprocServer32 default: $shown"
    } else { Write-Host "  [$when] InprocServer32: no key" }
    foreach ($p in @(Get-CimInstance Win32_Process -Filter "Name='explorer.exe'" -ErrorAction SilentlyContinue)) {
        $owner = Invoke-CimMethod -InputObject $p -MethodName GetOwner -ErrorAction SilentlyContinue
        Write-Host "  [$when] explorer.exe pid $($p.ProcessId) of $($owner.Domain)\$($owner.User), started $($p.CreationDate)"
    }
    foreach ($k in 'HKCU:\Software\ExplorerPatcher', 'HKCU:\Software\StartIsBack', 'HKLM:\SOFTWARE\Windhawk\Engine\Mods') {
        if (Test-Path $k) { Write-Host "  [$when] $k : $((Get-ChildItem $k -ErrorAction SilentlyContinue | ForEach-Object { $_.PSChildName }) -join ', ')" }
    }
}
Show-State 'before'

if ($Style -eq 'Classic') {
    # The default value must exist and be an empty string; a key whose default is
    # "(value not set)" does nothing. reg.exe add /ve (no /d) is the one way that is
    # sure to write the empty string.
    $ErrorActionPreference = 'Continue'
    & reg.exe add 'HKCU\Software\Classes\CLSID\{86ca1aa0-34aa-4e8b-a509-50c905bae2a2}\InprocServer32' /ve /f *> $null
    $ErrorActionPreference = 'Stop'
    $value = (Get-Item "$key\InprocServer32").GetValue('', $null)
    if ($null -eq $value) { throw 'the empty default value did not stick; run this again as administrator' }
    $done = 'Windows 10 style: the full menu at once'
} else {
    if (Test-Path $key) { Remove-Item -Path $key -Recurse -Force }
    $done = 'Windows 11 style: the short menu, the rest under "Show more options"'
}

if (-not $NoRestart) {
    # Explorer reads the key when it starts.
    Get-Process -Name 'explorer' -ErrorAction SilentlyContinue | Stop-Process -Force
    # Windows restarts the shell on its own; start it if it has not after a moment.
    Start-Sleep -Seconds 3
    if (-not (Get-Process -Name 'explorer' -ErrorAction SilentlyContinue)) { Start-Process explorer.exe; Start-Sleep -Seconds 2 }
}
Show-State 'after'
try { Stop-Transcript | Out-Null } catch { }

Write-Host ''
Write-Host "  Right-click menu: $done." -ForegroundColor Cyan
Write-Host "  Still the old menu? Sign out and in once; the log is in $logs." -ForegroundColor DarkGray
Write-Host ''
if ($Pause) { Write-Host '  Press a key to close.' -ForegroundColor DarkGray; [void][Console]::ReadKey($true) }
