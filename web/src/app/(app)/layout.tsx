import type { Metadata } from "next";
import { Footer } from "@/components/general/Footer";
import { Navbar } from "@/components/general/Navbar";
import { Inter } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Learnflow",
  description: "AI-powered YouTube learning with topic segmentation and smart summaries",
  keywords: ["AI", "YouTube learning", "NLP", "summarization"],
  authors: [{ name: "Jaydeep Patil" }],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} antialiased`} suppressHydrationWarning>
        <Navbar />
        {children}
        <Footer />
      </body>
    </html>
  );
}