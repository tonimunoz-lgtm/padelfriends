export interface User {
  uid: string;
  email: string;
  displayName?: string;
  role: 'admin' | 'player';
  teamId?: string;
  createdAt: Date;
  photoURL?: string;
}

export interface Team {
  id: string;
  name: string;
  code: string;
  player1Id: string;
  player1Name: string;
  player1Email: string;
  player2Id?: string;
  player2Name?: string;
  player2Email?: string;
  preferredLocation: string;
  clubName: string;
  points: number;
  matchesPlayed: number;
  wins: number;
  draws: number;
  losses: number;
  setsWon: number;
  setsLost: number;
  gamesWon: number;
  gamesLost: number;
  createdAt: Date;
}

export interface Championship {
  id: string;
  name: string;
  season: string;
  startDate: Date;
  endDate?: Date;
  status: 'draft' | 'active' | 'finished';
  teamIds: string[];
  currentRound: number;
  totalRounds: number;
  createdAt: Date;
  description?: string;
  pointsWin: number;
  pointsDraw: number;
  pointsLoss: number;
}

export interface Match {
  id: string;
  championshipId: string;
  round: number;
  homeTeamId: string;
  homeTeamName: string;
  awayTeamId: string;
  awayTeamName: string;
  scheduledDate: Date;
  location: string;
  locationOverride?: string;
  locationOverrideExpiry?: Date;
  status: 'scheduled' | 'in_progress' | 'completed' | 'postponed';
  result?: MatchResult;
  reminderSent?: boolean;
  createdAt: Date;
  substitutePlayer1Id?: string;
  substitutePlayer1Name?: string;
  substituteTeamId?: string;
}

export interface MatchResult {
  homeScore: number;
  awayScore: number;
  sets: SetResult[];
  submittedBy: string;
  submittedAt: Date;
  confirmedBy?: string;
  confirmedAt?: Date;
  status: 'pending_confirmation' | 'confirmed' | 'disputed';
}

export interface SetResult {
  homeGames: number;
  awayGames: number;
}

export interface Standings {
  teamId: string;
  teamName: string;
  position: number;
  points: number;
  matchesPlayed: number;
  wins: number;
  draws: number;
  losses: number;
  setsWon: number;
  setsLost: number;
  setsDiff: number;
  form: ('W' | 'D' | 'L')[];
}

export interface Notification {
  id: string;
  userId: string;
  type: 'match_reminder' | 'result_submitted' | 'result_confirmed' | 'team_invite' | 'general' | 'location_changed';
  title: string;
  message: string;
  read: boolean;
  createdAt: Date;
  matchId?: string;
  teamId?: string;
  link?: string;
}
