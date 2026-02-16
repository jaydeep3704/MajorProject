import prisma from "@/lib/prisma";
import { auth } from "@/utils/auth";
import { NextRequest, NextResponse } from "next/server";
import { groq } from "@/utils/groq";

interface RouteContext {
    params: { id: string };
}

interface Question {
    type: "mcq" | "short_answer";
    question: string;
    options?: string[];
    answer: string;
    explanation: string;
}

interface QuizContent {
    title: string;
    questions: Question[];
}

// Custom error classes for better error handling
class QuizGenerationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "QuizGenerationError";
    }
}

class ValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ValidationError";
    }
}

export async function GET(request: NextRequest, { params }: RouteContext) {
    try {
        // Extract and validate params
        const { id } = await params;
        
        if (!id) {
            return NextResponse.json(
                { error: "Course ID is required" },
                { status: 400 }
            );
        }

        // Authenticate user
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json(
                { error: "Unauthorized. Please sign in to access this quiz." },
                { status: 401 }
            );
        }

        // Fetch course with related data
        const course = await prisma.course.findUnique({
            where: { id },
            include: {
                quiz: {
                    select: {
                        content: true,
                    },
                },
                chapters: {
                    select: {
                        index: true,
                        title: true,
                    },
                    orderBy: {
                        index: "asc",
                    },
                },
            },
        });

        // Validate course exists
        if (!course) {
            return NextResponse.json(
                { error: "Course not found" },
                { status: 404 }
            );
        }

        // Return existing quiz if available
        if (course.quiz?.content) {
            return NextResponse.json({
                quiz: course.quiz.content,
                message: "Quiz fetched successfully",
                cached: true,
            });
        }

        // Validate course has necessary data for quiz generation
        if (!course.chapters || course.chapters.length === 0) {
            return NextResponse.json(
                { error: "No chapters available for this course. Cannot generate quiz." },
                { status: 400 }
            );
        }

        // Format chapters information
        const chaptersText = course.chapters
            .map((chapter) => `Chapter ${chapter.index}: ${chapter.title}`)
            .join(", ");

        // Generate quiz using only chapter information to avoid 413 errors
        console.log(`Generating quiz for course: ${course.title} (ID: ${id})`);
        
        const quizContent = await generate_quiz(
            course.title,
            chaptersText
        );

        if (!quizContent) {
            throw new QuizGenerationError("Quiz generation returned empty content");
        }

        // Validate quiz structure
        validateQuizContent(quizContent);

        // Save quiz to database
        const savedQuiz = await prisma.quiz.create({
            data: {
                courseId: id,
                content: quizContent as any,
            },
        });

        console.log(`Quiz successfully created for course: ${id}`);

        return NextResponse.json({
            quiz: savedQuiz.content,
            message: "Quiz generated successfully",
            cached: false,
        });

    } catch (error) {
        console.error("Error in quiz route:", error);

        // Handle specific error types
        if (error instanceof ValidationError) {
            return NextResponse.json(
                { error: error.message },
                { status: 400 }
            );
        }

        if (error instanceof QuizGenerationError) {
            return NextResponse.json(
                { error: "Failed to generate quiz. Please try again later." },
                { status: 500 }
            );
        }

        // Handle Prisma errors
        if (error && typeof error === "object" && "code" in error) {
            const prismaError = error as { code: string; meta?: any };
            
            if (prismaError.code === "P2002") {
                return NextResponse.json(
                    { error: "A quiz already exists for this course" },
                    { status: 409 }
                );
            }

            if (prismaError.code === "P2025") {
                return NextResponse.json(
                    { error: "Course not found" },
                    { status: 404 }
                );
            }
        }

        // Generic error response
        return NextResponse.json(
            {
                error: "An unexpected error occurred while processing your request",
                details: process.env.NODE_ENV === "development" 
                    ? (error instanceof Error ? error.message : "Unknown error")
                    : undefined
            },
            { status: 500 }
        );
    }
}

