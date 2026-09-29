import React from 'react';
import {
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CornerDownLeft,
  Home,
  Menu,
  RotateCcw,
} from 'lucide-react';
import { NavDirection } from '../../types';

interface DPadRemoteProps {
  onNavigate: (dir: NavDirection) => void;
}

export const DPadRemote: React.FC<DPadRemoteProps> = ({ onNavigate }) => {
  return (
    <div className="flex flex-col items-center select-none py-2">
      {/* Outer D-Pad Circular Housing */}
      <div className="relative w-56 h-56 sm:w-64 sm:h-64 rounded-full bg-[#18181D] border-2 border-white/10 shadow-[0_15px_35px_rgba(0,0,0,0.5)] p-2 flex items-center justify-center">
        {/* Up Button */}
        <button
          onClick={() => onNavigate('up')}
          className="absolute top-2 inset-x-0 mx-auto w-24 h-14 flex items-center justify-center text-zinc-400 hover:text-white active:text-[#6D5DFB] active:scale-95 transition-all focus:outline-none cursor-pointer"
          title="Up"
        >
          <ChevronUp className="w-8 h-8" />
        </button>

        {/* Down Button */}
        <button
          onClick={() => onNavigate('down')}
          className="absolute bottom-2 inset-x-0 mx-auto w-24 h-14 flex items-center justify-center text-zinc-400 hover:text-white active:text-[#6D5DFB] active:scale-95 transition-all focus:outline-none cursor-pointer"
          title="Down"
        >
          <ChevronDown className="w-8 h-8" />
        </button>

        {/* Left Button */}
        <button
          onClick={() => onNavigate('left')}
          className="absolute left-2 inset-y-0 my-auto w-14 h-24 flex items-center justify-center text-zinc-400 hover:text-white active:text-[#6D5DFB] active:scale-95 transition-all focus:outline-none cursor-pointer"
          title="Left"
        >
          <ChevronLeft className="w-8 h-8" />
        </button>

        {/* Right Button */}
        <button
          onClick={() => onNavigate('right')}
          className="absolute right-2 inset-y-0 my-auto w-14 h-24 flex items-center justify-center text-zinc-400 hover:text-white active:text-[#6D5DFB] active:scale-95 transition-all focus:outline-none cursor-pointer"
          title="Right"
        >
          <ChevronRight className="w-8 h-8" />
        </button>

        {/* Center OK Button */}
        <button
          onClick={() => onNavigate('ok')}
          className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-[#202027] hover:bg-[#282832] active:bg-[#6D5DFB] active:scale-90 text-white font-bold text-base sm:text-lg border border-white/10 shadow-inner flex items-center justify-center transition-all cursor-pointer focus:outline-none"
          title="OK / Select"
        >
          <span>OK</span>
        </button>
      </div>

      {/* Auxiliary TV Action Buttons: Back, Home, Menu, Enter */}
      <div className="grid grid-cols-3 gap-4 w-full max-w-[280px] sm:max-w-xs mt-6">
        <button
          onClick={() => onNavigate('back')}
          className="flex flex-col items-center justify-center p-3 rounded-2xl bg-[#141418] hover:bg-[#1C1C22] active:scale-95 border border-white/10 text-zinc-300 hover:text-white transition cursor-pointer"
          title="Back"
        >
          <RotateCcw className="w-5 h-5 mb-1" />
          <span className="text-[11px] font-medium">Back</span>
        </button>

        <button
          onClick={() => onNavigate('home')}
          className="flex flex-col items-center justify-center p-3 rounded-2xl bg-[#141418] hover:bg-[#1C1C22] active:scale-95 border border-white/10 text-zinc-300 hover:text-white transition cursor-pointer"
          title="Home"
        >
          <Home className="w-5 h-5 mb-1 text-[#6D5DFB]" />
          <span className="text-[11px] font-medium">Home</span>
        </button>

        <button
          onClick={() => onNavigate('menu')}
          className="flex flex-col items-center justify-center p-3 rounded-2xl bg-[#141418] hover:bg-[#1C1C22] active:scale-95 border border-white/10 text-zinc-300 hover:text-white transition cursor-pointer"
          title="Menu"
        >
          <Menu className="w-5 h-5 mb-1" />
          <span className="text-[11px] font-medium">Menu</span>
        </button>
      </div>
    </div>
  );
};
