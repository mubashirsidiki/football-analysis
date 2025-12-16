import { useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
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
      // Count events
      if (frame.event && frame.event !== 'none' && frame.event !== 'unknown') {
        eventBreakdown[frame.event] = (eventBreakdown[frame.event] || 0) + 1
      }

      // Count formations
      if (frame.team_a_shape && frame.team_a_shape !== 'Unknown') {
        teamAShapes[frame.team_a_shape] = (teamAShapes[frame.team_a_shape] || 0) + 1
      }
      if (frame.team_b_shape && frame.team_b_shape !== 'Unknown') {
        teamBShapes[frame.team_b_shape] = (teamBShapes[frame.team_b_shape] || 0) + 1
      }

      // Count players and ball visibility
      totalPlayers += frame.players_detected
      if (frame.ball_position && frame.ball_position !== 'Not visible') {
        ballVisibleCount++
      }
    })

    const avgPlayersDetected = frames.length > 0 ? totalPlayers / frames.length : 0
    const ballVisibilityRate = frames.length > 0 ? ballVisibleCount / frames.length : 0

    // Find most common formations
    const mostCommonFormationA = Object.entries(teamAShapes).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Unknown'
    const mostCommonFormationB = Object.entries(teamBShapes).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Unknown'

    // Find most common event
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
      color: 'text-blue-600',
    },
    {
      title: 'Avg Players Detected',
      value: summary.avgPlayersDetected,
      description: 'per frame',
      icon: Users,
      color: 'text-green-600',
    },
    {
      title: 'Ball Visibility',
      value: `${summary.ballVisibilityRate}%`,
      description: 'of frames',
      icon: Target,
      color: 'text-orange-600',
    },
    {
      title: 'Common Formations',
      value: `${summary.mostCommonFormation.teamA} / ${summary.mostCommonFormation.teamB}`,
      description: 'Team A / Team B',
      icon: TrendingUp,
      color: 'text-purple-600',
    },
  ]

  return (
    <div className="mb-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat, index) => {
        const Icon = stat.icon
        return (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <Icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

