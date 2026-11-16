from __future__ import annotations

import io
import logging
import random
import shutil
import subprocess
import tempfile
import threading
import time
import uuid
import wave
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional

from config import (
    CHECKPOINT_DIR,
    DEMO_AUDIO_DIR,
    EXECUTION_MODE,
    FLUIDSYNTH_BIN,
    MAX_NEW_TOKENS,
    PROMPTS_DIR,
    SOUNDFONT_PATH,
    TEMPERATURE,
    TOKENIZER_CONFIG_PATH,
    TOP_P,
)
from schemas import (
    ArtworkDNASchema,
    ArtworkPatternType,
    GenerationPhaseType,
    GenerationStatusResponseSchema,
    GenerationStatusType,
    HealthResponse,
    TrackMetadataSchema,
)

logger = logging.getLogger("neurify.model_service")

DEMO_CATALOG = [
    {"filename": "track-01.wav", "duration": 34.0, "bpm": 84, "key": "D Dorian"},
    {"filename": "track-02.wav", "duration": 38.0, "bpm": 96, "key": "F# Minor"},
    {"filename": "track-03.wav", "duration": 32.0, "bpm": 76, "key": "C Lydian"},
    {"filename": "track-04.wav", "duration": 36.0, "bpm": 90, "key": "A Aeolian"},
    {"filename": "track-05.wav", "duration": 40.0, "bpm": 80, "key": "E Minor"},
]

CURATED_TITLES = [
    "Echoes of Tomorrow",
    "Nocturne in Latent Space",
    "Velvet Synapse",
    "Glass Meridian",
    "Subtle Architecture",
    "Weightless Sequence",
    "Harmonic Drift",
    "Silent Tensor",
    "Ephemeral Weights",
    "Liminal Resonance",
    "Obsidian Harmonics",
    "Aether & Attention",
    "Chromatic Memory",
    "Parallel Cadence",
]

TITLE_ADJECTIVES = [
    "Latent",
    "Synaptic",
    "Crystalline",
    "Nocturnal",
    "Quiet",
    "Orbital",
    "Tessellated",
    "Residual",
    "Modular",
    "Distant",
]

TITLE_NOUNS = [
    "Solitude",
    "Trajectory",
    "Continuum",
    "Reflections",
    "Prelude",
    "Topology",
    "Equilibrium",
    "Horizon",
    "Harmonics",
    "Monolith",
]

PATTERNS: List[ArtworkPatternType] = [
    "harmonic-rings",
    "synaptic-mesh",
    "spectral-waves",
    "orbital-lattice",
    "tensor-grid",
]


def _seeded_random(seed: int):
    state = seed % 2147483647
    if state <= 0:
        state += 2147483646

    def _next() -> float:
        nonlocal state
        state = (state * 16807) % 2147483647
        return (state - 1) / 2147483646

    return _next


def _build_artwork_dna(seed: int, sequence_index: int) -> ArtworkDNASchema:
    rand = _seeded_random(seed)
    pattern = PATTERNS[sequence_index % len(PATTERNS)]
    return ArtworkDNASchema(
        seed=seed,
        pattern=pattern,
        nodeCount=16 + int(rand() * 20),
        waveFrequency=round(1.5 + rand() * 3.5, 4),
        harmonicRatio=round(1.2 + rand() * 2.4, 4),
        rotationSpeed=round(0.12 + rand() * 0.25, 4),
        ringCount=5 + int(rand() * 7),
        accentIntensity=round(0.65 + rand() * 0.35, 4),
        symmetry=3 + int(rand() * 6),
    )


def _read_wav_duration_bytes(audio_bytes: bytes, fallback: float = 35.0) -> float:
    try:
        with wave.open(io.BytesIO(audio_bytes), "rb") as wf:
            frames = wf.getnframes()
            rate = wf.getframerate()
            if rate > 0:
                return round(frames / float(rate), 2)
    except Exception:
        pass
    return fallback


class GenerationConflictError(Exception):
    """Raised when a new generation is requested while another is already running."""


class GenerationCancelledError(Exception):
    """Internal signal raised when an active generation job is cancelled."""


