// Разбор ссылок на видео и построение встроенных плееров.
export function parseVideoUrl(raw) {
  let u;
  try { u = new URL(String(raw).trim()); } catch { return { platform: 'other', id: null }; }
  const host = u.hostname.replace(/^www\.|^m\./, '');

  // YouTube
  if (host === 'youtu.be') return yt(u.pathname.slice(1));
  if (host.endsWith('youtube.com') || host.endsWith('youtube-nocookie.com')) {
    if (u.searchParams.get('v')) return yt(u.searchParams.get('v'));
    const m = u.pathname.match(/\/(?:shorts|embed|live|v)\/([\w-]{11})/);
    if (m) return yt(m[1]);
    return { platform: 'youtube', id: null };
  }
  // TikTok
  if (host.endsWith('tiktok.com')) {
    const m = u.pathname.match(/\/(?:video|photo|embed(?:\/v2)?)\/(\d{8,})/);
    return { platform: 'tiktok', id: m ? m[1] : null };
  }
  // VK Видео
  if (host === 'vk.com' || host === 'vk.ru' || host === 'vkvideo.ru') {
    const src = (u.searchParams.get('z') || '') + ' ' + u.pathname;
    const m = src.match(/video(-?\d+)_(\d+)/);
    if (u.pathname.includes('video_ext.php') && u.searchParams.get('oid')) {
      return { platform: 'vk', id: `${u.searchParams.get('oid')}_${u.searchParams.get('id')}` };
    }
    return { platform: 'vk', id: m ? `${m[1]}_${m[2]}` : null };
  }
  return { platform: 'other', id: null };

  function yt(id) {
    const m = String(id).match(/^[\w-]{11}/);
    return { platform: 'youtube', id: m ? m[0] : null };
  }
}

export function detectPlatform(url) { return parseVideoUrl(url).platform; }

export const PLATFORM_LABEL = { youtube: 'YouTube', tiktok: 'TikTok', vk: 'VK Видео', other: 'Ссылка' };

export function embedSrc(url) {
  const { platform, id } = parseVideoUrl(url);
  if (!id) return null;
  if (platform === 'youtube') return `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`;
  if (platform === 'tiktok') return `https://www.tiktok.com/embed/v2/${id}`;
  if (platform === 'vk') {
    const [oid, vid] = id.split('_');
    return `https://vk.com/video_ext.php?oid=${oid}&id=${vid}&hd=2&autoplay=1`;
  }
  return null;
}

export function thumbnail(url) {
  const { platform, id } = parseVideoUrl(url);
  if (platform === 'youtube' && id) return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
  return null;
}
