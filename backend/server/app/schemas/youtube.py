from pydantic import BaseModel, HttpUrl

class YouTubeRequest(BaseModel):
    url: HttpUrl
    segment_seconds: int = 60


class TranscriptSegment(BaseModel):
    start: float
    end: float
    text: str


class YouTubeResponse(BaseModel):
    video_id: str
    title: str
    description: str
    thumbnail: str
    segments: list[TranscriptSegment]


class YouTubeURL(BaseModel):
    url: HttpUrl

class SegmentedTranscriptRequest(BaseModel):
    url: HttpUrl
    segment_seconds: int = 60