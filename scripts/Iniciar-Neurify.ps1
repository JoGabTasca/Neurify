# Abre o backend e o player do Neurify. Rode depois do Preparar-Neurify uma vez.
# Uso: clique duas vezes em Iniciar-Neurify.bat, na raiz do repositorio

param(
    [string]$Pasta = (Split-Path -Parent $PSScriptRoot),
    [switch]$Testar
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$Backend = Join-Path $Pasta 'backend'
$VenvPy = Join-Path $Backend '.venv\Scripts\python.exe'
$Api = 'http://127.0.0.1:8000/api'
$Player = 'http://localhost:5173'

if (-not (Test-Path $VenvPy)) {
    Write-Host "Nao achei o ambiente em $Backend. Rode primeiro o Preparar-Neurify.bat." -ForegroundColor Red
    Read-Host 'Aperte Enter para fechar'
    exit 1
}

function Ler-Health {
    try { return Invoke-RestMethod -Uri "$Api/health" -TimeoutSec 3 } catch { return $null }
}

function Responde([string]$url) {
    try { $null = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 3; return $true } catch { return $false }
}

# Backend -------------------------------------------------------------------
$h = Ler-Health
if (-not $h) {
    $cmd = "`$host.UI.RawUI.WindowTitle = 'Neurify backend'; Set-Location -LiteralPath '$Backend'; & '.\.venv\Scripts\python.exe' -m uvicorn main:app --host 127.0.0.1 --port 8000"
    Start-Process powershell -ArgumentList @('-NoExit', '-ExecutionPolicy', 'Bypass', '-Command', $cmd)
    Write-Host 'Esperando o backend carregar o modelo (ate 3 minutos)...'
    for ($i = 0; ($i -lt 90) -and (-not $h); $i++) { Start-Sleep -Seconds 2; $h = Ler-Health }
}
if (-not $h) {
    Write-Host "O backend nao respondeu. Veja a janela 'Neurify backend'." -ForegroundColor Red
    Read-Host 'Aperte Enter para fechar'
    exit 1
}
if ($h.mode -eq 'REAL') {
    Write-Host "Modo REAL: $($h.detail)" -ForegroundColor Green
} else {
    Write-Host "Modo MOCK (audios de demonstracao): $($h.detail)" -ForegroundColor Yellow
}

# Teste de uma geracao completa -----------------------------------------------
if ($Testar -and $h.mode -eq 'REAL') {
    Write-Host 'Gerando uma musica de teste (512 tokens na CPU, cerca de 1 minuto)...'
    $g = Invoke-RestMethod -Method Post -Uri "$Api/generate" -ContentType 'application/json' -Body '{"cancel_previous": true}'
    $s = $null
    for ($i = 0; $i -lt 120; $i++) {
        Start-Sleep -Seconds 2
        $s = Invoke-RestMethod -Uri "$Api/generations/$($g.id)"
        if ($s.status -eq 'completed' -or $s.status -eq 'failed') { break }
    }
    if ($s -and $s.status -eq 'completed') {
        Write-Host ("Teste OK: {0} | {1} | {2:N0} s de audio, {3} tokens" -f $s.track.title, $s.track.subtitle, $s.track.durationSeconds, $s.track.tokenCount) -ForegroundColor Green
    } elseif ($s) {
        Write-Host "Teste falhou: $($s.error)" -ForegroundColor Red
    } else {
        Write-Host 'Teste sem resposta do backend.' -ForegroundColor Red
    }
}

# Frontend ------------------------------------------------------------------
if (-not (Responde $Player)) {
    $cmd = "`$host.UI.RawUI.WindowTitle = 'Neurify player'; Set-Location -LiteralPath '$Pasta'; npm run dev"
    Start-Process powershell -ArgumentList @('-NoExit', '-ExecutionPolicy', 'Bypass', '-Command', $cmd)
    for ($i = 0; ($i -lt 30) -and (-not (Responde $Player)); $i++) { Start-Sleep -Seconds 2 }
}
Start-Process $Player
Write-Host "Player aberto em $Player. Para encerrar, feche as janelas 'Neurify backend' e 'Neurify player'."
Read-Host 'Aperte Enter para fechar esta janela'
