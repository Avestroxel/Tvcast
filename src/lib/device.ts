import { DeviceInfo, DeviceType } from '../types';

export function getOrCreateDeviceId(): string {
  const STORAGE_KEY = 'castsync_device_id';
  let id = localStorage.getItem(STORAGE_KEY);
  if (!id) {
    id = 'dev_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36).substring(4);
    localStorage.setItem(STORAGE_KEY, id);
  }
  return id;
}

export function detectDevice(): DeviceInfo {
  const ua = navigator.userAgent;
  let type: DeviceType = 'desktop';
  let os = 'Unknown OS';
  let browser = 'Browser';

  // Detect TV
  const isTV =
    /SmartTV|SMART-TV|Tizen|WebOS|Android TV|GoogleTV|AppleTV|HbbTV|NetCast|Opera TV|Roku|Viera|BRAVIA/i.test(ua) ||
    (window.innerWidth >= 1920 && /Android/i.test(ua) && !/Mobile/i.test(ua));

  // Detect Tablet
  const isTablet =
    /(ipad|tablet|(android(?!.*mobile))|(windows(?!.*phone)(.*touch))|kindle|playbook|silk)/i.test(ua);

  // Detect Mobile
  const isMobile =
    /(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(
      ua
    );

  if (isTV) {
    type = 'tv';
  } else if (isTablet) {
    type = 'tablet';
  } else if (isMobile) {
    type = 'mobile';
  } else {
    // Distinguish laptop vs desktop heuristically
    const hasBattery = 'getBattery' in navigator;
    const isTouch = navigator.maxTouchPoints > 0;
    if (window.screen.width <= 1536 || isTouch || hasBattery) {
      type = 'laptop';
    } else {
      type = 'desktop';
    }
  }

  // OS detection
  if (/Windows/i.test(ua)) os = 'Windows';
  else if (/Macintosh|Mac OS X/i.test(ua)) os = 'macOS';
  else if (/iPhone/i.test(ua)) os = 'iOS';
  else if (/iPad/i.test(ua)) os = 'iPadOS';
  else if (/Android/i.test(ua)) os = isTV ? 'Android TV' : 'Android';
  else if (/Linux/i.test(ua)) os = 'Linux';
  else if (/Tizen/i.test(ua)) os = 'Tizen OS';
  else if (/Web0S|WebOS/i.test(ua)) os = 'webOS';

  // Browser detection
  if (/Edg/i.test(ua)) browser = 'Edge';
  else if (/Chrome/i.test(ua) && !/Edg/i.test(ua)) browser = 'Chrome';
  else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari';
  else if (/Firefox/i.test(ua)) browser = 'Firefox';
  else if (/SamsungBrowser/i.test(ua)) browser = 'Samsung Internet';

  // Construct human-friendly label
  let name = '';
  if (type === 'tv') {
    name = `${os} TV`;
  } else if (type === 'mobile') {
    name = `${os} Phone (${browser})`;
  } else if (type === 'tablet') {
    name = `${os} Tablet`;
  } else {
    name = `${browser} on ${os}`;
  }

  return {
    id: getOrCreateDeviceId(),
    name,
    type,
    browser,
    os,
  };
}
