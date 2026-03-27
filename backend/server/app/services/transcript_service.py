from youtube_transcript_api import YouTubeTranscriptApi, TranscriptsDisabled, NoTranscriptFound
from typing import List, Dict
from app.utils.transcript_merger import merge_segments

import whisper
import yt_dlp
import os
import uuid

ytt_api = YouTubeTranscriptApi()

print("🔄 Loading Whisper model...")
whisper_model = whisper.load_model("base")
print("✅ Whisper model loaded")

TEMP_DIR = os.path.join(os.getcwd(), "temp")
os.makedirs(TEMP_DIR, exist_ok=True)
print(f"📁 Temp directory ready: {TEMP_DIR}")


def download_audio(video_id: str) -> str:
    """Download YouTube audio and convert to MP3"""

    filename = f"{uuid.uuid4()}.mp3"
    filepath = os.path.join(TEMP_DIR, filename)

    print(f"⬇️  Downloading audio for video: {video_id}")

    ydl_opts = {
        "format": "bestaudio/best",
        "outtmpl": filepath,
        "quiet": False,
        "postprocessors": [
            {
                "key": "FFmpegExtractAudio",
                "preferredcodec": "mp3",
                "preferredquality": "192",
            }
        ],
    }

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        ydl.download([f"https://www.youtube.com/watch?v={video_id}"])

    # yt_dlp + postprocessor writes to filepath directly as .mp3
    # but if the template already ends in .mp3, the final file is exactly filepath
    if not os.path.exists(filepath):
        # fallback: yt_dlp may have written <filepath>.mp3 if template had no extension conflict
        alt = filepath + ".mp3"
        if os.path.exists(alt):
            filepath = alt
        else:
            raise FileNotFoundError(
                f"❌ Audio file not found after download. Expected: {filepath}"
            )

    size_mb = os.path.getsize(filepath) / (1024 * 1024)
    print(f"✅ Audio downloaded and converted to MP3: {filepath} ({size_mb:.2f} MB)")
    return filepath


def whisper_transcribe(video_id: str) -> List[Dict]:
    """Generate transcript using Whisper"""

    print(f"🎙️  Starting Whisper transcription for video: {video_id}")
    audio_path = download_audio(video_id)

    print(f"🔍 Detecting language and transcribing audio through Whisper...")
    result = whisper_model.transcribe(
        audio_path,
        task="translate",  # keeps original language
        verbose=True,       # prints segment-by-segment progress
    )

    detected_lang = result.get("language", "unknown")
    print(f"🌐 Detected language: {detected_lang}")

    print(f"🗑️  Removing temp audio file: {audio_path}")
    os.remove(audio_path)
    print(f"✅ Temp file removed")

    segments = [
        {
            "text": seg["text"].strip(),
            "start": seg["start"],
            "duration": seg["end"] - seg["start"],
        }
        for seg in result["segments"]
    ]

    print(f"✅ Whisper generated {len(segments)} segments")
    return segments


def get_raw_transcript(video_id: str) -> List[Dict]:
    """Get transcript with Whisper fallback"""

    print(f"🔎 Attempting to fetch YouTube transcript for video: {video_id}")

    try:
        fetched = ytt_api.fetch(video_id)
        transcript = list(fetched)

        if transcript:
            print(f"✅ YouTube transcript fetched: {len(transcript)} segments")
            return transcript
        else:
            print("⚠️  YouTube transcript was empty. Falling back to Whisper...")

    except (TranscriptsDisabled, NoTranscriptFound) as e:
        print(f"⚠️  No YouTube transcript available ({type(e).__name__}). Falling back to Whisper...")
    except Exception as e:
        print(f"⚠️  Unexpected error fetching YouTube transcript: {e}. Falling back to Whisper...")

    return whisper_transcribe(video_id)


def get_segmented_transcript(video_id: str, segment_seconds: int) -> List[Dict]:
    """Get merged transcript segments with Whisper fallback"""

    print(f"\n{'='*50}")
    print(f"📼 Processing video: {video_id}")
    print(f"⏱️  Segment window: {segment_seconds}s")
    print(f"{'='*50}\n")

    transcript = get_raw_transcript(video_id)
    print(transcript)
    if not transcript:
        raise ValueError("❌ Transcript generation failed — both YouTube and Whisper returned empty results")

    print(f"🔗 Merging {len(transcript)} raw segments into {segment_seconds}s windows...")
    merged = merge_segments(transcript, window=segment_seconds)
    print(f"✅ Merged into {len(merged)} segments")

    return merged