"use client"

import React, { useState, useEffect, useRef } from 'react'
import { Check, X, Loader2 } from 'lucide-react'

interface Question {
  type: 'mcq' | 'short_answer'
  question: string
  options?: string[]
  answer: string
  explanation: string
}

interface Quiz {
  title: string
  questions: Question[]
}

const QuizPage = ({ params }: { params: Promise<{ id?: string }> }) => {
  const { id } = React.use(params)
  const hasFetched = useRef(false)
  const [quiz, setQuiz] = useState<Quiz | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [submitted, setSubmitted] = useState(false)
  const [score, setScore] = useState<number | null>(null)

  useEffect(() => {
    if (hasFetched.current || !id) return
    hasFetched.current = true

    const fetchQuiz = async () => {
      try {
        const response = await fetch(`/api/courses/${id}/quiz`)
        const data = await response.json()
        
        console.log("API Response:", data)
        
        let parsedQuiz = data.quiz
        if (typeof parsedQuiz === 'string') {
          parsedQuiz = JSON.parse(parsedQuiz)
        }
        
        setQuiz(parsedQuiz)
      } catch (error) {
        console.error('Failed to fetch quiz:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchQuiz()
  }, [id])

  const handleAnswer = (questionIndex: number, answer: string) => {
    setAnswers(prev => ({ ...prev, [questionIndex]: answer }))
  }

  const handleSubmit = () => {
    if (!quiz) return

    let correct = 0
    quiz.questions.forEach((q, idx) => {
      const userAnswer = answers[idx]
      const correctAnswer = q.answer
      
      // Compare HTML strings exactly as they are
      if (userAnswer === correctAnswer) {
        correct++
      }
    })

    setScore(correct)
    setSubmitted(true)
    setCurrentQuestion(0)
  }

  const isQuestionAnswered = (index: number) => {
    return answers[index] !== undefined && answers[index] !== ''
  }

  const allQuestionsAnswered = quiz
    ? quiz.questions.every((_, idx) => isQuestionAnswered(idx))
    : false

  const getQuestionStatus = (index: number) => {
    if (!submitted) return null
    
    const userAnswer = answers[index]
    const correctAnswer = quiz?.questions[index].answer
    
    // Compare HTML strings exactly
    return userAnswer === correctAnswer ? 'correct' : 'incorrect'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!quiz) {
    return (
      <div className="text-center py-12">
        <p className="text-destructive">Failed to load quiz</p>
      </div>
    )
  }

  const currentQ = quiz.questions[currentQuestion]
  const status = getQuestionStatus(currentQuestion)

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="inline-block px-3 py-1 bg-primary/10 text-primary text-sm rounded-full mb-4">
          {submitted ? 'Results' : 'In Progress'}
        </div>
        
        <h1 className="text-3xl font-bold mb-4">
          {quiz.title}
        </h1>
        
        {submitted && score !== null && (
          <div className="inline-block bg-muted border rounded-lg px-6 py-3">
            <p className="text-2xl font-bold">
              {score} / {quiz.questions.length}
            </p>
            <p className="text-sm text-muted-foreground">
              {Math.round((score / quiz.questions.length) * 100)}% correct
            </p>
          </div>
        )}
      </div>

      {/* Progress */}
      {!submitted && (
        <div className="mb-6">
          <div className="flex justify-between text-sm text-muted-foreground mb-2">
            <span>Question {currentQuestion + 1} of {quiz.questions.length}</span>
            <span>{Object.keys(answers).length} answered</span>
          </div>
          <div className="w-full bg-secondary rounded-full h-2">
            <div 
              className="bg-primary h-2 rounded-full transition-all"
              style={{ width: `${((currentQuestion + 1) / quiz.questions.length) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Question navigation dots */}
      <div className="flex flex-wrap gap-2 mb-6 justify-center">
        {quiz.questions.map((_, idx) => {
          const dotStatus = submitted ? getQuestionStatus(idx) : null
          const isActive = idx === currentQuestion
          const isAnswered = isQuestionAnswered(idx)

          return (
            <button
              key={idx}
              onClick={() => setCurrentQuestion(idx)}
              className={`
                w-10 h-10 rounded-full font-medium text-sm transition-all
                ${isActive ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''}
                ${dotStatus === 'correct'
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-2 border-green-500'
                  : dotStatus === 'incorrect'
                  ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-2 border-red-500'
                  : isAnswered
                  ? 'bg-primary/20 text-primary border-2 border-primary'
                  : 'bg-muted text-muted-foreground border-2 border-border'
                }
                hover:scale-110
              `}
            >
              {idx + 1}
            </button>
          )
        })}
      </div>

      {/* Question card */}
      <div className="bg-card border rounded-lg p-6 mb-6">
        {/* Question header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex-1">
            <div 
              className="prose dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: currentQ.question }}
            />
          </div>
          
          {submitted && (
            <div className={`ml-4 flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${
              status === 'correct'
                ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
            }`}>
              {status === 'correct' ? <Check className="w-6 h-6" /> : <X className="w-6 h-6" />}
            </div>
          )}
        </div>

        {/* Answer options */}
        {!submitted && (
          <div className="mb-6">
            <div className="space-y-3">
              {currentQ.options?.map((option, idx) => (
                <button
                  key={idx}
                  onClick={() => handleAnswer(currentQuestion, option)}
                  className={`
                    w-full text-left p-4 rounded-lg border-2 transition-all
                    ${answers[currentQuestion] === option
                      ? 'bg-primary/10 border-primary'
                      : 'bg-muted/50 border-border hover:border-primary/50'
                    }
                  `}
                >
                  <div className="flex items-start gap-3">
                    <div className={`
                      w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-1
                      ${answers[currentQuestion] === option
                        ? 'border-primary bg-primary'
                        : 'border-muted-foreground'
                      }
                    `}>
                      {answers[currentQuestion] === option && (
                        <Check className="w-3 h-3 text-primary-foreground" />
                      )}
                    </div>
                    <div 
                      className="flex-1 prose dark:prose-invert prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: option }}
                    />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Show answer and explanation when submitted */}
        {submitted && (
          <div className="space-y-4 mt-6">
            {/* User's answer */}
            <div className="bg-muted/50 rounded-lg p-4 border">
              <p className="text-sm font-medium text-muted-foreground mb-2">Your Answer:</p>
              <div 
                className="prose dark:prose-invert prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: answers[currentQuestion] || '<p>Not answered</p>' }}
              />
            </div>

            {/* Correct answer */}
            {status === 'incorrect' && (
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
                <p className="text-sm font-medium text-green-600 dark:text-green-400 mb-2">Correct Answer:</p>
                <div 
                  className="prose dark:prose-invert prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: currentQ.answer }}
                />
              </div>
            )}

            {/* Explanation */}
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
              <p className="text-sm font-medium text-blue-600 dark:text-blue-400 mb-2">Explanation:</p>
              <div 
                className="prose dark:prose-invert prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: currentQ.explanation }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between gap-4">
        <button
          onClick={() => setCurrentQuestion(Math.max(0, currentQuestion - 1))}
          disabled={currentQuestion === 0}
          className="px-6 py-2 bg-secondary hover:bg-secondary/80 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium transition-all"
        >
          Previous
        </button>

        {!submitted && currentQuestion === quiz.questions.length - 1 && allQuestionsAnswered ? (
          <button
            onClick={handleSubmit}
            className="px-8 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-bold transition-all"
          >
            Submit Quiz
          </button>
        ) : (
          <button
            onClick={() => setCurrentQuestion(Math.min(quiz.questions.length - 1, currentQuestion + 1))}
            disabled={currentQuestion === quiz.questions.length - 1}
            className="px-6 py-2 bg-secondary hover:bg-secondary/80 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium transition-all"
          >
            Next
          </button>
        )}
      </div>

      {/* Submit warning */}
      {!submitted && !allQuestionsAnswered && (
        <div className="mt-4 text-center">
          <p className="text-sm text-muted-foreground">
            Answer all questions to submit ({Object.keys(answers).length}/{quiz.questions.length} completed)
          </p>
        </div>
      )}
    </div>
  )
}

export default QuizPage