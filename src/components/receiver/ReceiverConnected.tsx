import React, { useEffect, useState } from 'react';
import { CheckCircle2, Tv, Smartphone, ArrowRight } from 'lucide-react';
import { DeviceInfo } from '../../types';
import { DeviceBadge } from '../common/DeviceBadge';

interface ReceiverConnectedProps {
  controllerDevice: DeviceInfo | null;
  onContinue: () => void;
}

export const ReceiverConnected: React.FC<ReceiverConnectedProps> = ({
  controllerDevice,
  onContinue,
}) => {
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onContinue();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [onContinue]);

  return (
    <div className="min-h-[calc(100vh-65px)] flex flex-col justify-center items-center p-6 text-center relative overflow-hidden select-none">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-[140px] pointer-events-none" />

      <div className="max-w-lg w-full bg-[#111114]/90 border border-white/10 backdrop-blur-2xl rounded-3xl p-8 sm:p-12 shadow-2xl space-y-6 relative z-10">
        <div className="w-20 h-20 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto shadow-[0_0_30px_rgba(52,211,153,0.3)] animate-bounce">
          <CheckCircle2 className="w-10 h-10" />
        </div>

        <div>
          <span className="text-xs uppercase tracking-widest text-emerald-400 font-bold">
            Device Paired
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white mt-1">
            Connected!
          </h2>
        </div>

        <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10 flex flex-col items-center space-y-2">
          <span className="text-xs text-zinc-400">Controlled by</span>
          <div className="text-lg font-bold text-white flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-[#6D5DFB]" />
            <span>{controllerDevice ? controllerDevice.name : 'Remote Controller'}</span>
          </div>
          <span className="text-xs text-emerald-400 font-medium">Session Ready</span>
        </div>

        <div className="pt-2">
          <button
            onClick={onContinue}
            className="w-full py-3.5 rounded-xl bg-white hover:bg-zinc-200 text-black font-semibold text-sm transition flex items-center justify-center gap-2 active:scale-95 cursor-pointer shadow-lg"
          >
            <span>Entering Media Screen ({countdown}s)</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
