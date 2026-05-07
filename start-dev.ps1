$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendDir = Join-Path $root 'backend'
$frontendDir = Join-Path $root 'frontend'

$ports = @(3000, 5173)

Write-Host "[dev] Pulizia porte: $($ports -join ', ')" -ForegroundColor Cyan
foreach ($port in $ports) {
  $listeners = Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue
  if ($listeners) {
    $pids = $listeners | Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($procId in $pids) {
      try {
        Stop-Process -Id $procId -Force -ErrorAction Stop
        Write-Host "[dev] Terminato PID $procId su porta $port" -ForegroundColor Yellow
      } catch {
        Write-Host "[dev] Impossibile terminare PID $procId su porta ${port}: $($_.Exception.Message)" -ForegroundColor Red
      }
    }
  }
}

Write-Host '[dev] Avvio backend (porta 3000)...' -ForegroundColor Green
Start-Process powershell -ArgumentList @(
  '-NoExit',
  '-NoProfile',
  '-Command',
  "Set-Location '$backendDir'; npm run dev"
)

Write-Host '[dev] Attendo backend pronto su http://127.0.0.1:3000/auth/me ...' -ForegroundColor Cyan
$backendReady = $false
for ($attempt = 1; $attempt -le 45; $attempt++) {
  try {
    $response = Invoke-WebRequest -Uri 'http://127.0.0.1:3000/auth/me' -Method GET -UseBasicParsing -TimeoutSec 1
    if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
      $backendReady = $true
      break
    }
  } catch {
    # 401/404 are acceptable signs that HTTP server is alive; check status if available
    $statusCode = $_.Exception.Response.StatusCode.value__
    if ($statusCode -eq 401 -or $statusCode -eq 404) {
      $backendReady = $true
      break
    }
  }

  Start-Sleep -Milliseconds 500
}

if (-not $backendReady) {
  Write-Host '[dev] Backend non pronto entro timeout: avvio frontend comunque.' -ForegroundColor Yellow
} else {
  Write-Host '[dev] Backend pronto.' -ForegroundColor Green
}

Write-Host '[dev] Avvio frontend (porta 5173 strict)...' -ForegroundColor Green
Start-Process powershell -ArgumentList @(
  '-NoExit',
  '-NoProfile',
  '-Command',
  "Set-Location '$frontendDir'; npm run dev"
)

Write-Host '[dev] Avvio completato. Controlla le due finestre aperte.' -ForegroundColor Cyan
