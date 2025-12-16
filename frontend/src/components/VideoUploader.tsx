import { useState, useCallback } from 'react'
import { Button } from './ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { uploadVideos } from '@/lib/api'
import { FrameAnalysis } from '@/lib/types'
import { X, Upload, Video, Settings } from 'lucide-react'

interface VideoFile {
  file: File
  preview: string
  duration: number
  error?: string
}

interface VideoUploaderProps {
  onAnalysisComplete: (frames: FrameAnalysis[]) => void
}

export default function VideoUploader({ onAnalysisComplete }: VideoUploaderProps) {
  const [videos, setVideos] = useState<VideoFile[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [frameInterval, setFrameInterval] = useState(1.0)
  const [maxDuration, setMaxDuration] = useState(10.0)
  const [showSettings, setShowSettings] = useState(false)

  const validateVideo = (file: File): Promise<{ valid: boolean; duration: number; error?: string }> => {
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

        const video = document.createElement('video')
        video.preload = 'metadata'
        
        let resolved = false
        const cleanup = () => {
          if (video.src) {
            URL.revokeObjectURL(video.src)
          }
        }
        
        const timeout = setTimeout(() => {
          if (!resolved) {
            resolved = true
            cleanup()
            resolve({ valid: false, duration: 0, error: 'Video validation timeout. File may be corrupted.' })
          }
        }, 10000) // 10 second timeout
        
        video.onloadedmetadata = () => {
          if (resolved) return
          resolved = true
          clearTimeout(timeout)
          cleanup()
          
          const duration = video.duration
          
          if (isNaN(duration) || duration <= 0) {
            resolve({ valid: false, duration: 0, error: 'Could not determine video duration' })
            return
          }
          
          if (duration > maxDuration) {
            resolve({ valid: false, duration, error: `Video duration (${duration.toFixed(1)}s) exceeds ${maxDuration} seconds` })
          } else {
            resolve({ valid: true, duration })
          }
        }
        
        video.onerror = (e) => {
          if (resolved) return
          resolved = true
          clearTimeout(timeout)
          cleanup()
          
          const errorMsg = video.error
          let message = 'Could not read video file'
          
          if (errorMsg) {
            switch (errorMsg.code) {
              case MediaError.MEDIA_ERR_ABORTED:
                message = 'Video loading was aborted'
                break
              case MediaError.MEDIA_ERR_NETWORK:
                message = 'Network error while loading video'
                break
              case MediaError.MEDIA_ERR_DECODE:
                message = 'Video file is corrupted or in unsupported format'
                break
              case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
                message = 'Video format is not supported'
                break
            }
          }
          
          resolve({ valid: false, duration: 0, error: message })
        }
        
        try {
          video.src = URL.createObjectURL(file)
        } catch (e) {
          if (!resolved) {
            resolved = true
            clearTimeout(timeout)
            resolve({ valid: false, duration: 0, error: 'Failed to create video preview' })
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
  }, [videos.length, maxDuration])

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

    try {
      const files = videos.map((v) => v.file)
      const result = await uploadVideos(files, {
        frame_interval: frameInterval,
        max_duration: maxDuration,
      })
      onAnalysisComplete(result.frames)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze videos')
    } finally {
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
              Upload up to 6 videos, each up to {maxDuration}s long (will process first {maxDuration}s if longer)
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
                    {formatDuration(video.duration)} • {formatFileSize(video.file.size)}
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

