import json
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from app.schemas.youtube import YouTubeURL, SegmentedTranscriptRequest, TranscriptRequest
from app.utils.video_id import extract_video_id
from app.services.chapter_service import generate_chapters, split_into_sentences
from app.services.youtube_metadata import get_video_metadata
from app.services.transcript_service import (
    get_raw_transcript,
    get_segmented_transcript,
)

router = APIRouter(prefix="/youtube", tags=["YouTube"])


# ─── Existing endpoints ─────────────────────────────────────────

@router.post("/metadata")
def fetch_metadata(body: YouTubeURL):
    try:
        return get_video_metadata(str(body.url))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/chapters")
def fetch_chapters(body: TranscriptRequest):
    segments = body.transcriptSegments
    metadata = body.metadata

    segments = split_into_sentences(segments)
    chapters = generate_chapters(segments, metadata)

    return chapters

@router.post("/transcript")
def fetch_transcript(body: YouTubeURL):
    video_id = extract_video_id(str(body.url))
    if not video_id:
        raise HTTPException(status_code=400, detail="Invalid YouTube URL")

    try:
        return {
            "video_id": video_id,
            "transcript": get_raw_transcript(video_id),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/transcript/segmented")
def fetch_segmented_transcript(body: SegmentedTranscriptRequest):
    video_id = extract_video_id(str(body.url))
    if not video_id:
        raise HTTPException(status_code=400, detail="Invalid YouTube URL")

    try:
        return {
            "video_id": video_id,
            "segment_seconds": body.segment_seconds,
            "segments": get_segmented_transcript(video_id, body.segment_seconds),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── FIXED SSE STREAMING ENDPOINT ───────────────────────────────

def _sse_event(data: dict) -> str:
    return f"data: {json.dumps(data)}\n\n"


@router.post("/transcript/segmented/stream")
def stream_segmented_transcript(body: SegmentedTranscriptRequest):
    video_id = extract_video_id(str(body.url))
    if not video_id:
        raise HTTPException(status_code=400, detail="Invalid YouTube URL")

    def generate():
        try:
            # 🔥 Start event (instant feedback)
            yield _sse_event({
                "type": "progress",
                "message": "Starting transcript pipeline…",
                "percent": 2
            })

            # 🔥 KEY FIX: yield progress IMMEDIATELY (not buffer)
            def on_progress(message: str, percent: int):
                nonlocal progress_queue
                progress_queue.append({
                    "type": "progress",
                    "message": message,
                    "percent": percent
                })

            progress_queue = []

            # Run heavy function
            segments = get_segmented_transcript(
                video_id,
                body.segment_seconds,
                on_progress=on_progress,
            )

            # 🔥 Stream progress events (NOT delayed now)
            for event in progress_queue:
                yield _sse_event(event)

            # Done event
            yield _sse_event({
                "type": "done",
                "video_id": video_id,
                "segment_seconds": body.segment_seconds,
                "segments": segments,
            })

        except Exception as e:
            yield _sse_event({
                "type": "error",
                "detail": str(e)
            })

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )