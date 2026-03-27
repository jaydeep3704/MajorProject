from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
from scipy.ndimage import gaussian_filter1d
import numpy as np
import re
from app.utils.gemini import client


model = SentenceTransformer("all-MiniLM-L6-v2")

WINDOW_SIZE = 3
LOCAL_WINDOW = 6
DEPTH_THRESHOLD = 0.15       # was 0.35 — too strict, barely any boundaries detected
MIN_CHAPTER_SECONDS = 120    # was 240 — allow chapters every 2min not 4min


# -------------------------------
# HELPERS
# -------------------------------

def get_field(seg, field):
    """Handle both dict segments and object segments"""
    if isinstance(seg, dict):
        return seg[field]
    return getattr(seg, field)


# -------------------------------
# WINDOW BUILDING
# -------------------------------

def build_windows(segments):
    windows = []
    for i in range(len(segments) - WINDOW_SIZE + 1):
        text = " ".join(
            get_field(segments[j], "text") for j in range(i, i + WINDOW_SIZE)
        )
        windows.append(text)
    return windows


# -------------------------------
# SIMILARITY COMPUTATION
# -------------------------------

def compute_similarity(embeddings):
    sims = cosine_similarity(embeddings[:-1], embeddings[1:]).diagonal()
    sims = gaussian_filter1d(sims, sigma=1)
    return sims


# -------------------------------
# TOPIC BOUNDARY DETECTION
# -------------------------------

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

    print(f"🔍 Detected {len(boundaries)} boundaries")
    return boundaries


# -------------------------------
# BUILD CHAPTERS
# -------------------------------

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

    print(f"📚 Built {len(chapters)} chapters")
    return chapters


# -------------------------------
# EXTRACT TIMESTAMPS FROM DESCRIPTION
# -------------------------------

def extract_description_chapters(description):
    if not description:
        return []

    pattern = r'(\d{1,2}:\d{2}(?::\d{2})?)\s+(.+)'
    matches = re.findall(pattern, description)

    chapters = []
    for time_str, title in matches:
        parts = list(map(int, time_str.split(":")))
        if len(parts) == 2:
            seconds = parts[0] * 60 + parts[1]
        else:
            seconds = parts[0] * 3600 + parts[1] * 60 + parts[2]

        chapters.append({
            "start": seconds,
            "title": title.strip()
        })

    return chapters


# -------------------------------
# ALIGN DETECTED CHAPTERS WITH DESCRIPTION
# -------------------------------

def align_chapters(detected, metadata_chapters):
    if not metadata_chapters:
        return detected

    aligned = []
    for i, meta in enumerate(metadata_chapters):
        start = meta["start"]
        end = metadata_chapters[i + 1]["start"] if i < len(metadata_chapters) - 1 else detected[-1]["end"]

        # Pull matching text from detected chapters that overlap this range
        overlapping_text = " ".join(
            c["text"] for c in detected
            if c["start"] >= start and c["start"] < end
        )

        aligned.append({
            "start": start,
            "end": end,
            "text": overlapping_text[:900],
            "title": meta["title"]   # already has title from description
        })

    return aligned


# -------------------------------
# GEMINI TITLE GENERATION
# -------------------------------

def generate_chapter_titles(chapters, metadata):
    video_title = getattr(metadata, "title", "") or ""
    description = (getattr(metadata, "description", "") or "")[:1000]

    chapters_text = ""
    for i, chapter in enumerate(chapters):
        start_min = int(get_field(chapter, "start") // 60)
        start_sec = int(get_field(chapter, "start") % 60)
        chapters_text += f"\nChapter {i+1} [{start_min:02d}:{start_sec:02d}]:\n{chapter['text']}\n"

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
        print(f"🤖 Generating {len(chapters)} chapter titles with Gemini...")

        response = client.models.generate_content(
            model="gemma-3-27b-it",
            contents=prompt
        )

        raw = response.text.strip()
        print(f"📝 Gemini raw response:\n{raw}")

        lines = [l.strip() for l in raw.split("\n") if l.strip()]

        clean_titles = []
        for t in lines:
            # Strip numbering: "1.", "1)", "**1.**", "- "
            t = re.sub(r'^[\*\-\d\.\)]+\s*', '', t)
            # Strip bold markdown
            t = re.sub(r'\*+', '', t).strip()
            if t:
                clean_titles.append(t)

        print(f"✅ Parsed {len(clean_titles)} titles: {clean_titles}")

        # Pad or trim to match chapter count
        while len(clean_titles) < len(chapters):
            clean_titles.append(f"Chapter {len(clean_titles) + 1}")

        return clean_titles[:len(chapters)]

    except Exception as e:
        print(f"❌ Gemini error: {e}")
        return [f"Chapter {i+1}" for i in range(len(chapters))]


# -------------------------------
# MAIN CHAPTER PIPELINE
# -------------------------------

def generate_chapters(segments, metadata):
    print(f"\n{'='*50}")
    print(f"🎬 Starting chapter generation")
    print(f"📊 Total segments: {len(segments)}")
    print(f"{'='*50}\n")

    texts = build_windows(segments)
    print(f"🪟 Built {len(texts)} windows")

    embeddings = model.encode(texts, batch_size=64, show_progress_bar=False)
    print(f"🔢 Encoded {len(embeddings)} embeddings")

    similarities = compute_similarity(embeddings)
    print(f"📈 Similarity range: min={similarities.min():.3f}, max={similarities.max():.3f}, mean={similarities.mean():.3f}")

    boundaries = detect_boundaries(similarities, segments)
    chapters = build_chapters(boundaries, segments)

    description = getattr(metadata, "description", "") or ""
    metadata_chapters = extract_description_chapters(description)

    if metadata_chapters:
        print(f"📋 Found {len(metadata_chapters)} chapters in description — aligning...")
        chapters = align_chapters(chapters, metadata_chapters)
    else:
        print("📋 No description chapters found — generating titles with Gemini...")
        titles = generate_chapter_titles(chapters, metadata)
        for i, chapter in enumerate(chapters):
            chapter["title"] = titles[i] if i < len(titles) else f"Chapter {i+1}"

    print(f"\n✅ Final chapters ({len(chapters)}):")
    for i, c in enumerate(chapters):
        start_fmt = f"{int(c['start'])//60:02d}:{int(c['start'])%60:02d}"
        print(f"  {i+1}. [{start_fmt}] {c.get('title', 'No title')}")

    return chapters


# -------------------------------
# TRANSCRIPT SEGMENTATION
# -------------------------------

def split_into_sentences(segments):
    new_segments = []
    WORD_CHUNK = 40

    for seg in segments:
        words = seg.text.split()

        for i in range(0, len(words), WORD_CHUNK):
            chunk_words = words[i:i + WORD_CHUNK]

            if len(chunk_words) < 10:
                continue

            new_segments.append({
                "start": seg.start,
                "end": seg.end,
                "text": " ".join(chunk_words)
            })

    return new_segments