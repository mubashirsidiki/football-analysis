import { useState, useCallback } from 'react'
import { Button } from './ui/button'
import { addTimestampOverlay } from '@/lib/api'
import { X, Upload, Video, Settings, Download, Loader2, Clock } from 'lucide-react'

interface VideoFile {
  file: File
  preview: string
  duration: number
  durationEstimated?: boolean
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
  const [dragOver, setDragOver] = useState(false)

  const validateVideo = (file: File): Promise<{ valid: boolean; duration: number; durationEstimated?: boolean; error?: string }> => {
    return new Promise((resolve) => {
      try {
        if (!file || !(file instanceof File)) {
          resolve({ valid: false, duration: 0, error: 'Invalid file' })
          return
        }

        if (!file.type.startsWith('video/')) {
          resolve({ valid: false, duration: 0, error: 'File must be a video file' })
          return
        }

        const maxSize = 100 * 1024 * 1024
        if (file.size > maxSize) {
          resolve({ valid: false, duration: 0, error: `File size exceeds 100MB limit` })
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
          if (video.src) URL.revokeObjectURL(video.src)
        }

        const timeout = setTimeout(() => {
          if (!resolved) {
            resolved = true
            cleanup()
            const fileSizeMB = file.size / (1024 * 1024)
            const duration = Math.max(1, fileSizeMB / 1.5)
            resolve({ valid: true, duration, durationEstimated: true })
          }
        }, 5000)

        video.onloadedmetadata = () => {
          if (resolved) return
          resolved = true
          clearTimeout(timeout)
          cleanup()
          const duration = video.duration
          if (isNaN(duration) || duration <= 0) {
            const fileSizeMB = file.size / (1024 * 1024)
            resolve({ valid: true, duration: Math.max(1, fileSizeMB / 1.5), durationEstimated: true })
            return
          }
          resolve({ valid: true, duration, durationEstimated: false })
        }

        video.onerror = () => {
          if (resolved) return
          resolved = true
          clearTimeout(timeout)
          cleanup()
          const fileSizeMB = file.size / (1024 * 1024)
          resolve({ valid: true, duration: Math.max(1, fileSizeMB / 1.5), durationEstimated: true })
        }

        try {
          video.src = URL.createObjectURL(file)
        } catch {
          if (!resolved) {
            resolved = true
            clearTimeout(timeout)
            const fileSizeMB = file.size / (1024 * 1024)
            resolve({ valid: true, duration: Math.max(1, fileSizeMB / 1.5), durationEstimated: true })
          }
        }
      } catch (error) {
        resolve({ valid: false, duration: 0, error: `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}` })
      }
    })
  }

