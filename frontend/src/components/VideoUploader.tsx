import { useState, useCallback } from 'react'
import { Button } from './ui/button'
import { Upload, X, Video, Film } from 'lucide-react'

interface VideoFile {
  file: File
  preview: string
  duration: number
  durationEstimated?: boolean
  error?: string
}

interface VideoUploaderProps {
  videos: VideoFile[]
  onVideosChange: (videos: VideoFile[]) => void
  isUploading?: boolean
  error?: string | null
  onError?: (error: string | null) => void
}

export default function VideoUploader({
  videos,
  onVideosChange,
  isUploading = false,
  error,
  onError,
}: VideoUploaderProps) {
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

        const maxSize = 100 * 1024 * 1024 // 100MB
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
        let duration = 0
        const cleanup = () => {
          if (video.src) URL.revokeObjectURL(video.src)
        }

        const timeout = setTimeout(() => {
          if (!resolved) {
            resolved = true
            cleanup()
            const fileSizeMB = file.size / (1024 * 1024)
            duration = Math.max(1, fileSizeMB / 1.5)
            resolve({ valid: true, duration, durationEstimated: true })
          }
        }, 5000)

        video.onloadedmetadata = () => {
          if (resolved) return
          resolved = true
          clearTimeout(timeout)
          cleanup()
          duration = video.duration

          if (isNaN(duration) || duration <= 0) {
            const fileSizeMB = file.size / (1024 * 1024)
            duration = Math.max(1, fileSizeMB / 1.5)
            resolve({ valid: true, duration, durationEstimated: true })
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
          duration = Math.max(1, fileSizeMB / 1.5)
          resolve({ valid: true, duration, durationEstimated: true })
        }

        try {
          video.src = URL.createObjectURL(file)
        } catch {
          if (!resolved) {
            resolved = true
            clearTimeout(timeout)
            const fileSizeMB = file.size / (1024 * 1024)
            duration = Math.max(1, fileSizeMB / 1.5)
            resolve({ valid: true, duration, durationEstimated: true })
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
      onError?.('Maximum 6 videos allowed')
      return
    }

    onError?.(null)
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
      onError?.(errors.join('; '))
    } else if (errors.length > 0) {
      onError?.(`Some videos failed validation: ${errors.join('; ')}`)
    }

    if (newVideos.length > 0) {
      onVideosChange([...videos, ...newVideos])
    }
  }, [videos, onVideosChange, onError])

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
    const newVideos = [...videos]
    URL.revokeObjectURL(newVideos[index].preview)
    newVideos.splice(index, 1)
    onVideosChange(newVideos)
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  return (
    <div className="panel upload-panel glass-card">
      <div className="panel-header">
        <h2>
          <i className="fa-solid fa-video" />
          Match Footage
        </h2>
        <span className="badge">Step 1</span>
      </div>

      {/* Upload Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`upload-zone ${dragOver ? 'drag-over' : ''}`}
      >
        <input
          type="file"
          accept="video/*"
          multiple
          onChange={(e) => handleFileSelect(e.target.files)}
          className="hidden"
          id="video-upload"
          disabled={isUploading || videos.length >= 6}
        />

        {videos.length === 0 ? (
          <div className="upload-content">
            <i className="fa-solid fa-cloud-arrow-up upload-icon" />
            <h3>Drag & Drop video file</h3>
            <p>or click to browse from your computer</p>
            <span className="file-hint">Supported formats: MP4, MOV, AVI (Max 100MB)</span>
          </div>
        ) : (
          <div className="file-preview">
            {videos.map((video, index) => (
              <div key={index} className="w-full">
                <div className="flex flex-col items-center text-center w-full p-4">
                  <div className="video-icon">
                    <Film />
                  </div>
                  <div className="file-details">
                    <span className="file-name">{video.file.name}</span>
                    <span className="file-size">{formatFileSize(video.file.size)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Hidden file input trigger */}
      <Button
        type="button"
        variant="outline"
        className="mt-4 w-full"
        disabled={isUploading || videos.length >= 6}
        onClick={() => document.getElementById('video-upload')?.click()}
      >
        <Upload className="h-4 w-4 mr-2" />
        {videos.length === 0 ? 'Select Videos' : 'Add More Videos'}
      </Button>

      {/* Video list */}
      {videos.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-sm text-[var(--text-muted)]">{videos.length} video{videos.length > 1 ? 's' : ''} selected</p>
          {videos.map((video, index) => (
            <div key={index} className="flex items-center gap-3 p-2 bg-[rgba(0,0,0,0.2)] rounded-lg">
              <Video className="h-4 w-4 text-[var(--text-muted)]" />
              <span className="flex-1 text-sm truncate">{video.file.name}</span>
              <span className="text-xs text-[var(--text-muted)]">{formatFileSize(video.file.size)}</span>
              <button
                onClick={() => removeVideo(index)}
                className="remove-btn"
                disabled={isUploading}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mt-4 p-3 bg-[rgba(239,68,68,0.1)] text-[#ef4444] rounded-md text-sm">
          {error}
        </div>
      )}
    </div>
  )
}