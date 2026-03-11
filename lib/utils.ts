import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Timestamp } from 'firebase/firestore';
import { format, formatDistanceToNow, isValid } from 'date-fns';
import { es } from 'date-fns/locale';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function toDate(value: unknown): Date {
  if (!value) return new Date();
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') return new Date(value);
  return new Date();
}

export function formatDate(value: unknown, fmt = 'dd/MM/yyyy'): string {
  const d = toDate(value);
  return isValid(d) ? format(d, fmt, { locale: es }) : '-';
}

export function formatDatetime(value: unknown): string {
  return formatDate(value, 'dd/MM/yyyy HH:mm');
}

export function formatRelative(value: unknown): string {
  const d = toDate(value);
  return isValid(d) ? formatDistanceToNow(d, { addSuffix: true, locale: es }) : '-';
}

export function formatDayName(value: unknown): string {
  return formatDate(value, 'EEEE dd \'de\' MMMM');
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function getResultLabel(homeScore: number, awayScore: number, isHome: boolean): 'W' | 'D' | 'L' {
  if (homeScore === awayScore) return 'D';
  if (isHome) return homeScore > awayScore ? 'W' : 'L';
  return awayScore > homeScore ? 'W' : 'L';
}
