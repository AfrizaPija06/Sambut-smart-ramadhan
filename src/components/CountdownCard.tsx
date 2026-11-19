import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { CountdownTime } from '../types';
import { formatIndonesianDate, getPreparationPhase, shiftDateStr } from '../utils/ramadan';

interface CountdownCardProps {
  countdown: CountdownTime;
  targetDateStr: string;
  hijriYear: number;
  onChangeTargetDate: (nextDateStr: string) => void;
  onResetDefaultDate: () => void;
  isCustomDate: boolean;
}

export function CountdownCard({
  countdown,
  targetDateStr,
  hijriYear,
  onChangeTargetDate,
  onResetDefaultDate,
  isCustomDate,
}: CountdownCardProps) {
  const [editingDate, setEditingDate] = useState(false);

  const phaseText = getPreparationPhase(countdown.days, countdown.isRamadan);
  // Progress across a 120-day pre-Ramadan runway (gives meaningful sense of approach)
  const runwayTotal = 120;
  const progressPct = countdown.isRamadan
    ? 100
    : Math.max(4, Math.min(100, Math.round(((runwayTotal - Math.min(runwayTotal, countdown.days)) / runwayTotal) * 100)));

  const timeUnits = [
    { label: 'Hari', value: String(countdown.days) },
    { label: 'Jam', value: String(countdown.hours).padStart(2, '0') },
    { label: 'Menit', value: String(countdown.minutes).padStart(2, '0') },
    { label: 'Detik', value: String(countdown.seconds).padStart(2, '0') },
  ];

  return (
    <section
      aria-label="Hitung mundur Ramadan"
      className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-7"
    >
      {/* Top unboxed metadata row */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-600 min-w-0">
          <span className="font-medium text-slate-900 whitespace-nowrap">
            1 Ramadan {hijriYear} H
          </span>
          <span aria-hidden="true">·</span>
          <span className="truncate">{formatIndonesianDate(targetDateStr)}</span>
        </div>

        <button
          type="button"
          onClick={() => setEditingDate((prev) => !prev)}
          className="inline-flex items-center gap-1.5 min-h-[44px] px-2.5 -mr-2 text-xs font-medium text-emerald-800 hover:text-emerald-950 transition-colors whitespace-nowrap shrink-0 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
          aria-expanded={editingDate}
        >
          <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
          <span>{editingDate ? 'Selesai' : 'Ubah tanggal'}</span>
        </button>
      </div>

      {/* Inline date adjustment drawer (for ±1 day rukyat differences) */}
      {editingDate && (
        <div className="mt-3 pt-3 pb-1 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onChangeTargetDate(shiftDateStr(targetDateStr, -1))}
              className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 active:scale-[0.98] transition-all"
              aria-label="Majukan 1 hari"
              title="Majukan 1 hari"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <input
              type="date"
              value={targetDateStr}
              onChange={(e) => {
                if (e.target.value) onChangeTargetDate(e.target.value);
              }}
              aria-label="Pilih tanggal perkiraan 1 Ramadan"
              className="min-h-[44px] px-3 rounded-xl border border-slate-200 text-xs sm:text-sm font-medium text-slate-800 bg-slate-50 focus:outline-none focus:border-emerald-700"
            />

            <button
              type="button"
              onClick={() => onChangeTargetDate(shiftDateStr(targetDateStr, 1))}
              className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 active:scale-[0.98] transition-all"
              aria-label="Mundurkan 1 hari"
              title="Mundurkan 1 hari"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {isCustomDate && (
            <button
              type="button"
              onClick={onResetDefaultDate}
              className="min-h-[44px] px-3 text-xs font-medium text-slate-600 hover:text-slate-900 underline underline-offset-4 whitespace-nowrap"
            >
              Kembalikan perkiraan awal
            </button>
          )}
        </div>
      )}

      {/* Main countdown display */}
      <div className="mt-5 sm:mt-6">
        {countdown.isRamadan ? (
          <div>
            <h1 className="font-display text-4xl sm:text-5xl font-semibold tracking-tight text-slate-900 tabular-nums [text-wrap:balance]">
              Hari ke-{countdown.ramadanDay} Ramadan
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Jaga kebiasaan baik yang sudah kamu bangun sejak jauh hari.
            </p>
          </div>
        ) : (
          <div>
            <div className="grid grid-cols-4 gap-2 sm:gap-3">
              {timeUnits.map((unit, idx) => (
                <div
                  key={unit.label}
                  className={`rounded-2xl py-3.5 sm:py-4 px-2 text-center ${
                    idx === 0
                      ? 'bg-[#0D6E52] text-white'
                      : 'bg-slate-50 text-slate-900 border border-slate-200/60'
                  }`}
                >
                  <div className="font-mono text-2xl sm:text-4xl font-semibold tracking-tight tabular-nums leading-none">
                    {unit.value}
                  </div>
                  <div
                    className={`mt-1.5 text-xs font-medium ${
                      idx === 0 ? 'text-emerald-100' : 'text-slate-500'
                    }`}
                  >
                    {unit.label}
                  </div>
                </div>
              ))}
            </div>

            {/* Preparation progress line */}
            <div className="mt-5">
              <div className="flex items-center justify-between gap-2 text-xs text-slate-600 mb-2">
                <span>{phaseText}</span>
                <span className="font-mono tabular-nums text-slate-500">
                  {countdown.days} hari lagi
                </span>
              </div>
              <div
                className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden"
                role="progressbar"
                aria-valuenow={progressPct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Progres mendekati Ramadan"
              >
                <div
                  className="h-full rounded-full bg-[#0D6E52] transition-all duration-300"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
