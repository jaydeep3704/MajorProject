import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/utils/auth";
import { Session } from "@auth/core/types";
import { Metadata } from "@/types/course";
export async function POST(request: NextRequest) {
  const body = await request.json();
  const session: any = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { message: "Unauthorized" },
      { status: 401 }
    );
  }
  const { CourseName, videoID } = body;

  if (!CourseName || !videoID) {
    return NextResponse.json({ status: 400, message: "Course Name and Video ID are required" })
  }

  try {
    const res_metadata = await fetch(`${process.env.FASTAPI_BACKEND_URL}/youtube/metadata`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: `https://www.youtube.com/watch?v=${videoID}`,
      }),
    });

    const res_transcript = await fetch(`${process.env.FASTAPI_BACKEND_URL}/youtube/transcript/segmented`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: `https://www.youtube.com/watch?v=${videoID}`,
      }),
    })
    const metadata:Metadata = await res_metadata.json();
    const transcript = await res_transcript.json();
    
     const course = await prisma.course.create({
      data: {
        title: CourseName,
        youtubeUrl: `https://www.youtube.com/watch?v=${videoID}`,
        userId: session.user.id,
        status: "PROCESSING",
      },
    });

     await prisma.courseMetadata.create({
      data: {
        courseId: course.id,
        title: metadata.title,
        description: metadata.description,
        thumbnail: metadata.thumbnail,
        duration: metadata.duration,
      },
    });

    if (transcript.segments?.length) {
      await prisma.transcriptSegment.createMany({
        data: transcript.segments.map((segment: any, index: number) => ({
          courseId: course.id,
          start: segment.start,
          end: segment.end,
          text: segment.text,
          index,
        })),
      });
    }

     await prisma.course.update({
      where: { id: course.id },
      data: { status: "COMPLETED" },
    });

    
    
    return NextResponse.json({
      message: "Course Created Successfully",
    });


  } catch (error) {
    console.log("Failed to create course")
  }
}
