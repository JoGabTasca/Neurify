from __future__ import annotations

from typing import Literal, Optional
from pydantic import BaseModel, Field

GenerationStatusType = Literal["pending", "generating", "completed", "failed"]

GenerationPhaseType = Literal[
    "idle",
    "sampling_tokens",
    "decoding_midi",
    "synthesizing_audio",
    "ready",
    "error",
]

ArtworkPatternType = Literal[
    "harmonic-rings",
    "synaptic-mesh",
    "spectral-waves",
    "orbital-lattice",
    "tensor-grid",
]


class ArtworkDNASchema(BaseModel):
    seed: int
    pattern: ArtworkPatternType
    nodeCount: int
    waveFrequency: float
    harmonicRatio: float
    rotationSpeed: float
    ringCount: int
    accentIntensity: float
    symmetry: int


class TrackMetadataSchema(BaseModel):
    id: str
    sequenceNumber: int
    title: str
    subtitle: str
    audioUrl: str
    durationSeconds: float
    bpm: int
    musicalKey: str
    tokenCount: int
    temperature: float
    createdAt: str
    isMock: bool
    artwork: ArtworkDNASchema


class HealthResponse(BaseModel):
    status: Literal["ok"] = "ok"
    model_loaded: bool = Field(
        description="Whether the fine-tuned GPT-2 checkpoint and MidiTok tokenizer are loaded in memory."
    )
    mode: Literal["MOCK", "REAL"] = Field(
        description="Active execution mode. MOCK uses local demo audio until the real model is connected."
    )
    is_generating: bool = Field(
        description="Whether a generation job is currently executing."
    )
    active_generation_id: Optional[str] = None
    checkpoint_dir: str
    checkpoint_found: bool
    tokenizer_config_found: bool
    soundfont_found: bool
    fluidsynth_available: bool
    detail: str


class GenerateRequest(BaseModel):
    cancel_previous: bool = Field(
        default=False,
        description="If true, cancels any currently running generation before starting the new one.",
    )


class GenerateResponse(BaseModel):
    id: str = Field(description="Unique identifier of the generation job.")
    jobId: str = Field(description="Alias for id, used by the frontend client.")
    status: GenerationStatusType
    mode: Literal["MOCK", "REAL"]
    is_mock: bool
    message: str


class GenerationStatusResponseSchema(BaseModel):
    id: str
    jobId: str
    status: GenerationStatusType
    phase: GenerationPhaseType
    progress: float
    message: str
    mode: Literal["MOCK", "REAL"]
    is_mock: bool
    audio_url: Optional[str] = None
    track: Optional[TrackMetadataSchema] = None
    error: Optional[str] = None
