import { NextRequest,NextResponse } from "next/server";
import { auth } from "@/utils/auth";
import prisma from "@/lib/prisma";
export async function POST(request:NextRequest) {
    const session=await auth()
    if(!session?.user?.id){
        return NextResponse.json({message:"Unauthorized"},{status:401})
    }
    const body=await request.json()
    const {courseId}=body

    if(!courseId){
        return NextResponse.json({message:"Course ID is required"},{status:400})
    }

    try {
        await prisma.course.delete({
            where:{
                id:courseId
            }
        })

        return NextResponse.json({message:"Course deleted successfully"},{status:200})
    } catch (error) {
        return NextResponse.json({message:"Error deleting course"},{status:500})
    }
}