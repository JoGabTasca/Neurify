from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import Optional

import uvicorn
from fastapi import Body, FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

from config import CORS_ORIGINS, HOST, PORT
from model_service import GenerationConflictError, model_service
from schemas import (
    GenerateRequest,
    GenerateResponse,
    GenerationStatusResponseSchema,
    HealthResponse,
    TrackMetadataSchema,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)
logger = logging.getLogger("neurify.api")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    logger.info("Starting Neurify Local Backend...")
    model_service.initialize()
    yield
    logger.info("Shutting down Neurify Local Backend...")
    model_service.shutdown()


app = FastAPI(
    title="Neurify Local Backend API",
    description=(
        "Local Python/FastAPI backend for Neurify (IBMEC — Redes Neurais e Deep Learning). "
        "Executes fine-tuned GPT-2 symbolic music generation, MidiTok decoding, and "
        "FluidSynth audio synthesis in memory (ephemeral single-play tracks), with a "
        "clearly identified MOCK demonstration mode until the real training checkpoint is connected."
    ),
    version="0.1.0",
    lifespan=lifespan,
)

# Restrict CORS exclusively to local origins used by the React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Accept", "Range"],
    expose_headers=["Content-Range", "Accept-Ranges", "Content-Length", "Content-Type"],
)


@app.get(
    "/api/health",
    response_model=HealthResponse,
    summary="Check server health and model readiness",
)
def get_health() -> HealthResponse:
    """Returns the server status, execution mode (MOCK or REAL), and whether the GPT-2 model is loaded."""
    return model_service.get_health()


@app.post(
    "/api/generate",
    response_model=GenerateResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Start generating a new original musical composition",
)
def post_generate(
    payload: Optional[GenerateRequest] = Body(default=None),
) -> GenerateResponse:
    """
    Initiates a new composition generation outside the main API thread.
    Enforces a single concurrent generation limit for local execution and discards the previous track.
    """
    cancel_previous = payload.cancel_previous if payload is not None else False
    try:
        job = model_service.start_generation(cancel_previous=cancel_previous)
    except GenerationConflictError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc

    return GenerateResponse(
        id=job.id,
        jobId=job.id,
        status=job.status,
        mode="REAL" if not job.is_mock else "MOCK",
        is_mock=job.is_mock,
        message=job.message,
    )


@app.get(
    "/api/generations/{generation_id}",
    response_model=GenerationStatusResponseSchema,
    summary="Get the status and metadata of a generation job",
)
def get_generation_status(generation_id: str) -> GenerationStatusResponseSchema:
    """
    Returns the status of the generation (`pending`, `generating`, `completed`, `failed`),
    along with progress details, track metadata, and audio URL when completed.
    """
    result = model_service.get_generation_status(generation_id)
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Generation '{generation_id}' not found.",
        )
    return result


@app.delete(
    "/api/generations/{generation_id}",
    response_model=GenerationStatusResponseSchema,
    summary="Cancel an active generation job",
)
def cancel_generation(generation_id: str) -> GenerationStatusResponseSchema:
    """Cancels an in-progress generation and frees the single-execution concurrency slot."""
    result = model_service.cancel_generation(generation_id)
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Generation '{generation_id}' not found.",
        )
    return result


@app.get(
    "/api/tracks/{track_id}",
    response_model=TrackMetadataSchema,
    summary="Get metadata for the active generated track",
)
def get_track_metadata(track_id: str) -> TrackMetadataSchema:
    track = model_service.get_track_metadata(track_id)
    if track is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Track '{track_id}' not found or has already expired.",
        )
    return track


@app.get(
    "/api/tracks/{track_id}/audio",
    summary="Stream the ephemeral audio buffer for the active track",
)
def get_track_audio(track_id: str, request: Request) -> Response:
    """
    Serves the active WAV audio directly from memory (with HTTP Range support for seeking).
    Once a new track is generated, previous track IDs expire and return 404.
    """
    audio_bytes = model_service.get_track_audio_bytes(track_id)
    if audio_bytes is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Audio for track '{track_id}' not found or has already expired (single-play only).",
        )

    total_size = len(audio_bytes)
    range_header = request.headers.get("range")

    base_headers = {
        "Accept-Ranges": "bytes",
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    }

    if range_header and range_header.startswith("bytes="):
        try:
            range_spec = range_header.replace("bytes=", "").split(",")[0].strip()
            start_str, end_str = range_spec.split("-")
            start = int(start_str) if start_str else 0
            end = int(end_str) if end_str else total_size - 1
            end = min(end, total_size - 1)

            if 0 <= start <= end < total_size:
                chunk = audio_bytes[start : end + 1]
                headers = {
                    **base_headers,
                    "Content-Range": f"bytes {start}-{end}/{total_size}",
                    "Content-Length": str(len(chunk)),
                }
                return Response(
                    content=chunk,
                    status_code=status.HTTP_206_PARTIAL_CONTENT,
                    media_type="audio/wav",
                    headers=headers,
                )
        except ValueError:
            pass

    headers = {
        **base_headers,
        "Content-Length": str(total_size),
    }
    return Response(
        content=audio_bytes,
        status_code=status.HTTP_200_OK,
        media_type="audio/wav",
        headers=headers,
    )


if __name__ == "__main__":
    uvicorn.run("main:app", host=HOST, port=PORT, reload=True)
