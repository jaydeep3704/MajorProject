import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { generateChaptersFromLongTranscript } from "@/lib/chapter-generator";
import { Chapter } from "@/utils/gemini";

type ParsedChapter = {
  title: string;
  start: number;
  end: number;
};

function parseYouTubeChapters(description: string): ParsedChapter[] {
  const lines = description.split("\n");

  // Matches:
  // 00:00
  // 00:00:00
  // (00:00)
  // (00:00:00)
  const timestampRegex =
    /\(?(\d{1,2}):(\d{2})(?::(\d{2}))?\)?/;

  const chapters: ParsedChapter[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    const match = line.match(timestampRegex);

    if (!match) continue;

    const hours = match[3] ? Number(match[1]) : 0;
    const minutes = match[3]
      ? Number(match[2])
      : Number(match[1]);
    const seconds = match[3]
      ? Number(match[3])
      : Number(match[2]);

    const totalSeconds =
      hours * 3600 + minutes * 60 + seconds;

    // Remove timestamp (and brackets) from title
    const title = line
      .replace(timestampRegex, "")
      .replace(/[-–—:]+$/, "") // remove trailing separators
      .trim();

    if (!title) continue;

    chapters.push({
      title,
      start: totalSeconds,
      end: 0,
    });
  }

  // Sort just in case timestamps were not ordered
  chapters.sort((a, b) => a.start - b.start);

  // Calculate end times
  for (let i = 0; i < chapters.length; i++) {
    chapters[i].end =
      i < chapters.length - 1
        ? chapters[i + 1].start
        : chapters[i].start + 60;
  }

  return chapters;
}


export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id?: string }> }
) {
  const { id: courseId } = await params;

  if (!courseId) {
    return NextResponse.json(
      { error: "Course ID missing" },
      { status: 400 }
    );
  }

  try {
    // 1️⃣ Check existing
    const existingChapters = await prisma.chapter.findMany({
      where: { courseId },
      orderBy: { index: "asc" },
    });

    if (existingChapters.length > 0) {
      return NextResponse.json({
        source: "database",
        chapters: existingChapters,
      });
    }

    // 2️⃣ Get description
    const metadata = await prisma.courseMetadata.findUnique({
      where: { courseId },
      select: { description: true },
    });

    if (metadata?.description) {
      const parsedChapters = parseYouTubeChapters(metadata.description);

      if (parsedChapters.length > 0) {
        await prisma.chapter.createMany({
          data: parsedChapters.map((ch, index) => ({
            courseId,
            title: ch.title,
            start: ch.start.toString(),
            end: ch.end.toString(),
            index,
          })),
        });

        return NextResponse.json({
          source: "youtube-description",
          chapters: parsedChapters,
        },{status:200});
      }
    }

    // 3️⃣ Fetch transcript segments
    const transcriptSegments = await prisma.transcriptSegment.findMany({
      where: { courseId },
      orderBy: { index: "asc" },
    });

    if (!transcriptSegments.length) {
      return NextResponse.json(
        { error: "Transcript not found" },
        { status: 400 }
      );
    }

    const transcript = transcriptSegments.map((seg) => ({
      start: Number(seg.start),
      end: Number(seg.end),
      text: seg.text,
    }));

    // 🔥 Keep this for later when you want AI fallback
    // const generatedChapters: Chapter[] =
    //   await generateChaptersFromLongTranscript(transcript);

    // await prisma.chapter.createMany({
    //   data: generatedChapters.map((ch, index) => ({
    //     courseId,
    //     title: ch.title,
    //     start: ch.start.toString(),
    //     end: ch.end.toString(),
    //     index,
    //     keywords: ch.keywords ?? [],
    //   })),
    // });

    return NextResponse.json({
      source: "generated",
      chapters: [],
    });

  } catch (error) {
    console.error("Chapter generation failed:", error);

    return NextResponse.json(
      { error: "Failed to generate chapters" },
      { status: 500 }
    );
  }
}
