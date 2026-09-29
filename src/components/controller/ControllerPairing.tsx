import React, { useState, useEffect, useRef } from 'react';
import { Camera, KeyRound, Sparkles, AlertCircle, ArrowRight, RefreshCw, QrCode } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { DeviceInfo } from '../../types';
import { Language, translations } from '../../lib/i18n';

interface ControllerPairingProps {
  controllerDevice: DeviceInfo;
  isPairing: boolean;
  pairingError: string | null;
  onJoinByCode: (code: string) => void;
  onJoinById: (sessionId: string) => void;
  lang?: Language;
}

export const ControllerPairing: React.FC<ControllerPairingProps> = ({
  controllerDevice,
  isPairing,
  pairingError,
  onJoinByCode,
  onJoinById,
  lang = 'en',
}) => {
  const t = translations[lang] || translations.en;
  const [activeTab, setActiveTab] = useState<'code' | 'scanner'>('code');
  const [codeDigits, setCodeDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [scannerActive, setScannerActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  // Handle digit inputs
  const handleDigitChange = (index: number, val: string) => {
    const clean = val.replace(/\D/g, '');
    const newDigits = [...codeDigits];

    if (clean.length > 1) {
      // Pasted string
      const pasted = clean.slice(0, 6).split('');
      for (let i = 0; i < 6; i++) {
        newDigits[i] = pasted[i] || '';
      }
      setCodeDigits(newDigits);
      if (pasted.length === 6) {
        onJoinByCode(pasted.join(''));
      } else {
        const nextIdx = Math.min(5, pasted.length);
        inputRefs.current[nextIdx]?.focus();
      }
      return;
    }

    newDigits[index] = clean;
    setCodeDigits(newDigits);

    if (clean && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    const fullCode = newDigits.join('');
    if (fullCode.length === 6) {
      onJoinByCode(fullCode);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !codeDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const fullCode = codeDigits.join('');
    if (fullCode.length === 6) {
      onJoinByCode(fullCode);
    }
  };

  // QR Camera Scanner logic
  useEffect(() => {
    if (activeTab === 'scanner') {
      startScanner();
    } else {
      stopScanner();
    }

    return () => {
      stopScanner();
    };
  }, [activeTab]);

  const startScanner = async () => {
    setCameraError(null);
    setScannerActive(true);

    try {
      const html5QrCode = new Html5Qrcode('qr-reader');
      scannerRef.current = html5QrCode;

      // Detect available cameras to prevent OverconstrainedError on laptop / desktop webcams
      let cameraConfig: any = { facingMode: 'environment' };
      try {
        const devices = await Html5Qrcode.getCameras();
        if (devices && devices.length > 0) {
          const rear = devices.find((d) => /back|rear|environment/i.test(d.label));
          cameraConfig = rear ? rear.id : devices[0].id;
        }
      } catch (camErr) {
        console.warn('Could not enumerate cameras, falling back to facingMode:', camErr);
      }

      await html5QrCode.start(
        cameraConfig,
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        },
        (decodedText) => {
          try {
            const url = new URL(decodedText);
            const sessionParam = url.searchParams.get('session');
            if (sessionParam) {
              stopScanner();
              onJoinById(sessionParam);
              return;
            }
          } catch {
            if (decodedText.startsWith('room_')) {
              stopScanner();
              onJoinById(decodedText);
              return;
            }
            if (/^\d{6}$/.test(decodedText.trim())) {
              stopScanner();
              onJoinByCode(decodedText.trim());
              return;
            }
          }
        },
        () => {}
      );
    } catch (err: any) {
      console.warn('QR Scanner Camera Error:', err);
      // Try fallback to front camera if environment failed
      try {
        if (scannerRef.current) {
          await scannerRef.current.start(
            { facingMode: 'user' },
            {
              fps: 10,
              qrbox: { width: 250, height: 250 },
              aspectRatio: 1.0,
            },
            (decodedText) => {
              stopScanner();
              try {
                const url = new URL(decodedText);
                const s = url.searchParams.get('session');
                if (s) return onJoinById(s);
              } catch {}
              if (decodedText.startsWith('room_')) return onJoinById(decodedText);
              if (/^\d{6}$/.test(decodedText.trim())) return onJoinByCode(decodedText.trim());
            },
            () => {}
          );
          return;
        }
      } catch {}

      setCameraError(
        lang === 'ku'
          ? 'نەتوانرا دەست بە کامێرا بگات. تکایە مۆڵەت بدە یان کۆدی ٦ ژمارەیی بنووسە.'
          : 'Could not access camera. Please allow camera permissions or enter the 6-digit pairing code manually.'
      );
      setScannerActive(false);
    }
  };

  const stopScanner = () => {
    if (scannerRef.current) {
      try {
        scannerRef.current
          .stop()
          .then(() => {
            scannerRef.current?.clear();
            scannerRef.current = null;
          })
          .catch(() => {});
      } catch {}
    }
    setScannerActive(false);
  };

  return (
    <div className="min-h-[calc(100vh-65px)] flex flex-col justify-center items-center p-4 sm:p-6 lg:p-12 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#6D5DFB]/10 rounded-full blur-[140px] pointer-events-none" />

      <div className="w-full max-w-md mx-auto space-y-6 relative z-10">
        {/* Title */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.04] border border-white/10 text-xs text-zinc-400">
            <span>{t.thisDevice}</span>
            <strong className="text-white">{controllerDevice.name}</strong>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">
            {t.connectToScreen}
          </h1>
          <p className="text-sm text-zinc-400">
            {t.choosePairing}
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-2 p-1 rounded-2xl bg-[#141418] border border-white/10">
          <button
            onClick={() => setActiveTab('code')}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer ${
              activeTab === 'code'
                ? 'bg-[#6D5DFB] text-white shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <KeyRound className="w-4 h-4" />
            <span>{t.pairingCodeTab}</span>
          </button>
          <button
            onClick={() => setActiveTab('scanner')}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer ${
              activeTab === 'scanner'
                ? 'bg-[#6D5DFB] text-white shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Camera className="w-4 h-4" />
            <span>{t.scanQrTab}</span>
          </button>
        </div>

        {/* Error notification */}
        {pairingError && (
          <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs animate-shake">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-400" />
            <span>{pairingError}</span>
          </div>
        )}

        {/* Card Content */}
        <div className="bg-[#111114]/90 border border-white/10 backdrop-blur-xl rounded-3xl p-6 sm:p-8 shadow-2xl">
          {activeTab === 'code' ? (
            /* Option B: Enter 6-digit Code */
            <form onSubmit={handleManualSubmit} className="space-y-6">
              <div className="text-center">
                <label className="block text-xs uppercase tracking-wider text-zinc-400 font-bold mb-3">
                  {t.enter6Digits}
                </label>
                {/* 6 Digit Input Boxes */}
                <div className="flex justify-center gap-2 sm:gap-3" dir="ltr">
                  {codeDigits.map((digit, index) => (
                    <input
                      key={index}
                      ref={(el) => {
                        inputRefs.current[index] = el;
                      }}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleDigitChange(index, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(index, e)}
                      disabled={isPairing}
                      className="w-11 h-14 sm:w-12 sm:h-16 text-center text-2xl font-mono font-bold bg-[#18181D] border border-white/15 focus:border-[#6D5DFB] focus:ring-2 focus:ring-[#6D5DFB]/40 rounded-xl text-white outline-none transition disabled:opacity-50"
                      autoFocus={index === 0}
                    />
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={codeDigits.join('').length !== 6 || isPairing}
                className="w-full py-3.5 rounded-xl bg-[#6D5DFB] hover:bg-[#5B4BE3] disabled:bg-zinc-800 disabled:text-zinc-500 disabled:cursor-not-allowed text-white font-semibold text-sm transition flex items-center justify-center gap-2 active:scale-95 shadow-lg cursor-pointer"
              >
                {isPairing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>{t.connecting}</span>
                  </>
                ) : (
                  <>
                    <span>{t.connectRemote}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const text = await navigator.clipboard.readText();
                      const clean = text.replace(/\D/g, '').slice(0, 6);
                      if (clean.length === 6) {
                        setCodeDigits(clean.split(''));
                        onJoinByCode(clean);
                      }
                    } catch {}
                  }}
                  className="text-xs text-zinc-400 hover:text-white transition underline cursor-pointer"
                >
                  {t.pasteClipboard}
                </button>
              </div>
            </form>
          ) : (
            /* Option A: Scan QR Code with Camera */
            <div className="space-y-4">
              <div className="relative rounded-2xl overflow-hidden bg-black aspect-square flex items-center justify-center border border-white/10">
                <div id="qr-reader" className="w-full h-full" />
                {cameraError && (
                  <div className="absolute inset-0 p-6 flex flex-col items-center justify-center text-center bg-black/90 text-zinc-300">
                    <AlertCircle className="w-10 h-10 text-amber-400 mb-2" />
                    <p className="text-xs text-zinc-400 mb-4">{cameraError}</p>
                    <button
                      onClick={() => setActiveTab('code')}
                      className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-medium cursor-pointer"
                    >
                      {t.use6DigitInstead}
                    </button>
                  </div>
                )}
              </div>

              <p className="text-xs text-center text-zinc-400">
                {t.pointCamera}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
