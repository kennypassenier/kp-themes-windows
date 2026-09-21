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

if ($Style -eq 'Classic') {
    # The default value must exist and be empty; "no value" does not count.
    New-Item -Path "$key\InprocServer32" -Force | Out-Null
    Set-ItemProperty -Path "$key\InprocServer32" -Name '(default)' -Value ''
    $done = 'Windows 10 style: the full menu at once'
} else {
    if (Test-Path $key) { Remove-Item -Path $key -Recurse -Force }
    $done = 'Windows 11 style: the short menu, the rest under "Show more options"'
}

if (-not $NoRestart) {
    Get-Process -Name 'explorer' -ErrorAction SilentlyContinue | Stop-Process -Force
    # Windows restarts the shell on its own; start it if it has not after a moment.
    Start-Sleep -Seconds 2
    if (-not (Get-Process -Name 'explorer' -ErrorAction SilentlyContinue)) { Start-Process explorer.exe }
}

Write-Host ''
Write-Host "  Right-click menu: $done." -ForegroundColor Cyan
Write-Host ''
if ($Pause) { Write-Host '  Press a key to close.' -ForegroundColor DarkGray; [void][Console]::ReadKey($true) }
