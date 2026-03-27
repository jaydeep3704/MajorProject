import { Footer } from "@/components/general/Footer"
import { HeroSection } from "@/components/general/Hero/HeroSection"
import { HowItWorks } from "@/components/general/HowItWorks"
import { Navbar } from "@/components/general/Navbar"
import { Button, buttonVariants } from "@/components/ui/button"
import { GraduationCap } from "lucide-react"
import Link from "next/link"
export default function HomePage() {
  return (
    <div>
      <HeroSection />
      <HowItWorks />
      <div className="max-w-7xl mx-auto lg:py-20 px-[4%] py-10 space-y-4">
        <h1 className="text-center text-4xl">Ready to Transform Your Learning?</h1>
        <p className="text-center text-muted-foreground lg:text-lg">
          Join thousands of learners using AI to create personalized courses from YouTube videos
        </p>
        <div className="flex justify-center items-center">
          <Link href={"/courses"} className={buttonVariants({variant:"default"})}>
            <GraduationCap />
            Start Learning Today
          </Link>
        </div>

      </div>
    </div>
  )
}