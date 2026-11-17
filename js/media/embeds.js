export function isEmbedVideo(url) {
  return /youtube\.com|youtu\.be|vimeo\.com/i.test(url);
}

export function toEmbedUrl(url) {
  try {
    const u = new URL(url);
    if (/youtu\.be$/i.test(u.hostname)) return "https://www.youtube.com/embed/" + u.pathname.slice(1) + "?autoplay=1&playsinline=1&rel=0";
    if (/youtube\.com$/i.test(u.hostname) || /www\.youtube\.com$/i.test(u.hostname)) {
      if (u.searchParams.get("v")) return "https://www.youtube.com/embed/" + u.searchParams.get("v") + "?autoplay=1&playsinline=1&rel=0";
      const shorts = u.pathname.match(/\/shorts\/([^/]+)/);
      if (shorts) return "https://www.youtube.com/embed/" + shorts[1] + "?autoplay=1&playsinline=1&rel=0";
    }
    if (/vimeo\.com$/i.test(u.hostname) || /www\.vimeo\.com$/i.test(u.hostname)) {
      const m = u.pathname.match(/(\d+)/);
      if (m) return "https://player.vimeo.com/video/" + m[1] + "?autoplay=1";
    }
  } catch (err) { /* invalid URL: render as-is */ }
  return url;
}

export function isDirectVideoUrl(url) {
  return /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(url);
}
