export function getYouTubeVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/,
    /youtube\.com\/embed\/([^&\s]+)/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export function mergeTranscript(items:any, maxGap = 1.5) {
  const merged = [];
  let current = null;

  for (const item of items) {
    if (
      !current ||
      item.offset > current.end + maxGap
    ) {
      current = {
        text: item.text,
        start: item.offset,
        end: item.offset + item.duration,
      };
      merged.push(current);
    } else {
      current.text += " " + item.text;
      current.end = item.offset + item.duration;
    }
  }

  return merged;
}
