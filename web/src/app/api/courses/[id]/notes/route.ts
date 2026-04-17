import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/utils/auth";
import prisma from "@/lib/prisma";
import { notes1, notes2 } from "@/utils/gemini";

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
        include: { notes: true },
    });

    if (!course) {
        return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const existing = await prisma.notes.findUnique({
        where: { courseId: id },
    });

    if (existing) {
        return NextResponse.json({ notes: existing });
    }

    const chaptersArray = await prisma.chapter.findMany({
        where: { courseId: course.id },
        orderBy: { index: "asc" },
    });

    const transcriptArray = await prisma.transcriptSegment.findMany({
        where: { courseId: id },
        orderBy: { index: "asc" },
    });

    try {
        const content = await generateWithGeminiParallel(
            chaptersArray,
            transcriptArray
        );

        const structuredChapters = splitHTMLIntoChapters(content);
        const recap = extractRecap(content);

   const note = await prisma.notes.upsert({
            where: { courseId: id },
            update: {
                content,
                contentType: "structured",
                chapters: structuredChapters,
                recap,
            },
            create: {
                courseId: id,
                content,
                contentType: "structured",
                chapters: structuredChapters,
                recap,
            },
        });

        return NextResponse.json({ notes: note });

    } catch (error) {
        console.error("Notes generation failed:", error);
        return NextResponse.json(
            { error: "Failed to generate notes" },
            { status: 500 }
        );
    }
}

//////////////////////////////////////////////////////////
// 🔥 GENERATION FUNCTION (FIXED)
//////////////////////////////////////////////////////////

export async function generateWithGeminiParallel(
    chapters: any[],
    transcripts: any[]
) {
    function getTranscriptForChapter(ch: any) {
        const start = parseFloat(ch.start);
        const end = parseFloat(ch.end);

        const relevant = transcripts.filter(
            (t) => t.start < end && t.end > start
        );

        // 🔥 dynamic limit
        const limit = Math.min(
            Math.max(Math.floor(relevant.length * 0.3), 10), // at least 10
            40 // cap
        );

        return relevant.slice(0, limit).map(t => t.text).join(" ");
    }

    const batches: any[] = [];
    for (let i = 0; i < chapters.length; i += 2) {
        batches.push(chapters.slice(i, i + 2));
    }

    const promises = batches.map((batch, batchIndex) => {
        const client = batchIndex % 2 === 0 ? notes1 : notes2;

        let chapterSection = "";

        batch.forEach((ch: any, idx: number) => {
            const globalIndex = batchIndex * 2 + idx + 1; // ✅ FIXED

            const transcriptText = getTranscriptForChapter(ch);

            chapterSection += `
CHAPTER ${globalIndex}:
TITLE: ${ch.title}

IMPORTANT:
- Render exactly as:
<h2>Chapter ${globalIndex}: ${ch.title}</h2>

TRANSCRIPT:
${transcriptText}
`;
        });

        const prompt = `
You are an expert academic content creator.

OUTPUT REQUIREMENTS:
- Return ONLY valid HTML
- Use semantic tags
- Include structured explanation
- Include code blocks using <pre><code>

IMPORTANT:
- Generate "Key Concepts Recap" ONLY ONCE at the very end of the full response.

STRUCTURE:

<section id="executive-summary">
  <ul>
    <li>5–10 key takeaways</li>
  </ul>
</section>

For each chapter:
<h2>Chapter X: Title</h2>

<h3>Core Concepts</h3>
<h3>Key Definitions</h3>
<h3>How It Works</h3>
<h3>Examples</h3>

Final:
<h2>Key Concepts Recap</h2>

${chapterSection}

Generate structured HTML notes now.
`;

        return client.models.generateContent({
            model: "gemma-4-31b-it",
            contents: prompt,
        });
    });

    const responses = await Promise.all(promises);

    return responses.map((r) => r.text || "").join("\n\n");
}

//////////////////////////////////////////////////////////
// 🔥 SPLIT CHAPTERS (FIXED)
//////////////////////////////////////////////////////////

function splitHTMLIntoChapters(html: string) {
    const regex = /<h2>(.*?)<\/h2>/g;
    const parts = html.split(regex);

    const chapters = [];

    for (let i = 1; i < parts.length; i += 2) {
        const title = parts[i];
        const content = parts[i + 1] || "";

        // ❌ REMOVE recap from chapters
        if (title.includes("Key Concepts Recap")) continue;

        chapters.push({
            title: title.replace(/Chapter \d+:\s*/, ""),
            content: `<h2>${title}</h2>${content}`,
        });
    }

    return chapters;
}

//////////////////////////////////////////////////////////
// 🔥 RECAP (ONLY LAST ONE)
//////////////////////////////////////////////////////////

function extractRecap(html: string) {
    const matches = html.match(
        /<h2>Key Concepts Recap<\/h2>[\s\S]*?(?=<h2>|$)/g
    );

    if (!matches || matches.length === 0) return null;

    return matches[matches.length - 1]; // ✅ last only
}