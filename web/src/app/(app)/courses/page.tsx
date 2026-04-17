"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Search } from "lucide-react";
import { CreateCourseModal } from "@/components/general/Course/CreateCourseModal";
import { CourseCard } from "@/components/general/Course/CourseCard";
import type { Course } from "@/types/course";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

export default function CoursesPage() {
  const router = useRouter();

  const [courses, setCourses] = useState<Course[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // ✅ Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 3;

  useEffect(() => {
    loadCourses();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

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

  const handleCourseCreated = async () => {
    await loadCourses();
    router.refresh();
  };

  // ✅ Filter
  const filteredCourses = courses.filter((course) =>
    course.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ✅ Pagination logic
  const totalPages = Math.ceil(filteredCourses.length / ITEMS_PER_PAGE);

  const paginatedCourses = filteredCourses.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  return (
    <section className="min-h-screen w-full px-[4%] py-4">
      {/* HERO */}
      <div className="relative w-full max-w-7xl mx-auto mb-8 rounded-3xl overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url(/illustration.jpg)" }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/40 via-purple-600/30 to-pink-600/40 dark:hidden" />
        <div className="absolute inset-0 bg-black/55 hidden dark:block" />

        <div className="relative z-10 px-6 py-20 sm:px-12 text-center space-y-6">
          <h1 className="text-4xl font-bold text-white">Welcome Back!</h1>
          <p className="text-xl text-white/90">
            Continue learning or create a new course
          </p>
          <Button
            size="lg"
            onClick={() => setIsModalOpen(true)}
            className="bg-purple-600 hover:bg-purple-700"
          >
            + Create New Course
          </Button>
        </div>
      </div>

      {/* COURSES */}
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6 gap-4">
          <h2 className="text-2xl font-bold">Your Courses</h2>

          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
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
            <Button onClick={() => setIsModalOpen(true)}>
              Create Course
            </Button>
          </Card>
        ) : filteredCourses.length === 0 ? (
          <Card className="p-12 text-center">
            <p>No results for "{searchQuery}"</p>
          </Card>
        ) : (
          <>
            {/* GRID */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {paginatedCourses.map((course) => (
                <CourseCard
                  key={course.id}
                  course={course}
                  onClick={() => router.push(`/courses/${course.id}`)}
                />
              ))}
            </div>

            {/* PAGINATION */}
            {totalPages > 1 && (
              <Pagination className="mt-6">
                <PaginationContent>
                  {/* PREV */}
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() =>
                        setCurrentPage((p) => Math.max(p - 1, 1))
                      }
                    />
                  </PaginationItem>

                  {/* NUMBERS */}
                  {Array.from({ length: totalPages }).map((_, i) => {
                    const page = i + 1;
                    return (
                      <PaginationItem key={page}>
                        <PaginationLink
                          isActive={currentPage === page}
                          onClick={() => setCurrentPage(page)}
                        >
                          {page}
                        </PaginationLink>
                      </PaginationItem>
                    );
                  })}

                  {/* NEXT */}
                  <PaginationItem>
                    <PaginationNext
                      onClick={() =>
                        setCurrentPage((p) =>
                          Math.min(p + 1, totalPages)
                        )
                      }
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            )}
          </>
        )}
      </div>

      {/* MODAL */}
      <CreateCourseModal
        isOpen={isModalOpen}
        onOpenChange={setIsModalOpen}
        onCourseCreated={handleCourseCreated}
      />
    </section>
  );
}