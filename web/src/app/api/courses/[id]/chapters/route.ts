import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
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
      select: { description: true, title: true },
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


    const segmentsForAPI = transcriptSegments.map(seg => ({
      start: seg.start,
      end: seg.end,
      text: seg.text
    }));



    const response = await fetch(`http://localhost:8000/youtube/chapters`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ transcriptSegments: segmentsForAPI, metadata: metadata })
    })


    if (!response.ok) {
      throw new Error("Python chapter service failed");
    }
    
    const data=await response.json()
    if(!data){
      return NextResponse.json({error:"Failed to create chapters"})
    }

    await prisma.chapter.createMany({
      data: data.map((ch: any, index: number) => ({
        courseId,
        title: ch.title,
        start: ch.start.toString(),
        end: ch.end.toString(),
        index,
      })),
    })

    return NextResponse.json({
      source: "generated",
      chapters:data.chapters,
    });

  } catch (error) {
    console.error("Chapter generation failed:", error);

    return NextResponse.json(
      { error: "Failed to generate chapters" },
      { status: 500 }
    );
  }
}
