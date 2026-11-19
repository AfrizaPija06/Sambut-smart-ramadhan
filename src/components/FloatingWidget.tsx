import { SlidersHorizontal } from 'lucide-react';
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
    ringTrack: 'rgba(255, 255, 255, 0.22)',
  },
  dark: {
    label: 'Gelap',
    bg: '#131917',
    subtext: '#CBD5D1',
    ringTrack: 'rgba(255, 255, 255, 0.18)',
  },
  navy: {
    label: 'Biru',
    bg: '#1B3B5F',
    subtext: '#DBEAFE',
    ringTrack: 'rgba(255, 255, 255, 0.22)',
  },
  earth: {
    label: 'Cokelat',
    bg: '#6B4226',
    subtext: '#FDE68A',
    ringTrack: 'rgba(255, 255, 255, 0.22)',
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

  // Draw slim 2.3:1 pill frame (368x160) — minimum height Android OS allows for Web PiP
  const drawCanvasFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, w, h);

    // Subtle bottom habit progress bar when ring/progress is enabled
    if (config.showRing) {
      ctx.fillStyle = theme.ringTrack;
      ctx.fillRect(0, h - 8, w, 8);
      const pct = totalCount > 0 ? completedCount / totalCount : 0;
      if (pct > 0) {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, h - 8, Math.round(w * pct), 8);
      }
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const cy = h / 2 + 2;
    const label = subText ? `${mainText}  ·  ${subText}` : mainText;
    const fontSize = subText ? (label.length > 11 ? 46 : 54) : 66;

    ctx.fillStyle = '#FFFFFF';
    ctx.font = `700 ${fontSize}px "JetBrains Mono", ui-monospace, monospace`;
    ctx.fillText(label, w / 2, cy);
  }, [completedCount, config.showRing, mainText, subText, theme.bg, theme.ringTrack, totalCount]);

  const syncDocumentPip = useCallback(() => {
    const win = pipWinRef.current;
    if (!win || win.closed) return;
    const doc = win.document;

    doc.body.style.background = theme.bg;

    const timerEl = doc.getElementById('pip-timer');
    if (timerEl) {
      timerEl.textContent = subText ? `${mainText} · ${subText}` : mainText;
    }
  }, [mainText, subText, theme.bg]);

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

  const handleTogglePip = async () => {
    setPipNotice(null);

    if (pipActive) {
      await stopPip();
      return;
    }

    if (window.documentPictureInPicture?.requestWindow) {
      try {
        const pipWin = await window.documentPictureInPicture.requestWindow({
          width: 190,
          height: 80,
        });
        pipWinRef.current = pipWin;

        const style = pipWin.document.createElement('style');
        style.textContent = `
          * { box-sizing: border-box; margin: 0; padding: 0; }
          html, body {
            width: 100%;
            height: 100%;
            color: #FFFFFF;
            font-family: ui-monospace, SFMono-Regular, monospace;
            display: flex;
            align-items: center;
            justify-content: center;
            user-select: none;
          }
          .timer {
            font-size: 24px;
            font-weight: 700;
            line-height: 1;
            font-variant-numeric: tabular-nums;
          }
        `;
        pipWin.document.head.appendChild(style);
        pipWin.document.body.innerHTML = `<div id="pip-timer" class="timer"></div>`;

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
      } else if (
        typeof video.webkitSupportsPresentationMode === 'function' &&
        video.webkitSupportsPresentationMode('picture-in-picture') &&
        typeof video.webkitSetPresentationMode === 'function'
      ) {
        video.webkitSetPresentationMode('picture-in-picture');
        setPipActive(true);
      } else {
        throw new Error('Picture-in-Picture tidak tersedia.');
      }
    } catch {
      await stopPip();
      setPipNotice('Mode mengambang tidak didukung oleh browser/pratinjau ini. Buka lewat Chrome di HP.');
    }
  };

  return (
    <section
      aria-label="Floating bubble smartphone"
      className="bg-white rounded-3xl border border-slate-200/80 px-5 py-4 sm:px-6 sm:py-5"
    >
      {/* Compact single-row control with On/Off switch */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {/* Tiny live preview chip */}
          <div
            aria-hidden="true"
            style={{ backgroundColor: theme.bg }}
            className="px-2.5 py-1.5 rounded-xl text-white font-mono text-xs font-bold leading-none tabular-nums shrink-0 whitespace-nowrap"
          >
            {subText ? `${mainText} · ${subText}` : mainText}
          </div>

          <div className="min-w-0">
            <h2 className="text-sm sm:text-base font-semibold tracking-tight text-slate-900 truncate">
              Floating Bubble
            </h2>
            <p className="text-xs text-slate-500 truncate">
              {pipActive ? 'Aktif · Tekan Home di HP' : 'Tampil mengambang di HP'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setShowCustomize((prev) => !prev)}
            aria-expanded={showCustomize}
            aria-label="Custom tampilan bubble"
            className={`min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl border transition-colors ${
              showCustomize
                ? 'bg-slate-100 border-slate-300 text-slate-900'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>

          {/* Compact On/Off Switch */}
          <button
            type="button"
            role="switch"
            aria-checked={pipActive}
            aria-label={pipActive ? 'Matikan floating bubble' : 'Aktifkan floating bubble'}
            onClick={handleTogglePip}
            className="min-h-[44px] pl-1 flex items-center gap-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 rounded-xl"
          >
            <span
              className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors duration-150 ${
                pipActive ? 'bg-[#0D6E52]' : 'bg-slate-300'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-xs transition-transform duration-150 ${
                  pipActive ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </span>
            <span className="text-xs font-semibold text-slate-700 w-6 text-left">
              {pipActive ? 'On' : 'Off'}
            </span>
          </button>
        </div>
      </div>

      {/* Custom Bubble Controls */}
      {showCustomize && (
        <div className="mt-4 pt-4 border-t border-slate-100 space-y-4">
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

          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-medium text-slate-700">Garis progres kebiasaan</span>
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

      {pipNotice && (
        <p className="mt-2.5 text-xs text-slate-500 leading-relaxed" role="status">
          {pipNotice}
        </p>
      )}

      {/* Slim 2.3:1 off-screen canvas & video so Android PiP renders as compact as possible */}
      <canvas
        ref={canvasRef}
        width={368}
        height={160}
        aria-hidden="true"
        className="fixed -left-[9999px] top-0 w-24 h-10 opacity-0 pointer-events-none"
      />
      <video
        ref={videoRef}
        muted
        playsInline
        aria-hidden="true"
        className="fixed -left-[9999px] top-0 w-24 h-10 opacity-0 pointer-events-none"
      />
    </section>
  );
}
