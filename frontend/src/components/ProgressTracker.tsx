import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Progress } from './ui/progress'
import { getProgress, getResults } from '@/lib/api'
import { FrameAnalysis } from '@/lib/types'
import { Loader2 } from 'lucide-react'

interface ProgressTrackerProps {
  sessionId: string
  onComplete: (frames: FrameAnalysis[]) => void
  isProcessing: boolean
}

export default function ProgressTracker({ sessionId, onComplete, isProcessing }: ProgressTrackerProps) {
  const [progress, setProgress] = useState({ processed: 0, total: 0, status: 'processing' as const, message: '' })
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isProcessing) return

    let pollCount = 0
    const maxPollAttempts = 300 // 10 minutes max (300 * 2s)
    let consecutiveErrors = 0
    const maxConsecutiveErrors = 5

    const pollProgress = async () => {
      try {
        pollCount++
        
        const progressData = await getProgress(sessionId)
        setProgress(progressData)
        consecutiveErrors = 0 // Reset error count on success

        if (progressData.status === 'completed') {
          try {
            // Fetch final results
            const results = await getResults(sessionId)
            if (results.frames && Array.isArray(results.frames)) {
              onComplete(results.frames)
            } else {
              setError('Invalid results received from server')
            }
          } catch (err) {
            setError(`Analysis completed but failed to fetch results: ${err instanceof Error ? err.message : 'Unknown error'}`)
          }
        } else if (progressData.status === 'error') {
          setError(progressData.message || 'Analysis failed')
        } else if (pollCount >= maxPollAttempts) {
          setError('Analysis is taking longer than expected. Please try again.')
        }
      } catch (err) {
        consecutiveErrors++
        
        if (consecutiveErrors >= maxConsecutiveErrors) {
          setError(`Failed to fetch progress after ${maxConsecutiveErrors} attempts: ${err instanceof Error ? err.message : 'Unknown error'}`)
        } else {
          // Log error but continue polling
          console.warn(`Progress fetch error (${consecutiveErrors}/${maxConsecutiveErrors}):`, err)
        }
      }
    }

    // Poll every 2 seconds
    const interval = setInterval(pollProgress, 2000)
    pollProgress() // Initial call

    return () => clearInterval(interval)
  }, [sessionId, isProcessing, onComplete])

  if (!isProcessing && progress.status === 'completed') {
    return null // Hide when complete
  }

  const progressPercent = progress.total > 0 
    ? Math.round((progress.processed / progress.total) * 100) 
    : 0

  const estimatedTimeRemaining = progress.total > 0 && progress.processed > 0
    ? Math.round((progress.total - progress.processed) * 4 / 60) // ~4 seconds per frame, convert to minutes
    : null

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle>Analysis Progress</CardTitle>
        <CardDescription>
          Processing frames with AI analysis
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error ? (
          <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm">
            {error}
          </div>
        ) : (
          <>
            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {progress.message || 'Processing...'}
                </span>
                <span className="font-medium">
                  {progress.processed} / {progress.total} frames
                </span>
              </div>
              <Progress value={progressPercent} />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{progressPercent}% complete</span>
                {estimatedTimeRemaining !== null && (
                  <span>~{estimatedTimeRemaining} min remaining</span>
                )}
              </div>
            </div>
            {progress.status === 'processing' && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Analyzing frames...</span>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

