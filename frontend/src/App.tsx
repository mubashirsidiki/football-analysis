import { useState, useEffect, ErrorInfo, Component, ReactNode } from 'react'
import VideoUploader from './components/VideoUploader'
import VideoTimestampOverlay from './components/VideoTimestampOverlay'
import AnalysisTable from './components/AnalysisTable'
import SummaryPanel from './components/SummaryPanel'
import ConfigPanel from './components/ConfigPanel'
import { FrameAnalysis, AnalysisResponse } from './lib/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card'
import { Button } from './components/ui/button'
import { AlertCircle } from 'lucide-react'
import { uploadVideos } from '@/lib/api'

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

interface VideoFile {
  file: File
  preview: string
  duration: number
  durationEstimated?: boolean
  error?: string
}

function App() {
  const [frames, setFrames] = useState<FrameAnalysis[]>([])
  const [error, setError] = useState<string | null>(null)
  const [analysisStatus, setAnalysisStatus] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'analysis' | 'timestamp'>('analysis')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisProgress, setAnalysisProgress] = useState(0)
  const [videos, setVideos] = useState<VideoFile[]>([])

  useEffect(() => {
    console.log('📊 App component mounted')
    console.log('🎬 Ready to analyze videos')
  }, [])

  const handleAnalysisComplete = (result: AnalysisResponse) => {
    console.log('✅ Analysis complete! Received', result.frames.length, 'frames')
    console.log('📊 Analysis status:', result.status)
    try {
      if (!Array.isArray(result.frames)) {
        throw new Error('Invalid frames data received')
      }
      setFrames(result.frames)
      setAnalysisStatus(result.status)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process analysis results')
    }
  }

  const handleStartAnalysis = async () => {
    if (videos.length === 0) {
      setError('Please upload at least one video')
      return
    }

    setIsAnalyzing(true)
    setError(null)
    setAnalysisProgress(0)

    const progressInterval = setInterval(() => {
      setAnalysisProgress((prev) => {
        if (prev >= 90) return prev
        return prev + Math.random() * 10
      })
    }, 500)

    try {
      const files = videos.map((v) => v.file)
      const result = await uploadVideos(files, {
        frame_interval: 1.0,
        max_duration: 10.0,
        analysis_mode: 'frame',
      })
      clearInterval(progressInterval)
      setAnalysisProgress(100)
      setTimeout(() => {
        handleAnalysisComplete(result)
        setIsAnalyzing(false)
        setAnalysisProgress(0)
      }, 300)
    } catch (err) {
      clearInterval(progressInterval)
      setAnalysisProgress(0)
      setError(err instanceof Error ? err.message : 'Failed to analyze videos')
      setIsAnalyzing(false)
    }
  }

  return (
    <ErrorBoundary>
      {/* Background Pattern for Glow Orbs */}
      <div className="bg-pattern" />

      {/* Navigation */}
      <nav className="navbar">
        <div className="nav-container">
          <div className="logo">
            <i className="fa-solid fa-chart-line text-accent-teal text-xl" />
            <span>Tactical<strong>IQ</strong></span>
          </div>
          <ul className="nav-links">
            <li><a href="#" className="active">Analyze</a></li>
            <li><a href="#">Solutions</a></li>
            <li><a href="#">Pricing</a></li>
          </ul>
          <div className="nav-actions">
            <a href="#" className="btn btn-outline">Log In</a>
            <a href="#" className="btn btn-primary">Sign Up</a>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="hero-section">
        {/* Hero Content */}
        <div className="hero-content">
          <h1 className="hero-title">
            Elevate Your Game with <span className="text-gradient">AI Analytics</span>
          </h1>
          <p className="hero-subtitle">
            Upload your match footage and generate instant, state-of-the-art tactical insights,
            player assessments, and event breakdowns using built-in AI models.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="mb-8 flex gap-2 p-1 bg-[rgba(0,0,0,0.3)] rounded-lg max-w-md">
          <button
            onClick={() => setActiveTab('analysis')}
            className={`tab-btn ${activeTab === 'analysis' ? 'active' : ''}`}
          >
            Video Analysis
          </button>
          <button
            onClick={() => setActiveTab('timestamp')}
            className={`tab-btn ${activeTab === 'timestamp' ? 'active' : ''}`}
          >
            Timestamp Overlay
          </button>
        </div>

        {error && (
          <Card className="mb-8 border-[#ef4444] bg-[rgba(239,68,68,0.1)] max-w-[1100px] w-full">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-[#ef4444]">
                <AlertCircle className="h-5 w-5" />
                <p className="text-sm font-medium">{error}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="mt-4 border-[rgba(255,255,255,0.08)]"
                onClick={() => setError(null)}
              >
                Dismiss
              </Button>
            </CardContent>
          </Card>
        )}

        {activeTab === 'analysis' && (
          <>
            {analysisStatus === 'partial' && (
              <Card className="mb-8 border-amber-500 bg-amber-950/20 max-w-[1100px] w-full">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-amber-400">
                    <AlertCircle className="h-5 w-5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Partial Analysis Results</p>
                      <p className="text-xs mt-1 text-amber-500">
                        API quota exhausted. Some frames were analyzed successfully, but others could not be processed due to daily quota limits (20 requests/day for free tier). Please upgrade your plan or try again tomorrow.
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4"
                    onClick={() => setAnalysisStatus(null)}
                  >
                    Dismiss
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Two-Panel Interface */}
            <div className="app-interface">
              {/* Left Panel: Video Upload */}
              <VideoUploader
                videos={videos}
                onVideosChange={setVideos}
                isUploading={isAnalyzing}
                error={error}
                onError={setError}
              />

              {/* Right Panel: Config */}
              <ConfigPanel
                onStartAnalysis={handleStartAnalysis}
                disabled={isAnalyzing}
              />
            </div>

            {/* Results Section */}
            {frames.length > 0 && (
              <>
                <SummaryPanel frames={frames} />
                <AnalysisTable frames={frames} />
              </>
            )}
          </>
        )}

        {activeTab === 'timestamp' && (
          <VideoTimestampOverlay />
        )}

        {/* Processing Overlay */}
        {isAnalyzing && (
          <div className="processing-overlay" id="processing-overlay">
            <div className="spinner-container">
              <div className="spinner" />
              <div className="spinner-core" />
            </div>
            <h3 className="text-2xl font-semibold mb-2">Analyzing Match Footage</h3>
            <p className="text-[var(--text-muted)] mb-8 max-w-md">
              Our AI is breaking down tactical decisions and player actions...
            </p>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${analysisProgress}%` }} />
            </div>
          </div>
        )}
      </main>
    </ErrorBoundary>
  )
}

export default App