async function generate_quiz(
    course_title: string,
    chapters: string
): Promise<QuizContent | null> {
    // Use only chapters to avoid 413 Request Too Large errors
    // Transcript can be very large and cause API failures
    const prompt = `Generate a technical quiz for: "${course_title}"

Course Structure:
${chapters}

Requirements:
- Create 8-10 multiple choice questions (MCQ ONLY)
- Each question must have exactly 4 options
- Include code snippets in at least 40% of questions
- Intermediate difficulty
- Test practical understanding

CRITICAL FORMATTING RULES - USE CLEAN HTML:
- Use simple HTML tags
- For code blocks, use: <pre><code>code here</code></pre> (NO language class needed)
- For inline code, use: <code>text</code>
- For paragraphs, use: <p>text</p>
- DO NOT add extra formatting, classes, or styling
- Keep code blocks clean and simple

Example with code:
"question": "<p>What does this code output?</p><pre><code>const x = 5;
console.log(x * 2);</code></pre>",
"options": [
  "<p>Prints <code>10</code> to console</p>",
  "<p>Shows <code>52</code></p>",
  "<p>Returns <code>undefined</code></p>",
  "<p>Throws an error</p>"
]

Return ONLY valid JSON (no markdown code blocks):
{
  "title": "${course_title} Quiz",
  "questions": [
    {
      "type": "mcq",
      "question": "<p>What is...</p>",
      "options": ["<p>Option A</p>", "<p>Option B</p>", "<p>Option C</p>", "<p>Option D</p>"],
      "answer": "<p>Option A</p>",
      "explanation": "<p>The answer is A because...</p>"
    }
  ]
}`;

    const MAX_RETRIES = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            console.log(`Quiz generation attempt ${attempt}/${MAX_RETRIES}`);

            const response = await groq.chat.completions.create({
                messages: [
                    {
                        role: "system",
                        content: "You are a quiz generator that outputs ONLY valid JSON. Never include markdown formatting or explanations outside the JSON structure."
                    },
                    {
                        role: "user",
                        content: prompt,
                    },
                ],
                model: "groq/compound-mini",
                temperature: 0.7,
                max_tokens: 4000,
            });

            const content = response.choices[0]?.message?.content;

            if (!content) {
                throw new QuizGenerationError("Empty response from AI model");
            }

            // Clean up the response - remove markdown code blocks if present
            let cleanedContent = content.trim();
            
            // Remove markdown code blocks
            cleanedContent = cleanedContent.replace(/```json\s*/g, "");
            cleanedContent = cleanedContent.replace(/```\s*/g, "");
            cleanedContent = cleanedContent.trim();

            // Parse JSON
            const parsedQuiz = JSON.parse(cleanedContent);

            // Validate basic structure
            if (!parsedQuiz.title || !parsedQuiz.questions || !Array.isArray(parsedQuiz.questions)) {
                throw new ValidationError("Invalid quiz structure returned from AI");
            }

            if (parsedQuiz.questions.length === 0) {
                throw new ValidationError("No questions generated");
            }

            console.log(`Successfully generated quiz with ${parsedQuiz.questions.length} questions`);
            
            return parsedQuiz as QuizContent;

        } catch (error) {
            lastError = error as Error;
            console.error(`Quiz generation attempt ${attempt} failed:`, error);

            // Don't retry validation errors
            if (error instanceof ValidationError) {
                throw error;
            }

            // Handle JSON parsing errors
            if (error instanceof SyntaxError) {
                console.error("JSON parsing failed. Response might be malformed.");
                
                if (attempt === MAX_RETRIES) {
                    throw new QuizGenerationError(
                        "Failed to parse quiz response after multiple attempts"
                    );
                }
                
                // Wait before retry with exponential backoff
                await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
                continue;
            }

            // Handle API rate limiting or network errors
            if (error && typeof error === "object" && "status" in error) {
                const apiError = error as { status: number };
                
                if (apiError.status === 429) {
                    console.error("Rate limit exceeded");
                    
                    if (attempt === MAX_RETRIES) {
                        throw new QuizGenerationError(
                            "API rate limit exceeded. Please try again in a few minutes."
                        );
                    }
                    
                    // Wait much longer for rate limits (45+ seconds based on API message)
                    const waitTime = 50000 * attempt; // 50s, 100s, 150s
                    console.log(`Waiting ${waitTime/1000}s before retry due to rate limit...`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                    continue;
                }
            }

            // If last attempt, throw the error
            if (attempt === MAX_RETRIES) {
                throw new QuizGenerationError(
                    lastError?.message || "Failed to generate quiz after multiple attempts"
                );
            }

            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
    }

    // Should not reach here, but just in case
    throw new QuizGenerationError(
        lastError?.message || "Failed to generate quiz"
    );
}

function validateQuizContent(quiz: QuizContent): void {
    // Validate title
    if (!quiz.title || typeof quiz.title !== "string" || quiz.title.trim().length === 0) {
        throw new ValidationError("Quiz must have a valid title");
    }

    // Validate questions array
    if (!Array.isArray(quiz.questions) || quiz.questions.length === 0) {
        throw new ValidationError("Quiz must contain at least one question");
    }

    if (quiz.questions.length > 20) {
        throw new ValidationError("Quiz cannot contain more than 20 questions");
    }

    // Validate each question
    quiz.questions.forEach((question, index) => {
        const questionNum = index + 1;

        // Validate type - only MCQ allowed
        if (question.type !== "mcq") {
            throw new ValidationError(
                `Question ${questionNum}: Only MCQ questions are allowed`
            );
        }

        // Validate question text
        if (!question.question || typeof question.question !== "string" || question.question.trim().length === 0) {
            throw new ValidationError(
                `Question ${questionNum}: Question text is required`
            );
        }

        // Validate MCQ fields
        if (!Array.isArray(question.options) || question.options.length !== 4) {
            throw new ValidationError(
                `Question ${questionNum}: MCQ must have exactly 4 options`
            );
        }

        if (question.options.some(opt => !opt || typeof opt !== "string" || opt.trim().length === 0)) {
            throw new ValidationError(
                `Question ${questionNum}: All options must be non-empty strings`
            );
        }

        // Validate answer
        if (!question.answer || typeof question.answer !== "string" || question.answer.trim().length === 0) {
            throw new ValidationError(
                `Question ${questionNum}: Answer is required`
            );
        }

        // Validate explanation
        if (!question.explanation || typeof question.explanation !== "string" || question.explanation.trim().length === 0) {
            throw new ValidationError(
                `Question ${questionNum}: Explanation is required`
            );
        }

        // Validate that answer matches one of the options
        const answerMatches = question.options.some(
            opt => opt.trim() === question.answer.trim()
        );
        
        if (!answerMatches) {
            console.warn(
                `Question ${questionNum}: Answer doesn't match any option exactly. This may cause validation issues.`
            );
        }
    });
}

export { GET as default };