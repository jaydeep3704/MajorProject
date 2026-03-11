"use client"

import React, { useState, useEffect, useRef } from "react"
import { Course } from "@/types/course"

declare global {
  interface Window {
    YT: any
    onYouTubeIframeAPIReady: () => void
  }
}

interface CourseViewerProps {
  courseId: string
  seekTime: number
}

export const CourseViewer = ({
  courseId,
  seekTime,
}: CourseViewerProps) => {
  const [course, setCourse] = useState<Course | null>(null)
  const [videoId, setVideoId] = useState<string>("")

  const playerRef = useRef<any | null>(null)
  const playerContainerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    getCourse()
  }, [])

  useEffect(() => {
    if (!videoId) return

    if (!window.YT) {
      const tag = document.createElement("script")
      tag.src = "https://www.youtube.com/iframe_api"
      document.body.appendChild(tag)

      window.onYouTubeIframeAPIReady = initializePlayer
    } else {
      initializePlayer()
    }
  }, [videoId])

  useEffect(() => {
    if (seekTime > 0) {
      playerRef.current?.seekTo(seekTime, true)
      playerRef.current?.playVideo()
    }
  }, [seekTime])

  const initializePlayer = () => {
    if (!playerContainerRef.current) return
    if (playerRef.current) return

    playerRef.current = new window.YT.Player(playerContainerRef.current, {
      videoId,
      playerVars: {
        controls: 0,
        modestbranding: 1,
        rel: 0,
        disablekb: 1,
      },
    })
  }

  const getCourse = async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_URL}/api/courses/${courseId}`
      )

      const data = await response.json()

      if (!data) return

      setCourse(data)

      const url = new URL(data.youtubeUrl)

      const id =
        url.searchParams.get("v") ||
        data.youtubeUrl.split("youtu.be/")[1]

      setVideoId(id || "")
    } catch (error) {
      console.log(error)
    }
  }

  return (
    <div className="lg:flex-3 bg-card rounded-lg p-4 shadow-md border relative">
      {course && (
        <div>
          <h1 className="mb-2 text-xl font-bold">
            ✨ {course.title}
          </h1>

          <div className="aspect-video rounded-lg overflow-hidden">
            <div ref={playerContainerRef} className="w-full h-full" />
          </div>
        </div>
      )}
    </div>
  )
}