// Hand-drawn icon set (24×24, rounded strokes). Colour follows `currentColor`.
const P = {
  talk: (
    <>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h8A2.5 2.5 0 0 1 17 5.5v5A2.5 2.5 0 0 1 14.5 13H9l-3.5 3v-3A2.5 2.5 0 0 1 4 10.5z" />
      <path d="M17 8h.5A2.5 2.5 0 0 1 20 10.5v5a2.5 2.5 0 0 1-2.5 2.5V21l-3.5-3h-3.5a2.5 2.5 0 0 1-2.4-1.8" />
      <circle cx="8" cy="8" r=".6" fill="currentColor" />
      <circle cx="10.5" cy="8" r=".6" fill="currentColor" />
      <circle cx="13" cy="8" r=".6" fill="currentColor" />
    </>
  ),
  mail: (
    <>
      <rect x="3" y="5.5" width="18" height="13" rx="2.5" />
      <path d="m3.5 7 8.5 6 8.5-6" />
    </>
  ),
  story: (
    <>
      <path d="M12 6.5C10 5 7.5 4.5 4 4.8v13.4c3.5-.3 6 .2 8 1.8 2-1.6 4.5-2.1 8-1.8V4.8c-3.5-.3-6 .2-8 1.7z" />
      <path d="M12 6.5V20" />
      <path d="m15 13 3.5-3.5a1.1 1.1 0 0 1 1.6 1.6L16.6 14.6 14.5 15z" />
    </>
  ),
  explorer: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m15.5 8.5-2 5-5 2 2-5z" />
      <circle cx="12" cy="12" r=".8" fill="currentColor" />
    </>
  ),
  wordlab: (
    <>
      <rect x="2.5" y="12" width="9" height="9" rx="2" />
      <rect x="12.5" y="12" width="9" height="9" rx="2" />
      <rect x="7.5" y="3" width="9" height="9" rx="2" />
      <path d="M10 9.5 12 5l2 4.5M10.7 8h2.6M5.5 18.5V14.5h1.6a1 1 0 0 1 0 2H5.5h2a1 1 0 0 1 0 2zM18.5 15a1.6 1.6 0 1 0 0 3" strokeWidth="1.4" />
    </>
  ),
  phonics: (
    <>
      <path d="M4 17 7.5 7l3.5 10M5.3 13.5h4.4" />
      <path d="M15 9.5a3 3 0 0 1 0 5M17.5 7a6.5 6.5 0 0 1 0 10" />
    </>
  ),
  star: <path d="m12 3.5 2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.8l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z" />,
  parent: (
    <>
      <path d="M12 3 4.5 6v5.5c0 4.4 3.1 8 7.5 9.5 4.4-1.5 7.5-5.1 7.5-9.5V6z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  back: <path d="M15 5 8 12l7 7" />,
  mic: (
    <>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M9 21h6" />
    </>
  ),
  stop: <rect x="6" y="6" width="12" height="12" rx="2.5" fill="currentColor" />,
  keyboard: (
    <>
      <rect x="2.5" y="6" width="19" height="12" rx="2.5" />
      <path d="M6 10h.01M9 10h.01M12 10h.01M15 10h.01M18 10h.01M7 14h10" />
    </>
  ),
  bulb: (
    <>
      <path d="M9 17.5h6M10 21h4" />
      <path d="M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1 2V16h5.2v-.2c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z" />
    </>
  ),
  replay: (
    <>
      <path d="M4 12a8 8 0 1 0 2.3-5.6" />
      <path d="M4 4v4h4" />
    </>
  ),
  slow: (
    <>
      <path d="M3 16h14.5a3.5 3.5 0 0 0 0-7c-1 0-1.8.4-2.4 1" />
      <path d="M5 16c0-3.9 2.7-7 6-7s6 3.1 6 7" />
      <path d="M7 16v2.5M14 16v2.5" />
    </>
  ),
  eye: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  eyeOff: (
    <>
      <path d="M10.6 5.6A9 9 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-2.6 3.4M6.6 6.6C4 8.3 2.5 12 2.5 12S6 18.5 12 18.5c1.8 0 3.3-.6 4.6-1.3" />
      <path d="m3 3 18 18M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </>
  ),
  send: <path d="M4 12 20 4l-6 16-2.5-6.5z" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  speaker: (
    <>
      <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
      <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />
    </>
  ),
  wave: (
    <>
      <path d="M7.5 12.5V7a1.5 1.5 0 0 1 3 0v4.5M10.5 11V5.5a1.5 1.5 0 0 1 3 0V11M13.5 11V6.5a1.5 1.5 0 0 1 3 0v6" />
      <path d="M16.5 12.5V10a1.5 1.5 0 0 1 3 0v3.5a7 7 0 0 1-7 7h-.6a6 6 0 0 1-4.6-2.2L4.5 15a1.6 1.6 0 0 1 2.4-2l.6.6" />
    </>
  ),
  close: <path d="M6 6l12 12M18 6 6 18" />,
  book: (
    <>
      <path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5z" />
      <path d="M5 19.5A1.5 1.5 0 0 0 6.5 21H19v-3" />
    </>
  ),
  image: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <circle cx="9" cy="9.5" r="1.8" />
      <path d="m3.5 17.5 5-5 4 4 2.5-2.5 5.5 5" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
    </>
  ),
  sparkle: (
    <>
      <path d="M12 3c.6 4.2 2.2 5.9 6.5 6.5-4.3.6-5.9 2.3-6.5 6.5-.6-4.2-2.2-5.9-6.5-6.5C9.8 8.9 11.4 7.2 12 3z" />
      <path d="M18.5 15.5c.3 1.8 1 2.6 2.5 3-1.5.3-2.2 1.1-2.5 3-.3-1.9-1-2.7-2.5-3 1.5-.4 2.2-1.2 2.5-3z" />
    </>
  ),
  pencil: (
    <>
      <path d="M4 20l1-4.5L15.5 5a2.1 2.1 0 0 1 3 3L8 18.5z" />
      <path d="m13.5 7 3 3" />
    </>
  ),
};

export default function Icon({ name, size = 24, stroke = 2, className = '', title }) {
  const body = P[name];
  if (!body) return null;
  return (
    <svg
      className={`icon ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
    >
      {title && <title>{title}</title>}
      {body}
    </svg>
  );
}
