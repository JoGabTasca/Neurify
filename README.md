<div align="center">
  <img src="public/favicon.svg" alt="Neurify Logo" width="64" height="64" />

  # Neurify
  ### *Music that never existed.*

  <p align="center">
    <em>An infinite stream of original music, composed by artificial intelligence.</em>
  </p>

  <p align="center">
    <img src="https://img.shields.io/badge/Institui%C3%A7%C3%A3o-IBMEC-080A09?style=flat-square&labelColor=121614&color=B8FF65" alt="IBMEC" />
    <img src="https://img.shields.io/badge/Disciplina-Redes%20Neurais%20e%20Deep%20Learning-080A09?style=flat-square&labelColor=121614&color=83D94C" alt="Redes Neurais e Deep Learning" />
    <img src="https://img.shields.io/badge/Modelo-GPT--2%20(Fine--tuning)-080A09?style=flat-square&labelColor=121614&color=B8FF65" alt="GPT-2 Fine-tuning" />
  </p>

  <p align="center">
    <img src="https://img.shields.io/badge/React-19-121614?style=flat-square&logo=react&logoColor=B8FF65" alt="React" />
    <img src="https://img.shields.io/badge/TypeScript-5.7-121614?style=flat-square&logo=typescript&logoColor=B8FF65" alt="TypeScript" />
    <img src="https://img.shields.io/badge/FastAPI-Python-121614?style=flat-square&logo=fastapi&logoColor=B8FF65" alt="FastAPI" />
    <img src="https://img.shields.io/badge/PyTorch-Transformers-121614?style=flat-square&logo=pytorch&logoColor=83D94C" alt="PyTorch" />
    <img src="https://img.shields.io/badge/MidiTok-FluidSynth-121614?style=flat-square&color=B8FF65" alt="MidiTok & FluidSynth" />
  </p>
</div>

---

## 1. Sobre o Neurify

**Neurify — Music that never existed.**

O **Neurify** é uma aplicação experimental de geração musical com Inteligência Artificial, desenvolvida como projeto acadêmico da disciplina de **Redes Neurais e Deep Learning do IBMEC**.

O projeto explora o uso de modelos de linguagem baseados na arquitetura **Transformer** para geração de sequências musicais inéditas. A proposta consiste em realizar o **fine-tuning do modelo GPT-2** utilizando datasets de músicas em formato **MIDI**, permitindo que a rede aprenda relações harmônicas, rítmicas e melódicas e gere novas composições a partir de sequências de tokens.

Seguindo o conceito *"The music can be only played once, so enjoy the ride"*, as composições geradas são **efêmeras**: o áudio sintetizado permanece apenas em memória durante a reprodução atual e é descartado assim que o usuário avança (*Skip*) para uma nova composição.

---

## 2. Contexto Acadêmico

| Campo | Identificação |
| :--- | :--- |
| **Instituição** | IBMEC |
| **Disciplina** | Redes Neurais e Deep Learning |
| **Projeto** | Neurify |
| **Área** | Inteligência Artificial Generativa / Geração Musical Simbólica |
| **Modelo Base** | GPT-2 (*Fine-tuning* em sequências MIDI tokenizadas) |
| **Execução** | 100% Local (Frontend React + Backend FastAPI) |

---

## 3. Arquitetura e Fluxo de Geração Musical

O pipeline local do Neurify conecta o frontend React à API Python (`FastAPI`), que executa a geração fora da thread principal e sintetiza o áudio em memória:

```mermaid
flowchart LR
    A["Frontend React"] -->|"POST /api/generate"| B["FastAPI Backend"]
    B --> C["GPT-2 Fine-tuned (Tokens)"]
    C --> D["MidiTok + Symusic (MIDI)"]
    D --> E["FluidSynth + SoundFont (WAV em Memória)"]
    E -->|"GET /api/tracks/{id}/audio"| A
```

1. **Solicitação do Frontend:** O botão *"Generate your first track"* ou o botão *Skip* solicita uma nova composição via `POST /api/generate`.
2. **Inferência do GPT-2:** O serviço desacoplado (`model_service.py`) executa em uma worker thread dedicada (limitada a 1 geração por vez) para não bloquear consultas de status (`GET /api/generations/{id}`).
3. **Decodificação MIDI (`MidiTok` + `Symusic`):** Os tokens gerados são decodificados com a mesma configuração do treinamento.
4. **Síntese de Áudio Efêmera (`FluidSynth`):** O MIDI temporário é convertido para WAV com `FluidSynth` e mantido apenas em memória RAM para reprodução única.
5. **Reprodução no Player:** O frontend recebe os metadados e reproduz o stream de áudio (`GET /api/tracks/{id}/audio`), acompanhado de arte generativa procedural em HTML5 Canvas.

