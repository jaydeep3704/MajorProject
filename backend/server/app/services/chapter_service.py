from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
from scipy.ndimage import gaussian_filter1d
import numpy as np
import re
from app.utils.gemini import client


model = SentenceTransformer("all-MiniLM-L6-v2")

WINDOW_SIZE = 3
LOCAL_WINDOW = 6
DEPTH_THRESHOLD = 0.35
MIN_CHAPTER_SECONDS = 240


# -------------------------------
# WINDOW BUILDING
# -------------------------------

def build_windows(segments):

    windows = []

    for i in range(len(segments) - WINDOW_SIZE + 1):

        text = " ".join(
            segments[j]["text"] for j in range(i, i + WINDOW_SIZE)
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
    last_boundary = segments[0]["start"]

    for i in range(len(similarities)):

        left_start = max(0, i - LOCAL_WINDOW)
        right_end = min(len(similarities), i + LOCAL_WINDOW)

        left_peak = np.max(similarities[left_start:i+1])
        right_peak = np.max(similarities[i:right_end])

        valley = similarities[i]

        depth = (left_peak - valley) + (right_peak - valley)

        if depth > DEPTH_THRESHOLD:

            boundary_time = segments[i+1]["start"]

            if boundary_time - last_boundary < MIN_CHAPTER_SECONDS:
                continue

            boundaries.append(i+1)
            last_boundary = boundary_time

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
            "start": chapter_segments[0]["start"],
            "end": chapter_segments[-1]["end"],
            "text": " ".join(s["text"] for s in chapter_segments)[:900]
        })

        start_idx = boundary

    if start_idx < len(segments):

        chapter_segments = segments[start_idx:]

        chapters.append({
            "start": chapter_segments[0]["start"],
            "end": chapter_segments[-1]["end"],
            "text": " ".join(s["text"] for s in chapter_segments)[:900]
        })

    return chapters


# -------------------------------
# EXTRACT TIMESTAMPS FROM DESCRIPTION
# -------------------------------

def extract_description_chapters(description):

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

        if i < len(metadata_chapters) - 1:
            end = metadata_chapters[i+1]["start"]
        else:
            end = detected[-1]["end"]

        aligned.append({
            "start": start,
            "end": end,
            "text": "",
            "title": meta["title"]
        })

    return aligned


# -------------------------------
# GEMINI TITLE GENERATION
# -------------------------------

def generate_chapter_titles(chapters, metadata):

    video_title = metadata.title
    description = metadata.description[:1000]

    chapters_text = ""

    for i, chapter in enumerate(chapters):
        chapters_text += f"""
Chapter {i+1}:
{chapter["text"]}
"""

    prompt = f"""
Video Title:
{video_title}

Video Description:
{description}

Generate YouTube chapter titles.

Rules:
- 3–6 words
- clear and descriptive
- related to the video topic
- return numbered titles only

Transcript Chapters:
{chapters_text}
"""

    try:

        response = client.models.generate_content(
            model="gemma-3-27b-it",
            contents=prompt
        )

        titles = response.text.strip().split("\n")

        clean_titles = []

        for t in titles:

            t = t.strip()

            if "." in t:
                t = t.split(".", 1)[1].strip()

            clean_titles.append(t)

        return clean_titles

    except Exception as e:

        print("Gemini error:", e)

        return ["Chapter"] * len(chapters)


# -------------------------------
# MAIN CHAPTER PIPELINE
# -------------------------------

def generate_chapters(segments, metadata):

    print("segments:", len(segments))

    texts = build_windows(segments)

    embeddings = model.encode(
        texts,
        batch_size=64,
        show_progress_bar=False
    )

    similarities = compute_similarity(embeddings)

    boundaries = detect_boundaries(similarities, segments)

    chapters = build_chapters(boundaries, segments)

    description = metadata.description

    metadata_chapters = extract_description_chapters(description)

    # If description already has chapters → align them
    if metadata_chapters:

        chapters = align_chapters(chapters, metadata_chapters)

    else:

        titles = generate_chapter_titles(chapters, metadata)

        for i, chapter in enumerate(chapters):

            chapter["title"] = titles[i] if i < len(titles) else "Chapter"
        
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

            chunk_words = words[i:i+WORD_CHUNK]

            if len(chunk_words) < 10:
                continue

            new_segments.append({
                "start": seg.start,
                "end": seg.end,
                "text": " ".join(chunk_words)
            })

    return new_segments