import { ai, Chapter, TranscriptItem } from "@/utils/gemini";


function chunkTranscript(
  transcript: TranscriptItem[],
  maxChars = 20000
): string[] {
  const chunks: string[] = [];
  let currentChunk = "";

  for (const segment of transcript) {
    const formatted = `[${segment.start}-${segment.end}] ${segment.text}\n`;

    if ((currentChunk + formatted).length > maxChars) {
      chunks.push(currentChunk);
      currentChunk = formatted;
    } else {
      currentChunk += formatted;
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks;
}

async function generateSectionStructure(chunk: string) {
  const prompt = `
From this transcript section, extract structured topics.

Return ONLY JSON in format:

[
  {
    "sectionTitle": "Short descriptive title",
    "start": 0,
    "end": 300,
    "mainTopics": ["topic1", "topic2"]
  }
]

Use timestamps from transcript.
Do NOT invent timestamps.

Transcript Section:
${chunk}
`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-lite",
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      temperature: 0.3
    }
  });

  if (!response.text) {
    throw new Error("Empty section response");
  }

  return JSON.parse(response.text);
}

async function generateFinalChapters(
  structuredSections: any[]
): Promise<Chapter[]> {
  const prompt = `
You are a course architect.

From the structured section data below, generate final course chapters.

Rules:
- 6–15 chapters maximum
- Chronological order
- Merge related sections
- Do NOT invent timestamps
- Return ONLY valid JSON

Format:
[
  {
    "title": "Chapter title",
    "start": 0,
    "end": 300,
    "keywords": ["keyword1", "keyword2"]
  }
]

Structured Sections:
${JSON.stringify(structuredSections)}
`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-lite",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      temperature: 0.3,
    },
  });

  if (!response.text) {
    throw new Error("Empty final response");
  }

  return JSON.parse(response.text);
}

interface StructuredSection {
  sectionTitle: string;
  start: number;
  end: number;
  mainTopics: string[];
}
export async function generateChaptersFromLongTranscript(
  transcript: TranscriptItem[]
): Promise<Chapter[]> {
  if (!transcript.length) throw new Error("Transcript empty");

  // 20k chars is a safe "medium" chunk for Flash-Lite
  const chunks = chunkTranscript(transcript, 5000); 
  const structuredSections:StructuredSection[] = [];
  console.log(transcript)

  // for (let i = 0; i < chunks.length; i++) {
  //   console.log(`Processing chunk ${i + 1}/${chunks.length}`);
    
  //   // Use a retry wrapper to handle transient 429 errors
  //   const result = await withRetry(() => generateSectionStructure(chunks[i]));
  //   structuredSections.push(...result);

  //   // If there are more chunks, wait 4.5 seconds. 
  //   // If it's the last chunk, don't wait—proceed to final chapters.
  //   if (i < chunks.length - 1) {
  //     await new Promise((res) => setTimeout(res, 4500)); 
  //   }
  // }

  console.log("Generating final chapters from", structuredSections.length, "sections...");
  return await withRetry(() => generateFinalChapters(structuredSections));
}

/**
 * Simple Exponential Backoff wrapper
 */
async function withRetry(fn: () => Promise<any>, retries = 3): Promise<any> {
  try {
    return await fn();
  } catch (error: any) {
    // Check for "Too Many Requests" (429)
    if (retries > 0 && error.status === 429) {
      const wait = 15000; // Wait 15s on limit hit
      console.warn(`Rate limit hit. Retrying in ${wait/1000}s...`);
      await new Promise(res => setTimeout(res, wait));
      return withRetry(fn, retries - 1);
    }
    throw error;
  }
}