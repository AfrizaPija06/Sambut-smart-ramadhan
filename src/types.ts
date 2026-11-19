export interface Habit {
  id: string;
  title: string;
  completedDates: string[]; // YYYY-MM-DD in local time
  createdAt: string;
}

export interface CountdownTime {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalMs: number;
  isRamadan: boolean;
  ramadanDay: number;
}

export interface RamadanInfo {
  hijriYear: number;
  dateStr: string; // YYYY-MM-DD
}