  const handleFileSelect = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return

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
  }, [videos.length])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    handleFileSelect(e.dataTransfer.files)
  }, [handleFileSelect])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setDragOver(false)
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

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  return (
    <div className="glass-card w-full max-w-[1100px]">
      <div className="p-6">
        {/* Header */}
        <div className="flex justify-between items-start pb-4 border-b border-[var(--border-color)]">
          <div className="flex items-center gap-3">
            <i className="fa-solid fa-clock-rotate-left text-[var(--primary-blue)] text-lg" />
            <div>
              <h2 className="text-lg font-semibold text-[var(--text-main)]">Video Timestamp Overlay</h2>
              <p className="text-sm text-[var(--text-muted)]">
                Add timestamp overlay (HH:MM:SS.mmm) to your videos
              </p>
            </div>
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

        {/* Settings */}
        {showSettings && (
          <div className="mt-4 p-4 bg-[rgba(0,0,0,0.2)] rounded-lg space-y-4 border border-[var(--border-color)]">
            <h3 className="text-sm font-semibold text-[var(--text-main)]">Processing Settings</h3>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-[var(--text-muted)] mb-1 block">
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
                    className="border-[var(--border-color)]"
                  >
                    Full Video
                  </Button>
                </div>
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  {maxDuration
                    ? `Process only first ${maxDuration} seconds of video`
                    : 'Process full video duration'}
                </p>
              </div>
              <div className="p-3 bg-[rgba(0,0,0,0.2)] rounded border border-[var(--border-color)]">
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-[var(--text-muted)]" />
                  <span className="text-[var(--text-muted)]">Timestamp Format:</span>
                  <code className="px-2 py-1 bg-[rgba(255,255,255,0.05)] rounded text-xs font-mono text-[var(--text-main)]">00:00:01.234</code>
                  <span className="text-[var(--text-muted)] text-xs">(bottom-right corner)</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Upload Zone */}
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`upload-zone mt-4 ${dragOver ? 'drag-over' : ''}`}
        >
          <input
            type="file"
            accept="video/*"
            multiple
            onChange={(e) => handleFileSelect(e.target.files)}
            className="hidden"
            id="timestamp-video-upload"
            disabled={isProcessing || videos.length >= 6}
          />

          <div className="upload-content">
            <i className="fa-solid fa-cloud-arrow-up upload-icon" />
            <h3>Drag & Drop video file</h3>
            <p>or click to browse from your computer</p>
            <span className="file-hint">Supported formats: MP4, MOV, AVI (Max 100MB)</span>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          className="mt-4 w-full border-[var(--border-color)]"
          disabled={isProcessing || videos.length >= 6}
          onClick={() => document.getElementById('timestamp-video-upload')?.click()}
        >
          <Upload className="h-4 w-4 mr-2" />
          Select Videos
        </Button>

        {/* Error */}
        {error && (
          <div className="mt-4 p-3 bg-[rgba(239,68,68,0.1)] text-[#ef4444] rounded-md text-sm">
            {error}
          </div>
        )}

        {/* Processing */}
        {isProcessing && (
          <div className="mt-6 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-[var(--text-muted)]">Processing video...</span>
              <span className="font-medium text-[var(--text-main)]">{progress}%</span>
            </div>
            <div className="h-2 bg-[rgba(255,255,255,0.1)] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[var(--primary-blue)] to-[var(--accent-teal)] transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Adding timestamp overlay to frames...</span>
            </div>
          </div>
        )}

        {/* Video list */}
        {videos.length > 0 && (
          <div className="mt-6 space-y-3">
            <h3 className="text-sm font-medium text-[var(--text-muted)]">Selected Videos ({videos.length}/6)</h3>
            {videos.map((video, index) => (
              <div
                key={index}
                className="flex items-center gap-4 p-3 bg-[rgba(0,0,0,0.2)] rounded-lg border border-[var(--border-color)]"
              >
                <Video className="h-8 w-8 text-[var(--text-muted)]" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--text-main)] truncate">{video.file.name}</p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {video.durationEstimated ? 'Duration: Unknown' : video.duration.toFixed(1) + 's'}
                    {maxDuration && video.duration > maxDuration && (
                      <span className="text-amber-400"> (will process first {maxDuration}s)</span>
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
                  className="hover:bg-[rgba(239,68,68,0.2)]"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Process Button */}
        {videos.length > 0 && !isProcessing && !processedVideoBlob && (
          <Button
            onClick={handleProcess}
            disabled={isProcessing}
            className="mt-6 w-full btn-primary btn-large btn-glow"
            size="lg"
          >
            <i className="fa-solid fa-wand-magic-sparkles mr-2" />
            Add Timestamp Overlay
          </Button>
        )}

        {/* Success */}
        {processedVideoBlob && processedVideoName && (
          <div className="mt-6 p-4 bg-[rgba(34,197,94,0.1)] border border-[rgba(34,197,94,0.3)] rounded-lg space-y-4">
            <div className="flex items-center gap-2 text-green-400">
              <Download className="h-5 w-5" />
              <p className="text-sm font-medium">Video processed successfully!</p>
            </div>
            <div className="text-sm text-[var(--text-muted)]">
              <p>File: {processedVideoName}</p>
              <p>Size: {formatFileSize(processedVideoBlob.size)}</p>
            </div>
            <Button
              onClick={handleDownload}
              className="w-full btn-primary btn-large"
              size="lg"
            >
              <Download className="mr-2 h-4 w-4" />
              Download Processed Video
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}