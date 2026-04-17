"use client";

import { useParams } from "next/navigation";
import React, { useState, useEffect } from "react";
import { CourseChapters } from "@/components/general/Course/CourseChapters";
import { CourseViewer } from "@/components/general/Course/CourseViewer";
import { Notes } from "@/components/general/Notes/Notes";
import { SidePanel } from "@/components/general/SidePanel";
import { NotesSkeleton } from "@/components/general/Notes/NotesSkeleton";
import { ChaptersSkeleton } from "@/components/general/Course/ChaptersSkeleton";
import { SidePanelSkeleton } from "@/components/general/SidePanelSkeleton";
import type { Chapter } from "@/types/course";

export default function CoursePage() {
  const params = useParams<{ id: string }>();
  const courseId = params.id;

  const [selectedTime, setSelectedTime] = useState<number>(0);

  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [notesData, setNotesData] = useState<any>(null);

  const [chaptersLoading, setChaptersLoading] = useState(true);
  const [notesAndQuizLoading, setNotesAndQuizLoading] = useState(true);

  // 🔥 RESET state when route changes
  useEffect(() => {
    if (!courseId) return;

    setChapters([]);
    setNotesData(null);
    setChaptersLoading(true);
    setNotesAndQuizLoading(true);
  }, [courseId]);

  // 🔥 MAIN FETCH
  useEffect(() => {
    if (!courseId) return;

    const controller = new AbortController();

    const run = async () => {
      // ── FETCH CHAPTERS ──
      const chaptersPromise = fetch(`/api/courses/${courseId}/chapters`, {
        signal: controller.signal,
      })
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data?.chapters)) {
            setChapters(data.chapters);
          }
        })
        .catch((err: any) => {
          if (err.name !== "AbortError") {
            console.error("Chapters error:", err);
          }
        })
        .finally(() => {
          setChaptersLoading(false);
        });

      // ── FETCH NOTES ──
      const notesPromise = fetch(`/api/courses/${courseId}/notes`, {
        signal: controller.signal,
      })
        .then(res => res.json())
        .then(data => {
          setNotesData(data?.notes ?? null);
        })
        .catch((err: any) => {
          if (err.name !== "AbortError") {
            console.error("Notes error:", err);
          }
        })
        .finally(() => {
          setNotesAndQuizLoading(false);
        });

      // 🔥 run BOTH independently
      await Promise.allSettled([chaptersPromise, notesPromise]);
    };
    run();

    return () => controller.abort();
  }, [courseId]);

  return (
    <div className="min-h-screen px-[4%] mt-5">
      {/* ── Top Section ── */}
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

      {/* ── Bottom Section ── */}
      <div className="flex md:flex-row flex-col md:gap-20 min-h-[80vh] mt-10">
        {notesAndQuizLoading ? (
          <>
            <NotesSkeleton />
            <SidePanelSkeleton />
          </>
        ) : (
          <>
            <Notes
              contentType={notesData?.contentType || "html"}
              notesHtml={notesData?.content}
              chapters={notesData?.chapters}
              recap={notesData?.recap}
            />
            <SidePanel courseId={courseId} />
          </>
        )}
      </div>
    </div>
  );
}