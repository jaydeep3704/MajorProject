import React from "react"

interface NotesProps {
  notesHtml: string                      // ← lifted up, no internal fetch
}

export const Notes = ({ notesHtml }: NotesProps) => {
  return (
    <div className="prose prose-lg max-w-4xl mx-auto lg:flex-3 p-4 rounded-lg dark:prose-invert">
      <div dangerouslySetInnerHTML={{ __html: notesHtml }} />
    </div>
  )
}