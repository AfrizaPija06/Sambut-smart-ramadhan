import { ExternalLink, SlidersHorizontal } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BubbleColorId, BubbleConfig, BubbleContentMode, CountdownTime, Habit } from '../types';
import { toLocalDateKey } from '../utils/ramadan';

interface DocumentPictureInPicture {
  requestWindow(options?: { width?: number; height?: number }): Promise<Window>;
  window: Window | null;
}

interface WebKitHTMLVideoElement extends HTMLVideoElement {
  webkitSupportsPresentationMode?: (mode: 'inline' | 'fullscreen' | 'picture-in-picture') => boolean;
  webkitSetPresentationMode?: (mode: 'inline' | 'fullscreen' | 'picture-in-picture') => void;
  webkitPresentationMode?: 'inline' | 'fullscreen' | 'picture-in-picture';
}

declare global {
  interface Window {
    documentPictureInPicture?: DocumentPictureInPicture;
  }
}

const BUBBLE_STORAGE_KEY = 'sambut_ramadan_bubble_config_v1';

const COLOR_THEMES: Record<
  BubbleColorId,
  { label: string; bg: string; subtext: string; ringTrack: string }
> = {
  emerald: {
    label: 'Hijau',
    bg: '#0D6E52',
    subtext: '#D1FAE5',
    ringTrack: 'rgba(255, 255, 255, 0.2)',
  },
  dark: {
    label: 'Gelap',
    bg: '#131917',
    subtext: '#CBD5D1',
    ringTrack: 'rgba(255, 255, 255, 0.16)',
  },
  navy: {
    label: 'Biru',
    bg: '#1B3B5F',
    subtext: '#DBEAFE',
    ringTrack: 'rgba(255, 255, 255, 0.2)',
  },
  earth: {
    label: 'Cokelat',
    bg: '#6B4226',
    subtext: '#FDE68A',
    ringTrack: 'rgba(255, 255, 255, 0.2)',
  },
};

const CONTENT_MODES: { id: BubbleContentMode; label: string }[] = [
  { id: 'countdown-habit', label: 'H- & Habit' },
  { id: 'countdown-clock', label: 'H- & Jam' },
  { id: 'countdown-only', label: 'H- Saja' },
];

const DEFAULT_CONFIG: BubbleConfig = {
  color: 'emerald',
  contentMode: 'countdown-habit',
  showRing: true,
};

