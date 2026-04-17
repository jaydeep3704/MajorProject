import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/utils/auth";
import { v4 as uuidv4 } from "uuid";

function mapTranscriptPercent(pct: number) {
  return Math.round(30 + (pct / 100) * 45);
}

async function processCourse(
  jobId: string,
  userId: string,
  CourseName: string,
  videoID: string
) {
  const update = async (stage: string, message: string, progress: number) => {
    await prisma.course.update({
      where: { jobId },
      data: {
        stage,
        message,
        progress,
        status: stage === "completed" ? "COMPLETED" : "PROCESSING",
      },
    });
  };

  try {
    // =========================
    // 1️⃣ FETCH METADATA FIRST
    // =========================
    await update("fetching_metadata", "Fetching metadata…", 10);

    const metaRes = await fetch(
      `${process.env.FASTAPI_BACKEND_URL}/youtube/metadata`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: `https://www.youtube.com/watch?v=${videoID}`,
        }),
      }
    );
    

    if (!metaRes.ok) {
      const text = await metaRes.text();
      throw new Error("Metadata fetch failed: " + text);
    }

    const metadata = await metaRes.json();
    
    // =========================
    // 2️⃣ UPDATE COURSE + SAVE METADATA
    // =========================
    const course = await prisma.course.update({
      where: { jobId },
      data: {
        title: CourseName || metadata.title || "Untitled",
        youtubeUrl: `https://www.youtube.com/watch?v=${videoID}`,
        metadata: {
          create: {
            title: metadata.title || "",
            description: metadata.description || "",
            thumbnail: metadata.thumbnail || "",
            duration: metadata.duration || 0,
          },
        },
      },
    });

    // =========================
    // 3️⃣ FETCH TRANSCRIPT (STREAM)
    // =========================
    await update("fetching_transcript", "Fetching transcript…", 30);

    const res = await fetch(
      `${process.env.FASTAPI_BACKEND_URL}/youtube/transcript/segmented/stream`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: `https://www.youtube.com/watch?v=${videoID}`,
          segment_seconds: 60,
        }),
      }
    );

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();

    let buffer = "";
    let segments: any[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value);
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;

        const event = JSON.parse(line.slice(6));

        if (event.type === "progress") {
          await update(
            "fetching_transcript",
            event.message,
            mapTranscriptPercent(event.percent)
          );
        }

        if (event.type === "done") {
          segments = event.segments;
          break;
        }

        if (event.type === "error") {
          throw new Error(event.detail);
        }
      }
    }

    // =========================
    // 4️⃣ SAVE TRANSCRIPT
    // =========================
    await update("saving_data", "Saving course…", 80);

    if (segments.length) {
      await prisma.transcriptSegment.createMany({
        data: segments.map((s: any, i: number) => ({
          courseId: course.id,
          start: s.start,
          end: s.end,
          text: s.text,
          index: i,
        })),
      });
    }

    // =========================
    // 5️⃣ COMPLETE
    // =========================
    await update("finalizing", "Finalizing…", 95);
    await update("completed", "Done!", 100);

  } catch (err: any) {
    console.error("Process course error:", err);

    await prisma.course.update({
      where: { jobId },
      data: {
        stage: "failed",
        status: "FAILED",
        message: err.message,
        progress: 0,
      },
    });
  }
}

export async function POST(req: NextRequest) {
  const session: any = await auth();

  const { CourseName, videoID } = await req.json();
  const jobId = uuidv4();

  await prisma.course.create({
    data: {
      title: CourseName,
      youtubeUrl: "",
      userId: session.user.id,
      jobId,
      stage: "queued",
      status: "PROCESSING",
      progress: 5,
      message: "Starting…",
    },
  });

  // 🔥 Run async (non-blocking)
  processCourse(jobId, session.user.id, CourseName, videoID);

  return NextResponse.json({ jobId });
}