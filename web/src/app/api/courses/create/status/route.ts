import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const jobId = req.nextUrl.searchParams.get("jobId");

  const course = await prisma.course.findUnique({
    where: { jobId: jobId! },
  });

  if (!course) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    stage: course.stage,
    message: course.message,
    progress: course.progress,
    courseId: course.id,
  });
}