import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Copy, Check, RefreshCw, QrCode as QrIcon, Tv, Shield, Clock } from 'lucide-react';
import { DeviceInfo, PairingSession } from '../../types';
import { DeviceBadge } from '../common/DeviceBadge';
import { Language, translations } from '../../lib/i18n';

interface ReceiverPairingProps {
  session: PairingSession | null;
  receiverDevice: DeviceInfo;
  isGenerating: boolean;
  onRefreshSession: () => void;
  lang?: Language;
}

export const ReceiverPairing: React.FC<ReceiverPairingProps> = ({
  session,
  receiverDevice,
  isGenerating,
  onRefreshSession,
  lang = 'en',
}) => {
  const t = translations[lang] || translations.en;
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [timeLeft, setTimeLeft] = useState<number>(300);
  const [isCopied, setIsCopied] = useState(false);

  // Generate pairing URL
  const pairingUrl = session
    ? `${window.location.origin}/?session=${session.sessionId}&role=controller`
    : '';

  // Generate QR Code image
  useEffect(() => {
    if (!pairingUrl) return;

    QRCode.toDataURL(pairingUrl, {
      width: 400,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
      errorCorrectionLevel: 'M',
    })
      .then((url) => {
        setQrDataUrl(url);
      })
      .catch((err) => {
        console.error('Failed to generate QR code', err);
      });
  }, [pairingUrl]);

  // Expiration countdown
  useEffect(() => {
    if (!session) return;

    const interval = setInterval(() => {
      const remainingSeconds = Math.max(0, Math.floor((session.expiresAt - Date.now()) / 1000));
      setTimeLeft(remainingSeconds);

      if (remainingSeconds <= 0) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [session]);

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleCopyLink = () => {
    if (!pairingUrl) return;
    navigator.clipboard.writeText(pairingUrl);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  // Format 6-digit code with spacing: "483 921"
  const formattedCode = session?.pairingCode
    ? `${session.pairingCode.slice(0, 3)} ${session.pairingCode.slice(3, 6)}`
    : '--- ---';

  const isExpired = timeLeft <= 0;

  return (
    <div className="min-h-[calc(100vh-65px)] flex flex-col justify-center items-center p-4 sm:p-8 lg:p-12 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-[#6D5DFB]/10 rounded-full blur-[140px] pointer-events-none" />

      <div className="w-full max-w-4xl mx-auto flex flex-col items-center text-center space-y-8 relative z-10">
        {/* Device identity tag */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.04] border border-white/10 text-xs sm:text-sm text-zinc-300">
          <Tv className="w-4 h-4 text-emerald-400" />
          <span>{lang === 'ku' ? 'ئامێری وەرگر:' : 'Receiver Device:'}</span>
          <strong className="text-white">{receiverDevice.name}</strong>
        </div>

        {/* TV-Sized Main Headline */}
        <div>
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white mb-3">
            {t.readyToConnect}
          </h1>
          <p className="text-base sm:text-xl text-zinc-400 max-w-xl mx-auto">
            {t.scanQrOrCode}
          </p>
        </div>

        {/* Pairing Display Card */}
        <div className="w-full max-w-2xl bg-[#111114]/90 border border-white/10 backdrop-blur-2xl rounded-3xl p-6 sm:p-10 shadow-[0_20px_50px_rgba(0,0,0,0.6)]">
          {isGenerating ? (
            <div className="py-20 flex flex-col items-center justify-center space-y-4">
              <RefreshCw className="w-10 h-10 text-[#6D5DFB] animate-spin" />
              <p className="text-zinc-400 text-lg">Generating secure pairing room...</p>
            </div>
          ) : isExpired ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-4">
              <Clock className="w-12 h-12 text-amber-400" />
              <h3 className="text-2xl font-bold text-white">{t.sessionExpired}</h3>
              <p className="text-zinc-400 text-sm max-w-md">
                {t.sessionExpiredDesc}
              </p>
              <button
                onClick={onRefreshSession}
                className="mt-4 px-6 py-3 rounded-xl bg-[#6D5DFB] hover:bg-[#5B4BE3] text-white font-semibold transition flex items-center gap-2 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>{t.generateNewCode}</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              {/* QR Code Column */}
              <div className="flex flex-col items-center">
                <div className="relative p-3 bg-white rounded-2xl shadow-2xl transition hover:scale-[1.02] duration-300">
                  {qrDataUrl ? (
                    <img
                      src={qrDataUrl}
                      alt="Pairing QR Code"
                      className="w-48 h-48 sm:w-56 sm:h-56 object-contain rounded-lg"
                    />
                  ) : (
                    <div className="w-48 h-48 sm:w-56 sm:h-56 bg-zinc-200 flex items-center justify-center rounded-lg">
                      <QrIcon className="w-16 h-16 text-zinc-400 animate-pulse" />
                    </div>
                  )}
                </div>
                <span className="mt-3 text-xs sm:text-sm text-zinc-400 font-medium">
                  {t.scanCamera}
                </span>
              </div>

              {/* 6-digit Code Column */}
              <div className="flex flex-col items-center md:items-start text-center md:text-left space-y-4">
                <div>
                  <span className="text-xs uppercase tracking-widest text-zinc-400 font-bold block mb-1">
                    {t.orEnterCode}
                  </span>
                  <div className="text-4xl sm:text-5xl font-mono font-black text-white tracking-widest bg-white/[0.04] border border-white/10 px-5 py-3 rounded-2xl select-all shadow-inner" dir="ltr">
                    {formattedCode}
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs sm:text-sm text-zinc-400">
                  <Clock className="w-4 h-4 text-amber-400" />
                  <span>
                    {t.expiresIn} <strong className="text-white font-mono">{formatCountdown(timeLeft)}</strong>
                  </span>
                </div>

                {/* Direct Link Copy Button */}
                <div className="w-full pt-2 flex flex-col gap-2">
                  <button
                    onClick={handleCopyLink}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 active:scale-95 border border-white/10 text-xs sm:text-sm text-zinc-200 font-medium transition cursor-pointer"
                  >
                    {isCopied ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-400" />
                        <span className="text-emerald-400">{t.copied}</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 text-zinc-400" />
                        <span>{t.copyLink}</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={onRefreshSession}
                    className="flex items-center justify-center gap-1.5 text-xs text-zinc-400 hover:text-white transition py-1 cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>{t.generateNew}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Animated Waiting Status */}
        {!isExpired && (
          <div className="flex items-center gap-3 px-5 py-2.5 rounded-full bg-white/[0.03] border border-white/10 text-sm text-zinc-300">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#6D5DFB] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-[#6D5DFB]"></span>
            </span>
            <span className="font-medium">{t.waitingForController}</span>
          </div>
        )}
      </div>
    </div>
  );
};
