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

    if (eventFilter !== 'all') {
      filtered = filtered.filter(f => f.event === eventFilter)
    }

    const sorted = [...filtered].sort((a, b) => {
      let aVal: number | string
      let bVal: number | string

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
        return 'bg-green-500/20 text-green-400 border border-green-500/30'
      case 'shot':
        return 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
      case 'tackle':
      case 'duel':
        return 'bg-red-500/20 text-red-400 border border-red-500/30'
      case 'pass':
        return 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
      case 'dribble':
        return 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
      default:
        return 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
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
      f.tactical_notes.replace(/"/g, '""')
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
    <div className="glass-card w-full max-w-[1100px]">
      <div className="p-6">
        {/* Header */}
        <div className="flex justify-between items-center pb-4 border-b border-[var(--border-color)]">
          <div className="flex items-center gap-3">
            <i className="fa-solid fa-table-cells text-[var(--primary-blue)] text-lg" />
            <div>
              <h2 className="text-lg font-semibold text-[var(--text-main)]">Frame Analysis Results</h2>
              <p className="text-sm text-[var(--text-muted)]">
                {sortedAndFilteredFrames.length} of {frames.length} frames
              </p>
            </div>
          </div>
          <Button onClick={exportToCSV} variant="outline" size="sm" className="border-[var(--border-color)]">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>

        {/* Filter */}
        <div className="mb-4 flex gap-2 items-center mt-4">
          <label className="text-sm font-medium text-[var(--text-muted)]">Filter by event:</label>
          <select
            value={eventFilter}
            onChange={(e) => setEventFilter(e.target.value)}
            className="px-3 py-1.5 border border-[var(--border-color)] bg-[rgba(0,0,0,0.2)] text-[var(--text-main)] rounded-md text-sm focus:outline-none focus:border-[var(--primary-blue)]"
          >
            <option value="all">All Events</option>
            {eventTypes.map(event => (
              <option key={event} value={event}>{event}</option>
            ))}
          </select>
        </div>

        {/* Table */}
        <div className="rounded-lg border border-[var(--border-color)] overflow-x-auto">
          <Table className="min-w-full">
            <TableHeader>
              <TableRow className="border-[var(--border-color)] hover:bg-transparent">
                <TableHead className="text-[var(--text-muted)] font-medium">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSort('timestamp')}
                    className="h-8 px-2 text-[var(--text-muted)] hover:text-[var(--text-main)]"
                  >
                    Timestamp (s)
                    <ArrowUpDown className="ml-2 h-3 w-3" />
                  </Button>
                </TableHead>
                <TableHead className="text-[var(--text-muted)] font-medium">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSort('event')}
                    className="h-8 px-2 text-[var(--text-muted)] hover:text-[var(--text-main)]"
                  >
                    Event
                    <ArrowUpDown className="ml-2 h-3 w-3" />
                  </Button>
                </TableHead>
                <TableHead className="text-[var(--text-muted)] font-medium">Ball Position</TableHead>
                <TableHead className="text-[var(--text-muted)] font-medium">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSort('players_detected')}
                    className="h-8 px-2 text-[var(--text-muted)] hover:text-[var(--text-main)]"
                  >
                    Players
                    <ArrowUpDown className="ml-2 h-3 w-3" />
                  </Button>
                </TableHead>
                <TableHead className="text-[var(--text-muted)] font-medium">Team A Shape</TableHead>
                <TableHead className="text-[var(--text-muted)] font-medium">Team B Shape</TableHead>
                <TableHead className="text-[var(--text-muted)] font-medium min-w-[400px]">Tactical Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedAndFilteredFrames.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-[var(--text-muted)] py-8">
                    No frames to display
                  </TableCell>
                </TableRow>
              ) : (
                sortedAndFilteredFrames.map((frame, index) => (
                  <TableRow key={index} className="border-[var(--border-color)] hover:bg-[rgba(255,255,255,0.02)]">
                    <TableCell className="font-mono text-[var(--text-main)]">{frame.timestamp.toFixed(1)}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getEventColor(frame.event)}`}>
                        {frame.event}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-[var(--text-muted)]">{frame.ball_position}</TableCell>
                    <TableCell className="text-[var(--text-main)]">{frame.players_detected}</TableCell>
                    <TableCell className="text-sm text-[var(--text-muted)]">{frame.team_a_shape}</TableCell>
                    <TableCell className="text-sm text-[var(--text-muted)]">{frame.team_b_shape}</TableCell>
                    <TableCell className="text-sm text-[var(--text-muted)] min-w-[400px] whitespace-normal break-words">
                      {frame.tactical_notes}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}