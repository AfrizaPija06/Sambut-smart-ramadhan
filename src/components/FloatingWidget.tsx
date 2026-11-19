import { ExternalLink } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { CountdownTime, Habit } from '../types';
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

interface FloatingWidgetControlProps {
  countdown: CountdownTime;
  habits: Habit[];
}

export function FloatingWidgetControl({ countdown, habits }: FloatingWidgetControlProps) {
  const [pipActive, setPipActive] = useState(false);
  const [pipNotice, setPipNotice] = useState<string | null>(null);

  const pipWinRef = useRef<Window | null>(null);
  const videoRef = useRef<WebKitHTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const todayKey = toLocalDateKey();
  const completedCount = habits.filter((h) => h.completedDates.includes(todayKey)).length;

  // Draw clean emerald green bubble (matching the compact H-XX + 0/4 style) for mobile PiP
  const drawCanvasFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2 + 12; // Offset slightly down so Android's top domain strip never overlaps

    // Full-bleed emerald bubble surface (Android rounds PiP corners automatically)
    ctx.fillStyle = '#0D6E52';
    ctx.fillRect(0, 0, w, h);

    // Subtle inner ring accent
    ctx.beginPath();
    ctx.arc(cx, cy, 118, 0, Math.PI * 2);
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.stroke();

    // Habit progress arc along the subtle ring
    const total = habits.length;
    const pct = total > 0 ? completedCount / total : 0;
    if (pct > 0) {
      ctx.beginPath();
      ctx.arc(cx, cy, 118, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct);
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#FFFFFF';
      ctx.stroke();
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Primary H-XX text
    const mainText = countdown.isRamadan ? `H-${countdown.ramadanDay}` : `H-${countdown.days}`;
    const fontSize = mainText.length >= 5 ? 64 : 80;
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `700 ${fontSize}px "JetBrains Mono", ui-monospace, monospace`;
    ctx.fillText(mainText, cx, cy - 12);

    // Habit counter directly below H-XX
    ctx.fillStyle = '#D1FAE5';
    ctx.font = '600 28px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText(`${completedCount}/${total}`, cx, cy + 48);
  }, [completedCount, countdown.days, countdown.isRamadan, countdown.ramadanDay, habits.length]);

  const syncDocumentPip = useCallback(() => {
    const win = pipWinRef.current;
    if (!win || win.closed) return;
    const doc = win.document;

    const timerEl = doc.getElementById('pip-timer');
    if (timerEl) {
      timerEl.textContent = countdown.isRamadan
        ? `H-${countdown.ramadanDay}`
        : `H-${countdown.days}`;
    }

    const summaryEl = doc.getElementById('pip-habit-summary');
    if (summaryEl) {
      summaryEl.textContent = `${completedCount}/${habits.length}`;
    }
  }, [completedCount, countdown.days, countdown.isRamadan, countdown.ramadanDay, habits.length]);

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
            background: #0D6E52;
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
            color: #D1FAE5;
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

  return (
    <section
      aria-label="Floating bubble smartphone"
      className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6"
    >
      <div>
        <h2 className="text-base sm:text-lg font-semibold tracking-tight text-slate-900">
          Floating Bubble Smartphone
        </h2>
        <p className="mt-1 text-xs sm:text-sm text-slate-500">
          Munculkan bubble hitung mundur ringkas yang tetap mengambang saat kamu menekan tombol Home di HP.
        </p>
      </div>

      <button
        type="button"
        onClick={handleLaunchPip}
        aria-pressed={pipActive}
        className={`mt-4 w-full min-h-[48px] px-4 rounded-xl text-sm font-medium inline-flex items-center justify-center gap-2 border transition-all active:scale-[0.98] ${
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
