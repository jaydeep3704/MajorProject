import { NextResponse, NextRequest } from "next/server";
import { auth } from "@/utils/auth";
import prisma from "@/lib/prisma";
export async function GET(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    try {

        const courses = await prisma.course.findMany({
            where: {
                userId: session.user.id
            }
        })

        if (courses) {
            return NextResponse.json({ courses, message: "Courses fetched successfully" }, { status: 200 })
        }
    } catch (error) {
        return NextResponse.json({ message: "Failed to fetch courses" }, { status: 500 });
    }
}