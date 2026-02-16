from youtube_transcript_api import YouTubeTranscriptApi
from typing import List, Dict
from app.utils.transcript_merger import merge_segments
ytt_api = YouTubeTranscriptApi()

def get_raw_transcript(video_id: str):
    """Get raw transcript as a list"""
    fetched = ytt_api.fetch(video_id)
    
    # Convert FetchedTranscript object to list
    transcript = list(fetched)
    
    return transcript


def get_segmented_transcript(video_id: str, segment_seconds: int):
    """Get merged transcript segments"""
    # Fetch transcript
    fetched = ytt_api.fetch(video_id)
    
    # Convert to list - THIS IS THE KEY!
    transcript = list(fetched)
    
    print(f"✅ Fetched {len(transcript)} segments")
    
    if not transcript:
        raise ValueError("Empty transcript returned")
    
    # Now merge
    merged = merge_segments(transcript, window=segment_seconds)
    print(f"✅ Merged into {len(merged)} segments")
    
    return merged