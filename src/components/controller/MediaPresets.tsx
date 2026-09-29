import React from 'react';
import { Film, Sparkles, Globe, Music, Compass } from 'lucide-react';

interface PresetItem {
  id: string;
  title: string;
  category: string;
  url: string;
  icon: 'video' | 'web' | 'music';
}

const PRESETS: PresetItem[] = [
  {
    id: 'bbb',
    title: 'Big Buck Bunny (1080p)',
    category: 'Animation',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    icon: 'video',
  },
  {
    id: 'sintel',
    title: 'Sintel (Blender Film)',
    category: 'Fantasy Short',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
    icon: 'video',
  },
  {
    id: 'tears',
    title: 'Tears of Steel (Sci-Fi)',
    category: 'VFX Action',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
    icon: 'video',
  },
  {
    id: 'elephants',
    title: 'Elephants Dream (Classic)',
    category: 'Open Movie',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    icon: 'video',
  },
  {
    id: 'subaru',
    title: 'Outdoors & Nature Reel',
    category: 'Cinematic 4K',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4',
    icon: 'video',
  },
  {
    id: 'wiki',
    title: 'Wikipedia Portal',
    category: 'Web Browser',
    url: 'https://en.m.wikipedia.org/wiki/Streaming_media',
    icon: 'web',
  },
];

interface MediaPresetsProps {
  onSelectUrl: (url: string) => void;
}

export const MediaPresets: React.FC<MediaPresetsProps> = ({ onSelectUrl }) => {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-zinc-400">
        <span className="uppercase tracking-wider font-bold">Featured Media Demos</span>
        <span className="text-[11px] text-[#A594FD]">Instant Test Streams</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {PRESETS.map((item) => (
          <button
            key={item.id}
            onClick={() => onSelectUrl(item.url)}
            className="flex flex-col text-left p-3 rounded-2xl bg-[#141418] hover:bg-[#1C1C22] active:scale-[0.98] border border-white/5 hover:border-[#6D5DFB]/40 transition group cursor-pointer"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider group-hover:text-[#A594FD]">
                {item.category}
              </span>
              {item.icon === 'video' ? (
                <Film className="w-3.5 h-3.5 text-zinc-500 group-hover:text-[#6D5DFB]" />
              ) : (
                <Globe className="w-3.5 h-3.5 text-zinc-500 group-hover:text-[#6D5DFB]" />
              )}
            </div>
            <span className="text-xs font-bold text-white truncate group-hover:text-white">
              {item.title}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};
