"use client"

import React, { useState, useEffect, useRef } from "react"
import { CourseChapters } from "@/components/general/Course/CourseChapters"
import { CourseViewer } from "@/components/general/Course/CourseViewer"
import { Notes } from "@/components/general/Notes/Notes"
import { SidePanel } from "@/components/general/SidePanel"
import { NotesSkeleton } from "@/components/general/Notes/NotesSkeleton"
import { ChaptersSkeleton } from "@/components/general/Course/ChaptersSkeleton"
import { SidePanelSkeleton } from "@/components/general/SidePanelSkeleton"
import type { Chapter } from "@/types/course"

export default function CoursePage({ params }: { params: Promise<{ id?: string }> }) {
  const { id } = React.use(params)
  const courseId = id as string

  const [selectedTime, setSelectedTime] = useState<number>(0)

  // Data state
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [notesHtml, setNotesHtml] = useState<string>("")
  // quiz/sidepanel data — pass through as-is if SidePanel fetches internally,
  // or add quizData state here if SidePanel also needs to be refactored

  // Loading stages
  const [chaptersLoading, setChaptersLoading] = useState(true)
  const [notesAndQuizLoading, setNotesAndQuizLoading] = useState(true)

  const hasFetched = useRef(false)

  useEffect(() => {
    if (hasFetched.current) return
    hasFetched.current = true

    const run = async () => {
      // Step 1: fetch chapters first
      try {
        const res = await fetch(`/api/courses/${courseId}/chapters`)
        const data = await res.json()
        setChapters(data.chapters ?? [])
      } catch (err) {
        console.error("Failed to fetch chapters:", err)
      } finally {
        setChaptersLoading(false)
      }

      // Step 2: now that chapters are done, fetch notes + quiz in parallel
      try {
        const [notesRes, quizRes] = await Promise.all([
          fetch(`/api/courses/${courseId}/notes`),
          fetch(`/api/courses/${courseId}/quiz`),   // adjust endpoint as needed
        ])
        const [notesData] = await Promise.all([
          notesRes.json(),
          quizRes.json(), // consume but SidePanel may manage its own quiz state
        ])
        setNotesHtml(notesData.notes?.content ?? "")
      } catch (err) {
        console.error("Failed to fetch notes/quiz:", err)
      } finally {
        setNotesAndQuizLoading(false)
      }
    }

    run()
  }, [courseId])

  return (
    <div className="min-h-screen px-[4%] mt-5">

      {/* ── Top row: Viewer (independent) + Chapters (waits for step 1) ── */}
      <div className="flex md:flex-row flex-col gap-6 min-h-[80vh]">
        <CourseViewer
          courseId={courseId}
          seekTime={selectedTime}
        />
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

      {/* ── Bottom row: Notes + SidePanel (waits for step 1 + step 2) ── */}
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
  )
}