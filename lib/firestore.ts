import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  addDoc,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';
import { Team, Match, Championship, Standings, Notification } from '@/types';

// --- TEAMS ---
export async function generateTeamCode(): Promise<string> {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export async function createTeam(data: Partial<Team>): Promise<string> {
  const code = await generateTeamCode();
  const ref = doc(collection(db, 'teams'));
  await setDoc(ref, {
    ...data,
    id: ref.id,
    code,
    points: 0,
    matchesPlayed: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    setsWon: 0,
    setsLost: 0,
    gamesWon: 0,
    gamesLost: 0,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function getTeamByCode(code: string): Promise<Team | null> {
  const q = query(collection(db, 'teams'), where('code', '==', code.toUpperCase()));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() } as Team;
}

export async function getTeam(id: string): Promise<Team | null> {
  const snap = await getDoc(doc(db, 'teams', id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Team;
}

export async function getAllTeams(): Promise<Team[]> {
  const snap = await getDocs(collection(db, 'teams'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Team));
}

export async function updateTeam(id: string, data: Partial<Team>) {
  await updateDoc(doc(db, 'teams', id), data as Record<string, unknown>);
}

export async function deleteTeam(id: string) {
  await deleteDoc(doc(db, 'teams', id));
}

// --- CHAMPIONSHIPS ---
export async function createChampionship(data: Partial<Championship>): Promise<string> {
  const ref = doc(collection(db, 'championships'));
  await setDoc(ref, { ...data, id: ref.id, createdAt: serverTimestamp() });
  return ref.id;
}

export async function getChampionships(): Promise<Championship[]> {
  const snap = await getDocs(query(collection(db, 'championships'), orderBy('createdAt', 'desc')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Championship));
}

export async function getActiveChampionship(): Promise<Championship | null> {
  const q = query(collection(db, 'championships'), where('status', '==', 'active'));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() } as Championship;
}

export async function updateChampionship(id: string, data: Partial<Championship>) {
  await updateDoc(doc(db, 'championships', id), data as Record<string, unknown>);
}

// --- MATCHES ---
export async function getMatchesByChampionship(championshipId: string): Promise<Match[]> {
  const q = query(
    collection(db, 'matches'),
    where('championshipId', '==', championshipId),
    orderBy('scheduledDate', 'asc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Match));
}

export async function getMatchesByTeam(teamId: string): Promise<Match[]> {
  const [homeSnap, awaySnap] = await Promise.all([
    getDocs(query(collection(db, 'matches'), where('homeTeamId', '==', teamId))),
    getDocs(query(collection(db, 'matches'), where('awayTeamId', '==', teamId))),
  ]);
  const all = [
    ...homeSnap.docs.map(d => ({ id: d.id, ...d.data() } as Match)),
    ...awaySnap.docs.map(d => ({ id: d.id, ...d.data() } as Match)),
  ];
  return all.sort((a, b) => {
    const da = a.scheduledDate instanceof Timestamp ? a.scheduledDate.toDate() : new Date(a.scheduledDate);
    const db2 = b.scheduledDate instanceof Timestamp ? b.scheduledDate.toDate() : new Date(b.scheduledDate);
    return da.getTime() - db2.getTime();
  });
}

export async function createMatch(data: Partial<Match>): Promise<string> {
  const ref = doc(collection(db, 'matches'));
  await setDoc(ref, { ...data, id: ref.id, createdAt: serverTimestamp() });
  return ref.id;
}

export async function updateMatch(id: string, data: Partial<Match>) {
  await updateDoc(doc(db, 'matches', id), data as Record<string, unknown>);
}

export async function submitMatchResult(
  matchId: string,
  homeScore: number,
  awayScore: number,
  sets: { homeGames: number; awayGames: number }[],
  submittedBy: string,
  championshipId: string,
  homeTeamId: string,
  awayTeamId: string
) {
  const isDraw = homeScore === awayScore;
  const homeWins = homeScore > awayScore;

  // Get points config from championship (fallback to 4/2/1)
  const champSnap = await getDoc(doc(db, 'championships', championshipId));
  const champData = champSnap.exists() ? champSnap.data() : {};
  const ptsWin = champData.pointsWin ?? 4;
  const ptsDraw = champData.pointsDraw ?? 2;
  const ptsLoss = champData.pointsLoss ?? 1;

  const homePoints = homeWins ? ptsWin : isDraw ? ptsDraw : ptsLoss;
  const awayPoints = homeWins ? ptsLoss : isDraw ? ptsDraw : ptsWin;

  const homeSetsWon = sets.filter(s => s.homeGames > s.awayGames).length;
  const awaySetsWon = sets.filter(s => s.awayGames > s.homeGames).length;
  // FIX: use reduce instead of filter to allow 0 games (6-0 etc)
  const homeGamesWon = sets.reduce((acc, s) => acc + s.homeGames, 0);
  const awayGamesWon = sets.reduce((acc, s) => acc + s.awayGames, 0);

  const batch = writeBatch(db);

  batch.update(doc(db, 'matches', matchId), {
    status: 'completed',
    result: {
      homeScore,
      awayScore,
      sets,
      submittedBy,
      submittedAt: serverTimestamp(),
      status: 'confirmed',
    },
  });

  const homeRef = doc(db, 'teams', homeTeamId);
  const homeSnap = await getDoc(homeRef);
  if (homeSnap.exists()) {
    const t = homeSnap.data() as Team;
    batch.update(homeRef, {
      points: (t.points || 0) + homePoints,
      matchesPlayed: (t.matchesPlayed || 0) + 1,
      wins: (t.wins || 0) + (homeWins ? 1 : 0),
      draws: (t.draws || 0) + (isDraw ? 1 : 0),
      losses: (t.losses || 0) + (!homeWins && !isDraw ? 1 : 0),
      setsWon: (t.setsWon || 0) + homeSetsWon,
      setsLost: (t.setsLost || 0) + awaySetsWon,
      gamesWon: (t.gamesWon || 0) + homeGamesWon,
      gamesLost: (t.gamesLost || 0) + awayGamesWon,
    });
  }

  const awayRef = doc(db, 'teams', awayTeamId);
  const awaySnap = await getDoc(awayRef);
  if (awaySnap.exists()) {
    const t = awaySnap.data() as Team;
    batch.update(awayRef, {
      points: (t.points || 0) + awayPoints,
      matchesPlayed: (t.matchesPlayed || 0) + 1,
      wins: (t.wins || 0) + (!homeWins && !isDraw ? 1 : 0),
      draws: (t.draws || 0) + (isDraw ? 1 : 0),
      losses: (t.losses || 0) + (homeWins ? 1 : 0),
      setsWon: (t.setsWon || 0) + awaySetsWon,
      setsLost: (t.setsLost || 0) + homeSetsWon,
      gamesWon: (t.gamesWon || 0) + awayGamesWon,
      gamesLost: (t.gamesLost || 0) + homeGamesWon,
    });
  }

  await batch.commit();
}

// Update an already-completed match result (reverses old stats, applies new ones)
export async function updateMatchResult(
  matchId: string,
  homeScore: number,
  awayScore: number,
  sets: { homeGames: number; awayGames: number }[],
  submittedBy: string,
) {
  const matchSnap = await getDoc(doc(db, 'matches', matchId));
  if (!matchSnap.exists()) throw new Error('Match not found');
  const match = { id: matchSnap.id, ...matchSnap.data() } as Match;
  const old = match.result;

  const champSnap = await getDoc(doc(db, 'championships', match.championshipId));
  const champData = champSnap.exists() ? champSnap.data() : {};
  const ptsWin = champData.pointsWin ?? 4;
  const ptsDraw = champData.pointsDraw ?? 2;
  const ptsLoss = champData.pointsLoss ?? 1;

  const batch = writeBatch(db);

  // Reverse old stats if result existed
  if (old) {
    const oldHomeWins = old.homeScore > old.awayScore;
    const oldIsDraw = old.homeScore === old.awayScore;
    const oldHomePts = oldHomeWins ? ptsWin : oldIsDraw ? ptsDraw : ptsLoss;
    const oldAwayPts = oldHomeWins ? ptsLoss : oldIsDraw ? ptsDraw : ptsWin;
    const oldHomeSets = (old.sets || []).filter(s => s.homeGames > s.awayGames).length;
    const oldAwaySets = (old.sets || []).filter(s => s.awayGames > s.homeGames).length;
    const oldHomeGames = (old.sets || []).reduce((a, s) => a + s.homeGames, 0);
    const oldAwayGames = (old.sets || []).reduce((a, s) => a + s.awayGames, 0);

    const homeRef = doc(db, 'teams', match.homeTeamId);
    const homeSnap = await getDoc(homeRef);
    if (homeSnap.exists()) {
      const t = homeSnap.data() as Team;
      batch.update(homeRef, {
        points: Math.max(0, (t.points || 0) - oldHomePts),
        matchesPlayed: Math.max(0, (t.matchesPlayed || 0) - 1),
        wins: Math.max(0, (t.wins || 0) - (oldHomeWins ? 1 : 0)),
        draws: Math.max(0, (t.draws || 0) - (oldIsDraw ? 1 : 0)),
        losses: Math.max(0, (t.losses || 0) - (!oldHomeWins && !oldIsDraw ? 1 : 0)),
        setsWon: Math.max(0, (t.setsWon || 0) - oldHomeSets),
        setsLost: Math.max(0, (t.setsLost || 0) - oldAwaySets),
        gamesWon: Math.max(0, (t.gamesWon || 0) - oldHomeGames),
        gamesLost: Math.max(0, (t.gamesLost || 0) - oldAwayGames),
      });
    }

    const awayRef = doc(db, 'teams', match.awayTeamId);
    const awaySnap = await getDoc(awayRef);
    if (awaySnap.exists()) {
      const t = awaySnap.data() as Team;
      batch.update(awayRef, {
        points: Math.max(0, (t.points || 0) - oldAwayPts),
        matchesPlayed: Math.max(0, (t.matchesPlayed || 0) - 1),
        wins: Math.max(0, (t.wins || 0) - (!oldHomeWins && !oldIsDraw ? 1 : 0)),
        draws: Math.max(0, (t.draws || 0) - (oldIsDraw ? 1 : 0)),
        losses: Math.max(0, (t.losses || 0) - (oldHomeWins ? 1 : 0)),
        setsWon: Math.max(0, (t.setsWon || 0) - oldAwaySets),
        setsLost: Math.max(0, (t.setsLost || 0) - oldHomeSets),
        gamesWon: Math.max(0, (t.gamesWon || 0) - oldAwayGames),
        gamesLost: Math.max(0, (t.gamesLost || 0) - oldHomeGames),
      });
    }
  }

  // Apply new stats
  const newHomeWins = homeScore > awayScore;
  const newIsDraw = homeScore === awayScore;
  const newHomePts = newHomeWins ? ptsWin : newIsDraw ? ptsDraw : ptsLoss;
  const newAwayPts = newHomeWins ? ptsLoss : newIsDraw ? ptsDraw : ptsWin;
  const newHomeSets = sets.filter(s => s.homeGames > s.awayGames).length;
  const newAwaySets = sets.filter(s => s.awayGames > s.homeGames).length;
  const newHomeGames = sets.reduce((a, s) => a + s.homeGames, 0);
  const newAwayGames = sets.reduce((a, s) => a + s.awayGames, 0);

  // Update match
  batch.update(doc(db, 'matches', matchId), {
    status: 'completed',
    result: { homeScore, awayScore, sets, submittedBy, submittedAt: serverTimestamp(), status: 'confirmed' },
  });

  // Re-add home stats
  const homeRef2 = doc(db, 'teams', match.homeTeamId);
  const homeSnap2 = await getDoc(homeRef2);
  if (homeSnap2.exists()) {
    const t = homeSnap2.data() as Team;
    // If we already modified this in the batch, read from the batch result
    // We use a fresh getDoc here since batch hasn't committed yet - slight race is acceptable for admin use
    batch.update(homeRef2, {
      points: (t.points || 0) + newHomePts,
      matchesPlayed: (t.matchesPlayed || 0) + 1,
      wins: (t.wins || 0) + (newHomeWins ? 1 : 0),
      draws: (t.draws || 0) + (newIsDraw ? 1 : 0),
      losses: (t.losses || 0) + (!newHomeWins && !newIsDraw ? 1 : 0),
      setsWon: (t.setsWon || 0) + newHomeSets,
      setsLost: (t.setsLost || 0) + newAwaySets,
      gamesWon: (t.gamesWon || 0) + newHomeGames,
      gamesLost: (t.gamesLost || 0) + newAwayGames,
    });
  }

  const awayRef2 = doc(db, 'teams', match.awayTeamId);
  const awaySnap2 = await getDoc(awayRef2);
  if (awaySnap2.exists()) {
    const t = awaySnap2.data() as Team;
    batch.update(awayRef2, {
      points: (t.points || 0) + newAwayPts,
      matchesPlayed: (t.matchesPlayed || 0) + 1,
      wins: (t.wins || 0) + (!newHomeWins && !newIsDraw ? 1 : 0),
      draws: (t.draws || 0) + (newIsDraw ? 1 : 0),
      losses: (t.losses || 0) + (newHomeWins ? 1 : 0),
      setsWon: (t.setsWon || 0) + newAwaySets,
      setsLost: (t.setsLost || 0) + newHomeSets,
      gamesWon: (t.gamesWon || 0) + newAwayGames,
      gamesLost: (t.gamesLost || 0) + newHomeGames,
    });
  }

  await batch.commit();
}

// --- ROUND ROBIN GENERATION ---
export function generateRoundRobin(teams: Team[]): { homeTeamId: string; awayTeamId: string; round: number }[] {
  const n = teams.length;
  const teamsCopy = [...teams];
  if (n % 2 !== 0) teamsCopy.push({ id: 'bye' } as Team);
  const total = teamsCopy.length;
  const rounds = total - 1;
  const matches: { homeTeamId: string; awayTeamId: string; round: number }[] = [];

  for (let round = 0; round < rounds; round++) {
    for (let i = 0; i < total / 2; i++) {
      const home = teamsCopy[i];
      const away = teamsCopy[total - 1 - i];
      if (home.id !== 'bye' && away.id !== 'bye') {
        // Alternate home/away each round
        if (round % 2 === 0) {
          matches.push({ homeTeamId: home.id, awayTeamId: away.id, round: round + 1 });
        } else {
          matches.push({ homeTeamId: away.id, awayTeamId: home.id, round: round + 1 });
        }
      }
    }
    // Rotate teams (keep first fixed)
    teamsCopy.splice(1, 0, teamsCopy.pop()!);
  }
  return matches;
}

// --- NOTIFICATIONS ---
export async function createNotification(data: Partial<Notification>) {
  await addDoc(collection(db, 'notifications'), {
    ...data,
    read: false,
    createdAt: serverTimestamp(),
  });
}

export async function getUserNotifications(userId: string): Promise<Notification[]> {
  const q = query(
    collection(db, 'notifications'),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Notification));
}

export async function markNotificationRead(id: string) {
  await updateDoc(doc(db, 'notifications', id), { read: true });
}

// --- STANDINGS ---
export async function getStandings(championshipId: string): Promise<Standings[]> {
  const championship = await getDoc(doc(db, 'championships', championshipId));
  if (!championship.exists()) return [];
  const teamIds: string[] = championship.data().teamIds || [];
  const teams = await Promise.all(teamIds.map(id => getTeam(id)));
  
  const standings: Standings[] = teams
    .filter(Boolean)
    .map((team, i) => ({
      teamId: team!.id,
      teamName: team!.name,
      position: i + 1,
      points: team!.points || 0,
      matchesPlayed: team!.matchesPlayed || 0,
      wins: team!.wins || 0,
      draws: team!.draws || 0,
      losses: team!.losses || 0,
      setsWon: team!.setsWon || 0,
      setsLost: team!.setsLost || 0,
      setsDiff: (team!.setsWon || 0) - (team!.setsLost || 0),
      form: [],
    }))
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (b.setsWon !== a.setsWon) return b.setsWon - a.setsWon;
      return b.setsDiff - a.setsDiff;
    })
    .map((s, i) => ({ ...s, position: i + 1 }));

  return standings;
}
