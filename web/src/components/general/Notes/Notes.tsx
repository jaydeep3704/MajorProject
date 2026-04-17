import { NotebookText } from "lucide-react";
import { StructuredNotes } from "./StructuredNotes";

export const Notes = ({
  contentType,
  notesHtml,
  chapters,
  recap,
}: any) => {
  if (contentType === "structured" && chapters) {
    return <StructuredNotes chapters={chapters} recap={recap} />;
  }

  return (

    <div className=" max-w-4xl mx-auto lg:flex-3">
      <h1 className="font-semibold flex text-xl gap-4 items-center"><NotebookText/> Notes</h1>
      <div className="prose prose-lg p-4 dark:prose-invert">
        <div dangerouslySetInnerHTML={{ __html: notesHtml || "" }} />
      </div>

    </div>
  );
};