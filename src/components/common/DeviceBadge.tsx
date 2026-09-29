import React from 'react';
import { Tv, Smartphone, Tablet, Laptop, Monitor, HelpCircle } from 'lucide-react';
import { DeviceType } from '../../types';

interface DeviceBadgeProps {
  name: string;
  type: DeviceType;
  status?: 'online' | 'offline' | 'reconnecting';
  size?: 'sm' | 'md' | 'lg';
}

export const DeviceBadge: React.FC<DeviceBadgeProps> = ({
  name,
  type,
  status = 'online',
  size = 'md',
}) => {
  const getIcon = () => {
    const iconClass = size === 'sm' ? 'w-3.5 h-3.5' : size === 'lg' ? 'w-6 h-6' : 'w-4 h-4';
    switch (type) {
      case 'tv':
        return <Tv className={iconClass} />;
      case 'mobile':
        return <Smartphone className={iconClass} />;
      case 'tablet':
        return <Tablet className={iconClass} />;
      case 'laptop':
        return <Laptop className={iconClass} />;
      case 'desktop':
        return <Monitor className={iconClass} />;
      default:
        return <HelpCircle className={iconClass} />;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'online':
        return 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)]';
      case 'reconnecting':
        return 'bg-amber-500 animate-pulse';
      case 'offline':
        return 'bg-zinc-600';
    }
  };

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 backdrop-blur-md ${
        size === 'sm'
          ? 'px-2.5 py-1 text-xs'
          : size === 'lg'
          ? 'px-4 py-2 text-base'
          : 'px-3 py-1.5 text-sm'
      }`}
    >
      <span className="text-zinc-400">{getIcon()}</span>
      <span className="font-medium text-white truncate max-w-[180px] sm:max-w-[240px]">{name}</span>
      {status && (
        <span
          className={`h-2 w-2 rounded-full ${getStatusColor()}`}
          title={status.toUpperCase()}
        />
      )}
    </div>
  );
};
