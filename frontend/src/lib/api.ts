import { AnalysisResponse } from './types'

// API URL configuration - defaults to localhost:8000
// Optional: Override with VITE_API_URL environment variable if needed
// Legacy: Used to require .env file, now defaults are sufficient
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export interface AnalysisConfig {
  frame_interval: number
  max_duration: number
}

export async function uploadVideos(
  files: File[],
  config: AnalysisConfig
): Promise<AnalysisResponse> {
  try {
    // Validate inputs
    if (!files || files.length === 0) {
      throw new Error('No files provided')
    }

    if (files.length > 6) {
      throw new Error('Maximum 6 videos allowed')
    }

    if (config.frame_interval <= 0) {
      throw new Error('Frame interval must be greater than 0')
    }

    if (config.max_duration <= 0) {
      throw new Error('Max duration must be greater than 0')
    }

    const formData = new FormData()
    files.forEach((file) => {
      if (!file || !(file instanceof File)) {
        throw new Error('Invalid file provided')
      }
      formData.append('videos', file)
    })
    
    formData.append('frame_interval', config.frame_interval.toString())
    formData.append('max_duration', config.max_duration.toString())

    const response = await fetch(`${API_URL}/api/analyze`, {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      let errorMessage = 'Failed to upload videos'
      
      try {
        const errorData = await response.json()
        errorMessage = errorData.detail || errorData.message || errorMessage
      } catch {
        // If JSON parsing fails, use status text
        errorMessage = response.statusText || `Server error (${response.status})`
      }

      // Provide more specific error messages
      if (response.status === 400) {
        throw new Error(errorMessage || 'Invalid request. Please check your video files and settings.')
      } else if (response.status === 413) {
        throw new Error('File too large. Maximum file size is 100MB.')
      } else if (response.status === 500) {
        throw new Error('Server error. Please try again later.')
      } else if (response.status >= 500) {
        throw new Error(`Server error (${response.status}). Please try again later.`)
      } else {
        throw new Error(errorMessage)
      }
    }

    const result = await response.json()
    
    if (!result) {
      throw new Error('Invalid response from server')
    }

    // Validate response structure
    if (!Array.isArray(result.frames)) {
      throw new Error('Invalid response format: frames must be an array')
    }

    return result
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error('Network error. Please check your connection and try again.')
    }
    throw error
  }
}

export async function addTimestampOverlay(
  files: File[],
  maxDuration?: number
): Promise<Blob> {
  try {
    // Validate inputs
    if (!files || files.length === 0) {
      throw new Error('No files provided')
    }

    if (files.length > 6) {
      throw new Error('Maximum 6 videos allowed')
    }

    if (maxDuration !== undefined && maxDuration !== null) {
      if (maxDuration <= 0) {
        throw new Error('Max duration must be greater than 0')
      }
      if (maxDuration > 60) {
        throw new Error('Max duration cannot exceed 60 seconds')
      }
    }

    const formData = new FormData()
    files.forEach((file) => {
      if (!file || !(file instanceof File)) {
        throw new Error('Invalid file provided')
      }
      formData.append('videos', file)
    })
    
    if (maxDuration !== undefined && maxDuration !== null) {
      formData.append('max_duration', maxDuration.toString())
    }

    const response = await fetch(`${API_URL}/api/video/timestamp-overlay`, {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      let errorMessage = 'Failed to process video'
      
      try {
        const errorData = await response.json()
        errorMessage = errorData.detail || errorData.message || errorMessage
      } catch {
        // If JSON parsing fails, use status text
        errorMessage = response.statusText || `Server error (${response.status})`
      }

      // Provide more specific error messages
      if (response.status === 400) {
        throw new Error(errorMessage || 'Invalid request. Please check your video files and settings.')
      } else if (response.status === 413) {
        throw new Error('File too large. Maximum file size is 100MB.')
      } else if (response.status === 500) {
        throw new Error('Server error. Please try again later.')
      } else if (response.status >= 500) {
        throw new Error(`Server error (${response.status}). Please try again later.`)
      } else {
        throw new Error(errorMessage)
      }
    }

    // Return blob for download
    const blob = await response.blob()
    
    if (!blob || blob.size === 0) {
      throw new Error('Invalid response from server: empty video file')
    }

    return blob
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error('Network error. Please check your connection and try again.')
    }
    throw error
  }
}

