const props = (size) => ({ width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '1.8', strokeLinecap: 'round', strokeLinejoin: 'round' })

export const FlameIcon = ({ size = 18 }) => (
  <svg {...props(size)}>
    <path d="M12 2C8 7 6 10 6 14a6 6 0 0 0 12 0c0-4-2-7-6-12z" />
    <path d="M9.5 14.5a2.5 2.5 0 0 0 5 0c0-2-2.5-4-2.5-4s-2.5 2-2.5 4z" />
  </svg>
)

export const ZzzIcon = ({ size = 18 }) => (
  <svg {...props(size)}>
    <path d="M3 5h8L3 13h8" />
    <path d="M11 9.5h6l-6 7h6" />
  </svg>
)

export const CameraIcon = ({ size = 18 }) => (
  <svg {...props(size)}>
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
    <circle cx="12" cy="13" r="4" />
  </svg>
)

export const SunIcon = ({ size = 18 }) => (
  <svg {...props(size)}>
    <circle cx="12" cy="12" r="5" />
    <line x1="12" y1="1" x2="12" y2="3" />
    <line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1" y1="12" x2="3" y2="12" />
    <line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </svg>
)

export const MoonIcon = ({ size = 18 }) => (
  <svg {...props(size)}>
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
)

export const VolumeIcon = ({ size = 18 }) => (
  <svg {...props(size)}>
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
  </svg>
)

export const VolumeMuteIcon = ({ size = 18 }) => (
  <svg {...props(size)}>
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <line x1="23" y1="9" x2="17" y2="15" />
    <line x1="17" y1="9" x2="23" y2="15" />
  </svg>
)

export const TargetIcon = ({ size = 20 }) => (
  <svg {...props(size)}>
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="6" />
    <circle cx="12" cy="12" r="2" />
  </svg>
)

export const TrophyIcon = ({ size = 20 }) => (
  <svg {...props(size)}>
    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
    <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
    <path d="M4 22h16" />
    <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
    <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
    <path d="M18 2H6v7a6 6 0 0 0 12 0V2z" />
  </svg>
)

export const CrownIcon = ({ size = 20 }) => (
  <svg {...props(size)}>
    <path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z" />
    <path d="M5 20h14" />
  </svg>
)

export const StarIcon = ({ size = 20 }) => (
  <svg {...props(size)}>
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
)

export const BoltIcon = ({ size = 20 }) => (
  <svg {...props(size)}>
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
)

export const RocketIcon = ({ size = 20 }) => (
  <svg {...props(size)}>
    <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
    <path d="m3.5 11.5 1 4.5 4.5 1L21 4 3.5 11.5z" />
  </svg>
)

export const MedalIcon = ({ size = 20 }) => (
  <svg {...props(size)}>
    <circle cx="12" cy="15" r="6" />
    <path d="M9 6.5L7 3h10l-2 3.5" />
    <path d="M12 9v6" />
    <path d="M9 12h6" />
  </svg>
)

export const DumbbellIcon = ({ size = 20 }) => (
  <svg {...props(size)}>
    <path d="M6.5 6.5h11" />
    <path d="M6.5 17.5h11" />
    <path d="M3 9.5h3V14.5H3z" />
    <path d="M18 9.5h3V14.5H18z" />
    <path d="M6 8V16" />
    <path d="M18 8V16" />
  </svg>
)

export const EditIcon = ({ size = 18 }) => (
  <svg {...props(size)}>
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
)

export const TrashIcon = ({ size = 18 }) => (
  <svg {...props(size)}>
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6" />
    <path d="M14 11v6" />
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
  </svg>
)

export const ListIcon = ({ size = 18 }) => (
  <svg {...props(size)}>
    <line x1="8" y1="6" x2="21" y2="6" />
    <line x1="8" y1="12" x2="21" y2="12" />
    <line x1="8" y1="18" x2="21" y2="18" />
    <line x1="3" y1="6" x2="3.01" y2="6" />
    <line x1="3" y1="12" x2="3.01" y2="12" />
    <line x1="3" y1="18" x2="3.01" y2="18" />
  </svg>
)

export const BikeIcon = ({ size = 18 }) => (
  <svg {...props(size)}>
    <circle cx="5.5" cy="17.5" r="3.5" />
    <circle cx="18.5" cy="17.5" r="3.5" />
    <path d="M15 6a1 1 0 0 0-1-1H9" />
    <path d="M12 6l3 5.5-4 3.5H9l-3.5-5.5" />
    <path d="M15 11.5L18.5 17.5" />
  </svg>
)

export const CheckIcon = ({ size = 18 }) => (
  <svg {...props(size)}>
    <polyline points="20 6 9 17 4 12" />
  </svg>
)
