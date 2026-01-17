import { useState, useCallback } from 'react'
import { Button } from './ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Progress } from './ui/progress'
import { uploadVideos } from '@/lib/api'
import { AnalysisResponse } from '@/lib/types'
import { X, Upload, Video, Settings, Loader2, Sparkles } from 'lucide-react'

interface VideoFile {
  file: File
  preview: string
  duration: number
  durationEstimated?: boolean // True if duration was estimated (browser couldn't read it)
  error?: string
}

interface VideoUploaderProps {
  onAnalysisComplete: (result: AnalysisResponse) => void
}

export default function VideoUploader({ onAnalysisComplete }: VideoUploaderProps) {
  const [videos, setVideos] = useState<VideoFile[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [frameInterval, setFrameInterval] = useState(1.0)
  const [maxDuration, setMaxDuration] = useState(10.0)
  const [showSettings, setShowSettings] = useState(false)
  const [analysisProgress, setAnalysisProgress] = useState(0)
  const [analysisMode, setAnalysisMode] = useState<'frame' | 'multimodal'>('frame')

  const validateVideo = (file: File, mode: 'frame' | 'multimodal' = 'frame'): Promise<{ valid: boolean; duration: number; durationEstimated?: boolean; error?: string }> => {
    return new Promise((resolve) => {
      try {
        // Validate file type
        if (!file || !(file instanceof File)) {
          resolve({ valid: false, duration: 0, error: 'Invalid file' })
          return
        }

        if (!file.type.startsWith('video/')) {
          resolve({ valid: false, duration: 0, error: 'File must be a video file' })
          return
        }

        // Validate file size (different limits for different modes)
        const maxSizeMB = mode === 'multimodal' ? 50 : 100
        const maxSize = maxSizeMB * 1024 * 1024
        if (file.size > maxSize) {
          resolve({ valid: false, duration: 0, error: `File size (${(file.size / 1024 / 1024).toFixed(1)}MB) exceeds ${maxSizeMB}MB limit for ${mode} mode` })
          return
        }

        if (file.size === 0) {
          resolve({ valid: false, duration: 0, error: 'File is empty' })
          return
        }

        // Try to get video metadata, but don't fail if browser can't play it
        // (some formats like AVI work with OpenCV but not browser)
        const video = document.createElement('video')
        video.preload = 'metadata'
        
        let resolved = false
        let duration = 0
        const cleanup = () => {
          if (video.src) {
            URL.revokeObjectURL(video.src)
          }
        }
        
        const timeout = setTimeout(() => {
          if (!resolved) {
            resolved = true
            cleanup()
            // If browser can't read it, still allow it (backend OpenCV might handle it)
            // Use a more reasonable duration estimate: ~1-2 MB per second for typical video
            const fileSizeMB = file.size / (1024 * 1024)
            const estimatedDuration = Math.max(1, fileSizeMB / 1.5) // ~1.5 MB per second average
            resolve({ valid: true, duration: estimatedDuration, durationEstimated: true })
          }
        }, 5000) // Reduced timeout since we're more lenient
        
        video.onloadedmetadata = () => {
          if (resolved) return
          resolved = true
          clearTimeout(timeout)
          cleanup()
          
          duration = video.duration
          
          if (isNaN(duration) || duration <= 0) {
            // Still allow it - backend will handle validation
            // Use a more reasonable duration estimate
            const fileSizeMB = file.size / (1024 * 1024)
            duration = Math.max(1, fileSizeMB / 1.5) // ~1.5 MB per second average
            resolve({ valid: true, duration, durationEstimated: true })
            return
          }
          
          resolve({ valid: true, duration, durationEstimated: false })
        }
        
        video.onerror = () => {
          if (resolved) return
          
          const errorMsg = video.error
          
          // For MEDIA_ERR_SRC_NOT_SUPPORTED, still allow the file
          // (backend OpenCV can handle formats browsers can't)
          if (errorMsg && errorMsg.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED) {
            resolved = true
            clearTimeout(timeout)
            cleanup()
            // Estimate duration based on file size (more reasonable estimate)
            const fileSizeMB = file.size / (1024 * 1024)
            duration = Math.max(1, fileSizeMB / 1.5) // ~1.5 MB per second average
            resolve({ valid: true, duration, durationEstimated: true })
            return
          }
          
          // For other errors, be more lenient but still try to resolve
          if (!resolved) {
            resolved = true
            clearTimeout(timeout)
            cleanup()
            // Still allow it - let backend handle validation
            const fileSizeMB = file.size / (1024 * 1024)
            duration = Math.max(1, fileSizeMB / 1.5) // ~1.5 MB per second average
            resolve({ valid: true, duration, durationEstimated: true })
          }
        }
        
        try {
          video.src = URL.createObjectURL(file)
        } catch (e) {
          if (!resolved) {
            resolved = true
            clearTimeout(timeout)
            // Still allow it - backend will validate
            const fileSizeMB = file.size / (1024 * 1024)
            duration = Math.max(1, fileSizeMB / 1.5) // ~1.5 MB per second average
            resolve({ valid: true, duration, durationEstimated: true })
          }
        }
      } catch (error) {
        resolve({ valid: false, duration: 0, error: `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}` })
      }
    })
  }

  const handleFileSelect = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) {
      return
    }

    try {
      const fileArray = Array.from(files)
      
      if (videos.length + fileArray.length > 6) {
        setError('Maximum 6 videos allowed')
        return
      }

      setError(null)
      const newVideos: VideoFile[] = []
      const errors: string[] = []

      for (const file of fileArray) {
        try {
          const validation = await validateVideo(file, analysisMode)

          if (!validation.valid) {
            errors.push(`${file.name}: ${validation.error || 'Invalid video file'}`)
            continue
          }

          const preview = URL.createObjectURL(file)
          newVideos.push({
            file,
            preview,
            duration: validation.duration,
            durationEstimated: validation.durationEstimated || false,
          })
        } catch (error) {
          errors.push(`${file.name}: ${error instanceof Error ? error.message : 'Validation failed'}`)
        }
      }

      if (errors.length > 0 && newVideos.length === 0) {
        setError(errors.join('; '))
      } else if (errors.length > 0) {
        setError(`Some videos failed validation: ${errors.join('; ')}`)
      }

      if (newVideos.length > 0) {
        setVideos((prev) => [...prev, ...newVideos])
      }
    } catch (error) {
      setError(`Failed to process files: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }, [videos.length, maxDuration, analysisMode])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    handleFileSelect(e.dataTransfer.files)
  }, [handleFileSelect])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  const removeVideo = (index: number) => {
    setVideos((prev) => {
      const newVideos = [...prev]
      URL.revokeObjectURL(newVideos[index].preview)
      newVideos.splice(index, 1)
      return newVideos
    })
  }

  const handleAnalyze = async () => {
    if (videos.length === 0) {
      setError('Please upload at least one video')
      return
    }

    setIsUploading(true)
    setError(null)
    setAnalysisProgress(0)

    // Simulate progress (since we don't have real-time progress from backend)
    const progressInterval = setInterval(() => {
      setAnalysisProgress((prev) => {
        if (prev >= 90) return prev
        return prev + Math.random() * 10
      })
    }, 500)

    try {
      const files = videos.map((v) => v.file)
      const result = await uploadVideos(files, {
        frame_interval: frameInterval,
        max_duration: maxDuration,
        analysis_mode: analysisMode,
      })
      clearInterval(progressInterval)
      setAnalysisProgress(100)
      // Small delay to show 100% before completing
      setTimeout(() => {
        onAnalysisComplete(result)
        setIsUploading(false)
        setAnalysisProgress(0)
      }, 300)
    } catch (err) {
      clearInterval(progressInterval)
      setAnalysisProgress(0)
      setError(err instanceof Error ? err.message : 'Failed to analyze videos')
      setIsUploading(false)
    }
  }

  const formatDuration = (seconds: number) => {
    return `${seconds.toFixed(1)}s`
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  return (
    <Card className="mb-8">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle>Upload Videos</CardTitle>
            <CardDescription>
              Upload up to 6 videos
              {analysisMode === 'frame'
                ? ` (will extract frames every ${frameInterval}s, max ${maxDuration}s)`
                : ' (multimodal mode: analyzes entire video, max 50MB)'
              }
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setShowSettings(!showSettings)}
            title="Settings"
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {showSettings && (
          <div className="mb-6 p-4 border rounded-lg space-y-4 bg-muted/50">
            <h3 className="text-sm font-semibold mb-3">Analysis Settings</h3>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Analysis Mode
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAnalysisMode('frame')}
                    className={`p-3 text-sm rounded-md border transition-colors ${
                      analysisMode === 'frame'
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background hover:bg-muted'
                    }`}
                  >
                    <div className="font-medium">Frame-based</div>
                    <div className="text-xs opacity-70">Extract frames & analyze with Gemini</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAnalysisMode('multimodal')}
                    className={`p-3 text-sm rounded-md border transition-colors ${
                      analysisMode === 'multimodal'
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background hover:bg-muted'
                    }`}
                  >
                    <div className="font-medium">Multimodal</div>
                    <div className="text-xs opacity-70">Analyze entire video with OpenRouter</div>
                  </button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {analysisMode === 'frame'
                    ? 'Extracts frames at intervals and analyzes each frame independently. Better for long videos.'
                    : 'Analyzes the entire video at once. Better for understanding temporal context and movement patterns.'}
                </p>
              </div>
              {analysisMode === 'frame' && (
                <div>
                  <label className="text-sm font-medium mb-1 block">
                    Frame Interval: {frameInterval}s
                  </label>
                  <input
                    type="range"
                    min="0.5"
                    max="5"
                    step="0.5"
                    value={frameInterval}
                    onChange={(e) => setFrameInterval(parseFloat(e.target.value))}
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Extract one frame every {frameInterval} seconds
                  </p>
                </div>
              )}
              <div>
                <label className="text-sm font-medium mb-1 block">
                  Max Video Duration: {maxDuration}s
                </label>
                <input
                  type="range"
                  min="5"
                  max="30"
                  step="1"
                  value={maxDuration}
                  onChange={(e) => setMaxDuration(parseFloat(e.target.value))}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Maximum allowed video duration
                </p>
              </div>
            </div>
          </div>
        )}
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center hover:border-primary/50 transition-colors"
        >
          <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-sm text-muted-foreground mb-4">
            Drag and drop videos here, or click to select
          </p>
          <input
            type="file"
            accept="video/*"
            multiple
            onChange={(e) => handleFileSelect(e.target.files)}
            className="hidden"
            id="video-upload"
            disabled={isUploading || videos.length >= 6}
          />
          <Button
            type="button"
            variant="outline"
            disabled={isUploading || videos.length >= 6}
            onClick={() => {
              document.getElementById('video-upload')?.click()
            }}
          >
            Select Videos
          </Button>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-destructive/10 text-destructive rounded-md text-sm">
            {error}
          </div>
        )}

        {isUploading && (
          <Card className="mt-6 border-primary/50 bg-primary/5">
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    <Sparkles className="h-4 w-4 text-primary absolute -top-1 -right-1 animate-pulse" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold">Analyzing Videos</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Processing frames and analyzing with AI...
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Extracting frames and running AI analysis</span>
                    <span className="font-medium">{Math.round(analysisProgress)}%</span>
                  </div>
                  <Progress value={analysisProgress} className="h-2" />
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Video className="h-3 w-3" />
                  <span>Processing {videos.length} video{videos.length > 1 ? 's' : ''}...</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {videos.length > 0 && (
          <div className="mt-6 space-y-3">
            <h3 className="text-sm font-medium">Selected Videos ({videos.length}/6)</h3>
            {videos.map((video, index) => (
              <div
                key={index}
                className="flex items-center gap-4 p-3 border rounded-lg"
              >
                <Video className="h-8 w-8 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{video.file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {video.durationEstimated ? (
                      <span className="text-muted-foreground/70">Duration: Unknown</span>
                    ) : (
                      formatDuration(video.duration)
                    )}
                    {!video.durationEstimated && video.duration > maxDuration && (
                      <span className="text-amber-600 dark:text-amber-400"> (will process first {maxDuration}s)</span>
                    )}
                    {' • '}
                    {formatFileSize(video.file.size)}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeVideo(index)}
                  disabled={isUploading}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {videos.length > 0 && (
          <Button
            onClick={handleAnalyze}
            disabled={isUploading}
            className="mt-6 w-full"
            size="lg"
          >
            {isUploading ? 'Starting Analysis...' : 'Analyze All Videos'}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

