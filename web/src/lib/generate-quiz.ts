import { ai } from "@/utils/gemini";

export async function generateQuiz(transcript: string) {
  const prompt = `
You are an educational assessment expert.

From the transcript below, generate 5–10 high-quality multiple choice questions.

Rules:
- Each question must include:
  - question
  - 4 options
  - correctAnswer (index 0-3)
- Questions must test understanding, not trivial facts.
- Return ONLY valid JSON.
- Format:

[
  {
    "question": "Question text",
    "options": ["A", "B", "C", "D"],
    "correctAnswer": 2
  }
]

Transcript:
${transcript}
`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
  });

  if (!response.text) {
    throw new Error("Empty Gemini response");
  }

  return JSON.parse(response.text);
}
