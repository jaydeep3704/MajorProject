from fastapi import APIRouter, HTTPException
from app.schemas.youtube import YouTubeURL, SegmentedTranscriptRequest
from app.utils.video_id import extract_video_id
from app.services.youtube_metadata import get_video_metadata
from app.services.transcript_service import (
    get_raw_transcript,
    get_segmented_transcript
)

router = APIRouter(prefix="/youtube", tags=["YouTube"])


@router.post("/metadata")
def fetch_metadata(body: YouTubeURL):
    try:
        return get_video_metadata(str(body.url))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/transcript")
def fetch_transcript(body: YouTubeURL):
    video_id = extract_video_id(str(body.url))
    if not video_id:
        raise HTTPException(status_code=400, detail="Invalid YouTube URL")

    try:
        return {
            "video_id": video_id,
            "transcript": get_raw_transcript(video_id)
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
            "segments": get_segmented_transcript(
                video_id,
                body.segment_seconds
            )
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
