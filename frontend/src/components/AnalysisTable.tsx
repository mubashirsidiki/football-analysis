import { useState, useMemo } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table'
import { Button } from './ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { FrameAnalysis } from '@/lib/types'
import { ArrowUpDown, Download } from 'lucide-react'

interface AnalysisTableProps {
  frames: FrameAnalysis[]
}

type SortField = 'timestamp' | 'event' | 'players_detected'
type SortDirection = 'asc' | 'desc'

export default function AnalysisTable({ frames }: AnalysisTableProps) {
  const [sortField, setSortField] = useState<SortField>('timestamp')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [eventFilter, setEventFilter] = useState<string>('all')

  const eventTypes = useMemo(() => {
    const events = new Set(frames.map(f => f.event).filter(e => e && e !== 'none'))
    return Array.from(events).sort()
  }, [frames])

  const sortedAndFilteredFrames = useMemo(() => {
    let filtered = frames

    // Apply event filter
    if (eventFilter !== 'all') {
      filtered = filtered.filter(f => f.event === eventFilter)
    }

    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      let aVal: any
      let bVal: any

      switch (sortField) {
        case 'timestamp':
          aVal = a.timestamp
          bVal = b.timestamp
          break
        case 'event':
          aVal = a.event
          bVal = b.event
          break
        case 'players_detected':
          aVal = a.players_detected
          bVal = b.players_detected
          break
        default:
          return 0
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1
      return 0
    })

    return sorted
  }, [frames, sortField, sortDirection, eventFilter])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const getEventColor = (event: string) => {
    switch (event.toLowerCase()) {
      case 'goal':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      case 'shot':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
      case 'tackle':
      case 'duel':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
      case 'pass':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
      case 'dribble':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
    }
  }

  const exportToCSV = () => {
    const headers = ['Timestamp', 'Event', 'Ball Position', 'Players Detected', 'Team A Shape', 'Team B Shape', 'Tactical Notes']
    const rows = sortedAndFilteredFrames.map(f => [
      f.timestamp.toFixed(1),
      f.event,
      f.ball_position,
      f.players_detected.toString(),
      f.team_a_shape,
      f.team_b_shape,
      f.tactical_notes.replace(/"/g, '""') // Escape quotes
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `football-analysis-${new Date().toISOString()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Frame Analysis Results</CardTitle>
            <CardDescription>
              {sortedAndFilteredFrames.length} of {frames.length} frames
            </CardDescription>
          </div>
          <Button onClick={exportToCSV} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex gap-2 items-center">
          <label className="text-sm font-medium">Filter by event:</label>
          <select
            value={eventFilter}
            onChange={(e) => setEventFilter(e.target.value)}
            className="px-3 py-1 border border-input bg-background text-foreground rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="all">All Events</option>
            {eventTypes.map(event => (
              <option key={event} value={event}>{event}</option>
            ))}
          </select>
        </div>

        <div className="rounded-md border overflow-x-auto max-w-full">
          <Table className="min-w-full">
            <TableHeader>
              <TableRow>
                <TableHead>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSort('timestamp')}
                    className="h-8 px-2"
                  >
                    Timestamp (s)
                    <ArrowUpDown className="ml-2 h-3 w-3" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSort('event')}
                    className="h-8 px-2"
                  >
                    Event
                    <ArrowUpDown className="ml-2 h-3 w-3" />
                  </Button>
                </TableHead>
                <TableHead>Ball Position</TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSort('players_detected')}
                    className="h-8 px-2"
                  >
                    Players
                    <ArrowUpDown className="ml-2 h-3 w-3" />
                  </Button>
                </TableHead>
                <TableHead>Team A Shape</TableHead>
                <TableHead>Team B Shape</TableHead>
                <TableHead className="min-w-[400px] whitespace-nowrap">Tactical Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedAndFilteredFrames.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No frames to display
                  </TableCell>
                </TableRow>
              ) : (
                sortedAndFilteredFrames.map((frame, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-mono">{frame.timestamp.toFixed(1)}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getEventColor(frame.event)}`}>
                        {frame.event}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">{frame.ball_position}</TableCell>
                    <TableCell>{frame.players_detected}</TableCell>
                    <TableCell className="text-sm">{frame.team_a_shape}</TableCell>
                    <TableCell className="text-sm">{frame.team_b_shape}</TableCell>
                    <TableCell className="text-sm min-w-[400px] whitespace-normal break-words">
                      {frame.tactical_notes}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}

