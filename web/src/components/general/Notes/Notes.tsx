import React, { useEffect, useState, useRef } from "react";

export const Notes = ({ courseId }: { courseId: string }) => {
  const hasFetched = useRef(false);
  const [notesHtml, setNotesHtml] = useState<string>("");

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;

    const fetchNotes = async () => {
      const response = await fetch(`/api/courses/${courseId}/notes`);
      const data = await response.json();

      console.log("API Response:", data);

      // assuming backend returns { notes: { content: "<html string>" } }
      setNotesHtml(data.notes?.content || "");
    };

    fetchNotes();
  }, [courseId]);

  return (
<div className="prose prose-lg max-w-4xl mx-auto lg:flex-3 p-4 rounded-lg dark:prose-invert">
  <div dangerouslySetInnerHTML={{ __html: notesHtml }} />
</div>



  );
};
