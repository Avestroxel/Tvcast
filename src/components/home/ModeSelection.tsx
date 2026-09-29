import React from 'react';
import { Smartphone, Tv, Sparkles, ArrowRight, ShieldCheck, Zap, Radio, Laptop } from 'lucide-react';
import { DeviceInfo } from '../../types';
import { DeviceBadge } from '../common/DeviceBadge';
import { Language, translations } from '../../lib/i18n';

interface ModeSelectionProps {
  currentDevice: DeviceInfo;
  onSelectMode: (mode: 'controller' | 'receiver') => void;
  onOpenSplitDemo: () => void;
  lang?: Language;
}

export const ModeSelection: React.FC<ModeSelectionProps> = ({
  currentDevice,
  onSelectMode,
  onOpenSplitDemo,
  lang = 'en',
}) => {
  const t = translations[lang] || translations.en;

  return (
    <div className="min-h-[calc(100vh-65px)] flex flex-col justify-between p-4 sm:p-6 lg:p-12 max-w-6xl mx-auto">
      {/* Top Banner / Device Identification */}
      <div className="flex flex-col items-center text-center space-y-4 pt-4 sm:pt-8">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/10 text-xs text-zinc-300">
          <span className="text-zinc-500">{t.thisDevice}</span>
          <DeviceBadge name={currentDevice.name} type={currentDevice.type} size="sm" />
        </div>

        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white max-w-3xl leading-tight">
          {t.heroTitle}
        </h1>

        <p className="text-sm sm:text-lg text-zinc-400 max-w-xl">
          {t.heroDesc}
        </p>
      </div>

      {/* Two Large Touch-Friendly Mode Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-8 sm:my-12">
        {/* Card 1: Control Another Device */}
        <button
          onClick={() => onSelectMode('controller')}
          className="group relative flex flex-col justify-between text-left p-6 sm:p-8 rounded-3xl bg-[#111114] border border-white/10 hover:border-[#6D5DFB]/50 transition-all duration-300 hover:shadow-[0_0_35px_rgba(109,93,251,0.18)] active:scale-[0.99] cursor-pointer overflow-hidden focus:outline-none focus:ring-2 focus:ring-[#6D5DFB]"
        >
          {/* Subtle background glow */}
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-48 h-48 rounded-full bg-[#6D5DFB]/10 blur-3xl group-hover:bg-[#6D5DFB]/20 transition-all" />

          <div>
            <div className="flex items-center justify-between mb-6">
              <div className="w-16 h-16 rounded-2xl bg-[#6D5DFB]/15 border border-[#6D5DFB]/30 flex items-center justify-center text-[#6D5DFB] shadow-inner">
                <Smartphone className="w-8 h-8 group-hover:scale-110 transition-transform duration-200" />
              </div>
              <span className="text-xs font-semibold px-3 py-1 rounded-full bg-white/5 border border-white/10 text-zinc-400 group-hover:text-white group-hover:bg-[#6D5DFB]/20 transition">
                {lang === 'ku' ? 'شێوازی کۆنتڕۆڵ' : 'Remote Mode'}
              </span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2 tracking-tight group-hover:text-[#A594FD] transition-colors">
              {t.controlAnother}
            </h2>
            <p className="text-sm sm:text-base text-zinc-400 leading-relaxed">
              {t.controlAnotherDesc}
            </p>
          </div>

          <div className="mt-8 pt-6 border-t border-white/[0.08] flex items-center justify-between">
            <span className="text-xs text-zinc-400 font-medium">
              {lang === 'ku' ? 'سکانی QR یان کۆدی ٦ ژمارەیی' : 'Scan QR or enter 6-digit code'}
            </span>
            <div className="flex items-center gap-1 text-sm font-semibold text-white group-hover:translate-x-1 transition-transform">
              <span>{t.startController}</span>
              <ArrowRight className="w-4 h-4 text-[#6D5DFB]" />
            </div>
          </div>
        </button>

        {/* Card 2: Let This Device Be Controlled */}
        <button
          onClick={() => onSelectMode('receiver')}
          className="group relative flex flex-col justify-between text-left p-6 sm:p-8 rounded-3xl bg-[#111114] border border-white/10 hover:border-emerald-500/50 transition-all duration-300 hover:shadow-[0_0_35px_rgba(53,208,127,0.18)] active:scale-[0.99] cursor-pointer overflow-hidden focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          {/* Subtle background glow */}
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-48 h-48 rounded-full bg-emerald-500/10 blur-3xl group-hover:bg-emerald-500/20 transition-all" />

          <div>
            <div className="flex items-center justify-between mb-6">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-inner">
                <Tv className="w-8 h-8 group-hover:scale-110 transition-transform duration-200" />
              </div>
              <span className="text-xs font-semibold px-3 py-1 rounded-full bg-white/5 border border-white/10 text-zinc-400 group-hover:text-white group-hover:bg-emerald-500/20 transition">
                {lang === 'ku' ? 'شێوازی پیشاندان' : 'Display Mode'}
              </span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2 tracking-tight group-hover:text-emerald-300 transition-colors">
              {t.beControlled}
            </h2>
            <p className="text-sm sm:text-base text-zinc-400 leading-relaxed">
              {t.beControlledDesc}
            </p>
          </div>

          <div className="mt-8 pt-6 border-t border-white/[0.08] flex items-center justify-between">
            <span className="text-xs text-zinc-400 font-medium">
              {lang === 'ku' ? 'گونجاو بۆ TV و شاشەی گەورە' : 'TV & Big Screen Optimized'}
            </span>
            <div className="flex items-center gap-1 text-sm font-semibold text-white group-hover:translate-x-1 transition-transform">
              <span>{t.readyToReceive}</span>
              <ArrowRight className="w-4 h-4 text-emerald-400" />
            </div>
          </div>
        </button>
      </div>

      {/* Simulator Shortcut & Feature Highlights */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4 border-t border-white/[0.06] text-xs text-zinc-400">
        <div className="flex flex-wrap items-center gap-4 sm:gap-6 justify-center sm:justify-start">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>{t.encrypted}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Zap className="w-4 h-4 text-amber-400" />
            <span>{t.realtimeSync}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Radio className="w-4 h-4 text-[#A594FD]" />
            <span>{t.localPlayback}</span>
          </div>
        </div>

        {/* Quick single-screen test */}
        <button
          onClick={onOpenSplitDemo}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 border border-white/10 transition cursor-pointer"
          title="Open split-screen simulator"
        >
          <Laptop className="w-3.5 h-3.5 text-[#6D5DFB]" />
          <span>{t.splitDemo}</span>
        </button>
      </div>
    </div>
  );
};
