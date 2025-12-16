import { useState, ErrorInfo, Component, ReactNode } from 'react'
import VideoUploader from './components/VideoUploader'
import AnalysisTable from './components/AnalysisTable'
import SummaryPanel from './components/SummaryPanel'
import { FrameAnalysis } from './lib/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card'
import { Button } from './components/ui/button'
import { AlertCircle } from 'lucide-react'

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <Card className="max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-5 w-5" />
                Something went wrong
              </CardTitle>
              <CardDescription>
                An unexpected error occurred
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {this.state.error?.message || 'An unknown error occurred'}
              </p>
              <Button
                onClick={() => {
                  this.setState({ hasError: false, error: null })
                  window.location.reload()
                }}
                className="w-full"
              >
                Reload Page
              </Button>
            </CardContent>
          </Card>
        </div>
      )
    }

    return this.props.children
  }
}

function App() {
  const [frames, setFrames] = useState<FrameAnalysis[]>([])
  const [error, setError] = useState<string | null>(null)

  const handleAnalysisComplete = (analysisFrames: FrameAnalysis[]) => {
    try {
      if (!Array.isArray(analysisFrames)) {
        throw new Error('Invalid frames data received')
      }
      setFrames(analysisFrames)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process analysis results')
    }
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-background">
        <div className="container mx-auto py-8 px-4">
          <h1 className="text-4xl font-bold mb-8 text-center">
            Football Video Analysis
          </h1>
          
          {error && (
            <Card className="mb-8 border-destructive">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="h-5 w-5" />
                  <p className="text-sm font-medium">{error}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => setError(null)}
                >
                  Dismiss
                </Button>
              </CardContent>
            </Card>
          )}
          
          <VideoUploader onAnalysisComplete={handleAnalysisComplete} />
          
          {frames.length > 0 && (
            <>
              <SummaryPanel frames={frames} />
              <AnalysisTable frames={frames} />
            </>
          )}
        </div>
      </div>
    </ErrorBoundary>
  )
}

export default App

