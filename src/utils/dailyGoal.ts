export interface DailyGoalStatus {
  date: string; // YYYY-MM-DD
  count: number;
  target: number;
  completed: boolean;
  streakDays: number;
  nominations: Array<{
    name: string;
    timestamp: string;
  }>;
}

const STORAGE_KEY = 'lazy_daily_goal_state';
const DEFAULT_TARGET = 3;

function getTodayString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getDailyGoal(): DailyGoalStatus {
  const today = getTodayString();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.date === today) {
        return {
          date: today,
          count: Number(parsed.count) || 0,
          target: Number(parsed.target) || DEFAULT_TARGET,
          completed: (Number(parsed.count) || 0) >= (Number(parsed.target) || DEFAULT_TARGET),
          streakDays: Number(parsed.streakDays) || 1,
          nominations: Array.isArray(parsed.nominations) ? parsed.nominations : []
        };
      } else {
        // Date changed! Check if yesterday was completed to maintain streak
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
        
        let newStreak = 1;
        if (parsed.date === yStr && parsed.completed) {
          newStreak = (Number(parsed.streakDays) || 1) + 1;
        }

        const freshState: DailyGoalStatus = {
          date: today,
          count: 0,
          target: DEFAULT_TARGET,
          completed: false,
          streakDays: newStreak,
          nominations: []
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(freshState));
        return freshState;
      }
    }
  } catch {}

  // Default initial state
  const initialState: DailyGoalStatus = {
    date: today,
    count: 0,
    target: DEFAULT_TARGET,
    completed: false,
    streakDays: 1,
    nominations: []
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initialState));
  } catch {}
  return initialState;
}

export function recordNominationGoal(friendName?: string): DailyGoalStatus {
  const current = getDailyGoal();
  const newCount = current.count + 1;
  const isNowCompleted = newCount >= current.target;
  
  const updatedNominations = [
    ...(current.nominations || []),
    {
      name: friendName?.trim() || `Friend #${newCount}`,
      timestamp: new Date().toISOString()
    }
  ];

  const updated: DailyGoalStatus = {
    ...current,
    count: newCount,
    completed: isNowCompleted,
    nominations: updatedNominations
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    // Dispatch custom event so all open components / tabs update synchronously
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('lazy_daily_goal_updated', { detail: updated }));
    }
  } catch {}

  return updated;
}

export function resetDailyGoalForTesting(): DailyGoalStatus {
  const today = getTodayString();
  const resetState: DailyGoalStatus = {
    date: today,
    count: 0,
    target: DEFAULT_TARGET,
    completed: false,
    streakDays: 1,
    nominations: []
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(resetState));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('lazy_daily_goal_updated', { detail: resetState }));
    }
  } catch {}
  return resetState;
}
