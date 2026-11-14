from __future__ import annotations

import os
from pathlib import Path

try:
    from dotenv import load_dotenv

    load_dotenv(Path(__file__).resolve().parent / ".env")
    load_dotenv(Path(__file__).resolve().parent.parent / ".env")
except ImportError:
    pass

BACKEND_DIR = Path(__file__).resolve().parent
REPO_ROOT = BACKEND_DIR.parent

# Server settings
HOST: str = os.getenv("NEURIFY_BACKEND_HOST", "127.0.0.1")
PORT: int = int(os.getenv("NEURIFY_BACKEND_PORT", "8000"))

# Execution mode:
# - "mock": Forces local demonstration mode using sample WAV files (clearly marked as MOCK)
# - "auto": Uses MOCK until the local checkpoint and notebook parameters are configured
# - "real": Requires valid local GPT-2 checkpoint, MidiTok config, and FluidSynth SoundFont
EXECUTION_MODE: str = os.getenv("NEURIFY_EXECUTION_MODE", "mock").strip().lower()

# Paths for local model artifacts and audio synthesis
CHECKPOINT_DIR: Path = Path(
    os.getenv("NEURIFY_CHECKPOINT_DIR", str(BACKEND_DIR / "checkpoints" / "gpt2-midi"))
).resolve()

TOKENIZER_CONFIG_PATH: Path = Path(
    os.getenv(
        "NEURIFY_TOKENIZER_CONFIG",
        str(CHECKPOINT_DIR / "tokenizer.json"),
    )
).resolve()

SOUNDFONT_PATH: Path = Path(
    os.getenv("NEURIFY_SOUNDFONT_PATH", str(BACKEND_DIR / "soundfonts" / "default.sf2"))
).resolve()

FLUIDSYNTH_BIN: str = os.getenv("NEURIFY_FLUIDSYNTH_BIN", "fluidsynth")

# Local demonstration audio directory (used while in MOCK mode)
DEMO_AUDIO_DIR: Path = Path(
    os.getenv("NEURIFY_DEMO_AUDIO_DIR", str(REPO_ROOT / "public" / "audio"))
).resolve()

# Allowed CORS origins (strictly local origins used by the React frontend)
_default_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:4173",
    "http://127.0.0.1:4173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
_env_origins = os.getenv("NEURIFY_CORS_ORIGINS", "")
CORS_ORIGINS: list[str] = (
    [origin.strip() for origin in _env_origins.split(",") if origin.strip()]
    if _env_origins.strip()
    else _default_origins
)
