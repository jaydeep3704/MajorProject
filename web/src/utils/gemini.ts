import { GoogleGenAI } from "@google/genai";

export const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

export const notes1=new GoogleGenAI({
  apiKey:process.env.NOTES_API_KEY_1!
})

export const notes2=new GoogleGenAI({
  apiKey:process.env.NOTES_API_KEY_2!
})

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