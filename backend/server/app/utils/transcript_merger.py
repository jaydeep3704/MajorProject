from youtube_transcript_api import YouTubeTranscriptApi
from typing import List, Dict
from .filler_words import FILLER_WORDS
import re

ytt_api = YouTubeTranscriptApi()




def normalize_transcript_text(text: str) -> str:
    """Normalize transcript text for classical NLP segmentation"""

    # Remove bracketed content [music], [applause]
    text = re.sub(r'\[.*?\]', '', text)
    # Lowercase
    text = text.lower()
    # Remove filler words
    for word in FILLER_WORDS:
        text = re.sub(rf'\b{word}\b', '', text)
    # Normalize numbers (optional)
    text = re.sub(r'\d+', ' NUM ', text)
    # Remove extra punctuation but keep sentence boundaries
    text = re.sub(r'[^\w\s\.\!\?]', '', text)
    # Remove extra spaces
    text = re.sub(r'\s+', ' ', text).strip()
    return text

def format_transcript_with_punctuation(text: str) -> str:
    """Add basic punctuation and capitalization"""
    if text:
        text = text[0].upper() + text[1:]
    
    if text and text[-1] not in '.!?':
        text += '.'
    
    text = re.sub(r'(\. )([a-z])', lambda m: m.group(1) + m.group(2).upper(), text)
    
    return text

def merge_segments(segments: List, window: int = 60) -> List[Dict]:
    """Merge transcript segments into time-based windows"""
    if not segments:
        return []
    
    merged = []
    bucket = []
    bucket_start = segments[0].start  # ✅ Use .start not ["start"]
    bucket_end = bucket_start + window

    for seg in segments:
        cleaned_text = normalize_transcript_text(seg.text)  # ✅ Use .text not ["text"]
        
        if seg.start <= bucket_end:  # ✅ Use .start
            bucket.append(cleaned_text)
        else:
            combined_text = " ".join(bucket)
            formatted_text = format_transcript_with_punctuation(combined_text)
            
            merged.append({
                "start": round(bucket_start, 2),
                "end": round(bucket_end, 2),
                "text": formatted_text
            })

            bucket_start = seg.start  # ✅ Use .start
            bucket_end = bucket_start + window
            bucket = [cleaned_text]

    if bucket:
        combined_text = " ".join(bucket)
        formatted_text = format_transcript_with_punctuation(combined_text)
        
        merged.append({
            "start": round(bucket_start, 2),
            "end": round(bucket_end, 2),
            "text": formatted_text
        })
    return merged


def get_raw_transcript(video_id: str) -> List[Dict]:
    """Get raw transcript as list of dicts"""
    fetched = ytt_api.fetch(video_id)
    
    # Convert FetchedTranscriptSnippet objects to dictionaries
    transcript = []
    for seg in fetched:
        transcript.append({
            "text": seg.text,
            "start": seg.start,
            "duration": seg.duration
        })
    
    return transcript


def get_segmented_transcript(video_id: str, segment_seconds: int) -> List[Dict]:
    """Get cleaned and merged transcript segments"""
    fetched = ytt_api.fetch(video_id)
    
    # Don't convert to list yet - pass the FetchedTranscript object directly
    # OR convert to list of objects (not dicts)
    transcript = list(fetched)
    
    if not transcript:
        raise ValueError("Empty transcript returned")
    
    return merge_segments(transcript, window=segment_seconds)