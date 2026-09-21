<#
.SYNOPSIS
    Installs the themes' fonts for the current user. No administrator rights.

.DESCRIPTION
    Copies every .ttf in the fonts folder beside this script (windows/fonts/,
    built by gates/desktop-fonts.py) to the per-user font folder and registers
    it under HKCU, which is what Settings > Fonts does for "Install for me".
    Running it again replaces the files. Programs pick the fonts up after a
    restart; YASB after its next reload.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File .\windows\install-fonts.ps1
#>
[CmdletBinding()]
param([string]$Source = (Join-Path $PSScriptRoot 'fonts'))

$ErrorActionPreference = 'Stop'
$target = Join-Path $env:LOCALAPPDATA 'Microsoft\Windows\Fonts'
$key = 'HKCU:\Software\Microsoft\Windows NT\CurrentVersion\Fonts'
New-Item -ItemType Directory -Path $target -Force | Out-Null
if (-not (Test-Path $key)) { New-Item -Path $key -Force | Out-Null }

Add-Type -Namespace KpFonts -Name Native -MemberDefinition @'
[DllImport("gdi32.dll", CharSet = CharSet.Unicode)]
public static extern int AddFontResourceW(string file);
[DllImport("user32.dll", CharSet = CharSet.Unicode)]
public static extern System.IntPtr SendMessageTimeoutW(System.IntPtr hWnd, uint msg, System.IntPtr w, System.IntPtr l, uint flags, uint timeout, out System.IntPtr result);
'@

$count = 0
foreach ($file in Get-ChildItem $Source -Filter '*.ttf') {
    $dest = Join-Path $target $file.Name
    # A font Windows has loaded is locked; if the same file is already there,
    # there is nothing to copy. A different one in use is left for next time.
    $same = (Test-Path $dest) -and ((Get-Item $dest).Length -eq $file.Length)
    if (-not $same) {
        try { Copy-Item $file.FullName $dest -Force }
        catch { Write-Host "  fonts      $($file.Name) is in use; it updates after a restart" -ForegroundColor Yellow; continue }
    }
    # The value name is only a label; Windows reads the family from the file.
    Set-ItemProperty -Path $key -Name "kp-themes $($file.BaseName) (TrueType)" -Value $dest
    [KpFonts.Native]::AddFontResourceW($dest) | Out-Null
    $count++
}
# WM_FONTCHANGE to every top-level window, so running programs look again.
$out = [IntPtr]::Zero
[KpFonts.Native]::SendMessageTimeoutW([IntPtr]0xffff, 0x001D, [IntPtr]::Zero, [IntPtr]::Zero, 2, 1000, [ref]$out) | Out-Null
Write-Host "  fonts      $count files installed for $env:USERNAME" -ForegroundColor Cyan