function loadBubbleConfig(): BubbleConfig {
  try {
    const raw = localStorage.getItem(BUBBLE_STORAGE_KEY);
    if (!raw) return DEFAULT_CONFIG;
    const parsed = JSON.parse(raw);
    return {
      color: parsed?.color && parsed.color in COLOR_THEMES ? parsed.color : DEFAULT_CONFIG.color,
      contentMode:
        parsed?.contentMode && CONTENT_MODES.some((m) => m.id === parsed.contentMode)
          ? parsed.contentMode
          : DEFAULT_CONFIG.contentMode,
      showRing: typeof parsed?.showRing === 'boolean' ? parsed.showRing : DEFAULT_CONFIG.showRing,
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

interface FloatingWidgetControlProps {
  countdown: CountdownTime;
  habits: Habit[];
}

export function FloatingWidgetControl({ countdown, habits }: FloatingWidgetControlProps) {
  const [pipActive, setPipActive] = useState(false);
  const [pipNotice, setPipNotice] = useState<string | null>(null);
  const [showCustomize, setShowCustomize] = useState(false);
  const [config, setConfig] = useState<BubbleConfig>(loadBubbleConfig);

  const pipWinRef = useRef<Window | null>(null);
  const videoRef = useRef<WebKitHTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(BUBBLE_STORAGE_KEY, JSON.stringify(config));
    } catch {
      // Ignore storage errors
    }
  }, [config]);

  const todayKey = toLocalDateKey();
  const completedCount = habits.filter((h) => h.completedDates.includes(todayKey)).length;
  const totalCount = habits.length;
  const theme = COLOR_THEMES[config.color];

  const mainText = countdown.isRamadan ? `H-${countdown.ramadanDay}` : `H-${countdown.days}`;
  const subText =
    config.contentMode === 'countdown-only'
      ? ''
      : config.contentMode === 'countdown-clock'
      ? `${String(countdown.hours).padStart(2, '0')}:${String(countdown.minutes).padStart(2, '0')}`
      : `${completedCount}/${totalCount}`;

  // Draw customizable 1:1 bubble for mobile PiP
  const drawCanvasFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2 + 12;

    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, w, h);

    if (config.showRing) {
      ctx.beginPath();
      ctx.arc(cx, cy, 118, 0, Math.PI * 2);
      ctx.lineWidth = 4;
      ctx.strokeStyle = theme.ringTrack;
      ctx.stroke();

      const pct = totalCount > 0 ? completedCount / totalCount : 0;
      if (pct > 0) {
        ctx.beginPath();
        ctx.arc(cx, cy, 118, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct);
        ctx.lineWidth = 5;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#FFFFFF';
        ctx.stroke();
      }
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const hasSub = subText.length > 0;
    const fontSize =
      config.contentMode === 'countdown-only'
        ? mainText.length >= 5
          ? 74
          : 92
        : mainText.length >= 5
        ? 64
        : 80;

    ctx.fillStyle = '#FFFFFF';
    ctx.font = `700 ${fontSize}px "JetBrains Mono", ui-monospace, monospace`;
    ctx.fillText(mainText, cx, hasSub ? cy - 14 : cy + 2);

    if (hasSub) {
      ctx.fillStyle = theme.subtext;
      ctx.font = '600 28px "Plus Jakarta Sans", system-ui, sans-serif';
      ctx.fillText(subText, cx, cy + 48);
    }
  }, [completedCount, config.contentMode, config.showRing, mainText, subText, theme, totalCount]);

  const syncDocumentPip = useCallback(() => {
    const win = pipWinRef.current;
    if (!win || win.closed) return;
    const doc = win.document;

    doc.body.style.background = theme.bg;

    const timerEl = doc.getElementById('pip-timer');
    if (timerEl) {
      timerEl.textContent = mainText;
    }

    const summaryEl = doc.getElementById('pip-habit-summary');
    if (summaryEl) {
      summaryEl.textContent = subText;
      summaryEl.style.color = theme.subtext;
      summaryEl.style.display = subText ? 'block' : 'none';
    }
  }, [mainText, subText, theme]);

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

    const video = videoRef.current;
    if (video?.webkitPresentationMode === 'picture-in-picture' && video.webkitSetPresentationMode) {
      try {
        video.webkitSetPresentationMode('inline');
      } catch {
        // Ignore
      }
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    if (video) {
      video.srcObject = null;
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

    if (window.documentPictureInPicture?.requestWindow) {
      try {
        const pipWin = await window.documentPictureInPicture.requestWindow({
          width: 170,
          height: 170,
        });
        pipWinRef.current = pipWin;

        const style = pipWin.document.createElement('style');
        style.textContent = `
          * { box-sizing: border-box; margin: 0; padding: 0; }
          html, body {
            width: 100%;
            height: 100%;
            color: #FFFFFF;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            user-select: none;
          }
          .timer {
            font-family: ui-monospace, SFMono-Regular, monospace;
            font-size: 38px;
            font-weight: 700;
            line-height: 1;
            font-variant-numeric: tabular-nums;
          }
          .summary {
            font-size: 16px;
            font-weight: 600;
            margin-top: 8px;
            font-variant-numeric: tabular-nums;
          }
        `;
        pipWin.document.head.appendChild(style);

        pipWin.document.body.innerHTML = `
          <div id="pip-timer" class="timer"></div>
          <div id="pip-habit-summary" class="summary"></div>
        `;

        pipWin.addEventListener('pagehide', () => {
          pipWinRef.current = null;
          setPipActive(false);
        });

        setPipActive(true);
        syncDocumentPip();
        return;
      } catch {
        // Fall through to Video PiP
      }
    }

    try {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      if (!canvas || !video || typeof canvas.captureStream !== 'function') {
        throw new Error('PiP tidak didukung pada browser ini.');
      }

      drawCanvasFrame();
      const stream = canvas.captureStream(2);
      streamRef.current = stream;
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;

      await video.play();

      if (video.readyState < 1) {
        await new Promise<void>((resolve) => {
          const onReady = () => {
            video.removeEventListener('loadedmetadata', onReady);
            resolve();
          };
          video.addEventListener('loadedmetadata', onReady);
          window.setTimeout(resolve, 400);
        });
      }

      if (typeof video.requestPictureInPicture === 'function') {
        await video.requestPictureInPicture();
        video.onleavepictureinpicture = () => {
          stopPip();
        };
        setPipActive(true);
        setPipNotice(
          'Bubble aktif. Tekan tombol Home di HP agar bubble H-berapa tetap mengambang di layar.'
        );
      } else if (
        typeof video.webkitSupportsPresentationMode === 'function' &&
        video.webkitSupportsPresentationMode('picture-in-picture') &&
        typeof video.webkitSetPresentationMode === 'function'
      ) {
        video.webkitSetPresentationMode('picture-in-picture');
        setPipActive(true);
        setPipNotice('Bubble iOS aktif. Tekan Home untuk melihat bubble tetap mengambang.');
      } else {
        throw new Error('Picture-in-Picture tidak tersedia.');
      }
    } catch {
      await stopPip();
      setPipNotice(
        'Browser/pratinjau ini membatasi mode Picture-in-Picture. Buka link Vercel langsung lewat Chrome di HP.'
      );
    }
  };

  const progressPct = totalCount > 0 ? completedCount / totalCount : 0;
  const ringCircumference = 2 * Math.PI * 30;
  const ringOffset = ringCircumference * (1 - progressPct);

  return (
    <section
      aria-label="Floating bubble smartphone"
      className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-base sm:text-lg font-semibold tracking-tight text-slate-900">
            Floating Bubble Smartphone
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-slate-500">
            Bubble hitung mundur yang tetap mengambang saat kamu menekan tombol Home di HP.
          </p>
        </div>

        {/* Live miniature preview of the bubble */}
        <div
          aria-hidden="true"
          style={{ backgroundColor: theme.bg }}
          className="relative w-16 h-16 rounded-2xl shrink-0 flex flex-col items-center justify-center text-white shadow-sm overflow-hidden"
        >
          {config.showRing && (
            <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 72 72">
              <circle
                cx="36"
                cy="36"
                r="30"
                fill="none"
                stroke={theme.ringTrack}
                strokeWidth="2.5"
              />
              {progressPct > 0 && (
                <circle
                  cx="36"
                  cy="36"
                  r="30"
                  fill="none"
                  stroke="#FFFFFF"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeDasharray={ringCircumference}
                  strokeDashoffset={ringOffset}
                />
              )}
            </svg>
          )}
          <span className="font-mono text-sm font-bold leading-none tabular-nums">
            {mainText}
          </span>
          {subText && (
            <span
              style={{ color: theme.subtext }}
              className="mt-1 text-[10px] font-semibold leading-none tabular-nums"
            >
              {subText}
            </span>
          )}
        </div>
      </div>

      {/* Primary action + Customize toggle */}
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={handleLaunchPip}
          aria-pressed={pipActive}
          className={`flex-1 min-h-[48px] px-4 rounded-xl text-sm font-medium inline-flex items-center justify-center gap-2 border transition-all active:scale-[0.98] ${
            pipActive
              ? 'bg-slate-900 border-slate-900 text-white hover:bg-slate-800'
              : 'bg-[#0D6E52] border-[#0D6E52] text-white hover:bg-[#095540]'
          }`}
        >
          <ExternalLink className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span className="whitespace-nowrap">
            {pipActive ? 'Tutup Floating Bubble' : 'Aktifkan Floating Bubble'}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setShowCustomize((prev) => !prev)}
          aria-expanded={showCustomize}
          aria-label="Atur tampilan bubble"
          className={`min-h-[48px] px-3.5 rounded-xl border text-sm font-medium inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
            showCustomize
              ? 'bg-slate-100 border-slate-300 text-slate-900'
              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <SlidersHorizontal className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>Custom</span>
        </button>
      </div>

      {/* Custom Bubble Controls */}
      {showCustomize && (
        <div className="mt-4 pt-4 border-t border-slate-100 space-y-4">
          {/* Color selection */}
          <div>
            <div className="text-xs font-medium text-slate-600 mb-2">Warna bubble</div>
            <div className="grid grid-cols-4 gap-2">
              {(Object.keys(COLOR_THEMES) as BubbleColorId[]).map((colorId) => {
                const item = COLOR_THEMES[colorId];
                const selected = config.color === colorId;
                return (
                  <button
                    key={colorId}
                    type="button"
                    onClick={() => setConfig((prev) => ({ ...prev, color: colorId }))}
                    aria-pressed={selected}
                    className={`min-h-[44px] px-2 rounded-xl border text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
                      selected
                        ? 'border-slate-900 bg-slate-50 text-slate-900'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span
                      className="w-3.5 h-3.5 rounded-full shrink-0 border border-black/10"
                      style={{ backgroundColor: item.bg }}
                      aria-hidden="true"
                    />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Content mode selection */}
          <div>
            <div className="text-xs font-medium text-slate-600 mb-2">Info yang tampil</div>
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-xl">
              {CONTENT_MODES.map((mode) => {
                const active = config.contentMode === mode.id;
                return (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => setConfig((prev) => ({ ...prev, contentMode: mode.id }))}
                    aria-pressed={active}
                    className={`min-h-[44px] px-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                      active
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {mode.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Progress ring toggle */}
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-medium text-slate-700">Cincin progres kebiasaan</span>
            <button
              type="button"
              role="switch"
              aria-checked={config.showRing}
              onClick={() => setConfig((prev) => ({ ...prev, showRing: !prev.showRing }))}
              className={`min-h-[44px] px-3.5 rounded-xl border text-xs font-medium transition-colors ${
                config.showRing
                  ? 'bg-[#0D6E52] border-[#0D6E52] text-white'
                  : 'bg-white border-slate-200 text-slate-600'
              }`}
            >
              {config.showRing ? 'Aktif' : 'Mati'}
            </button>
          </div>
        </div>
      )}

      <p className="mt-3 text-xs text-slate-500 leading-relaxed" role="status">
        {pipNotice ??
          'Buka lewat Chrome di HP, ketuk Aktifkan Floating Bubble, lalu tekan tombol Home.'}
      </p>

      {/* Square 1:1 off-screen canvas & video for mobile PiP bubble */}
      <canvas
        ref={canvasRef}
        width={320}
        height={320}
        aria-hidden="true"
        className="fixed -left-[9999px] top-0 w-16 h-16 opacity-0 pointer-events-none"
      />
      <video
        ref={videoRef}
        muted
        playsInline
        aria-hidden="true"
        className="fixed -left-[9999px] top-0 w-16 h-16 opacity-0 pointer-events-none"
      />
    </section>
  );
}
