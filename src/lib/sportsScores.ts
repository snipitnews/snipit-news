/**
 * Sports scores fetching module using TheSportsDB API
 * Fetches recent scores and tournament information for sports topics
 */

interface SportsScore {
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  status: string; // "Final", "Live", "Scheduled", etc.
  league: string; // "NBA", "NFL", "MLB", etc.
  date: string;
  url?: string;
  standoutStats?: string; // e.g., "Tatum 34 pts"
  trends?: string; // e.g., "Celtics: 8-2 last 10"
}

interface TournamentInfo {
  name: string;
  currentRound?: string;
  keyMatches: SportsScore[];
  league: string;
}

const THE_SPORTS_DB_API_KEY = '123';
const THE_SPORTS_DB_BASE_URL = 'https://www.thesportsdb.com/api/v1/json';

/**
 * Maps topic names to TheSportsDB league IDs
 */
const LEAGUE_MAP: Record<string, { id: string; name: string }> = {
  nba: { id: '4387', name: 'NBA' },
  nfl: { id: '4391', name: 'NFL' },
  mlb: { id: '4424', name: 'MLB' },
  nhl: { id: '4380', name: 'NHL' },
  soccer: { id: '4328', name: 'English Premier League' }, // Default to EPL
  'la liga': { id: '4335', name: 'La Liga' },
  'ligue 1': { id: '4334', name: 'Ligue 1' },
  epl: { id: '4328', name: 'English Premier League' },
  tennis: { id: '4337', name: 'ATP Tour' },
  golf: { id: '4338', name: 'PGA Tour' },
  sports: { id: '4387', name: 'NBA' }, // Default to NBA for general sports
};

/**
 * Fetches recent events (scores) for a given league
 */
async function fetchRecentEvents(leagueId: string, leagueName: string): Promise<SportsScore[]> {
  try {
    // Fetch recent past events for the league (last 5 events)
    // TheSportsDB API: eventspastleague.php?id=LEAGUE_ID
    const response = await fetch(
      `${THE_SPORTS_DB_BASE_URL}/${THE_SPORTS_DB_API_KEY}/eventspastleague.php?id=${leagueId}`
    );

    if (!response.ok) {
      console.error(`[Sports Scores] API error: ${response.status}`);
      return [];
    }

    const data = await response.json();
    
    if (!data.events || data.events.length === 0) {
      console.log(`[Sports Scores] No events found for ${leagueName}`);
      return [];
    }

    // Filter to last week (7 days) to ensure we have enough games for fallback
    // prioritizeScores will then filter to day before first, then expand to week if needed
    const now = Date.now();
    const oneWeekAgo = now - (7 * 24 * 60 * 60 * 1000);
    const recentEvents = data.events.filter((event: any) => {
      if (!event.dateEvent) return false;
      try {
        const eventDate = new Date(event.dateEvent).getTime();
        return eventDate >= oneWeekAgo && eventDate <= now;
      } catch {
        return false; // Exclude if date parsing fails
      }
    });

    return parseEvents(recentEvents.slice(0, 15), leagueName); // Get top 15 most recent from last week
  } catch (error) {
    console.error(`[Sports Scores] Error fetching events for ${leagueName}:`, error);
    return [];
  }
}

/**
 * Parses TheSportsDB events into SportsScore format
 */
function parseEvents(events: any[], leagueName: string): SportsScore[] {
  return events
    .filter(event => {
      // Include events that have scores OR are scheduled/live
      return (event.strResult && event.strResult.trim() !== '') || 
             event.strStatus === 'Scheduled' || 
             event.strStatus === 'Live' ||
             event.strStatus === 'Not Started';
    })
    .map(event => {
      let homeScore = 0;
      let awayScore = 0;
      const homeTeam = event.strHomeTeam || '';
      const awayTeam = event.strAwayTeam || '';

      // Parse score from strResult if available
      if (event.strResult && event.strResult.trim() !== '') {
        const scoreMatch = event.strResult.match(/(\d+)\s*-\s*(\d+)/);
        if (scoreMatch) {
          const scores = scoreMatch[0].split('-').map(s => parseInt(s.trim()));
          // TheSportsDB typically formats as "HomeTeam Score - Score AwayTeam" or "AwayTeam Score - Score HomeTeam"
          // We'll use the intHomeScore and intAwayScore if available, otherwise parse from strResult
          if (event.intHomeScore !== null && event.intAwayScore !== null) {
            homeScore = parseInt(event.intHomeScore) || 0;
            awayScore = parseInt(event.intAwayScore) || 0;
          } else {
            // Try to determine from result string order
            const resultLower = event.strResult.toLowerCase();
            const homeLower = homeTeam.toLowerCase();
            const awayLower = awayTeam.toLowerCase();
            
            if (resultLower.indexOf(homeLower) < resultLower.indexOf(awayLower)) {
              // Home team mentioned first in result
              homeScore = scores[0];
              awayScore = scores[1];
            } else {
              // Away team mentioned first
              awayScore = scores[0];
              homeScore = scores[1];
            }
          }
        }
      }

      // Determine status
      let status = 'Final';
      if (event.strStatus === 'Not Started' || event.strStatus === 'Scheduled') {
        status = 'Scheduled';
      } else if (event.strStatus === 'Live' || event.strStatus === 'In Progress') {
        status = 'Live';
      } else if (event.strStatus === 'Half Time') {
        status = 'HT';
      } else if (event.strStatus === 'Match Finished' || event.strStatus === 'FT') {
        status = 'Final';
      }

      return {
        homeTeam: homeTeam || 'TBD',
        awayTeam: awayTeam || 'TBD',
        homeScore,
        awayScore,
        status,
        league: leagueName,
        date: event.dateEvent || event.strDate || new Date().toISOString(),
        url: event.strVideo || event.strEvent || undefined,
      };
    })
    .filter(score => score.homeTeam !== 'TBD' && score.awayTeam !== 'TBD');
}

