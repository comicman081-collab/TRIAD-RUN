$ErrorActionPreference = 'Stop'

$triadGameRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$triadPort = 8766
$triadEntry = 'TRIAD_RUN_V0_8_MANEQUIN_ASSEMBLY.html'
$triadProfile = Join-Path $triadGameRoot '.triad_runtime_profile'
$triadStatePath = Join-Path $triadGameRoot '.triad_runtime_state.json'
$triadServer = $null

function Find-TriadBrowser {
  $triadCandidates = @(
    "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
    "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
    "$env:LocalAppData\Microsoft\Edge\Application\msedge.exe",
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe"
  )
  return $triadCandidates | Where-Object { $_ -and (Test-Path -LiteralPath $_) } | Select-Object -First 1
}

try {
  $triadOccupied = Get-NetTCPConnection -State Listen -LocalPort $triadPort -ErrorAction SilentlyContinue
  if ($triadOccupied) { throw "TRIAD RUN 전용 포트 $triadPort 가 이미 사용 중입니다." }

  $triadPython = Get-Command python.exe -ErrorAction Stop
  $triadServer = Start-Process -FilePath $triadPython.Source -ArgumentList @('-m','http.server',"$triadPort",'--bind','127.0.0.1') -WorkingDirectory $triadGameRoot -WindowStyle Hidden -PassThru

  $triadReady = $false
  for ($triadAttempt = 0; $triadAttempt -lt 30; $triadAttempt++) {
    Start-Sleep -Milliseconds 100
    try {
      $triadResponse = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:$triadPort/$triadEntry" -TimeoutSec 1
      if ($triadResponse.StatusCode -eq 200 -and $triadResponse.Content -match 'TRIAD // RUN') { $triadReady = $true; break }
    } catch {}
  }
  if (-not $triadReady) { throw 'TRIAD RUN 로컬 서버가 준비되지 않았습니다.' }

  $triadBrowser = Find-TriadBrowser
  if (-not $triadBrowser) { throw 'Microsoft Edge 또는 Google Chrome을 찾지 못했습니다.' }
  New-Item -ItemType Directory -Path $triadProfile -Force | Out-Null
  $triadUrl = "http://127.0.0.1:$triadPort/$triadEntry?autoplayHost=1"
  $triadBrowserProcess = Start-Process -FilePath $triadBrowser -ArgumentList @(
    "--app=$triadUrl",
    "--user-data-dir=$triadProfile",
    '--autoplay-policy=no-user-gesture-required',
    '--disable-background-media-suspend',
    '--disable-background-mode',
    '--no-first-run',
    '--disable-default-apps'
  ) -PassThru
  @{
    serverPid = $triadServer.Id
    browserPid = $triadBrowserProcess.Id
    port = $triadPort
    profile = $triadProfile
  } | ConvertTo-Json | Set-Content -LiteralPath $triadStatePath -Encoding UTF8

  while ($true) {
    $triadProfileEscaped = [regex]::Escape($triadProfile)
    $triadBrowserAlive = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
      $_.Name -match '^(msedge|chrome)\.exe$' -and $_.CommandLine -match $triadProfileEscaped
    } | Select-Object -First 1
    if (-not $triadBrowserAlive) { break }
    Start-Sleep -Milliseconds 500
  }
} finally {
  if ($triadServer -and -not $triadServer.HasExited) { Stop-Process -Id $triadServer.Id -Force }
  Remove-Item -LiteralPath $triadStatePath -Force -ErrorAction SilentlyContinue
}
