import React from 'react';
import { Smartphone, Tv, ArrowUpRight, Chrome, Radio, Puzzle } from 'lucide-react';
import { DeviceInfo } from '../../types';
import { Language } from '../../lib/i18n';

interface ModeSelectionProps {
  currentDevice: DeviceInfo;
  onSelectMode: (mode: 'controller' | 'receiver') => void;
  lang?: Language;
}
export const ModeSelection: React.FC<ModeSelectionProps> = ({ currentDevice, onSelectMode, lang = 'en' }) => {
  const ku = lang === 'ku';
  return <div className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8 sm:py-16">
    <div className="mb-10 flex items-center gap-2 text-xs text-zinc-500"><span className="h-1.5 w-1.5 rounded-full bg-[#b1a7ff]" />{currentDevice.name}<span className="ms-auto">{ku ? 'گەڕان · هەڵبژاردن · پخشکردن' : 'BROWSE · CHOOSE · CAST'}</span></div>
    <div className="max-w-2xl"><p className="eyebrow mb-4">{ku ? 'شاشەیەکی گەورەتر، بە ئاسانی' : 'A BIGGER SCREEN, SIMPLY'}</p><h1 className="text-4xl font-semibold leading-[1.15] tracking-tight sm:text-6xl">{ku ? 'لە مۆبایلەکەت بگەڕێ.' : 'Find it on your phone.'}<br /><span className="text-zinc-500">{ku ? 'لە شاشەکەت بیبینە.' : 'Watch it on your screen.'}</span></h1><p className="mt-6 max-w-lg text-sm leading-7 text-zinc-400 sm:text-base">{ku ? 'مۆبایل و شاشەکەت پێکەوە ببەستە. لە پەڕەکان بگەڕێ، ڤیدیۆیەک هەڵبژێرە و پخشەکە لە شوێنی خۆت کۆنترۆڵ بکە.' : 'Pair your phone with your screen. Explore pages, select a video, and keep playback controls in your hand.'}</p></div>
    <div className="mt-10 grid gap-4 md:grid-cols-2">
      {([
        { mode: 'controller', icon: Smartphone, step: '01', title: ku ? 'مۆبایلەکەم بەکار دەهێنم' : 'Use my phone', description: ku ? 'کۆدی شاشەکە داخڵ بکە، پاشان ڤیدیۆیەک بدۆزەوە.' : 'Enter the code from your screen, then find something to watch.', action: ku ? 'گەڕان دەست پێ بکە' : 'Start browsing' },
        { mode: 'receiver', icon: Tv, step: '02', title: ku ? 'ئەمە شاشەکەمە' : 'This is my screen', description: ku ? 'کۆدی پەیوەستکردن پیشان بدە و چاوەڕێی مۆبایلەکەت بە.' : 'Show a pairing code and get ready to receive a video.', action: ku ? 'شاشەکە ئامادە بکە' : 'Set up screen' },
      ] as const).map((item) => <button key={item.mode} onClick={() => onSelectMode(item.mode)} className="group rounded-3xl border border-white/[0.08] bg-[#111218] p-6 text-start transition hover:border-white/20 hover:bg-[#15161d] sm:p-8"><div className="mb-7 flex items-center justify-between"><span className="grid h-12 w-12 place-items-center rounded-2xl border border-white/[0.07] bg-white/[0.03] text-[#b1a7ff]"><item.icon size={23} /></span><span className="font-mono text-xs text-zinc-600">{item.step}</span></div><h2 className="text-xl font-semibold tracking-tight">{item.title}</h2><p className="mt-3 min-h-12 text-sm leading-6 text-zinc-500">{item.description}</p><div className="mt-7 flex items-center justify-between border-t border-white/[0.06] pt-5 text-sm text-zinc-300"><span>{item.action}</span><ArrowUpRight size={19} className="text-zinc-500 transition group-hover:text-[#b1a7ff]" /></div></button>)}
    </div>
    <div className="mt-8 flex flex-wrap items-center gap-5 border-t border-white/[0.06] pt-5 text-xs text-zinc-500"><span className="flex items-center gap-2"><Puzzle size={14} />{ku ? 'Chrome Bridge لە لاپتۆپ' : 'Chrome Bridge on computer'}</span><span className="flex items-center gap-2"><Radio size={14} />{ku ? 'کۆنترۆڵ لە مۆبایل' : 'Phone remote controls'}</span><span className="ms-auto flex items-center gap-2"><Chrome size={14} />{ku ? 'تابی ڕاستەقینەی Chrome' : 'Real Chrome tab'}</span></div>
  </div>;
};