---

## 4. Endpoints do Backend Local

| Método | Rota | Descrição |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Retorna o estado do servidor, modo ativo (`MOCK` ou `REAL`) e se o modelo GPT-2 está carregado. |
| `POST` | `/api/generate` | Inicia a geração de uma música inédita (controle de concorrência de 1 execução por vez) e retorna o `id` da geração. |
| `GET` | `/api/generations/{id}` | Retorna o status (`pending`, `generating`, `completed`, `failed`), progresso, metadados e URL do áudio. |
| `GET` | `/api/tracks/{id}/audio` | Disponibiliza o stream de áudio (WAV) da faixa ativa em memória (com suporte a HTTP `Range`). |
| `DELETE` | `/api/generations/{id}` | Cancela uma geração em andamento e libera o slot de execução. |

---

## 5. Estrutura do Repositório

```text
neurify/
├── backend/
│   ├── checkpoints/              # Diretório local para pesos do GPT-2 e config do MidiTok (ignorado no Git)
│   ├── soundfonts/               # Diretório local para arquivos SoundFont .sf2 (ignorado no Git)
│   ├── config.py                 # Configurações locais, caminhos e origens CORS permitidas
│   ├── main.py                   # Servidor FastAPI, rotas REST e controle de ciclo de vida
│   ├── model_service.py          # Camada desacoplada do GPT-2, MidiTok, FluidSynth e modo MOCK
│   ├── schemas.py                # Contratos Pydantic da API
│   ├── requirements.txt          # Dependências Python do backend
│   └── .env.example              # Exemplo de variáveis de ambiente do backend
├── public/
│   ├── audio/                    # Faixas WAV de demonstração utilizadas enquanto em modo MOCK
│   └── favicon.svg               # Ícone vetorial do Neurify
├── src/
│   ├── components/               # Componentes visuais (AlbumArtwork, GenerationState, MusicControls, etc.)
│   ├── hooks/
│   │   └── useMusicPlayer.ts     # Gerenciamento do HTML5 Audio, estados de geração e tratamento de erros
│   ├── pages/
│   │   ├── Welcome.tsx           # Tela 01 — Experiência de entrada
│   │   └── Player.tsx            # Tela 02 — Player de streaming generativo
│   ├── services/
│   │   └── musicService.ts       # Cliente HTTP integrado ao backend FastAPI via VITE_API_URL
│   ├── types/
│   │   └── music.ts              # Contratos TypeScript
│   ├── App.tsx                   # Orquestração entre telas e transições
│   └── main.tsx                  # Ponto de entrada React
├── .env.example                  # Variável VITE_API_URL=http://localhost:8000
├── package.json                  # Scripts e dependências do frontend
└── vite.config.ts                # Configuração Vite
```

---

## 6. Guia de Execução Local (Apresentação Acadêmica)

### 6.1. Instalação das Dependências Python (Backend)

1. Acesse a pasta `backend/` e crie um ambiente virtual Python (`Python >= 3.10`):
   ```bash
   cd backend
   python -m venv .venv
   ```

2. Ative o ambiente virtual:
   - **Windows (PowerShell):**
     ```powershell
     .\.venv\Scripts\Activate.ps1
     ```
   - **Linux / macOS:**
     ```bash
     source .venv/bin/activate
     ```

3. Instale as dependências:
   ```bash
   pip install -r requirements.txt
   ```

### 6.2. Instalação do Sintetizador MIDI (`FluidSynth`) e `SoundFont`

Para converter os arquivos MIDI gerados pelo modelo em áudio WAV no modo real:

1. **Instale o executável do FluidSynth no sistema operacional:**
   - **Windows (via Winget ou Chocolatey):**
     ```powershell
     winget install FluidSynth.FluidSynth
     # ou: choco install fluidsynth
     ```
   - **macOS (Homebrew):**
     ```bash
     brew install fluid-synth
     ```
   - **Ubuntu / Debian:**
     ```bash
     sudo apt-get update && sudo apt-get install -y fluidsynth
     ```
   Verifique se o binário está disponível no `PATH` executando `fluidsynth --version`.

