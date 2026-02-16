import yt_dlp

def get_video_metadata(url: str):
    with yt_dlp.YoutubeDL({"quiet": True, "skip_download": True}) as ydl:
        info = ydl.extract_info(url, download=False)

    return {
        "title": info.get("title"),
        "description": info.get("description"),
        "thumbnail": info.get("thumbnail"),
        "duration": info.get("duration")
    }
