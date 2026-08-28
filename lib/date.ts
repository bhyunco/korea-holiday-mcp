/**
 * 날짜 유틸리티.
 *
 * 서버가 어느 타임존에서 돌든 결과가 같아야 하므로, 모든 날짜는
 * "YYYY-MM-DD" 문자열과 UTC 자정 Date 객체로만 다룬다.
 * (로컬 타임존 기반 Date 생성자는 이 파일에서 절대 쓰지 않는다.)
 */

export type ISODate = string; // "YYYY-MM-DD"

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export const WEEKDAY_KO = ["일", "월", "화", "수", "목", "금", "토"] as const;

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** "YYYY-MM-DD" → UTC 자정 Date. 형식/실재 여부를 모두 검증한다. */
export function parseISODate(value: string): Date {
  const m = ISO_RE.exec(value.trim());
  if (!m) {
    throw new Error(`날짜 형식이 올바르지 않습니다: "${value}" (YYYY-MM-DD 형식이어야 합니다)`);
  }
  const [, y, mo, d] = m;
  const date = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)));
  // 2026-02-31 같은 존재하지 않는 날짜를 걸러낸다.
  if (
    date.getUTCFullYear() !== Number(y) ||
    date.getUTCMonth() !== Number(mo) - 1 ||
    date.getUTCDate() !== Number(d)
  ) {
    throw new Error(`존재하지 않는 날짜입니다: "${value}"`);
  }
  return date;
}

export function toISODate(date: Date): ISODate {
  return date.toISOString().slice(0, 10);
}

export function makeDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

export function diffDays(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / DAY_MS);
}

/** 0=일 … 6=토 */
export function dayOfWeek(date: Date): number {
  return date.getUTCDay();
}

export function weekdayKo(date: Date): string {
  return WEEKDAY_KO[dayOfWeek(date)];
}

export function isWeekend(date: Date): boolean {
  const d = dayOfWeek(date);
  return d === 0 || d === 6;
}

export function isSunday(date: Date): boolean {
  return dayOfWeek(date) === 0;
}

/** 한국 표준시 기준 오늘 날짜 */
export function todayKST(): Date {
  const now = new Date(Date.now() + KST_OFFSET_MS);
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** "2026-02-17 (화)" 형태의 표시 문자열 */
export function formatKo(date: Date): string {
  return `${toISODate(date)} (${weekdayKo(date)})`;
}
