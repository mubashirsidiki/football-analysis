import { useMemo } from 'react'
import { FrameAnalysis } from '@/lib/types'
import { Activity, Users, Target, TrendingUp } from 'lucide-react'

interface SummaryPanelProps {
  frames: FrameAnalysis[]
}

export default function SummaryPanel({ frames }: SummaryPanelProps) {
  const summary = useMemo(() => {
    const totalEvents = frames.filter(f => f.event && f.event !== 'none' && f.event !== 'unknown').length
    const eventBreakdown: Record<string, number> = {}
    const teamAShapes: Record<string, number> = {}
    const teamBShapes: Record<string, number> = {}

    let totalPlayers = 0
    let ballVisibleCount = 0

    frames.forEach(frame => {
      if (frame.event && frame.event !== 'none' && frame.event !== 'unknown') {
        eventBreakdown[frame.event] = (eventBreakdown[frame.event] || 0) + 1
      }

      if (frame.team_a_shape && frame.team_a_shape !== 'Unknown') {
        teamAShapes[frame.team_a_shape] = (teamAShapes[frame.team_a_shape] || 0) + 1
      }
      if (frame.team_b_shape && frame.team_b_shape !== 'Unknown') {
        teamBShapes[frame.team_b_shape] = (teamBShapes[frame.team_b_shape] || 0) + 1
      }

      totalPlayers += frame.players_detected
      if (frame.ball_position && frame.ball_position !== 'Not visible') {
        ballVisibleCount++
      }
    })

    const avgPlayersDetected = frames.length > 0 ? totalPlayers / frames.length : 0
    const ballVisibilityRate = frames.length > 0 ? ballVisibleCount / frames.length : 0

    const mostCommonFormationA = Object.entries(teamAShapes).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Unknown'
    const mostCommonFormationB = Object.entries(teamBShapes).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Unknown'
    const mostCommonEvent = Object.entries(eventBreakdown).sort((a, b) => b[1] - a[1])[0]?.[0] || 'None'

    return {
      totalEvents,
      eventBreakdown,
      avgPlayersDetected: Math.round(avgPlayersDetected * 10) / 10,
      mostCommonFormation: {
        teamA: mostCommonFormationA,
        teamB: mostCommonFormationB,
      },
      ballVisibilityRate: Math.round(ballVisibilityRate * 100),
      mostCommonEvent,
    }
  }, [frames])

  const stats = [
    {
      title: 'Total Events',
      value: summary.totalEvents,
      description: `${summary.mostCommonEvent} most common`,
      icon: Activity,
      color: 'text-[var(--primary-blue)]',
    },
    {
      title: 'Avg Players Detected',
      value: summary.avgPlayersDetected,
      description: 'per frame',
      icon: Users,
      color: 'text-[var(--accent-teal)]',
    },
    {
      title: 'Ball Visibility',
      value: `${summary.ballVisibilityRate}%`,
      description: 'of frames',
      icon: Target,
      color: 'text-yellow-400',
    },
    {
      title: 'Common Formations',
      value: `${summary.mostCommonFormation.teamA} / ${summary.mostCommonFormation.teamB}`,
      description: 'Team A / Team B',
      icon: TrendingUp,
      color: 'text-purple-400',
    },
  ]

  return (
    <div className="mb-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4 w-full max-w-[1100px]">
      {stats.map((stat, index) => {
        const Icon = stat.icon
        return (
          <div key={index} className="glass-card p-4">
            <div className="flex flex-row items-center justify-between pb-2">
              <span className="text-sm font-medium text-[var(--text-muted)]">{stat.title}</span>
              <Icon className={`h-4 w-4 ${stat.color}`} />
            </div>
            <div className="text-2xl font-bold text-[var(--text-main)] break-words">{stat.value}</div>
            <p className="text-xs text-[var(--text-muted)] mt-1">{stat.description}</p>
          </div>
        )
      })}
    </div>
  )
}