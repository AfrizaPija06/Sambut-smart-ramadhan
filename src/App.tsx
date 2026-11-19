import { useCallback, useEffect, useMemo, useState } from 'react';
import { CountdownCard } from './components/CountdownCard';
import { FloatingWidgetControl } from './components/FloatingWidget';
import { HabitTracker } from './components/HabitTracker';
import { PWAInstallButton } from './components/PWAInstallButton';
import { Habit } from './types';
import { getCountdown, getDefaultRamadanTarget, toLocalDateKey } from './utils/ramadan';

const STORAGE_KEYS = {
  habits: 'sambut_ramadan_habits_v1',
  targetDate: 'sambut_ramadan_target_date_v1',
};

function createStarterHabits(): Habit[] {
  const nowIso = new Date().toISOString();
  return [
    {
      id: 'starter-1',
      title: 'Puasa sunnah Senin / Kamis',
      completedDates: [],
      createdAt: nowIso,
    },
    {
      id: 'starter-2',
      title: "Tilawah Al-Qur'an 1 halaman",
      completedDates: [],
      createdAt: nowIso,
    },
    {
      id: 'starter-3',
      title: 'Sholat di awal waktu',
      completedDates: [],
      createdAt: nowIso,
    },
    {
      id: 'starter-4',
      title: 'Kurangi gula & tidur lebih awal',
      completedDates: [],
      createdAt: nowIso,
    },
  ];
}

function loadInitialHabits(): Habit[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.habits);
    if (raw === null) return createStarterHabits();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : createStarterHabits();
  } catch {
    return createStarterHabits();
  }
}

function loadInitialTargetDate(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEYS.targetDate);
  } catch {
    return null;
  }
}

export default function App() {
  const defaultTarget = useMemo(() => getDefaultRamadanTarget(), []);
  const [customTargetDate, setCustomTargetDate] = useState<string | null>(loadInitialTargetDate);
  const [habits, setHabits] = useState<Habit[]>(loadInitialHabits);
  const [now, setNow] = useState<Date>(() => new Date());

  const activeTargetDate = customTargetDate ?? defaultTarget.dateStr;

  useEffect(() => {
    const id = window.setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.habits, JSON.stringify(habits));
    } catch {
      // Ignore storage quota errors
    }
  }, [habits]);

  useEffect(() => {
    try {
      if (customTargetDate) {
        localStorage.setItem(STORAGE_KEYS.targetDate, customTargetDate);
      } else {
        localStorage.removeItem(STORAGE_KEYS.targetDate);
      }
    } catch {
      // Ignore storage errors
    }
  }, [customTargetDate]);

  const countdown = useMemo(
    () => getCountdown(activeTargetDate, now),
    [activeTargetDate, now]
  );

  const handleToggleHabitToday = useCallback((habitId: string) => {
    const todayKey = toLocalDateKey();
    setHabits((prev) =>
      prev.map((habit) => {
        if (habit.id !== habitId) return habit;
        const alreadyDone = habit.completedDates.includes(todayKey);
        return {
          ...habit,
          completedDates: alreadyDone
            ? habit.completedDates.filter((d) => d !== todayKey)
            : [...habit.completedDates, todayKey],
        };
      })
    );
  }, []);

  const handleAddHabit = useCallback((title: string) => {
    const next: Habit = {
      id: `h-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title,
      completedDates: [],
      createdAt: new Date().toISOString(),
    };
    setHabits((prev) => [...prev, next]);
  }, []);

  const handleDeleteHabit = useCallback((habitId: string) => {
    setHabits((prev) => prev.filter((h) => h.id !== habitId));
  }, []);

  const handleRestoreStarterHabits = useCallback(() => {
    setHabits(createStarterHabits());
  }, []);

  const todayFormatted = useMemo(
    () =>
      new Intl.DateTimeFormat('id-ID', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      }).format(now),
    [now]
  );

  return (
    <div className="min-h-dvh bg-[#f6f7f4] text-slate-900">
      <header className="max-w-5xl mx-auto px-4 sm:px-6 pt-5 pb-4 flex items-center justify-between gap-4">
        <span className="font-display text-lg sm:text-xl font-semibold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
          Sambut Ramadan
        </span>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs sm:text-sm text-slate-500 whitespace-nowrap">
            {todayFormatted}
          </span>
          <PWAInstallButton />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 pb-16 grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-start">
        <div className="lg:col-span-6 space-y-4 sm:space-y-6">
          <CountdownCard
            countdown={countdown}
            targetDateStr={activeTargetDate}
            hijriYear={defaultTarget.hijriYear}
            onChangeTargetDate={(dateStr) => setCustomTargetDate(dateStr)}
            onResetDefaultDate={() => setCustomTargetDate(null)}
            isCustomDate={customTargetDate !== null && customTargetDate !== defaultTarget.dateStr}
          />

          <FloatingWidgetControl countdown={countdown} habits={habits} />
        </div>

        <div className="lg:col-span-6">
          <HabitTracker
            habits={habits}
            onToggleToday={handleToggleHabitToday}
            onAddHabit={handleAddHabit}
            onDeleteHabit={handleDeleteHabit}
            onRestoreStarterHabits={handleRestoreStarterHabits}
          />
        </div>
      </main>
    </div>
  );
}
