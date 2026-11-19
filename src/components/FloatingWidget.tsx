import {
  Check,
  ExternalLink,
  Eye,
  EyeOff,
  GripVertical,
  Minimize2,
  Moon,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { CountdownTime, Habit } from '../types';
import { formatIndonesianDate, toLocalDateKey } from '../utils/ramadan';

interface DocumentPictureInPicture {
  requestWindow(options?: { width?: number; height?: number }): Promise<Window>;
  window: Window | null;
}

declare global {
  interface Window {
    documentPictureInPicture?: DocumentPictureInPicture;
  }
}

interface FloatingWidgetControlProps {
  isOverlayVisible: boolean;
  onToggleOverlay: () => void;
  countdown: CountdownTime;
  targetDateStr: string;
  hijriYear: number;
  habits: Habit[];
  onToggleHabit: (habitId: string) => void;
}

export function FloatingWidgetControl({
  isOverlayVisible,
  onToggleOverlay,
  countdown,
  targetDateStr,
  hijriYear,
  habits,
  onToggleHabit,
}: FloatingWidgetControlProps) {
  const [pipActive, setPipActive] = useState(false);
  const [pipNotice, setPipNotice] = useState<string | null>(null);

  const pipWinRef = useRef<Window | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const todayKey = toLocalDateKey();
  const completedCount = habits.filter((h) => h.completedDates.includes(todayKey)).length;

  // Draw crisp live widget onto offscreen canvas for mobile video PiP
  const drawCanvasFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    // Deep slate background
    ctx.fillStyle = '#0F1714';
    ctx.fillRect(0, 0, w, h);

    // Subtle top accent bar
    ctx.fillStyle = '#0D6E52';
    ctx.fillRect(0, 0, w, 10);

    // Header label
    ctx.fillStyle = '#94A39D';
    ctx.font = '600 22px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(`RAMADAN ${hijriYear} H  ·  ${formatIndonesianDate(targetDateStr)}`, 36, 62);

    // Main countdown
    ctx.fillStyle = '#FFFFFF';
    if (countdown.isRamadan) {
      ctx.font = '700 58px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(`Hari ke-${countdown.ramadanDay}`, 36, 154);
    } else {
      ctx.font = '700 68px "JetBrains Mono", monospace';
      const hrs = String(countdown.hours).padStart(2, '0');
      const mins = String(countdown.minutes).padStart(2, '0');
      const secs = String(countdown.seconds).padStart(2, '0');
      ctx.fillText(`${countdown.days}h  ${hrs}:${mins}:${secs}`, 36, 160);
    }

    // Habit progress footer
    const total = habits.length;
    const pct = total > 0 ? completedCount / total : 0;

    ctx.fillStyle = '#CBD5D1';
    ctx.font = '500 24px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(`Kebiasaan hari ini: ${completedCount} dari ${total} selesai`, 36, 250);

    // Progress bar track
    const barX = 36;
    const barY = 278;
    const barW = w - 72;
    const barH = 14;
    ctx.fillStyle = '#24332E';
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, 7);
    ctx.fill();

    // Progress fill
    if (pct > 0) {
      ctx.fillStyle = '#18A87C';
      ctx.beginPath();
      ctx.roundRect(barX, barY, Math.max(14, Math.round(barW * pct)), barH, 7);
      ctx.fill();
    }
  }, [completedCount, countdown, habits.length, hijriYear, targetDateStr]);

  // Sync Document PiP DOM if open
  const syncDocumentPip = useCallback(() => {
    const win = pipWinRef.current;
    if (!win || win.closed) return;
    const doc = win.document;

    const timerEl = doc.getElementById('pip-timer');
    if (timerEl) {
      if (countdown.isRamadan) {
        timerEl.textContent = `Hari ke-${countdown.ramadanDay} Ramadan`;
      } else {
        const hrs = String(countdown.hours).padStart(2, '0');
        const mins = String(countdown.minutes).padStart(2, '0');
        const secs = String(countdown.seconds).padStart(2, '0');
        timerEl.textContent = `${countdown.days}h ${hrs}:${mins}:${secs}`;
      }
    }

    const summaryEl = doc.getElementById('pip-habit-summary');
    if (summaryEl) {
      summaryEl.textContent = `${completedCount}/${habits.length} kebiasaan hari ini`;
    }

    const listEl = doc.getElementById('pip-habit-list');
    if (listEl) {
      listEl.innerHTML = '';
      habits.forEach((habit) => {
        const done = habit.completedDates.includes(todayKey);
        const btn = doc.createElement('button');
        btn.type = 'button';
        btn.className = `habit-btn ${done ? 'done' : ''}`;
        btn.onclick = () => onToggleHabit(habit.id);

        const box = doc.createElement('span');
        box.className = 'box';
        box.textContent = done ? '✓' : '';

        const label = doc.createElement('span');
        label.className = 'label';
        label.textContent = habit.title;

        btn.appendChild(box);
        btn.appendChild(label);
        listEl.appendChild(btn);
      });
    }
  }, [completedCount, countdown, habits, onToggleHabit, todayKey]);

  // Update active PiP windows on tick or habit change
  useEffect(() => {
    if (!pipActive) return;
    if (pipWinRef.current && !pipWinRef.current.closed) {
      syncDocumentPip();
    } else if (canvasRef.current) {
      drawCanvasFrame();
    }
  }, [pipActive, syncDocumentPip, drawCanvasFrame]);

  const stopPip = useCallback(async () => {
    if (pipWinRef.current && !pipWinRef.current.closed) {
      pipWinRef.current.close();
    }
    pipWinRef.current = null;

    if (document.pictureInPictureElement) {
      try {
        await document.exitPictureInPicture();
      } catch {
        // Ignore if already exited
      }
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    setPipActive(false);
  }, []);

  useEffect(() => {
    return () => {
      if (pipWinRef.current && !pipWinRef.current.closed) {
        pipWinRef.current.close();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const handleLaunchPip = async () => {
    setPipNotice(null);

    if (pipActive) {
      await stopPip();
      return;
    }

    // 1. Try Document Picture-in-Picture (interactive window)
    if (window.documentPictureInPicture?.requestWindow) {
      try {
        const pipWin = await window.documentPictureInPicture.requestWindow({
          width: 310,
          height: 280,
        });
        pipWinRef.current = pipWin;

        const style = pipWin.document.createElement('style');
        style.textContent = `
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            background: #0F1714;
            color: #F8FAF9;
            padding: 14px;
            user-select: none;
          }
          .kicker { font-size: 11px; color: #94A39D; letter-spacing: 0.01em; }
          .timer {
            font-family: ui-monospace, SFMono-Regular, monospace;
            font-size: 26px;
            font-weight: 700;
            margin-top: 4px;
            font-variant-numeric: tabular-nums;
          }
          .summary { font-size: 12px; color: #6EE7B7; margin-top: 8px; margin-bottom: 8px; }
          .list { display: flex; flex-direction: column; gap: 6px; }
          .habit-btn {
            width: 100%;
            min-height: 36px;
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 6px 8px;
            border-radius: 8px;
            border: 1px solid #24332E;
            background: #17221E;
            color: #F8FAF9;
            font-size: 12px;
            text-align: left;
            cursor: pointer;
          }
          .habit-btn.done { color: #8A9993; text-decoration: line-through; }
          .box {
            width: 18px;
            height: 18px;
            border-radius: 5px;
            border: 1px solid #4A5E57;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-size: 11px;
            flex-shrink: 0;
          }
          .habit-btn.done .box {
            background: #0D6E52;
            border-color: #0D6E52;
            color: #fff;
          }
          .label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        `;
        pipWin.document.head.appendChild(style);

        pipWin.document.body.innerHTML = `
          <div class="kicker">Ramadan ${hijriYear} H · ${formatIndonesianDate(targetDateStr)}</div>
          <div id="pip-timer" class="timer"></div>
          <div id="pip-habit-summary" class="summary"></div>
          <div id="pip-habit-list" class="list"></div>
        `;

        pipWin.addEventListener('pagehide', () => {
          pipWinRef.current = null;
          setPipActive(false);
        });

        setPipActive(true);
        syncDocumentPip();
        return;
      } catch {
        // Fall through to Video PiP or show message
      }
    }

    // 2. Fallback: Canvas -> Video Picture-in-Picture (works on Android Chrome & iOS Safari)
    try {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      if (!canvas || !video || typeof canvas.captureStream !== 'function') {
        throw new Error('PiP tidak didukung pada browser ini.');
      }

      drawCanvasFrame();
      const stream = canvas.captureStream(1);
      streamRef.current = stream;
      video.srcObject = stream;
      await video.play();

      if (typeof video.requestPictureInPicture === 'function') {
        await video.requestPictureInPicture();
        video.onleavepictureinpicture = () => {
          stopPip();
        };
        setPipActive(true);
      } else {
        throw new Error('Picture-in-Picture tidak tersedia.');
      }
    } catch {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      setPipNotice(
        'Mode jendela OS (PiP) dibatasi di pratinjau ini. Gunakan Widget Mengambang di Layar atau buka langsung di browser smartphone.'
      );
    }
  };

  return (
    <section
      aria-label="Pengaturan floating widget"
      className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base sm:text-lg font-semibold tracking-tight text-slate-900">
            Floating Widget Smartphone
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-slate-500">
            Tempelkan pengingat hitung mundur yang bisa digeser di layar atau buka sebagai jendela mengambang.
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <button
          type="button"
          onClick={onToggleOverlay}
          aria-pressed={isOverlayVisible}
          className={`min-h-[48px] px-4 rounded-xl text-sm font-medium inline-flex items-center justify-center gap-2 border transition-all active:scale-[0.98] ${
            isOverlayVisible
              ? 'bg-[#0D6E52] border-[#0D6E52] text-white hover:bg-[#095540]'
              : 'bg-slate-50 border-slate-200 text-slate-800 hover:bg-slate-100'
          }`}
        >
          {isOverlayVisible ? (
            <>
              <EyeOff className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span className="whitespace-nowrap">Sembunyikan Widget</span>
            </>
          ) : (
            <>
              <Eye className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span className="whitespace-nowrap">Tampilkan Widget</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={handleLaunchPip}
          aria-pressed={pipActive}
          className={`min-h-[48px] px-4 rounded-xl text-sm font-medium inline-flex items-center justify-center gap-2 border transition-all active:scale-[0.98] ${
            pipActive
              ? 'bg-slate-900 border-slate-900 text-white'
              : 'bg-white border-slate-200 text-slate-800 hover:bg-slate-50'
          }`}
        >
          <ExternalLink className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span className="whitespace-nowrap">
            {pipActive ? 'Tutup Floating OS' : 'Floating Window (PiP)'}
          </span>
        </button>
      </div>

      {pipNotice && (
        <p className="mt-3 text-xs text-slate-600 leading-relaxed" role="status">
          {pipNotice}
        </p>
      )}

      {/* Hidden offscreen canvas & video used solely for mobile Canvas->Video Picture-in-Picture */}
      <canvas ref={canvasRef} width={640} height={340} className="hidden" aria-hidden="true" />
      <video ref={videoRef} muted playsInline className="hidden" aria-hidden="true" />
    </section>
  );
}

interface FloatingWidgetOverlayProps {
  visible: boolean;
  onClose: () => void;
  countdown: CountdownTime;
  habits: Habit[];
  onToggleHabit: (habitId: string) => void;
}

export function FloatingWidgetOverlay({
  visible,
  onClose,
  countdown,
  habits,
  onToggleHabit,
}: FloatingWidgetOverlayProps) {
  const [expanded, setExpanded] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number }>(() => {
    if (typeof window === 'undefined') return { x: 16, y: 80 };
    return {
      x: Math.max(12, window.innerWidth - 210),
      y: Math.max(72, window.innerHeight - 130),
    };
  });

  const dragRef = useRef<{
    active: boolean;
    moved: boolean;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  }>({
    active: false,
    moved: false,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
  });

  const widgetRef = useRef<HTMLDivElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const clampPosition = useCallback((x: number, y: number) => {
    const el = widgetRef.current;
    const width = el?.offsetWidth ?? (expanded ? 280 : 196);
    const height = el?.offsetHeight ?? (expanded ? 260 : 52);
    const margin = 12;
    const maxX = Math.max(margin, window.innerWidth - width - margin);
    const maxY = Math.max(margin, window.innerHeight - height - margin);
    return {
      x: Math.min(Math.max(margin, x), maxX),
      y: Math.min(Math.max(margin, y), maxY),
    };
  }, [expanded]);

  // Keep widget inside viewport when resizing or expanding
  useEffect(() => {
    if (!visible) return;
    const syncBounds = () => {
      setPos((prev) => clampPosition(prev.x, prev.y));
    };
    syncBounds();
    window.addEventListener('resize', syncBounds);
    return () => window.removeEventListener('resize', syncBounds);
  }, [visible, expanded, clampPosition]);

  if (!visible) return null;

  const todayKey = toLocalDateKey();
  const completedCount = habits.filter((h) => h.completedDates.includes(todayKey)).length;

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Ignore drags starting directly on action buttons
    if ((e.target as HTMLElement).closest('button[data-no-drag="true"]')) {
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      active: true,
      moved: false,
      startX: e.clientX,
      startY: e.clientY,
      originX: pos.x,
      originY: pos.y,
    };
    setIsDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.active) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
      dragRef.current.moved = true;
    }
    const next = clampPosition(dragRef.current.originX + dx, dragRef.current.originY + dy);
    setPos(next);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.active) return;
    const wasMoved = dragRef.current.moved;
    dragRef.current.active = false;
    setIsDragging(false);

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore if capture already lost
    }

    if (!wasMoved) {
      // Treat as tap when in compact mode
      if (!expanded) {
        setExpanded(true);
      }
      return;
    }

    // Snap smoothly to nearest horizontal screen edge like a smartphone floating widget
    const el = widgetRef.current;
    const width = el?.offsetWidth ?? (expanded ? 280 : 196);
    const margin = 12;
    const snapLeft = pos.x + width / 2 < window.innerWidth / 2;
    const targetX = snapLeft ? margin : Math.max(margin, window.innerWidth - width - margin);
    setPos((prev) => clampPosition(targetX, prev.y));
  };

  const compactLabel = countdown.isRamadan
    ? `Ramadan H-${countdown.ramadanDay}`
    : `${countdown.days}h ${String(countdown.hours).padStart(2, '0')}j ${String(
        countdown.minutes
      ).padStart(2, '0')}m`;

  return (
    <div
      ref={widgetRef}
      role="dialog"
      aria-label="Floating widget Ramadan"
      style={{
        transform: `translate3d(${pos.x}px, ${pos.y}px, 0)`,
      }}
      className={`fixed top-0 left-0 z-50 select-none will-change-transform ${
        isDragging ? '' : 'transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]'
      }`}
    >
      {!expanded ? (
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="touch-none cursor-grab active:cursor-grabbing bg-[#111815] text-white rounded-2xl shadow-lg shadow-slate-900/20 border border-white/10 pl-3 pr-1.5 h-12 flex items-center gap-2.5"
        >
          <Moon className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden="true" />
          <div className="leading-tight">
            <div className="font-mono text-xs font-semibold tabular-nums whitespace-nowrap">
              {compactLabel}
            </div>
            <div className="text-[11px] text-slate-300 tabular-nums whitespace-nowrap">
              {completedCount}/{habits.length} kebiasaan
            </div>
          </div>
          <button
            type="button"
            data-no-drag="true"
            onClick={onClose}
            aria-label="Tutup floating widget"
            className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <div className="w-[276px] bg-[#111815] text-white rounded-2xl shadow-xl shadow-slate-900/25 border border-white/10 overflow-hidden">
          {/* Drag header */}
          <div
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            className="touch-none cursor-grab active:cursor-grabbing pl-3.5 pr-1 py-1 bg-white/5 border-b border-white/10 flex items-center justify-between gap-2"
          >
            <div className="flex items-center gap-2 min-w-0">
              <GripVertical className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
              <span className="font-mono text-xs font-semibold text-emerald-300 tabular-nums truncate">
                {compactLabel}
              </span>
            </div>
            <div className="flex items-center shrink-0">
              <button
                type="button"
                data-no-drag="true"
                onClick={() => setExpanded(false)}
                aria-label="Perkecil widget"
                className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
              >
                <Minimize2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                data-no-drag="true"
                onClick={onClose}
                aria-label="Tutup widget"
                className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Quick habit check-off */}
          <div className="p-2.5 max-h-[220px] overflow-y-auto space-y-1">
            {habits.length === 0 ? (
              <p className="text-xs text-slate-400 py-3 text-center">
                Belum ada kebiasaan hari ini.
              </p>
            ) : (
              habits.map((habit) => {
                const done = habit.completedDates.includes(todayKey);
                return (
                  <button
                    key={habit.id}
                    type="button"
                    data-no-drag="true"
                    onClick={() => onToggleHabit(habit.id)}
                    className="w-full min-h-[44px] px-2.5 py-1.5 rounded-xl flex items-center gap-2.5 text-left hover:bg-white/10 active:scale-[0.98] transition-all"
                  >
                    <span
                      className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border ${
                        done
                          ? 'bg-emerald-500 border-emerald-500 text-slate-950'
                          : 'border-slate-500 text-transparent'
                      }`}
                      aria-hidden="true"
                    >
                      <Check className="w-3 h-3 stroke-[3]" />
                    </span>
                    <span
                      className={`text-xs truncate ${
                        done ? 'text-slate-400 line-through' : 'text-slate-100'
                      }`}
                    >
                      {habit.title}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
