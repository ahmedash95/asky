const shapes = {
  user: '<circle cx="12" cy="8" r="3.25"/><path d="M5.5 19.5a6.5 6.5 0 0 1 13 0"/>',
  mail: '<rect x="3.25" y="5.5" width="17.5" height="13" rx="2.5"/><path d="m4.5 8 6.4 4.3a2 2 0 0 0 2.2 0L19.5 8"/>',
  globe:
    '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17"/><path d="M12 3.5c2.2 2.3 3.4 5.3 3.4 8.5s-1.2 6.2-3.4 8.5c-2.2-2.3-3.4-5.3-3.4-8.5S9.8 5.8 12 3.5Z"/>',
  calendar:
    '<rect x="3.5" y="5.5" width="17" height="15" rx="2.5"/><path d="M8 3v4M16 3v4M3.5 10.5h17"/>',
  check:
    '<circle cx="12" cy="12" r="8.5"/><path d="m8.4 12.2 2.5 2.5 4.7-5.1"/>',
  trash:
    '<path d="M4.5 7h15M10 7V4.8h4V7M6.8 7l.9 12.2a1.5 1.5 0 0 0 1.5 1.4h5.6a1.5 1.5 0 0 0 1.5-1.4L18.2 7"/>',
  external:
    '<path d="M14 4.5h5.5V10"/><path d="M19.5 4.5 12 12"/><path d="M18 14.5V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3.5"/>',
  copy: '<rect x="9" y="9" width="11.5" height="11.5" rx="2.5"/><path d="M6.5 15h-1a2 2 0 0 1-2-2V5.5a2 2 0 0 1 2-2H13a2 2 0 0 1 2 2v1"/>',
  download:
    '<path d="M12 4v11.5"/><path d="m7.5 11.5 4.5 4.5 4.5-4.5"/><path d="M4.5 20h15"/>',
  arrowLeft: '<path d="M19.5 12h-15"/><path d="m11 5.5-6.5 6.5 6.5 6.5"/>',
  x: '<path d="M18.24 2.25h3.31l-7.23 8.26 8.5 11.24h-6.66l-5.21-6.82-5.97 6.82H1.68l7.73-8.84L1.25 2.25h6.83l4.71 6.23zm-1.16 17.52h1.83L7.08 4.13H5.12z"/>',
} as const;

export type IconName = keyof typeof shapes;

/** Brand marks are solid; the rest are strokes that inherit the text color. */
const solid = new Set<IconName>(["x"]);

export function icon(name: IconName, cls = "size-4 shrink-0"): string {
  const paint = solid.has(name)
    ? 'fill="currentColor"'
    : 'fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"';
  return `<svg class="${cls}" viewBox="0 0 24 24" ${paint} aria-hidden="true">${shapes[name]}</svg>`;
}
