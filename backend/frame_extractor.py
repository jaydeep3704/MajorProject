import os
import subprocess
import shutil
import torch
import clip
import numpy as np
from PIL import Image
import cv2
import pytesseract
from difflib import SequenceMatcher

# =========================
# CONFIG
# =========================
VIDEO_FILE = "video.mp4"
FRAME_DIR = "frames"
OUTPUT_DIR = "unique_frames"

FPS = 1
CLIP_THRESHOLD = 0.9
TEXT_SIM_THRESHOLD = 0.7
MIN_TEXT_LENGTH = 20


# =========================
# LOAD CLIP MODEL
# =========================
device = "cuda" if torch.cuda.is_available() else "cpu"
model, preprocess = clip.load("ViT-B/32", device=device)


# =========================
# DOWNLOAD VIDEO
# =========================
def download_video(url):
    print("⬇️ Downloading video...")
    subprocess.run([
        "yt-dlp",
        "-f", "mp4",
        "-o", VIDEO_FILE,
        url
    ], check=True)


# =========================
# EXTRACT FRAMES
# =========================
def extract_frames():
    print("🎬 Extracting frames...")

    if os.path.exists(FRAME_DIR):
        shutil.rmtree(FRAME_DIR)
    os.makedirs(FRAME_DIR, exist_ok=True)

    subprocess.run([
        "ffmpeg",
        "-i", VIDEO_FILE,
        "-vf", f"fps={FPS}",
        f"{FRAME_DIR}/frame_%04d.jpg"
    ], check=True)


# =========================
# CLIP EMBEDDING
# =========================
def get_embedding(image_path):
    image = preprocess(Image.open(image_path)).unsqueeze(0).to(device)
    with torch.no_grad():
        embedding = model.encode_image(image)
    return embedding.cpu().numpy()[0]


def cosine_sim(a, b):
    return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))


# =========================
# STEP 1: VISUAL FILTER
# =========================
def filter_visual_duplicates(frame_paths):
    print("🧠 Removing visual duplicates (CLIP)...")

    selected = []
    embeddings = []

    for path in frame_paths:
        emb = get_embedding(path)

        if not embeddings:
            selected.append(path)
            embeddings.append(emb)
            continue

        sims = [cosine_sim(emb, e) for e in embeddings[-5:]]

        if max(sims) < CLIP_THRESHOLD:
            selected.append(path)
            embeddings.append(emb)

    print(f"After CLIP filter: {len(selected)} frames")
    return selected


# =========================
# OCR TEXT EXTRACTION
# =========================
def extract_text(image_path):
    img = cv2.imread(image_path)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    text = pytesseract.image_to_string(gray)
    return text.strip()


def text_similarity(a, b):
    return SequenceMatcher(None, a, b).ratio()


# =========================
# STEP 2: TEXT FILTER
# =========================
def filter_text_duplicates(frame_paths):
    print("🧾 Removing incomplete/duplicate slides (OCR)...")

    selected = []
    texts = []

    for path in frame_paths:
        text = extract_text(path)

        # skip empty or low text frames
        if len(text) < MIN_TEXT_LENGTH:
            continue

        if not texts:
            selected.append(path)
            texts.append(text)
            continue

        sims = [text_similarity(text, t) for t in texts]

        max_sim = max(sims)

        if max_sim > TEXT_SIM_THRESHOLD:
            idx = sims.index(max_sim)

            # keep longer (more complete slide)
            if len(text) > len(texts[idx]):
                selected[idx] = path
                texts[idx] = text
        else:
            selected.append(path)
            texts.append(text)

    print(f"After OCR filter: {len(selected)} frames")
    return selected


# =========================
# SAVE FINAL FRAMES
# =========================
def save_frames(frames):
    if os.path.exists(OUTPUT_DIR):
        shutil.rmtree(OUTPUT_DIR)
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    for i, frame in enumerate(frames):
        shutil.copy(frame, f"{OUTPUT_DIR}/frame_{i:04d}.jpg")

    print(f"✅ Saved {len(frames)} final frames → {OUTPUT_DIR}/")


# =========================
# MAIN PIPELINE
# =========================
def generate_unique_frames(url):
    download_video(url)
    extract_frames()

    all_frames = sorted([
        os.path.join(FRAME_DIR, f)
        for f in os.listdir(FRAME_DIR)
        if f.endswith(".jpg")
    ])

    print(f"Total frames: {len(all_frames)}")

    # Step 1: visual filtering
    frames = filter_visual_duplicates(all_frames)

    # Step 2: text-based filtering
    frames = filter_text_duplicates(frames)

    # Save final frames
    save_frames(frames)

    print("🎉 Done! Clean frames ready.")


# =========================
# RUN
# =========================
if __name__ == "__main__":
    url = input("Enter YouTube URL: ")
    generate_unique_frames(url)