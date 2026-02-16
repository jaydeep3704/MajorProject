import { GoogleGenAI } from "@google/genai";

export const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

export type TranscriptItem = {
  start: number;
  end: number;
  text: string;
};

export type Chapter = {
  title: string;
  start: number;
  end: number;
  keywords: string[];
};