import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/utils/auth";
import prisma from "@/lib/prisma";
import { groq } from "@/utils/groq";
import { error } from "console";

interface RouteContext {
    params: { id: string };
}

export async function GET(request: NextRequest, { params }: RouteContext) {
    const { id } = await params;
    const session = await auth();

    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const course = await prisma.course.findUnique({
        where: { id },
        include: { notes: true }  // no transcripts needed
    });

    if (!course) {
        return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    if (course.notes) {
        return NextResponse.json({ notes: course.notes, message: "Notes fetched successfully" });
    }

    const chaptersArray = await prisma.chapter.findMany({
        where: { courseId: course.id }
    });

    const chapters = chaptersArray.map(c => c.title).join(", ");
    console.log(chapters)
    if(!chapters) return NextResponse.json({error:"Not able to generate notes (No chapters found)"},{status:400})

    const prompt = `
You are an expert academic content creator.

You are provided with a list of chapter titles from a video course.

OUTPUT REQUIREMENTS:
1. Return ONLY valid HTML. No markdown.
2. Do NOT include <html>, <head>, or <body> tags.
3. Use semantic HTML:
   - <h2> for each chapter
   - <h3> for subtopics
   - <ul>, <ol>, <li> for lists
   - <strong> for key terms
   - <code> for technical terms
   - <blockquote> for important conceptual explanations
4. If you cannot generate anything return an empty string

STRUCTURE:
<section id="executive-summary">
  5–10 concise key takeaways in bullet form
</section>

Then for each chapter:
<h2>Chapter X: Descriptive Title</h2>
- Explain core ideas
- Define important terms
- Break complex ideas into steps
- Maintain logical flow

Final section:
<h2>Key Concepts Recap</h2>
- Bullet list of the most important concepts

TONE: Professional academic. No meta commentary.

CHAPTER TITLES:
${chapters}

Generate the complete structured HTML notes now.`;

    try {
        const completion = await groq.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            model: "groq/compound-mini",
        });

        const content = completion.choices[0].message.content;

        if (!content) {
            return NextResponse.json({ error: "No content generated" }, { status: 500 });
        }

        const note = await prisma.notes.create({
            data: { courseId: id, content }
        });

        return NextResponse.json({ notes: note, message: "Notes created successfully" });

    } catch (error) {
        console.error("Notes generation failed:", error);
        return NextResponse.json({ error: "Failed to generate notes" }, { status: 500 });
    }
}