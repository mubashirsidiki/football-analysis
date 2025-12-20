import { useState, useCallback } from 'react'
import { Button } from './ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Progress } from './ui/progress'
import { addTimestampOverlay } from '@/lib/api'
import { X, Upload, Video, Settings, Download, Loader2, Clock } from 'lucide-react'

interface VideoFile {
  file: File
  preview: string
  duration: number
  durationEstimated?: boolean // True if duration was estimated (browser couldn't read it)
  error?: string
}

export default function VideoTimestampOverlay() {
  const [videos, setVideos] = useState<VideoFile[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [maxDuration, setMaxDuration] = useState<number | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [processedVideoBlob, setProcessedVideoBlob] = useState<Blob | null>(null)
  const [processedVideoName, setProcessedVideoName] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)

  const validateVideo = (file: File): Promise<{ valid: boolean; duration: number; durationEstimated?: boolean; error?: string }> => {
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

        // Validate file size (100MB limit)
        const maxSize = 100 * 1024 * 1024 // 100MB
        if (file.size > maxSize) {
          resolve({ valid: false, duration: 0, error: `File size (${(file.size / 1024 / 1024).toFixed(1)}MB) exceeds 100MB limit` })
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
            resolve({ valid: true, duration })
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
      setProcessedVideoBlob(null)
      setProcessedVideoName(null)
      const newVideos: VideoFile[] = []
      const errors: string[] = []

      for (const file of fileArray) {
        try {
          const validation = await validateVideo(file)
          
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
  }, [videos.length])

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
    setProcessedVideoBlob(null)
    setProcessedVideoName(null)
  }

  const handleProcess = async () => {
    if (videos.length === 0) {
      setError('Please upload at least one video')
      return
    }

    setIsProcessing(true)
    setError(null)
    setProgress(0)
    setProcessedVideoBlob(null)
    setProcessedVideoName(null)

    try {
      // Simulate progress (since we don't have real-time progress from backend)
      const progressInterval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) return prev
          return prev + 5
        })
      }, 500)

      const files = videos.map((v) => v.file)
      const blob = await addTimestampOverlay(files, maxDuration || undefined)
      
      clearInterval(progressInterval)
      setProgress(100)

      // Generate filename
      const baseName = videos[0].file.name.replace(/\.[^/.]+$/, '')
      const outputName = `${baseName}_timestamped.mp4`

      setProcessedVideoBlob(blob)
      setProcessedVideoName(outputName)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process video')
      setProgress(0)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDownload = () => {
    if (!processedVideoBlob || !processedVideoName) return

    const url = URL.createObjectURL(processedVideoBlob)
    const a = document.createElement('a')
    a.href = url
    a.download = processedVideoName
    a.click()
    URL.revokeObjectURL(url)
  }

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)
    const ms = Math.floor((seconds % 1) * 1000)
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`
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
            <CardTitle>Video Timestamp Overlay</CardTitle>
            <CardDescription>
              Add timestamp overlay (HH:MM:SS.mmm) to your videos and download the processed video
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
            <h3 className="text-sm font-semibold mb-3">Processing Settings</h3>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium mb-1 block">
                  Max Video Duration: {maxDuration ? `${maxDuration}s` : 'Full video'}
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min="5"
                    max="60"
                    step="1"
                    value={maxDuration || 60}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value)
                      setMaxDuration(value === 60 ? null : value)
                    }}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setMaxDuration(null)}
                    disabled={maxDuration === null}
                  >
                    Full Video
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {maxDuration 
                    ? `Process only first ${maxDuration} seconds of video`
                    : 'Process full video duration'}
                </p>
              </div>
              <div className="p-3 bg-background rounded border">
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Timestamp Format:</span>
                  <code className="px-2 py-1 bg-muted rounded text-xs font-mono">00:00:01.234</code>
                  <span className="text-muted-foreground text-xs">(bottom-right corner)</span>
                </div>
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
            id="timestamp-video-upload"
            disabled={isProcessing || videos.length >= 6}
          />
          <Button
            type="button"
            variant="outline"
            disabled={isProcessing || videos.length >= 6}
            onClick={() => {
              document.getElementById('timestamp-video-upload')?.click()
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

        {isProcessing && (
          <div className="mt-6 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Processing video...</span>
              <span className="font-medium">{progress}%</span>
            </div>
            <Progress value={progress} />
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Adding timestamp overlay to frames...</span>
            </div>
          </div>
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
                    {!video.durationEstimated && maxDuration && video.duration > maxDuration && (
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
                  disabled={isProcessing}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {videos.length > 0 && !isProcessing && !processedVideoBlob && (
          <Button
            onClick={handleProcess}
            disabled={isProcessing}
            className="mt-6 w-full"
            size="lg"
          >
            <Clock className="mr-2 h-4 w-4" />
            Add Timestamp Overlay
          </Button>
        )}

        {processedVideoBlob && processedVideoName && (
          <div className="mt-6 p-4 border rounded-lg bg-green-50 dark:bg-green-950/20 space-y-4">
            <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
              <Download className="h-5 w-5" />
              <p className="text-sm font-medium">Video processed successfully!</p>
            </div>
            <div className="text-sm text-muted-foreground">
              <p>File: {processedVideoName}</p>
              <p>Size: {formatFileSize(processedVideoBlob.size)}</p>
            </div>
            <Button
              onClick={handleDownload}
              className="w-full"
              size="lg"
            >
              <Download className="mr-2 h-4 w-4" />
              Download Processed Video
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

