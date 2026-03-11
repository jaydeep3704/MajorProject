from pydantic import BaseModel, HttpUrl
from typing import List
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

class Segment(BaseModel):
    start: float
    end: float
    text: str

class Metadata(BaseModel):
    title: str
    description: str
    

class TranscriptRequest(BaseModel):
    transcriptSegments: List[Segment]
    metadata:Metadata