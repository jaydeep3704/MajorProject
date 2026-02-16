import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/utils/auth";
import prisma from "@/lib/prisma";
import { groq } from "@/utils/groq";
interface RouteContext {
    params: { id: string };
}

const MODEL = 'gemini-2.0-flash-lite'


export async function GET(request: NextRequest, { params }: RouteContext) {
    const { id } = await params
    const session = await auth()
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const course = await prisma.course.findUnique({
        where: {
            id: id
        },
        include: {
            transcripts: true,
            notes: true,
        }
    })

    if (course?.notes) {
        return NextResponse.json({ notes: course.notes, message: "Notes fetched sucessfully" })
    }

    let transcript_text = course?.transcripts
        .map(t => t.text)
        .join(" ") as string;

    const words = transcript_text.trim().split(/\s+/);
    if (words.length > 30000) {
        words.slice(0, 30000)
    }

    const filteredTranscript = words.join(" ")

    const chaptersArray = await prisma.chapter.findMany({
        where: {
            courseId: course?.id
        }
    })
    let chapters = ''
    chaptersArray.forEach((chapter) => {
        chapters += `${chapter.title},`
    })


    let prompt = `
                You are an expert academic content creator.

                You are provided with:
                
                1. A list of possible chapter titles.

                Your responsibilities:

                
                - Select only the most meaningful and logically distinct chapters from the provided list.
                - Remove irrelevant or redundant chapters.
                - Merge closely related chapters if necessary.
               

                OUTPUT REQUIREMENTS:

                1. Return ONLY valid HTML. No markdown.
                2. Do NOT include <html>, <head>, or <body> tags.
                3. Use semantic HTML structure:
                - <h2> for each selected chapter
                - <h3> for subtopics
                - <ul>, <ol>, <li> for structured lists
                - <strong> for key terms
                - <code> for technical terms where appropriate
                - <blockquote> only for important conceptual explanations

                STRUCTURE:

                <section id="executive-summary">
                - 5–10 concise but meaningful key takeaways in bullet form
                </section>

                Then generate structured chapter content:

                - Each selected chapter must begin with:
                <h2>Chapter X: Descriptive Title</h2>

                - Within each chapter:
                • Clearly explain core ideas
                • Define important terms
                • Break complex ideas into understandable steps
                • Avoid repetition
                • Maintain logical flow

                Final Section:

                <h2>Key Concepts Recap</h2>
                - Bullet list of the most important concepts across all chapters

                DEPTH REQUIREMENTS:

                - The notes must be detailed and comprehensive.
                - Coverage must go beyond a superficial summary.
                - All major ideas must be explained clearly.
                - Expand complex topics properly rather than compressing them.

                CONTENT CONSTRAINTS:
                - Do NOT include meta commentary.
                - Maintain a professional academic tone.

                Generate the complete structured HTML notes now.


                ----------------------------------------
                POSSIBLE CHAPTERS:
                ${chapters}`;


    const notes= await groq.chat.completions.create({
        messages: [
            {
                role: "user",
                content: prompt,
            },
        ],
        model: "groq/compound-mini",
    });

    if(notes.choices[0].message.content){
       const note= await prisma.notes.create({
            data:{
                courseId:id,
                content:notes.choices[0].message.content,
            }
        })

        if(note){
            return NextResponse.json({ id, data: "Notes Created sucessfully" })
        }
    
    }

    console.log( notes.choices[0].message.content);




    return NextResponse.json({ id, data: "Notes fetched successfully",notes:notes.choices[0].message.content })
}


