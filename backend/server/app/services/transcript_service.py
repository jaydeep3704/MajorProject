from youtube_transcript_api import YouTubeTranscriptApi, TranscriptsDisabled, NoTranscriptFound
from typing import List, Dict, Callable, Optional
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


def download_audio(
    video_id: str,
    on_progress: Optional[Callable[[str, int], None]] = None,
) -> str:
    """Download YouTube audio and convert to MP3.
    
    on_progress(message, percent) is called at key milestones.
    """

    filename = f"{uuid.uuid4()}.mp3"
    filepath = os.path.join(TEMP_DIR, filename)

    print(f"⬇️  Downloading audio for video: {video_id}")
    if on_progress:
        on_progress("Downloading audio…", 10)

    def ydl_progress_hook(d):
        if on_progress and d.get("status") == "downloading":
            downloaded = d.get("downloaded_bytes", 0)
            total = d.get("total_bytes") or d.get("total_bytes_estimate") or 1
            pct = int((downloaded / total) * 40)  # map download to 10–50%
            on_progress(f"Downloading audio… {pct + 10}%", pct + 10)
        elif on_progress and d.get("status") == "finished":
            on_progress("Audio downloaded, converting…", 52)

    ydl_opts = {
        "format": "bestaudio/best",
        "outtmpl": filepath,
        "quiet": False,
        "progress_hooks": [ydl_progress_hook],
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

    if not os.path.exists(filepath):
        alt = filepath + ".mp3"
        if os.path.exists(alt):
            filepath = alt
        else:
            raise FileNotFoundError(
                f"❌ Audio file not found after download. Expected: {filepath}"
            )

    size_mb = os.path.getsize(filepath) / (1024 * 1024)
    print(f"✅ Audio downloaded: {filepath} ({size_mb:.2f} MB)")

    if on_progress:
        on_progress(f"Audio ready ({size_mb:.1f} MB), starting transcription…", 55)

    return filepath


def whisper_transcribe(
    video_id: str,
    on_progress: Optional[Callable[[str, int], None]] = None,
) -> List[Dict]:
    """Generate transcript using Whisper with optional progress callbacks."""

    print(f"🎙️  Starting Whisper transcription for video: {video_id}")
    audio_path = download_audio(video_id, on_progress=on_progress)

    if on_progress:
        on_progress("Whisper is transcribing audio…", 58)

    print(f"🔍 Transcribing audio through Whisper…")

    # Whisper doesn't expose a native per-segment callback, but we can hook
    # into its segment generator by using a custom progress approach.
    # We run transcribe normally and emit a "still working" heartbeat at the end.
    result = whisper_model.transcribe(
        audio_path,
        task="translate", 
        verbose=True,
    )

    detected_lang = result.get("language", "unknown")
    print(f"🌐 Detected language: {detected_lang}")

    if on_progress:
        on_progress(f"Transcription done (lang: {detected_lang}), cleaning up…", 88)

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

    if on_progress:
        on_progress(f"Generated {len(segments)} transcript segments", 92)

    return segments


def get_raw_transcript(
    video_id: str,
    on_progress: Optional[Callable[[str, int], None]] = None,
) -> List[Dict]:
    """Get transcript from YouTube, with Whisper as fallback."""

    print(f"🔎 Attempting to fetch YouTube transcript for video: {video_id}")

    if on_progress:
        on_progress("Checking for YouTube transcript…", 5)

    try:
        fetched = ytt_api.fetch(video_id)
        transcript = list(fetched)

        if transcript:
            print(f"✅ YouTube transcript fetched: {len(transcript)} segments")
            if on_progress:
                on_progress(f"Found YouTube transcript ({len(transcript)} segments)", 90)
            return transcript
        else:
            print("⚠️  YouTube transcript empty. Falling back to Whisper…")
            if on_progress:
                on_progress("No YouTube transcript found, using Whisper…", 8)

    except (TranscriptsDisabled, NoTranscriptFound) as e:
        print(f"⚠️  No YouTube transcript ({type(e).__name__}). Falling back to Whisper…")
        if on_progress:
            on_progress("No YouTube transcript available, using Whisper…", 8)
    except Exception as e:
        print(f"⚠️  Unexpected error: {e}. Falling back to Whisper…")
        if on_progress:
            on_progress("Transcript fetch failed, using Whisper…", 8)

    return whisper_transcribe(video_id, on_progress=on_progress)


def get_segmented_transcript(
    video_id: str,
    segment_seconds: int,
    on_progress: Optional[Callable[[str, int], None]] = None,
) -> List[Dict]:
    """Get merged transcript segments with optional progress reporting."""

    print(f"\n{'='*50}")
    print(f"📼 Processing video: {video_id}")
    print(f"⏱️  Segment window: {segment_seconds}s")
    print(f"{'='*50}\n")

    transcript = get_raw_transcript(video_id, on_progress=on_progress)

    if not transcript:
        raise ValueError("❌ Transcript generation failed — both YouTube and Whisper returned empty results")

    if on_progress:
        on_progress(f"Merging {len(transcript)} segments into {segment_seconds}s windows…", 95)

    print(f"🔗 Merging {len(transcript)} raw segments into {segment_seconds}s windows…")
    merged = merge_segments(transcript, window=segment_seconds)
    print(f"✅ Merged into {len(merged)} segments")

    if on_progress:
        on_progress(f"Transcript ready ({len(merged)} segments)", 99)

    return merged