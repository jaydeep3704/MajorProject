from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
from scipy.ndimage import gaussian_filter1d
import numpy as np
import re
from app.utils.gemini import client

# =========================
# MODEL
# =========================
model = SentenceTransformer("all-MiniLM-L6-v2")

WINDOW_SIZE = 3
LOCAL_WINDOW = 6
DEPTH_THRESHOLD = 0.15
MIN_CHAPTER_SECONDS = 120


# =========================
# SPLIT INTO SENTENCES (RESTORED)
# =========================
def split_into_sentences(segments):
    new_segments = []

    for seg in segments:
        text = seg["text"] if isinstance(seg, dict) else seg.text
        start = seg["start"] if isinstance(seg, dict) else seg.start
        end = seg["end"] if isinstance(seg, dict) else seg.end

        sentences = re.split(r'(?<=[.!?])\s+', text)

        duration = (end - start) / max(len(sentences), 1)

        for i, sentence in enumerate(sentences):
            new_segments.append({
                "start": start + i * duration,
                "end": start + (i + 1) * duration,
                "text": sentence.strip()
            })

    return new_segments


# =========================
# HELPERS
# =========================
def get_field(seg, field):
    if isinstance(seg, dict):
        return seg[field]
    return getattr(seg, field)


def build_windows(segments):
    windows = []
    for i in range(len(segments) - WINDOW_SIZE + 1):
        text = " ".join(
            get_field(segments[j], "text") for j in range(i, i + WINDOW_SIZE)
        )
        windows.append(text)
    return windows


def compute_similarity(embeddings):
    sims = cosine_similarity(embeddings[:-1], embeddings[1:]).diagonal()
    sims = gaussian_filter1d(sims, sigma=1)
    return sims


# =========================
# BOUNDARY DETECTION
# =========================
def detect_boundaries(similarities, segments):
    boundaries = []
    last_boundary = get_field(segments[0], "start")

    for i in range(len(similarities)):
        left_start = max(0, i - LOCAL_WINDOW)
        right_end = min(len(similarities), i + LOCAL_WINDOW)

        left_peak = np.max(similarities[left_start:i+1])
        right_peak = np.max(similarities[i:right_end])
        valley = similarities[i]

        depth = (left_peak - valley) + (right_peak - valley)

        if depth > DEPTH_THRESHOLD:
            boundary_time = get_field(segments[i+1], "start")

            if boundary_time - last_boundary < MIN_CHAPTER_SECONDS:
                continue

            boundaries.append(i + 1)
            last_boundary = boundary_time

    return boundaries


# =========================
# BUILD CHAPTERS
# =========================
def build_chapters(boundaries, segments):
    chapters = []
    start_idx = 0

    for boundary in boundaries:
        chapter_segments = segments[start_idx:boundary]
        if not chapter_segments:
            continue

        chapters.append({
            "start": get_field(chapter_segments[0], "start"),
            "end": get_field(chapter_segments[-1], "end"),
            "text": " ".join(get_field(s, "text") for s in chapter_segments)[:900]
        })

        start_idx = boundary

    if start_idx < len(segments):
        chapter_segments = segments[start_idx:]
        chapters.append({
            "start": get_field(chapter_segments[0], "start"),
            "end": get_field(chapter_segments[-1], "end"),
            "text": " ".join(get_field(s, "text") for s in chapter_segments)[:900]
        })

    return chapters


# =========================
# TITLE GENERATION (YOUR BEST VERSION FIXED)
# =========================
def generate_chapter_titles(chapters, metadata):
    # ✅ handle both dict and object safely
    if isinstance(metadata, dict):
        video_title = metadata.get("title", "") or ""
        description = (metadata.get("description", "") or "")[:1000]
    else:
        video_title = getattr(metadata, "title", "") or ""
        description = (getattr(metadata, "description", "") or "")[:1000]

    chapters_text = ""
    for i, chapter in enumerate(chapters):
        start = get_field(chapter, "start")
        start_min = int(start // 60)
        start_sec = int(start % 60)

        chapters_text += (
            f"\nChapter {i+1} [{start_min:02d}:{start_sec:02d}]:\n"
            f"{chapter['text']}\n"
        )

    prompt = f"""You are generating YouTube chapter titles.

Video Title: {video_title}
{"Video Description: " + description if description else ""}

Generate exactly {len(chapters)} chapter titles based on the transcript excerpts below.

Rules:
- 3 to 6 words per title
- Clear, specific, and descriptive
- Reflect the actual content of each chapter
- If context is limited, infer from the video title
- Return ONLY the titles, one per line, no numbering, no bullets, no extra text

Transcript Chapters:
{chapters_text}
"""

    try:
        response = client.models.generate_content(
            model="gemma-3-27b-it",
            contents=prompt
        )

        lines = [l.strip() for l in response.text.split("\n") if l.strip()]

        # limit length
        lines = [l[:80] for l in lines]

        # ensure correct count
        while len(lines) < len(chapters):
            lines.append(f"Chapter {len(lines)+1}")

        return lines[:len(chapters)]

    except Exception as e:
        print("Gemini error:", e)
        return [f"Chapter {i+1}" for i in range(len(chapters))]


# =========================
# MAIN FUNCTION
# =========================
def generate_chapters(segments, metadata):
    if not isinstance(metadata, dict):
        metadata = {}

    # 1️⃣ sentence split
    segments = split_into_sentences(segments)

    # 2️⃣ embeddings
    texts = build_windows(segments)
    embeddings = model.encode(texts, show_progress_bar=False)

    # 3️⃣ similarity
    similarities = compute_similarity(embeddings)

    # 4️⃣ boundaries
    boundaries = detect_boundaries(similarities, segments)

    # 5️⃣ chapters
    chapters = build_chapters(boundaries, segments)

    # 6️⃣ titles (only if no description chapters used)
    description = metadata.get("description", "")

    if not description:
        titles = generate_chapter_titles(chapters, metadata)
        for i, c in enumerate(chapters):
            c["title"] = titles[i]

    return chapters