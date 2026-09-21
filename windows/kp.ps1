<#
.SYNOPSIS
    One command for the whole desktop: .\kp.ps1 synthwave

.DESCRIPTION
    A thin wrapper around apply.ps1, which does the work. Without a theme it
    shows the list and asks. Every switch apply.ps1 takes works here too.

.EXAMPLE
    .\kp.ps1                      pick from the list
.EXAMPLE
    .\kp.ps1 cyberpunk -RestartExplorer
#>
& (Join-Path $PSScriptRoot 'apply.ps1') @args
