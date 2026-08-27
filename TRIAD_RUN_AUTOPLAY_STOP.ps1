$ErrorActionPreference = 'SilentlyContinue'

$triadGameRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$triadProfile = Join-Path $triadGameRoot '.triad_runtime_profile'
$triadStatePath = Join-Path $triadGameRoot '.triad_runtime_state.json'
$triadPort = 8766
$triadStopped = 0

$triadProfileEscaped = [regex]::Escape($triadProfile)
Get-CimInstance Win32_Process | Where-Object {
  $_.Name -match '^(msedge|chrome)\.exe$' -and $_.CommandLine -match $triadProfileEscaped
} | ForEach-Object {
  Stop-Process -Id $_.ProcessId -Force
  $triadStopped++
}

Get-NetTCPConnection -State Listen -LocalPort $triadPort | ForEach-Object {
  $triadOwner = Get-CimInstance Win32_Process -Filter "ProcessId=$($_.OwningProcess)"
  if ($triadOwner.Name -match '^python(w)?\.exe$' -and $triadOwner.CommandLine -match 'http\.server\s+8766') {
    Stop-Process -Id $triadOwner.ProcessId -Force
    $triadStopped++
  }
}

Get-CimInstance Win32_Process | Where-Object {
  $_.Name -match '^(powershell|pwsh)\.exe$' -and
  $_.ProcessId -ne $PID -and
  $_.CommandLine -match 'TRIAD_RUN_AUTOPLAY\.ps1'
} | ForEach-Object {
  Stop-Process -Id $_.ProcessId -Force
  $triadStopped++
}

Remove-Item -LiteralPath $triadStatePath -Force

Add-Type -AssemblyName PresentationFramework
if ($triadStopped -gt 0) {
  [System.Windows.MessageBox]::Show('TRIAD RUN 자동 음악과 로컬 실행을 종료했습니다.', 'TRIAD // RUN') | Out-Null
} else {
  [System.Windows.MessageBox]::Show('실행 중인 TRIAD RUN 자동 음악이 없습니다.', 'TRIAD // RUN') | Out-Null
}