2. **Adicione um arquivo SoundFont (`.sf2`):**
   - Baixe um SoundFont General MIDI (ex.: `FluidR3_GM.sf2` ou `GeneralUser_GS.sf2`).
   - Salve o arquivo em `backend/soundfonts/default.sf2` (ou configure o caminho em `NEURIFY_SOUNDFONT_PATH` no arquivo `backend/.env`).

### 6.3. Configuração do Caminho do Checkpoint

1. Copie o arquivo de exemplo de variáveis de ambiente do backend:
   ```bash
   cp backend/.env.example backend/.env
   ```
2. Quando os arquivos resultantes do notebook de treinamento estiverem prontos, coloque-os em `backend/checkpoints/gpt2-midi/` e ajuste em `backend/.env`:
   ```env
   NEURIFY_EXECUTION_MODE=mock
   NEURIFY_CHECKPOINT_DIR=./checkpoints/gpt2-midi
   NEURIFY_TOKENIZER_CONFIG=./checkpoints/gpt2-midi/tokenizer.json
   NEURIFY_SOUNDFONT_PATH=./soundfonts/default.sf2
   ```
   > **Nota:** Enquanto o notebook de treinamento não for conectado, mantenha `NEURIFY_EXECUTION_MODE=mock`. O backend operará automaticamente em modo de demonstração identificado como `MOCK`.

### 6.4. Inicialização do Backend (FastAPI)

Com o ambiente virtual ativado dentro da pasta `backend/`:

```bash
cd backend
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```
A API estará disponível em `http://localhost:8000` (documentação interativa Swagger em `http://localhost:8000/docs`).

### 6.5. Inicialização do Frontend (React + Vite)

Em outro terminal, na raiz do repositório:

1. Configure a variável de ambiente do frontend (opcional, pois o padrão já é `http://localhost:8000`):
   ```bash
   cp .env.example .env
   ```
   Conteúdo de `.env`:
   ```env
   VITE_API_URL=http://localhost:8000
   ```

2. Instale os pacotes e inicie o servidor Vite:
   ```bash
   npm install
   npm run dev
   ```
3. Abra `http://localhost:5173` no navegador.

---

## 7. Como Verificar a API e Realizar uma Geração de Teste

### 7.1. Verificar se a API está funcionando (`GET /api/health`)

No terminal (ou navegador), execute:

```bash
curl http://localhost:8000/api/health
```

Resposta esperada (enquanto em modo `MOCK`):
```json
{
  "status": "ok",
  "model_loaded": false,
  "mode": "MOCK",
  "is_generating": false,
  "active_generation_id": null,
  "checkpoint_dir": ".../backend/checkpoints/gpt2-midi",
  "checkpoint_found": false,
  "tokenizer_config_found": false,
  "soundfont_found": false,
  "fluidsynth_available": false,
  "detail": "Operating in MOCK demonstration mode with local audio files..."
}
```

### 7.2. Realizar uma geração de teste via linha de comando

1. **Disparar uma nova geração (`POST /api/generate`):**
   ```bash
   curl -X POST http://localhost:8000/api/generate \
     -H "Content-Type: application/json" \
     -d "{}"
   ```
   Exemplo de retorno:
   ```json
   {
     "id": "gen-1763156000000-a1b2c3",
     "jobId": "gen-1763156000000-a1b2c3",
     "status": "pending",
     "mode": "MOCK",
     "is_mock": true,
     "message": "Composing something new..."
   }
   ```

2. **Consultar o status da geração (`GET /api/generations/{id}`):**
   ```bash
   curl http://localhost:8000/api/generations/gen-1763156000000-a1b2c3
   ```
   Quando `status` for `"completed"`, o JSON conterá o objeto `track` e `audio_url` (ex.: `"/api/tracks/nrf-mock-1a2b3/audio"`).

3. **Testar o stream do áudio gerado (`GET /api/tracks/{id}/audio`):**
   ```bash
   curl -I http://localhost:8000/api/tracks/nrf-mock-1a2b3/audio
   ```
   Retorna `HTTP/1.1 200 OK` com `Content-Type: audio/wav`.

---

## 8. Status da Integração do Modelo

> [!IMPORTANT]
> **Modo `MOCK` Ativo no Backend:** A estrutura completa da API (`FastAPI`), o controle de concorrência, o fluxo assíncrono em memória e a integração com o frontend React estão prontos e operacionais. A inferência definitiva do `GPT-2` e a decodificação `MidiTok` serão conectadas em `backend/model_service.py` após a análise do notebook de treinamento (identificando arquitetura exata, classe do tokenizador, vocabulário, tokens especiais e estratégia de amostragem).