@dataclass
class GenerationJob:
    id: str
    status: GenerationStatusType = "pending"
    phase: GenerationPhaseType = "idle"
    progress: float = 0.08
    message: str = "Initializing generation pipeline..."
    mode: str = "MOCK"
    is_mock: bool = True
    audio_url: Optional[str] = None
    track: Optional[TrackMetadataSchema] = None
    error: Optional[str] = None
    cancel_event: threading.Event = field(default_factory=threading.Event)
    # Filled during real generation
    generated_tokens: int = 0
    prompt_source: Optional[str] = None
    bpm: int = 120


class ModelService:
    """
    Decoupled service layer for GPT-2 symbolic music generation, MidiTok decoding,
    and FluidSynth audio synthesis.

    Ephemeral playback design ("The music can be only played once"):
      - Generated MIDI and synthesized WAV files are never persisted on disk.
      - Only the current active composition is held in memory while playing; starting
        a new generation immediately discards the previous track's audio buffer.

    Real mode uses the model saved by the training notebook (MIDI_AP2_GPT2_Chrono_Trigger):
      - GPT-2 124M pre-trained on text, with a new 484-row token table, fine-tuned in two
        phases on Chrono Trigger MIDIs (folder gpt2_pretreinado, Hugging Face format);
      - MidiTok 3.1.0 REMI tokenizer (num_velocities=16, use_chords=True, use_programs=True),
        loaded from the tokenizer.json saved next to the weights;
      - the notebook's sampling: start from the first two bars of a song (or an empty bar),
        512 new tokens, temperature 0.9, top-p 0.95, special tokens suppressed.
    Without those files the service runs in a clearly identified MOCK mode with local WAVs.
    """

    def __init__(self) -> None:
        self._state_lock = threading.Lock()
        self._executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="neurify-worker")

        self.model = None
        self.tokenizer = None
        self.device: str = "cpu"
        self.model_loaded: bool = False
        self.mode: str = "MOCK"
        self.status_detail: str = "Not initialized."

        self._active_job_id: Optional[str] = None
        self._jobs: Dict[str, GenerationJob] = {}

        # Ephemeral single-track memory store (discarded whenever a new track is generated)
        self._current_track: Optional[TrackMetadataSchema] = None
        self._current_audio_bytes: Optional[bytes] = None

        self._sequence_counter: int = 0
        self._last_demo_index: int = -1

        # Filled by _load_real_model()
        self._special_ids: List[int] = []
        self._bar_id: Optional[int] = None
        self._empty_bar: List[int] = []
        self._prompt_files: List[Path] = []
        self._context_size: int = 1024

    def initialize(self) -> None:
        """
        Called once during FastAPI startup (lifespan).
        Loads the notebook's model when every artifact is present; otherwise stays in MOCK.
        """
        CHECKPOINT_DIR.mkdir(parents=True, exist_ok=True)
        SOUNDFONT_PATH.parent.mkdir(parents=True, exist_ok=True)

        if EXECUTION_MODE == "mock":
            self._set_mock("MOCK mode forced by NEURIFY_EXECUTION_MODE=mock.")
            return

        missing = []
        if not self._has_checkpoint_files():
            missing.append(f"GPT-2 weights in {CHECKPOINT_DIR}")
        if not TOKENIZER_CONFIG_PATH.is_file():
            missing.append(f"MidiTok tokenizer.json at {TOKENIZER_CONFIG_PATH}")
        if not SOUNDFONT_PATH.is_file():
            missing.append(f"SoundFont at {SOUNDFONT_PATH}")
        if not self._is_fluidsynth_available():
            missing.append(f"FluidSynth binary '{FLUIDSYNTH_BIN}' in PATH")

        if missing:
            message = "Missing: " + "; ".join(missing) + "."
            if EXECUTION_MODE == "real":
                raise RuntimeError(f"NEURIFY_EXECUTION_MODE=real but real mode cannot start. {message}")
            self._set_mock(f"Operating in MOCK demonstration mode with local audio files. {message}")
            return

        try:
            self._load_real_model()
        except Exception as exc:
            if EXECUTION_MODE == "real":
                raise
            logger.exception("Could not load the real model: %s", exc)
            self._set_mock(f"Operating in MOCK mode: the real model failed to load ({exc}).")
            return

        self.model_loaded = True
        self.mode = "REAL"
        prompts = (
            f"{len(self._prompt_files)} prompt MIDI file(s) in {PROMPTS_DIR}"
            if self._prompt_files
            else "no prompt MIDIs, generation starts from an empty 4/4 bar"
        )
        self.status_detail = (
            f"GPT-2 fine-tuned checkpoint loaded on {self.device} "
            f"(vocabulary {len(self.tokenizer)} tokens, {prompts}; "
            f"{MAX_NEW_TOKENS} new tokens, temperature {TEMPERATURE}, top-p {TOP_P})."
        )
        logger.info("[REAL MODE] %s", self.status_detail)

    def _set_mock(self, detail: str) -> None:
        self.model_loaded = False
        self.mode = "MOCK"
        self.status_detail = detail
        logger.info("[MOCK MODE] %s", detail)

    def _load_real_model(self) -> None:
        """Loads the GPT-2 checkpoint and the MidiTok tokenizer saved by the training notebook."""
        import torch
        from miditok import REMI
        from transformers import GPT2LMHeadModel

        tokenizer = REMI(params=TOKENIZER_CONFIG_PATH)
        model = GPT2LMHeadModel.from_pretrained(CHECKPOINT_DIR)
        if model.config.vocab_size != len(tokenizer):
            raise ValueError(
                f"Checkpoint vocabulary ({model.config.vocab_size}) does not match "
                f"tokenizer.json ({len(tokenizer)}). Use the tokenizer saved with this model."
            )

        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        model.to(self.device).eval()

        self.model = model
        self.tokenizer = tokenizer
        self._context_size = int(model.config.n_positions)
        # PAD, BOS, EOS and MASK never appear in the training blocks, so they are never sampled
        self._special_ids = list(tokenizer.special_tokens_ids)
        self._bar_id = tokenizer["Bar_None"]
        self._empty_bar = [self._bar_id]
        if "TimeSig_4/4" in tokenizer.vocab:
            self._empty_bar.append(tokenizer["TimeSig_4/4"])
        self._prompt_files = sorted(
            p for p in PROMPTS_DIR.glob("*") if p.suffix.lower() in (".mid", ".midi")
        ) if PROMPTS_DIR.is_dir() else []

    def shutdown(self) -> None:
        """Cleanly shuts down the background inference worker and clears ephemeral audio."""
        with self._state_lock:
            if self._active_job_id and self._active_job_id in self._jobs:
                self._jobs[self._active_job_id].cancel_event.set()
            self._current_track = None
            self._current_audio_bytes = None
        self._executor.shutdown(wait=False, cancel_futures=True)

    def _has_checkpoint_files(self) -> bool:
        if not CHECKPOINT_DIR.is_dir():
            return False
        weight_patterns = ("*.safetensors", "*.bin", "*.pt", "*.pth")
        for pattern in weight_patterns:
            if any(CHECKPOINT_DIR.glob(pattern)):
                return True
        return False

    def _is_fluidsynth_available(self) -> bool:
        return shutil.which(FLUIDSYNTH_BIN) is not None

    def get_health(self) -> HealthResponse:
        with self._state_lock:
            active_id = self._active_job_id
            is_gen = active_id is not None

        return HealthResponse(
            status="ok",
            model_loaded=self.model_loaded,
            mode="REAL" if self.model_loaded else "MOCK",
            is_generating=is_gen,
            active_generation_id=active_id,
            checkpoint_dir=str(CHECKPOINT_DIR),
            checkpoint_found=self._has_checkpoint_files(),
            tokenizer_config_found=TOKENIZER_CONFIG_PATH.is_file(),
            soundfont_found=SOUNDFONT_PATH.is_file(),
            fluidsynth_available=self._is_fluidsynth_available(),
            detail=self.status_detail,
        )

    def start_generation(self, cancel_previous: bool = False) -> GenerationJob:
        """
        Enqueues a new music generation job if no other job is active.
        Enforces single-execution concurrency control and discards the previous ephemeral track.
        """
        with self._state_lock:
            if self._active_job_id is not None:
                active_job = self._jobs.get(self._active_job_id)
                if active_job and active_job.status in ("pending", "generating"):
                    if cancel_previous:
                        logger.info(
                            "Cancelling previous active generation %s to start a new one.",
                            active_job.id,
                        )
                        active_job.cancel_event.set()
                        active_job.status = "failed"
                        active_job.phase = "error"
                        active_job.error = "Generation superseded by a new request."
                        self._active_job_id = None
                    else:
                        raise GenerationConflictError(
                            f"A generation is already in progress ({active_job.id}). "
                            "Only one generation can run at a time."
                        )

            # Discard the previous track from memory so it can only ever be heard once
            self._current_track = None
            self._current_audio_bytes = None
            self._jobs.clear()

            job_id = f"gen-{int(time.time() * 1000)}-{uuid.uuid4().hex[:6]}"
            current_mode = "REAL" if self.model_loaded else "MOCK"
            job = GenerationJob(
                id=job_id,
                status="pending",
                phase="idle",
                progress=0.08,
                message="Composing something new...",
                mode=current_mode,
                is_mock=not self.model_loaded,
            )
            self._jobs[job_id] = job
            self._active_job_id = job_id

        # Submit the pipeline to run outside the main FastAPI event loop thread
        self._executor.submit(self._execute_generation_pipeline, job_id)
        return job

    def cancel_generation(self, job_id: str) -> Optional[GenerationStatusResponseSchema]:
        """Cancels a running or pending generation and releases the active concurrency slot."""
        with self._state_lock:
            job = self._jobs.get(job_id)
            if not job:
                return None

            if job.status in ("pending", "generating"):
                job.cancel_event.set()
                job.status = "failed"
                job.phase = "error"
                job.message = "Generation cancelled"
                job.error = "Generation was cancelled by the client."
                if self._active_job_id == job_id:
                    self._active_job_id = None

            return self._job_to_schema(job)

    def get_generation_status(self, job_id: str) -> Optional[GenerationStatusResponseSchema]:
        with self._state_lock:
            job = self._jobs.get(job_id)
            if not job:
                return None
            return self._job_to_schema(job)

    def get_track_metadata(self, track_id: str) -> Optional[TrackMetadataSchema]:
        with self._state_lock:
            if self._current_track and self._current_track.id == track_id:
                return self._current_track
            job = self._jobs.get(track_id)
            if job and job.track:
                return job.track
            return None

    def get_track_audio_bytes(self, track_or_job_id: str) -> Optional[bytes]:
        with self._state_lock:
            if self._current_track and self._current_audio_bytes:
                if track_or_job_id == self._current_track.id:
                    return self._current_audio_bytes
                job = self._jobs.get(track_or_job_id)
                if job and job.track and job.track.id == self._current_track.id:
                    return self._current_audio_bytes
        return None

    def _job_to_schema(self, job: GenerationJob) -> GenerationStatusResponseSchema:
        return GenerationStatusResponseSchema(
            id=job.id,
            jobId=job.id,
            status=job.status,
            phase=job.phase,
            progress=job.progress,
            message=job.message,
            mode="REAL" if not job.is_mock else "MOCK",
            is_mock=job.is_mock,
            audio_url=job.audio_url,
            track=job.track,
            error=job.error,
        )

    def _update_job(
        self,
        job: GenerationJob,
        *,
        status: Optional[GenerationStatusType] = None,
        phase: Optional[GenerationPhaseType] = None,
        progress: Optional[float] = None,
        message: Optional[str] = None,
    ) -> None:
        with self._state_lock:
            if job.cancel_event.is_set():
                raise GenerationCancelledError()
            if status is not None:
                job.status = status
            if phase is not None:
                job.phase = phase
            if progress is not None:
                job.progress = progress
            if message is not None:
                job.message = message

    def _sleep_interruptible(self, job: GenerationJob, duration_sec: float) -> None:
        if job.cancel_event.wait(timeout=duration_sec):
            raise GenerationCancelledError()

    def _execute_generation_pipeline(self, job_id: str) -> None:
        """
        Executes the 6-step music generation workflow in a background worker thread:
          1. Receive request
          2. Execute GPT-2 inference (token sampling)
          3. Decode tokens using MidiTok
          4. Generate a valid MIDI in temporary storage
          5. Synthesize MIDI to WAV audio via FluidSynth into memory (deleting temp files)
          6. Expose ephemeral audio URL and track metadata to the frontend player
        """
        with self._state_lock:
            job = self._jobs.get(job_id)
            if not job or job.cancel_event.is_set():
                if self._active_job_id == job_id:
                    self._active_job_id = None
                return

        try:
            # Stage 1 & 2: GPT-2 Token Sampling
            self._update_job(
                job,
                status="generating",
                phase="sampling_tokens",
                progress=0.28,
                message="Composing something new...",
            )
            tokens = self._step_generate_tokens(job)

            # Stage 3 & 4: MidiTok Sequence Decoding -> Valid MIDI Bytes
            self._update_job(
                job,
                status="generating",
                phase="decoding_midi",
                progress=0.64,
                message="Connecting neural patterns...",
            )
            midi_bytes = self._step_decode_tokens_to_midi(job, tokens)

            # Stage 5: Audio Synthesis (FluidSynth / Local Demo WAV in MOCK mode)
            self._update_job(
                job,
                status="generating",
                phase="synthesizing_audio",
                progress=0.92,
                message="Your next sound is taking shape...",
            )
            track, audio_bytes = self._step_synthesize_audio(job, midi_bytes, len(tokens))

            # Stage 6: Make ephemeral track and audio buffer available to the player
            with self._state_lock:
                if job.cancel_event.is_set():
                    raise GenerationCancelledError()

                self._current_track = track
                self._current_audio_bytes = audio_bytes
                job.track = track
                job.audio_url = track.audioUrl
                job.status = "completed"
                job.phase = "ready"
                job.progress = 1.0
                job.message = "Composition ready"

                if self._active_job_id == job_id:
                    self._active_job_id = None

            logger.info(
                "Generation %s completed (%s mode) -> ephemeral track %s (%d bytes in memory)",
                job_id,
                job.mode,
                track.id,
                len(audio_bytes),
            )

        except GenerationCancelledError:
            logger.info("Generation %s was cancelled.", job_id)
            with self._state_lock:
                job.status = "failed"
                job.phase = "error"
                job.error = job.error or "Generation cancelled."
                if self._active_job_id == job_id:
                    self._active_job_id = None

        except Exception as exc:
            logger.exception("Generation %s failed: %s", job_id, exc)
            with self._state_lock:
                job.status = "failed"
                job.phase = "error"
                job.message = "Generation failed"
                job.error = str(exc)
                if self._active_job_id == job_id:
                    self._active_job_id = None

    def _step_generate_tokens(self, job: GenerationJob) -> List[int]:
        """
        Step 2: GPT-2 autoregressive token generation.
        In MOCK mode, simulates the inference latency and returns a synthetic token sequence length.
        """
        if not self.model_loaded:
            self._sleep_interruptible(job, 0.68)
            seed = int(time.time() * 1000) % 1000000
            rand = _seeded_random(seed)
            simulated_len = 512 + int(rand() * 512)
            return [0] * simulated_len

        import torch
        from transformers import StoppingCriteria, StoppingCriteriaList

        class _StopWhenCancelled(StoppingCriteria):
            def __call__(self, input_ids, scores, **kwargs) -> bool:
                return job.cancel_event.is_set()

        prompt, source, prompt_is_music = self._build_prompt()
        max_new = max(1, min(MAX_NEW_TOKENS, self._context_size - len(prompt)))
        inputs = torch.tensor([prompt], dtype=torch.long, device=self.device)

        with torch.no_grad():
            output = self.model.generate(
                inputs,
                attention_mask=torch.ones_like(inputs),
                max_new_tokens=max_new,
                do_sample=True,
                temperature=TEMPERATURE,
                top_p=TOP_P,
                suppress_tokens=self._special_ids,
                pad_token_id=self.tokenizer.pad_token_id,
                stopping_criteria=StoppingCriteriaList([_StopWhenCancelled()]),
            )
        if job.cancel_event.is_set():
            raise GenerationCancelledError()

        new_tokens = output[0, len(prompt):].tolist()
        job.generated_tokens = len(new_tokens)
        job.prompt_source = source

        if not prompt_is_music:
            # The empty bar has no notes, so it is kept as the start of the piece
            return prompt + new_tokens
        # The prompt bars come from a real song, so only the model's continuation is played.
        # The prompt ends right before a bar line, so the continuation normally starts a bar.
        if new_tokens and new_tokens[0] != self._bar_id:
            new_tokens = self._empty_bar + new_tokens
        return new_tokens

    def _build_prompt(self) -> tuple[List[int], Optional[str], bool]:
        """
        Same rule as the training notebook: the tokens of a song up to its third bar line
        (its first two bars). Without prompt MIDIs, an empty 4/4 bar.
        """
        files = list(self._prompt_files)
        random.shuffle(files)
        limit = max(1, self._context_size - MAX_NEW_TOKENS)
        for path in files:
            try:
                ids = self._tokenize_file(path)
            except Exception as exc:
                logger.warning("Skipping prompt %s: %s", path.name, exc)
                continue
            bar_starts = [i for i, t in enumerate(ids) if t == self._bar_id]
            end = bar_starts[2] if len(bar_starts) > 2 else min(len(ids), 64)
            prompt = ids[: min(end, limit)]
            if prompt:
                return prompt, path.stem, True
        return list(self._empty_bar), None, False

    def _tokenize_file(self, path: Path) -> List[int]:
        seq = self.tokenizer(path)
        if isinstance(seq, list):  # only happens with one sequence per track
            return [i for s in seq for i in s.ids]
        return list(seq.ids)

    def _step_decode_tokens_to_midi(
        self, job: GenerationJob, tokens: List[int]
    ) -> Optional[bytes]:
        """
        Steps 3 & 4: Decode generated token IDs via MidiTok/Symusic into MIDI bytes.
        In MOCK mode, simulates decoding latency without inventing a MidiTok tokenizer config.
        """
        if not self.model_loaded:
            self._sleep_interruptible(job, 0.72)
            return None

        score = self.tokenizer.decode(tokens)
        if sum(len(track.notes) for track in score.tracks) == 0:
            raise RuntimeError("The generated tokens did not contain any notes.")
        if len(score.tempos) > 0:
            job.bpm = int(round(getattr(score.tempos[0], "qpm", 120)))

        with tempfile.TemporaryDirectory(prefix="neurify-ephemeral-") as tmp_dir:
            midi_path = Path(tmp_dir) / "composition.mid"
            score.dump_midi(str(midi_path))
            return midi_path.read_bytes()

    def _step_synthesize_audio(
        self,
        job: GenerationJob,
        midi_bytes: Optional[bytes],
        token_count: int,
    ) -> tuple[TrackMetadataSchema, bytes]:
        """
        Step 5: Convert MIDI bytes into WAV audio bytes in memory using FluidSynth
        and a self-cleaning TemporaryDirectory, or load a local demo WAV in MOCK mode.
        """
        if not self.model_loaded:
            self._sleep_interruptible(job, 0.65)
            return self._create_mock_track_and_audio(token_count)

        if not midi_bytes:
            raise RuntimeError("MIDI data was not generated prior to audio synthesis.")

        track_id = f"nrf-{uuid.uuid4().hex[:6]}"
        audio_bytes = self.synthesize_midi_bytes_with_fluidsynth(midi_bytes)

        with self._state_lock:
            seq = self._sequence_counter
            self._sequence_counter += 1

        seed = (int(time.time() * 1000) % 1000000) + seq * 7919
        duration = _read_wav_duration_bytes(audio_bytes, fallback=35.0)
        title = self._pick_title(seq, seed)
        subtitle = "GPT-2 fine-tuned · Chrono Trigger style"
        if job.prompt_source:
            subtitle += f" · starts after 2 bars of {job.prompt_source}"

        track = TrackMetadataSchema(
            id=track_id,
            sequenceNumber=seq + 1,
            title=title,
            subtitle=subtitle,
            audioUrl=f"/api/tracks/{track_id}/audio",
            durationSeconds=duration,
            bpm=job.bpm,
            musicalKey="N/A",
            tokenCount=job.generated_tokens or token_count,
            temperature=TEMPERATURE,
            createdAt=datetime.now(timezone.utc).isoformat(),
            isMock=False,
            artwork=_build_artwork_dna(seed, seq),
        )
        return track, audio_bytes

    def synthesize_midi_bytes_with_fluidsynth(self, midi_bytes: bytes) -> bytes:
        """
        Synthesizes MIDI bytes into WAV bytes using FluidSynth inside a TemporaryDirectory.
        All temporary files (.mid and .wav) are automatically deleted immediately after synthesis.
        """
        if not SOUNDFONT_PATH.is_file():
            raise FileNotFoundError(
                f"SoundFont file not found at '{SOUNDFONT_PATH}'. "
                "Configure NEURIFY_SOUNDFONT_PATH with a valid .sf2 file."
            )
        if not self._is_fluidsynth_available():
            raise RuntimeError(
                f"FluidSynth binary '{FLUIDSYNTH_BIN}' was not found in PATH."
            )

        with tempfile.TemporaryDirectory(prefix="neurify-ephemeral-") as tmp_dir:
            tmp_path = Path(tmp_dir)
            midi_path = tmp_path / "composition.mid"
            wav_path = tmp_path / "composition.wav"
            midi_path.write_bytes(midi_bytes)

            cmd = [
                FLUIDSYNTH_BIN,
                "-ni",
                "-F",
                str(wav_path),
                "-r",
                "44100",
                # FluidSynth 2.6+ only accepts options before the SoundFont and MIDI files
                str(SOUNDFONT_PATH),
                str(midi_path),
            ]
            result = subprocess.run(cmd, capture_output=True, text=True, check=False)
            if result.returncode != 0 or not wav_path.is_file():
                stderr_msg = (
                    result.stderr or result.stdout or "Unknown FluidSynth error"
                ).strip()
                raise RuntimeError(f"FluidSynth synthesis failed: {stderr_msg}")

            return wav_path.read_bytes()

    def _create_mock_track_and_audio(
        self, token_count: int
    ) -> tuple[TrackMetadataSchema, bytes]:
        """
        Creates a clearly identified MOCK track backed by local demonstration WAV bytes
        held strictly in memory for the current playback session.
        """
        with self._state_lock:
            seq = self._sequence_counter
            self._sequence_counter += 1

            demo_index = seq % len(DEMO_CATALOG)
            if demo_index == self._last_demo_index:
                demo_index = (demo_index + 1) % len(DEMO_CATALOG)
            self._last_demo_index = demo_index

        sample = DEMO_CATALOG[demo_index]
        source_wav = DEMO_AUDIO_DIR / str(sample["filename"])
        if not source_wav.is_file():
            raise FileNotFoundError(
                f"Local demonstration audio file not found at '{source_wav}'."
            )

        audio_bytes = source_wav.read_bytes()
        seed = (int(time.time() * 1000) % 1000000) + seq * 7919
        rand = _seeded_random(seed)
        track_id = f"nrf-mock-{(seed % 0xFFFFF):05x}"

        duration = _read_wav_duration_bytes(
            audio_bytes, fallback=float(sample["duration"])
        )
        title = self._pick_title(seq, seed)
        temperature = round(0.82 + rand() * 0.26, 2)

        track = TrackMetadataSchema(
            id=track_id,
            sequenceNumber=seq + 1,
            title=title,
            subtitle="[MOCK] Local demo audio · Awaiting GPT-2 checkpoint",
            audioUrl=f"/api/tracks/{track_id}/audio",
            durationSeconds=duration,
            bpm=int(sample["bpm"]),
            musicalKey=str(sample["key"]),
            tokenCount=token_count,
            temperature=temperature,
            createdAt=datetime.now(timezone.utc).isoformat(),
            isMock=True,
            artwork=_build_artwork_dna(seed, seq),
        )
        return track, audio_bytes

    def _pick_title(self, seq: int, seed: int) -> str:
        if seq < len(CURATED_TITLES):
            return CURATED_TITLES[seq]
        rand = _seeded_random(seed)
        adj = TITLE_ADJECTIVES[int(rand() * len(TITLE_ADJECTIVES))]
        noun = TITLE_NOUNS[int(rand() * len(TITLE_NOUNS))]
        return f"{adj} {noun}"


model_service = ModelService()
