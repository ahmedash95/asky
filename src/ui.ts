export const field =
  "w-full rounded-2xl border border-line bg-paper/80 px-3.5 py-3 text-[0.95rem] text-ink caret-ember outline-none transition selection:bg-ember/20 placeholder:text-mute/70 focus:border-ember focus:bg-card focus:ring-4 focus:ring-ember/15";
export const input = `mt-1.5 ${field}`;
export const textarea = `${field} autogrow max-h-96 leading-relaxed`;
export const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember";
export const btn = `inline-flex min-h-11 items-center justify-center rounded-2xl bg-ember px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-ember-dark ${focusRing}`;
export const btnBlock = `${btn} w-full`;
export const btnGhost = `inline-flex min-h-11 items-center justify-center rounded-2xl border border-line bg-card px-4 text-sm font-medium text-ink transition hover:bg-paper ${focusRing}`;
export const btnQuiet = `inline-flex min-h-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-3 text-sm font-medium text-mute transition hover:bg-card hover:text-ink ${focusRing}`;
export const btnDanger = `inline-flex min-h-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-3 text-sm font-medium text-mute transition hover:bg-red-50 hover:text-red-700 ${focusRing}`;
export const card =
  "rounded-2xl bg-card p-5 shadow-lift ring-1 ring-line/80 sm:rounded-3xl sm:p-6";
export const label = "block text-sm font-medium text-ink";
export const help = "mt-1.5 text-sm text-mute";
export const sectionTitle = "font-serif text-base font-semibold";
export const flashOk =
  "mb-5 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 ring-1 ring-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-200 dark:ring-emerald-900";
export const flashErr =
  "mb-5 rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-800 ring-1 ring-red-100 dark:bg-red-950/50 dark:text-red-200 dark:ring-red-900";
