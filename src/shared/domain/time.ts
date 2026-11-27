import { ApplicationError, fields, instant, timeZone } from './validation.js';
export interface WindowQuery {
  from: string;
  to: string;
  timeZone?: string;
}
export function windowQuery(query: WindowQuery) {
  fields(query, ['from', 'to', 'timeZone']);
  const from = instant(query.from),
    to = instant(query.to),
    zone = timeZone(query.timeZone ?? 'UTC');
  const span = Date.parse(to) - Date.parse(from);
  if (span <= 0 || span > 93 * 86400000) throw new ApplicationError(400);
  return { from, to, timeZone: zone };
}
export function localDate(value: string, zone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(value));
  const part = (name: string) => parts.find((p) => p.type === name)!.value;
  return `${part('year').padStart(4, '0')}-${part('month')}-${part('day')}`;
}
export function localMinute(value: string, zone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(value));
  return (
    Number(parts.find((p) => p.type === 'hour')!.value) * 60 +
    Number(parts.find((p) => p.type === 'minute')!.value)
  );
}
export const round = (value: number) => Math.round(value * 100) / 100;
export function elapsedMinutes(start: string, end: string) {
  return (Date.parse(end) - Date.parse(start)) / 60000;
}
export function observedInterval(
  start: string,
  end: string,
  excludedMinutes: number,
  maxHours: number,
  now: Date,
) {
  const minutes = elapsedMinutes(start, end);
  if (
    minutes <= 0 ||
    minutes > maxHours * 60 ||
    Date.parse(end) > now.getTime() ||
    !Number.isInteger(excludedMinutes) ||
    excludedMinutes < 0 ||
    excludedMinutes >= minutes
  )
    throw new ApplicationError(400);
  return minutes;
}
export function boundedSummary<T>(rows: T[]) {
  if (rows.length > 10000) throw new ApplicationError(409);
  return rows;
}
