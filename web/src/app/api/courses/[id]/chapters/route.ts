import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// ✅ Extract chapters from YouTube description
function parseYouTubeChapters(description: string) {
  const lines = description.split("\n");

  const regex = /\(?(\d{1,2}):(\d{2})(?::(\d{2}))?\)?/;

  const chapters: {
    title: string;
    start: number;
    end: number;
  }[] = [];

  for (const raw of lines) {
    const line = raw.trim();
    const match = line.match(regex);

    if (!match) continue;

    const hours = match[3] ? Number(match[1]) : 0;
    const minutes = match[3] ? Number(match[2]) : Number(match[1]);
    const seconds = match[3] ? Number(match[3]) : Number(match[2]);

    const total = hours * 3600 + minutes * 60 + seconds;

    const title = line
      .replace(regex, "")
      .replace(/[-–—:]+$/, "")
      .trim();

    if (!title) continue;

    chapters.push({
      title,
      start: total,
      end: 0,
    });
  }

  // sort + assign end times
  chapters.sort((a, b) => a.start - b.start);

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
  { params }: { params: { id: string } }
) {
  const courseId = await params.id;

  if (!courseId) {
    return NextResponse.json(
      { error: "Course ID missing" },
      { status: 400 }
    );
  }

  try {
    // 1️⃣ Already exists
    const existing = await prisma.chapter.findMany({
      where: { courseId },
      orderBy: { index: "asc" },
    });

    if (existing.length > 0) {
      return NextResponse.json({
        source: "db",
        chapters: existing,
      });
    }

    // 2️⃣ Metadata
    const metadata = await prisma.courseMetadata.findUnique({
      where: { courseId },
    });

    // =========================
    // 🔥 NEW: DESCRIPTION CHAPTERS FIRST
    // =========================
    if (metadata?.description) {
      const parsed = parseYouTubeChapters(metadata.description);

      if (parsed.length > 0) {
        await prisma.chapter.createMany({
          data: parsed.map((ch, index) => ({
            courseId,
            title: ch.title,
            start: ch.start.toString(),
            end: ch.end.toString(),
            index,
          })),
        });

        return NextResponse.json({
          source: "description",
          chapters: parsed,
        });
      }
    }

    // =========================
    // 3️⃣ Transcript fallback
    // =========================
    const transcript = await prisma.transcriptSegment.findMany({
      where: { courseId },
      orderBy: { index: "asc" },
    });

    if (!transcript.length) {
      return NextResponse.json(
        { error: "No transcript" },
        { status: 400 }
      );
    }

    const segments = transcript.map((t) => ({
      start: t.start,
      end: t.end,
      text: t.text,
    }));

    // =========================
    // 4️⃣ Python ML fallback
    // =========================
    const response = await fetch("http://localhost:8000/youtube/chapters", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        transcriptSegments: segments,
        metadata: {
          title: metadata?.title || "",
          description: metadata?.description || "",
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Python error:", errorText);
      return NextResponse.json(
        { error: "Python chapter service failed" },
        { status: 500 }
      );
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
      return NextResponse.json(
        { error: "Invalid chapter response" },
        { status: 500 }
      );
    }

    // 5️⃣ Save ML chapters
    await prisma.chapter.createMany({
      data: data.map((ch: any, index: number) => ({
        courseId,
        title: ch.title || `Chapter ${index + 1}`,
        start: String(ch.start),
        end: String(ch.end),
        index,
      })),
    });

    return NextResponse.json({
      source: "generated",
      chapters: data,
    });

  } catch (err) {
    console.error("Chapter generation failed:", err);

    return NextResponse.json(
      { error: "Failed to generate chapters" },
      { status: 500 }
    );
  }
}