/**
 * Fetches scores for a given sports topic
 */
export async function fetchSportsScores(
  topic: string
): Promise<{ scores: SportsScore[]; tournaments: TournamentInfo[] }> {
  const topicLower = topic.toLowerCase().trim();
  
  // Find matching league
  let leagueInfo = LEAGUE_MAP[topicLower];
  
  // If exact match not found, try partial match
  if (!leagueInfo) {
    for (const [key, value] of Object.entries(LEAGUE_MAP)) {
      if (topicLower.includes(key) || key.includes(topicLower)) {
        leagueInfo = value;
        break;
      }
    }
  }

  if (!leagueInfo) {
    console.log(`[Sports Scores] No league mapping found for topic: ${topic}`);
    return { scores: [], tournaments: [] };
  }

  console.log(`[Sports Scores] Fetching scores for ${leagueInfo.name} (league ID: ${leagueInfo.id})`);
  
  const scores = await fetchRecentEvents(leagueInfo.id, leagueInfo.name);
  
  // For now, tournaments will be empty - can be enhanced later
  const tournaments: TournamentInfo[] = [];

  return { scores, tournaments };
}

/**
 * Filters and prioritizes scores to get the most relevant ones
 * Priority: Day before (last 24 hours) > Last week (if not enough from day before)
 * Returns top 3 most important games
 */
export function prioritizeScores(
  scores: SportsScore[],
  maxScores: number = 3
): SportsScore[] {
  if (scores.length === 0) return [];

  const now = Date.now();
  const oneDayAgo = now - (24 * 60 * 60 * 1000); // 24 hours ago
  const oneWeekAgo = now - (7 * 24 * 60 * 60 * 1000); // 7 days ago

  // Helper to check if score is within time window
  const isWithinWindow = (scoreDate: Date, startTime: number, endTime: number): boolean => {
    const gameTime = scoreDate.getTime();
    return gameTime >= startTime && gameTime <= endTime;
  };

  // First, try to get Final games with scores from the day before (last 24 hours)
  const dayBeforeFinalScores = scores
    .filter(score => {
      try {
        const gameDate = new Date(score.date);
        return isWithinWindow(gameDate, oneDayAgo, now);
      } catch {
        return false;
      }
    })
    .filter(score => score.status === 'Final' && (score.homeScore > 0 || score.awayScore > 0));

  // If we have at least 3 Final games with scores from day before, use only those
  // Otherwise, expand to last week (but still prioritize day-before games)
  const timeWindowScores = dayBeforeFinalScores.length >= maxScores
    ? scores.filter(score => {
        // Use only day before scores
        try {
          const gameDate = new Date(score.date);
          return isWithinWindow(gameDate, oneDayAgo, now);
        } catch {
          return false;
        }
      })
    : scores.filter(score => {
        // Expand to last week if not enough from day before
        try {
          const gameDate = new Date(score.date);
          return isWithinWindow(gameDate, oneWeekAgo, now);
        } catch {
          return false;
        }
      });

  // Sort by priority
  return timeWindowScores
    .sort((a, b) => {
      // 1. Prioritize games from day before (last 24 hours) over older games
      try {
        const aDate = new Date(a.date).getTime();
        const bDate = new Date(b.date).getTime();
        const aIsDayBefore = aDate >= oneDayAgo;
        const bIsDayBefore = bDate >= oneDayAgo;
        
        if (aIsDayBefore && !bIsDayBefore) return -1; // Day before first
        if (!aIsDayBefore && bIsDayBefore) return 1;
      } catch {
        // Continue with other priorities if date parsing fails
      }
      
      // 2. Prioritize Final games with actual scores
      const statusPriority: Record<string, number> = {
        'Final': 10, // Highest priority for completed games
        'Live': 5,
        'HT': 5,
        'Scheduled': 1,
      };
      
      const aPriority = statusPriority[a.status] || 0;
      const bPriority = statusPriority[b.status] || 0;
      
      if (aPriority !== bPriority) {
        return bPriority - aPriority; // Higher priority first
      }
      
      // 3. For Final games, prioritize games with scores (non-zero scores)
      if (a.status === 'Final' && b.status === 'Final') {
        const aHasScore = (a.homeScore > 0 || a.awayScore > 0);
        const bHasScore = (b.homeScore > 0 || b.awayScore > 0);
        if (aHasScore && !bHasScore) return -1;
        if (!aHasScore && bHasScore) return 1;
        
        // 4. If both have scores, prioritize close games or high-scoring games
        const aTotalScore = a.homeScore + a.awayScore;
        const bTotalScore = b.homeScore + b.awayScore;
        const aScoreDiff = Math.abs(a.homeScore - a.awayScore);
        const bScoreDiff = Math.abs(b.homeScore - b.awayScore);
        
        // Prefer close games (low score diff) or high-scoring games
        if (aScoreDiff !== bScoreDiff) {
          return aScoreDiff - bScoreDiff; // Lower diff (closer game) first
        }
        return bTotalScore - aTotalScore; // Higher total score first
      }
      
      // 5. If same priority, sort by date (most recent first)
      try {
        const aDate = new Date(a.date).getTime();
        const bDate = new Date(b.date).getTime();
        return bDate - aDate;
      } catch {
        return 0;
      }
    })
    .slice(0, maxScores); // Always return top 3
}
