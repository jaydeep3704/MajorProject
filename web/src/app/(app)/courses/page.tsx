"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Search } from "lucide-react";
import { CreateCourseModal } from "@/components/general/Course/CreateCourseModal";
import { CourseCard } from "@/components/general/Course/CourseCard";
import type { Course } from "@/types/course";

export default function CoursesPage() {
  const router = useRouter();

  const [courses, setCourses] = useState<Course[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadCourses();
  }, []);

  const loadCourses = async () => {
    try {
      const response = await fetch("/api/courses");

      if (!response.ok) {
        throw new Error("Failed to load courses");
      }

      const data = await response.json();
      setCourses(data.courses);
    } catch (error) {
      console.error("Error loading courses:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCourseCreated = async (newCourse: Course) => {
    await loadCourses();
    router.refresh();
  };

  const filteredCourses = courses.filter((course) =>
    course.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <section className="min-h-screen w-full px-[4%] py-4">
      {/* ================= Hero Section ================= */}
      <Card className="py-20 max-w-7xl h-[400px] bg-[url(/illustration.jpg)] bg-cover bg-center mx-auto relative rounded-3xl overflow-hidden mb-8">
        <div className="absolute inset-0 bg-black/60"></div>

        <div className="relative z-10">
          <CardHeader>
            <CardTitle className="text-center font-bold lg:text-5xl text-2xl drop-shadow-md text-white">
              Welcome Back!
            </CardTitle>
            <CardDescription className="text-center lg:text-2xl text-lg font-bold text-gray-300 drop-shadow-md">
              Continue your learning journey or create a new course from any
              YouTube video
            </CardDescription>
          </CardHeader>

          <CardContent className="flex justify-center items-center py-5">
            <Button
              size="lg"
              onClick={() => setIsModalOpen(true)}
              className="text-lg px-8 py-6"
            >
              + Create New Course
            </Button>
          </CardContent>
        </div>
      </Card>

      {/* ================= Course Grid ================= */}
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6 gap-4">
          <h2 className="text-2xl font-bold shrink-0">Your Courses</h2>

          {/* Search Bar */}
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              type="text"
              placeholder="Search courses..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <Loader2 className="h-8 w-8 animate-spin mx-auto" />
          </div>
        ) : filteredCourses.length === 0 && courses.length === 0 ? (
          <Card className="p-12 text-center">
            <p className="text-gray-500 mb-4 text-xl">No courses yet</p>
            <Button
              onClick={() => setIsModalOpen(true)}
              variant="outline"
              className="w-sm mx-auto"
            >
              Create Your First Course
            </Button>
          </Card>
        ) : filteredCourses.length === 0 ? (
          <Card className="p-12 text-center">
            <p className="text-gray-500 text-xl">
              No courses match &quot;{searchQuery}&quot;
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCourses.map((course) => (
              <CourseCard
                key={course.id}
                course={course}
                onClick={() => router.push(`/courses/${course.id}`)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ================= Create Course Modal ================= */}
      <CreateCourseModal
        isOpen={isModalOpen}
        onOpenChange={setIsModalOpen}
        onCourseCreated={handleCourseCreated}
      />
    </section>
  );
}