"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { NotebookTabsIcon, NotebookText } from "lucide-react";

interface Chapter {
  title: string;
  content: string;
}

interface StructuredNotesProps {
  chapters: Chapter[];
  recap?: string;
}

export const StructuredNotes = ({ chapters, recap }: StructuredNotesProps) => {
  return (
    <div className="flex-3 max-w-4xl mx-auto p-4 space-y-4">
      <h1 className="font-semibold flex text-xl gap-4 items-center"><NotebookText/> Notes</h1>
      <Accordion type="single" collapsible className="w-full">
        {chapters.map((ch, index) => (
          <AccordionItem key={index} value={`item-${index}`}>
            <AccordionTrigger className="text-left font-semibold text-lg">
              {ch.title}
            </AccordionTrigger>

            <AccordionContent>
              <div
                className="prose prose-lg max-w-none dark:prose-invert"
                dangerouslySetInnerHTML={{ __html: ch.content }}
              />
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      {/* Recap */}
      {/* {recap && (
        <div className="mt-6 border-t pt-6">
          <h2 className="text-xl font-bold mb-3">Recap</h2>
          <div
            className="prose prose-lg max-w-none dark:prose-invert"
            dangerouslySetInnerHTML={{ __html: recap }}
          />
        </div>
      )} */}

    </div>
  );
};