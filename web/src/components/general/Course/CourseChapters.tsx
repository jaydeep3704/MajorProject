"use client"

import { Chapter } from "@/types/course"
import React, { useState } from "react"
import { Loader2, PlayCircle, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"

interface CourseChaptersProps {
  courseId: string
  chapters: Chapter[]                    // ← lifted up, no internal fetch
  onChapterClick: (time: number) => void
}

export const CourseChapters = ({ courseId, chapters, onChapterClick }: CourseChaptersProps) => {
  const [activeIndex, setActiveIndex] = useState<number>(0)
  const [isDeleting, setIsDeleting] = useState(false)
  const router = useRouter()

  async function deleteCourse() {
    if (!courseId) return
    setIsDeleting(true)
    try {
      const res = await fetch("/api/courses/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId }),
      })
      if (res.ok) router.push("/courses")
    } catch (err) {
      console.error("Failed to delete course:", err)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="lg:flex-1 bg-card rounded-lg p-6 max-h-[30vh] md:max-h-[90vh] overflow-y-auto no-scrollbar shadow-md">
      <h2 className="text-lg font-semibold text-foreground mb-4 flex justify-between items-center">
        Course Content
        <Button onClick={deleteCourse} variant="ghost" disabled={isDeleting}>
          {isDeleting ? <Loader2 className="animate-spin" /> : <Trash2 />}
        </Button>
      </h2>

      <div className="space-y-2">
        {chapters.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No chapters available</p>
          </div>
        ) : (
          chapters.map((chapter, index) => (
            <button
              key={index}
              onClick={() => {
                setActiveIndex(index)
                onChapterClick(Number.parseInt(chapter.start))
              }}
              className={`w-full p-4 rounded-lg transition-all duration-200 text-left group ${
                activeIndex === index
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "bg-muted hover:bg-muted/80 text-foreground hover:shadow-sm"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <PlayCircle className={`w-4 h-4 flex-shrink-0 ${activeIndex === index ? "group-hover:scale-110" : ""}`} />
                    <p className="font-medium truncate text-sm md:text-base">{chapter.title}</p>
                  </div>
                  <p className={`text-xs md:text-sm opacity-75 ${
                    activeIndex === index ? "text-primary-foreground" : "text-muted-foreground"
                  }`}>
                    Chapter {index + 1}
                  </p>
                </div>
                <span className={`flex-shrink-0 text-xs md:text-sm font-mono font-semibold ${
                  activeIndex === index ? "text-primary-foreground" : "text-muted-foreground"
                }`}>
                  {formatToHHMMSS(Number.parseInt(chapter.start))}
                </span>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}

function formatToHHMMSS(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const pad = (n: number) => n.toString().padStart(2, "0")
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
}