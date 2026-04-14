from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
from scipy.ndimage import gaussian_filter1d
import numpy as np
import re
from app.utils.gemini import client


model = SentenceTransformer("all-MiniLM-L6-v2")

WINDOW_SIZE = 3
LOCAL_WINDOW = 6
DEPTH_THRESHOLD = 0.15       
MIN_CHAPTER_SECONDS = 120    


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
        evaluate_boundaries(chapters, metadata_chapters)
    else:
        print("📋 No description chapters found — generating titles with Gemini...")
        titles = generate_chapter_titles(chapters, metadata)
        for i, chapter in enumerate(chapters):
            chapter["title"] = titles[i] if i < len(titles) else f"Chapter {i+1}"

    print(f"\n✅ Final chapters ({len(chapters)}):")
    for i, c in enumerate(chapters):
        start_fmt = f"{int(c['start'])//60:02d}:{int(c['start'])%60:02d}"
        print(f"  {i+1}. [{start_fmt}] {c.get('title', 'No title')}")

        # -------------------------------
    # EVALUATION METRICS
    # -------------------------------

    print("\n📊 Evaluation Metrics:")

    # 1. Number of chapters
    print(f"📚 Total Chapters: {len(chapters)}")

    # 2. Average chapter duration
    durations = [
        (float(c["end"]) - float(c["start"])) 
        for c in chapters
    ]
    avg_duration = sum(durations) / len(durations) if durations else 0
    print(f"⏱️ Avg Chapter Duration: {avg_duration:.2f} seconds")

    # 3. Coherence (intra-chapter similarity)
    coherence_scores = []

    for c in chapters:
        text = c["text"]
        sentences = text.split(". ")

        if len(sentences) < 2:
            continue

        emb = model.encode(sentences, show_progress_bar=False)
        sim_matrix = cosine_similarity(emb)

        # take upper triangle mean (excluding diagonal)
        vals = []
        for i in range(len(sim_matrix)):
            for j in range(i+1, len(sim_matrix)):
                vals.append(sim_matrix[i][j])

        if vals:
            coherence_scores.append(sum(vals)/len(vals))

    avg_coherence = sum(coherence_scores)/len(coherence_scores) if coherence_scores else 0
    print(f"🧠 Avg Coherence Score: {avg_coherence:.3f}")    

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

def evaluate_boundaries(detected_chapters, metadata_chapters, tolerance=20):
    """
    tolerance = seconds allowed difference
    """

    if not metadata_chapters:
        print("⚠️ No metadata chapters available for evaluation")
        return

    # Convert to boundary times (exclude first)
    detected = [float(c["start"]) for c in detected_chapters[1:]]
    actual = [float(c["start"]) for c in metadata_chapters[1:]]

    matched = 0
    errors = []

    used = set()

    for d in detected:
        best_match = None
        best_diff = float("inf")

        for i, a in enumerate(actual):
            if i in used:
                continue

            diff = abs(d - a)
            if diff < best_diff:
                best_diff = diff
                best_match = i

        if best_match is not None and best_diff <= tolerance:
            matched += 1
            used.add(best_match)
            errors.append(best_diff)

    precision = matched / len(detected) if detected else 0
    recall = matched / len(actual) if actual else 0

    if precision + recall == 0:
        f1 = 0
    else:
        f1 = 2 * precision * recall / (precision + recall)

    avg_error = sum(errors) / len(errors) if errors else 0

    print("\n📊 Boundary Evaluation:")
    print(f"🎯 Precision: {precision:.2f}")
    print(f"🎯 Recall: {recall:.2f}")
    print(f"🎯 F1 Score: {f1:.2f}")
    print(f"📏 Avg Boundary Error: {avg_error:.2f} sec")