import { Check, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { Habit } from '../types';
import { getHabitStreak, getLast7Days, toLocalDateKey } from '../utils/ramadan';

interface HabitTrackerProps {
  habits: Habit[];
  onToggleToday: (habitId: string) => void;
  onAddHabit: (title: string) => void;
  onDeleteHabit: (habitId: string) => void;
  onRestoreStarterHabits: () => void;
}

export function HabitTracker({
  habits,
  onToggleToday,
  onAddHabit,
  onDeleteHabit,
  onRestoreStarterHabits,
}: HabitTrackerProps) {
  const [newTitle, setNewTitle] = useState('');
  const today = new Date();
  const todayKey = toLocalDateKey(today);
  const last7Days = getLast7Days(today);

  const completedTodayCount = habits.filter((h) => h.completedDates.includes(todayKey)).length;
  const totalCount = habits.length;
  const completionPct = totalCount > 0 ? Math.round((completedTodayCount / totalCount) * 100) : 0;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    onAddHabit(trimmed);
    setNewTitle('');
  };

  return (
    <section
      aria-label="Pembangun kebiasaan persiapan Ramadan"
      className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-7 flex flex-col"
    >
      {/* Header */}
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <h2 className="text-lg sm:text-xl font-semibold tracking-tight text-slate-900">
            Bangun Kebiasaan
          </h2>
          <p className="mt-0.5 text-xs sm:text-sm text-slate-500">
            Latih ritme kecil setiap hari agar Ramadan terasa ringan.
          </p>
        </div>

        <div className="text-right shrink-0">
          <span className="font-mono text-sm sm:text-base font-semibold text-slate-900 tabular-nums">
            {completedTodayCount}/{totalCount}
          </span>
          <span className="block text-xs text-slate-500">hari ini</span>
        </div>
      </div>

      {/* Daily completion bar */}
      <div className="mt-4 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
        <div
          className="h-full rounded-full bg-[#0D6E52] transition-all duration-200"
          style={{ width: `${completionPct}%` }}
        />
      </div>

      {/* Habit rows */}
      <div className="mt-4 divide-y divide-slate-100">
        {habits.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-sm text-slate-600">
              Belum ada kebiasaan. Tambahkan satu kebiasaan kecil untuk memulai.
            </p>
            <button
              type="button"
              onClick={onRestoreStarterHabits}
              className="mt-3 inline-flex items-center gap-1.5 min-h-[44px] px-4 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Muat contoh kebiasaan</span>
            </button>
          </div>
        ) : (
          habits.map((habit) => {
            const isDoneToday = habit.completedDates.includes(todayKey);
            const streak = getHabitStreak(habit.completedDates, today);
            const completedSet = new Set(habit.completedDates);

            return (
              <div
                key={habit.id}
                className="py-3 first:pt-1 last:pb-1 flex items-center justify-between gap-2"
              >
                <button
                  type="button"
                  onClick={() => onToggleToday(habit.id)}
                  aria-pressed={isDoneToday}
                  className="flex-1 min-w-0 min-h-[48px] flex items-center gap-3 text-left rounded-xl py-1 pr-2 hover:bg-slate-50/70 active:scale-[0.99] transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
                >
                  <span
                    className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 border transition-colors ${
                      isDoneToday
                        ? 'bg-[#0D6E52] border-[#0D6E52] text-white'
                        : 'bg-white border-slate-300 text-transparent'
                    }`}
                    aria-hidden="true"
                  >
                    <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div
                      className={`text-sm sm:text-[15px] font-medium truncate transition-colors ${
                        isDoneToday ? 'text-slate-400 line-through' : 'text-slate-900'
                      }`}
                    >
                      {habit.title}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                      <span className="tabular-nums">
                        {streak > 0 ? `${streak} hari berturut` : 'Mulai hari ini'}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className={isDoneToday ? 'text-emerald-800 font-medium' : ''}>
                        {isDoneToday ? 'Selesai' : 'Belum'}
                      </span>
                    </div>
                  </div>
                </button>

                {/* 7-day consistency squares + Delete */}
                <div className="flex items-center gap-1 shrink-0">
                  <div
                    className="hidden sm:flex items-center gap-1 mr-1"
                    aria-label="Riwayat 7 hari terakhir"
                  >
                    {last7Days.map((day) => {
                      const done = completedSet.has(day.key);
                      return (
                        <span
                          key={day.key}
                          title={`${day.label}: ${done ? 'Selesai' : 'Kosong'}`}
                          className={`w-2.5 h-2.5 rounded-[3px] ${
                            done
                              ? 'bg-[#0D6E52]'
                              : day.isToday
                              ? 'bg-slate-200 ring-1 ring-slate-300'
                              : 'bg-slate-100'
                          }`}
                        />
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={() => onDeleteHabit(habit.id)}
                    aria-label={`Hapus kebiasaan ${habit.title}`}
                    className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50/70 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add new habit form (Thumb-friendly bottom zone) */}
      <form onSubmit={handleSubmit} className="mt-5 pt-4 border-t border-slate-100 flex gap-2">
        <input
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="Tambah kebiasaan baru..."
          maxLength={60}
          aria-label="Nama kebiasaan baru"
          className="flex-1 min-w-0 min-h-[48px] px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-[#0D6E52] transition-colors"
        />
        <button
          type="submit"
          disabled={!newTitle.trim()}
          className="min-h-[48px] px-4 rounded-xl bg-[#0D6E52] text-white text-sm font-medium inline-flex items-center gap-1.5 hover:bg-[#095540] disabled:opacity-40 disabled:pointer-events-none active:scale-[0.98] transition-all whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          <span>Tambah</span>
        </button>
      </form>
    </section>
  );
}
