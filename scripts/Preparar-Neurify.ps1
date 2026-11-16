# Prepara o Neurify no Windows com o modelo treinado na AP2 (GPT-2 + MIDI, estilo Chrono Trigger).
# Uso: clique duas vezes em Preparar-Neurify.bat, na raiz do repositorio.
# Pode ser rodado de novo sem problema: pula o que ja esta pronto.

param(
    [switch]$SemTeste
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$Pasta = Split-Path -Parent $PSScriptRoot
$Backend = Join-Path $Pasta 'backend'
$Config = Join-Path $Backend 'modelo_config'
$TamanhoModelo = 344871552
$UrlSoundFont = 'https://raw.githubusercontent.com/mrbumpy409/GeneralUser-GS/684543d5e5efaef08d02be50dcda8d552478fa60/GeneralUser-GS.sf2'

function Titulo([string]$t) { Write-Host ''; Write-Host "== $t ==" -ForegroundColor Cyan }
function Ok([string]$t) { Write-Host "   OK  $t" -ForegroundColor Green }
function Aviso([string]$t) { Write-Host "   !!  $t" -ForegroundColor Yellow }
function Falha([string]$t) { Write-Host "   XX  $t" -ForegroundColor Red; Read-Host 'Aperte Enter para fechar'; exit 1 }

function Atualizar-Path {
    $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' +
                [Environment]::GetEnvironmentVariable('Path', 'User')
}

function Tem-Comando([string]$nome) {
    return [bool](Get-Command $nome -ErrorAction SilentlyContinue)
}

function Instalar-Winget([string]$id) {
    if (-not (Tem-Comando 'winget')) {
        Falha "winget nao encontrado. Instale '$id' manualmente e rode o script de novo."
    }
    Write-Host "   Instalando $id com o winget (pode pedir confirmacao)..."
    & winget install -e --id $id
    Atualizar-Path
}

# Devolve o caminho de um python.exe 3.10 a 3.13, ou $null
function Achar-Python {
    $candidatos = @()
    if (Tem-Comando 'py') {
        foreach ($v in @('3.12', '3.11', '3.10', '3.13')) {
            try {
                $exe = & py "-$v" -c 'import sys; print(sys.executable)' 2>$null
                if ($LASTEXITCODE -eq 0 -and $exe) { $candidatos += $exe.Trim() }
            } catch { }
        }
    }
    foreach ($v in @('312', '311', '310', '313')) {
        $p = Join-Path $env:LOCALAPPDATA "Programs\Python\Python$v\python.exe"
        if (Test-Path $p) { $candidatos += $p }
    }
    if (Tem-Comando 'python') {
        try {
            $exe = & python -c 'import sys; print(sys.executable)' 2>$null
            if ($LASTEXITCODE -eq 0 -and $exe) { $candidatos += $exe.Trim() }
        } catch { }
    }
    foreach ($c in $candidatos) {
        try {
            $ver = & $c -c 'import sys; print(sys.version_info[0], sys.version_info[1], sep=chr(46))' 2>$null
            if ($LASTEXITCODE -eq 0 -and @('3.10', '3.11', '3.12', '3.13') -contains $ver.Trim()) { return $c }
        } catch { }
    }
    return $null
}

function Pasta-Downloads {
    try {
        $p = (New-Object -ComObject Shell.Application).NameSpace('shell:Downloads').Self.Path
        if ($p -and (Test-Path $p)) { return $p }
    } catch { }
    return (Join-Path $HOME 'Downloads')
}

# Procura o model.safetensors baixado do Drive (zip da pasta, pasta extraida ou o arquivo solto)
function Achar-Modelo {
    $lugares = @((Pasta-Downloads), $Pasta)
    foreach ($l in $lugares) {
        if (-not (Test-Path $l)) { continue }
        $solto = Get-ChildItem -Path $l -Filter 'model*.safetensors' -File -ErrorAction SilentlyContinue |
                 Where-Object { $_.Length -eq $TamanhoModelo } | Sort-Object LastWriteTime -Descending | Select-Object -First 1
        if ($solto) { return $solto.FullName }
        $zip = Get-ChildItem -Path $l -Filter 'gpt2_pretreinado*.zip' -File -ErrorAction SilentlyContinue |
               Sort-Object LastWriteTime -Descending | Select-Object -First 1
        if ($zip) {
            $tmp = Join-Path $env:TEMP 'neurify-modelo'
            if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
            Write-Host "   Extraindo $($zip.Name)..."
            Expand-Archive -Path $zip.FullName -DestinationPath $tmp -Force
            $m = Get-ChildItem -Path $tmp -Filter 'model.safetensors' -File -Recurse | Select-Object -First 1
            if ($m) { return $m.FullName }
        }
        $pastaSolta = Get-ChildItem -Path $l -Directory -Filter 'gpt2_pretreinado*' -ErrorAction SilentlyContinue |
                      Sort-Object LastWriteTime -Descending | Select-Object -First 1
        if ($pastaSolta) {
            $m = Get-ChildItem -Path $pastaSolta.FullName -Filter 'model.safetensors' -File -Recurse | Select-Object -First 1
            if ($m) { return $m.FullName }
        }
    }
    return $null
}

function Barra([string]$p) { return ($p -replace '\\', '/') }

function Fluid-Abre([string]$exe) {
    $ErrorActionPreference = 'Continue'
    try {
        $null = & $exe --version 2>&1
        return ($LASTEXITCODE -eq 0)
    } catch { return $false }
}

# ---------------------------------------------------------------------------
Titulo '1/7 Modelo treinado (gpt2_pretreinado)'
$Ckpt = Join-Path $Backend 'checkpoints\gpt2-midi'
New-Item -ItemType Directory -Path $Ckpt -Force | Out-Null
$destModelo = Join-Path $Ckpt 'model.safetensors'
$pronto = (Test-Path $destModelo) -and ((Get-Item $destModelo).Length -eq $TamanhoModelo)
if (-not $pronto) {
    $achado = Achar-Modelo
    if (-not $achado) {
        Aviso 'Nao achei o model.safetensors (345 MB) na pasta Downloads nem na pasta do repositorio.'
        Write-Host '   Baixe a pasta gpt2_pretreinado (ou so o model.safetensors) do link que voce recebeu do grupo'
        Write-Host '   e deixe em Downloads, sem renomear. Se o Drive avisar que nao verifica virus, baixe assim mesmo.'
        Read-Host '   Quando o download terminar, aperte Enter'
        $achado = Achar-Modelo
    }
    if ($achado) {
        Copy-Item $achado $destModelo -Force
        Ok 'model.safetensors copiado'
    } else {
        Aviso 'Modelo nao encontrado: o player vai abrir em modo MOCK (audios de demonstracao). Rode o script de novo depois de baixar.'
    }
} else {
    Ok 'model.safetensors ja estava no lugar'
}
foreach ($f in @('config.json', 'generation_config.json', 'tokenizer.json')) {
    Copy-Item (Join-Path $Config $f) (Join-Path $Ckpt $f) -Force
}
Ok 'config.json, generation_config.json e tokenizer.json copiados de backend\modelo_config'

# ---------------------------------------------------------------------------
Titulo '2/7 MIDIs de teste usados como comeco das musicas'
$Prompts = Join-Path $Ckpt 'prompts'
New-Item -ItemType Directory -Path $Prompts -Force | Out-Null
$urls = Get-Content (Join-Path $Config 'prompts_teste.txt') | Where-Object { $_ -match '^https?://' }
foreach ($u in $urls) {
    $nome = Split-Path $u -Leaf
    $dest = Join-Path $Prompts $nome
    if (Test-Path $dest) { continue }
    try {
        Invoke-WebRequest -Uri $u -OutFile $dest -UseBasicParsing -Headers @{ 'User-Agent' = 'Neurify-AP2-Ibmec/1.0 (trabalho academico)' }
        Start-Sleep -Milliseconds 300
    } catch { Aviso "Nao consegui baixar $nome" }
}
$qtd = (Get-ChildItem $Prompts -Filter *.mid -ErrorAction SilentlyContinue).Count
if ($qtd -eq 0) { Aviso 'Nenhum MIDI de comeco. O modelo vai comecar de um compasso vazio.' } else { Ok "$qtd MIDIs em checkpoints\gpt2-midi\prompts" }

# ---------------------------------------------------------------------------
Titulo '3/7 SoundFont General MIDI'
$SfDir = Join-Path $Backend 'soundfonts'
New-Item -ItemType Directory -Path $SfDir -Force | Out-Null
$Sf = Join-Path $SfDir 'default.sf2'
if (-not (Test-Path $Sf) -or ((Get-Item $Sf).Length -lt 10000000)) {
    Write-Host '   Baixando o GeneralUser GS (31 MB), de S. Christian Collins...'
    Invoke-WebRequest -Uri $UrlSoundFont -OutFile $Sf -UseBasicParsing
    if ((Get-Item $Sf).Length -ne 32319396) { Aviso 'O SoundFont baixado tem tamanho inesperado. Se o audio falhar, apague backend\soundfonts\default.sf2 e rode de novo.' }
}
Ok 'backend\soundfonts\default.sf2'

# ---------------------------------------------------------------------------
Titulo '4/7 FluidSynth'
$Fluid = $null
$cmdFluid = Get-Command 'fluidsynth' -ErrorAction SilentlyContinue
if ($cmdFluid) { $Fluid = $cmdFluid.Source }
$FluidDir = Join-Path $Backend 'tools\fluidsynth'
if (-not $Fluid) {
    $local = Get-ChildItem -Path $FluidDir -Filter 'fluidsynth.exe' -File -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($local) { $Fluid = $local.FullName }
}
if (-not $Fluid) {
    $url = 'https://github.com/FluidSynth/fluidsynth/releases/download/v2.4.8/fluidsynth-2.4.8-win10-x64.zip'
    try {
        $rel = Invoke-RestMethod -Uri 'https://api.github.com/repos/FluidSynth/fluidsynth/releases/latest' -Headers @{ 'User-Agent' = 'neurify-setup' }
        $asset = $rel.assets | Where-Object { $_.name -match 'win10-x64.*\.zip$' } | Select-Object -First 1
        if ($asset) { $url = $asset.browser_download_url }
    } catch { Aviso 'Nao consegui consultar a ultima versao; usando a 2.4.8.' }
    Write-Host "   Baixando $url"
    $zipFluid = Join-Path $env:TEMP 'fluidsynth-win.zip'
    Invoke-WebRequest -Uri $url -OutFile $zipFluid -UseBasicParsing
    New-Item -ItemType Directory -Path $FluidDir -Force | Out-Null
    Expand-Archive -Path $zipFluid -DestinationPath $FluidDir -Force
    $local = Get-ChildItem -Path $FluidDir -Filter 'fluidsynth.exe' -File -Recurse | Select-Object -First 1
    if (-not $local) { Falha 'O zip do FluidSynth nao tinha fluidsynth.exe.' }
    $Fluid = $local.FullName
}
if (-not (Fluid-Abre $Fluid)) {
    Aviso 'O FluidSynth nao abriu. Normalmente falta o Visual C++ Redistributable.'
    Instalar-Winget 'Microsoft.VCRedist.2015+.x64'
    if (-not (Fluid-Abre $Fluid)) { Falha "O FluidSynth continua sem abrir: $Fluid" }
}
Ok "FluidSynth: $Fluid"

# ---------------------------------------------------------------------------
Titulo '5/7 Arquivo backend\.env'
$EnvFile = Join-Path $Backend '.env'
$linhas = Get-Content (Join-Path $Backend '.env.example')
$valores = @{
    'NEURIFY_EXECUTION_MODE'   = 'auto'
    'NEURIFY_CHECKPOINT_DIR'   = (Barra $Ckpt)
    'NEURIFY_TOKENIZER_CONFIG' = (Barra (Join-Path $Ckpt 'tokenizer.json'))
    'NEURIFY_PROMPTS_DIR'      = (Barra $Prompts)
    'NEURIFY_SOUNDFONT_PATH'   = (Barra $Sf)
    'NEURIFY_FLUIDSYNTH_BIN'   = (Barra $Fluid)
}
$saida = foreach ($l in $linhas) {
    $chave = ($l -split '=', 2)[0].Trim()
    if ($valores.ContainsKey($chave)) { "$chave=$($valores[$chave])" } else { $l }
}
[IO.File]::WriteAllLines($EnvFile, [string[]]$saida, (New-Object Text.UTF8Encoding($false)))
Ok 'backend\.env com caminhos absolutos e modo auto'

# ---------------------------------------------------------------------------
Titulo '6/7 Python e dependencias do backend'
$Py = Achar-Python
if (-not $Py) {
    Aviso 'Python 3.10 a 3.13 nao encontrado.'
    Instalar-Winget 'Python.Python.3.12'
    $Py = Achar-Python
    if (-not $Py) { Falha 'Python ainda nao encontrado. Feche esta janela, abra de novo e rode o script.' }
}
Ok "Python: $Py"
$VenvPy = Join-Path $Backend '.venv\Scripts\python.exe'
if (-not (Test-Path $VenvPy)) {
    & $Py -m venv (Join-Path $Backend '.venv')
    if ($LASTEXITCODE -ne 0) { Falha 'Nao consegui criar o ambiente virtual.' }
}
Write-Host '   Instalando pacotes (torch, transformers, miditok...). A primeira vez demora alguns minutos.'
& $VenvPy -m pip install --upgrade pip --quiet
& $VenvPy -m pip install -r (Join-Path $Backend 'requirements.txt')
if ($LASTEXITCODE -ne 0) { Falha 'pip install falhou. Veja a mensagem acima.' }
& $VenvPy -c "import torch, transformers, symusic; from importlib.metadata import version; print('   torch', torch.__version__, '| transformers', transformers.__version__, '| miditok', version('miditok'))"
Ok 'Backend pronto'

# ---------------------------------------------------------------------------
Titulo '7/7 Node e dependencias do frontend'
$nodeOk = $false
if (Tem-Comando 'node') {
    $maior = [int](((& node --version) -replace '^v', '') -split '\.')[0]
    $nodeOk = $maior -ge 18
}
if (-not $nodeOk) {
    Instalar-Winget 'OpenJS.NodeJS.LTS'
    if (-not (Tem-Comando 'npm')) { Falha 'Node instalado, mas o npm ainda nao aparece. Feche esta janela, abra de novo e rode o script.' }
}
Push-Location $Pasta
try {
    & npm install --no-fund --no-audit
    if ($LASTEXITCODE -ne 0) { Falha 'npm install falhou. Veja a mensagem acima.' }
} finally { Pop-Location }
Ok 'Frontend pronto'

# ---------------------------------------------------------------------------
Write-Host ''
Write-Host 'Tudo instalado. Abrindo o backend, conferindo o modo e abrindo o player...' -ForegroundColor Cyan
$iniciar = Join-Path $PSScriptRoot 'Iniciar-Neurify.ps1'
if ($SemTeste) { & $iniciar } else { & $iniciar -Testar }
