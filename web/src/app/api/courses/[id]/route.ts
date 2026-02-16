import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

interface RouteContext {
  params: { id: string };
}

export async function GET(
  request: Request,
  { params }: RouteContext
) {
  try {
    const { id } =await  params;

    if (!id) {
      return NextResponse.json(
        { error: "Course ID is required" },
        { status: 400 }
      );
    }

    const course = await prisma.course.findUnique({
      where: { id },
      include: {
        chapters: {
          orderBy: { index: "asc" },
        },
      },
    });

    if (!course) {
      return NextResponse.json(
        { error: "Course not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(course);

  } catch (error) {
    console.error("GET /api/courses/[id] error:", error);

    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
