import { CountdownTime, RamadanInfo } from '../types';

const UPCOMING_RAMADAN: RamadanInfo[] = [
  { hijriYear: 1448, dateStr: '2027-02-08' },
  { hijriYear: 1449, dateStr: '2028-01-28' },
  { hijriYear: 1450, dateStr: '2029-01-16' },
  { hijriYear: 1451, dateStr: '2030-01-06' },
];

export function toLocalDateKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0);
}

export function getDefaultRamadanTarget(now: Date = new Date()): RamadanInfo {
  for (const item of UPCOMING_RAMADAN) {
    const start = parseLocalDate(item.dateStr);
    const endOfRamadan = new Date(start.getTime() + 30 * 86400000);
    if (now < endOfRamadan) {
      return item;
    }
  }
  return UPCOMING_RAMADAN[UPCOMING_RAMADAN.length - 1];
}

export function shiftDateStr(dateStr: string, deltaDays: number): string {
  const date = parseLocalDate(dateStr);
  date.setDate(date.getDate() + deltaDays);
  return toLocalDateKey(date);
}

export function formatIndonesianDate(dateStr: string): string {
  const date = parseLocalDate(dateStr);
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function getCountdown(targetDateStr: string, now: Date = new Date()): CountdownTime {
  const target = parseLocalDate(targetDateStr);
  const diff = target.getTime() - now.getTime();

  if (diff <= 0) {
    const elapsedDays = Math.floor(Math.abs(diff) / 86400000) + 1;
    if (elapsedDays <= 30) {
      return {
        days: 0,
        hours: 0,
        minutes: 0,
        seconds: 0,
        totalMs: 0,
        isRamadan: true,
        ramadanDay: elapsedDays,
      };
    }
  }

  const clamped = Math.max(0, diff);
  const days = Math.floor(clamped / 86400000);
  const hours = Math.floor((clamped % 86400000) / 3600000);
  const minutes = Math.floor((clamped % 3600000) / 60000);
  const seconds = Math.floor((clamped % 60000) / 1000);

  return {
    days,
    hours,
    minutes,
    seconds,
    totalMs: clamped,
    isRamadan: false,
    ramadanDay: 0,
  };
}

export function getHabitStreak(completedDates: string[], today: Date = new Date()): number {
  const set = new Set(completedDates);
  const todayKey = toLocalDateKey(today);
  const cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  if (!set.has(todayKey)) {
    cursor.setDate(cursor.getDate() - 1);
  }

  let streak = 0;
  while (set.has(toLocalDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

const DAY_LABELS = ['Mg', 'Sn', 'Sl', 'Rb', 'Km', 'Jm', 'Sb'];

export function getLast7Days(today: Date = new Date()): { key: string; label: string; isToday: boolean }[] {
  const days: { key: string; label: string; isToday: boolean }[] = [];
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    days.push({
      key: toLocalDateKey(d),
      label: DAY_LABELS[d.getDay()],
      isToday: i === 0,
    });
  }
  return days;
}

export function getPreparationPhase(daysLeft: number, isRamadan: boolean): string {
  if (isRamadan) return 'Ramadan sedang berlangsung';
  if (daysLeft <= 7) return 'Pekan terakhir menuju Ramadan';
  if (daysLeft <= 30) return 'Bulan Syaban · Matangkan ritme harian';
  if (daysLeft <= 60) return 'Dua bulan lagi · Jaga konsistensi';
  return 'Persiapan dini · Bangun kebiasaan perlahan';
}
