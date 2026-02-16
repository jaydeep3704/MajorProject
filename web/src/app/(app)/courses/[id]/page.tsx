"use client"

import React,{ useState } from "react"
import { CourseChapters } from "@/components/general/Course/CourseChapters"
import { CourseViewer } from "@/components/general/Course/CourseViewer"
import { Notes } from "@/components/general/Notes/Notes"
import { Card } from "@/components/ui/card"
import { SidePanel } from "@/components/general/SidePanel"

export default function CoursePage({ params }: { params: Promise<{ id?: string }> }) {
  const [selectedTime, setSelectedTime] = useState<number>(0)
  const {id}=React.use(params)
  return (
    <div className="min-h-screen px-[4%] mt-5">
      <div className="flex md:flex-row flex-col gap-6 min-h-[80vh]">
        <CourseViewer
          courseId={id as string}
          seekTime={selectedTime}
        />
        <CourseChapters
          courseId={id as string}
          onChapterClick={setSelectedTime}
        />
      </div>
      <div className="flex md:flex-row flex-col md:gap-20  min-h-[80vh] mt-10 ">
        <Notes courseId={id as string}/>
        <SidePanel courseId={id as string}/>
      </div>
    </div>
  )
}
