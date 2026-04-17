"use client";
import { useParams } from "next/navigation";
import React, { useState, useEffect, useRef } from "react";
import { CourseChapters } from "@/components/general/Course/CourseChapters";
import { CourseViewer } from "@/components/general/Course/CourseViewer";
import { Notes } from "@/components/general/Notes/Notes";
import { SidePanel } from "@/components/general/SidePanel";
import { NotesSkeleton } from "@/components/general/Notes/NotesSkeleton";
import { ChaptersSkeleton } from "@/components/general/Course/ChaptersSkeleton";
import { SidePanelSkeleton } from "@/components/general/SidePanelSkeleton";
import type { Chapter } from "@/types/course";

export default function CoursePage() {
  // ✅ FIX: no React.use nonsense
    const params = useParams<{ id:string }>()
    const courseId=params.id
    const [selectedTime, setSelectedTime] = useState<number>(0);

  // Data state
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [notesHtml, setNotesHtml] = useState<string>("");

  // Loading states
  const [chaptersLoading, setChaptersLoading] = useState(true);
  const [notesAndQuizLoading, setNotesAndQuizLoading] = useState(true);

  const hasFetched = useRef(false);

  useEffect(() => {
    if (!params.id || hasFetched.current) return;
    hasFetched.current = true;

    const controller = new AbortController();

  const run = async () => {
  let chaptersReady = false;

  // ── STEP 1: Chapters ──
  try {
    const res = await fetch(`/api/courses/${courseId}/chapters`, {
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("Chapters API error:", text);
      throw new Error("Failed to fetch chapters");
    }

    const data = await res.json();

    const validChapters = Array.isArray(data?.chapters) && data.chapters.length > 0;

    if (!validChapters) {
      throw new Error("Chapters not ready");
    }

    setChapters(data.chapters);
    chaptersReady = true;

  } catch (err) {
    if ((err as any).name !== "AbortError") {
      console.error("Failed to fetch chapters:", err);
    }
  } finally {
    setChaptersLoading(false);
  }

  // ❗ STOP HERE if chapters not ready
  if (!chaptersReady) {
    setNotesAndQuizLoading(false);
    return;
  }

  // ── STEP 2: Notes + Quiz ──
  try {
    const [notesRes, quizRes] = await Promise.all([
      fetch(`/api/courses/${courseId}/notes`, {
        signal: controller.signal,
      }),
      fetch(`/api/courses/${courseId}/quiz`, {
        signal: controller.signal,
      }),
    ]);

    const notesData = notesRes.ok ? await notesRes.json() : null;

    if (!notesRes.ok) {
      console.error("Notes API error:", await notesRes.text());
    }

    if (!quizRes.ok) {
      console.error("Quiz API error:", await quizRes.text());
    }

    setNotesHtml(notesData?.notes?.content ?? "");

  } catch (err) {
    if ((err as any).name !== "AbortError") {
      console.error("Failed to fetch notes/quiz:", err);
    }
  } finally {
    setNotesAndQuizLoading(false);
  }
};
    run();

    return () => controller.abort(); // ✅ cleanup
  }, [courseId]);

  return (
    <div className="min-h-screen px-[4%] mt-5">
      {/* ── Top row ── */}
      <div className="flex md:flex-row flex-col gap-6 min-h-[80vh]">
        <CourseViewer courseId={courseId} seekTime={selectedTime} />

        {chaptersLoading ? (
          <ChaptersSkeleton />
        ) : (
          <CourseChapters
            courseId={courseId}
            chapters={chapters}
            onChapterClick={setSelectedTime}
          />
        )}
      </div>

      {/* ── Bottom row ── */}
      <div className="flex md:flex-row flex-col md:gap-20 min-h-[80vh] mt-10">
        {notesAndQuizLoading ? (
          <>
            <NotesSkeleton />
            <SidePanelSkeleton />
          </>
        ) : (
          <>
            <Notes notesHtml={notesHtml} />
            <SidePanel courseId={courseId} />
          </>
        )}
      </div>
    </div>
  );
}