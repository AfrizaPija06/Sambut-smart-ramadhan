import { Download, X } from 'lucide-react';
import { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export function PWAInstallButton() {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className="min-h-[44px] px-3.5 rounded-xl bg-[#0D6E52] text-white text-xs sm:text-sm font-medium inline-flex items-center gap-1.5 hover:bg-[#095540] active:scale-[0.98] transition-all whitespace-nowrap shrink-0"
      >
        <Download className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span>Instal di HP</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="min-h-[44px] px-3.5 rounded-xl border border-slate-200 bg-white text-slate-800 text-xs sm:text-sm font-medium inline-flex items-center gap-1.5 hover:bg-slate-50 active:scale-[0.98] transition-all whitespace-nowrap shrink-0"
        >
          <Download className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>Instal di iPhone</span>
        </button>

        {showIOSGuide && (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/45 backdrop-blur-xs p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ios-install-title"
          >
            <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl border border-slate-200">
              <div className="flex items-center justify-between gap-2">
                <h3 id="ios-install-title" className="text-base font-semibold text-slate-900">
                  Instal di iPhone / iPad
                </h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  aria-label="Tutup panduan"
                  className="min-h-[44px] min-w-[44px] -mr-2 inline-flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-800 hover:bg-slate-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <ol className="mt-3 space-y-2 text-sm text-slate-600 list-decimal list-inside">
                <li>
                  Buka aplikasi ini di browser <strong>Safari</strong>.
                </li>
                <li>
                  Ketuk tombol <strong>Bagikan (Share)</strong> di bilah bawah Safari.
                </li>
                <li>
                  Pilih <strong>Tambahkan ke Layar Utama (Add to Home Screen)</strong>.
                </li>
              </ol>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full min-h-[48px] rounded-xl bg-[#0D6E52] text-white text-sm font-medium hover:bg-[#095540] transition-colors"
              >
                Mengerti
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
}
