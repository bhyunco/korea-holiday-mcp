/**
 * MCP 응답 텍스트 포맷터.
 *
 * LLM이 그대로 읽고 인용할 수 있도록 사람이 읽는 한국어 문장으로 만든다.
 * 날짜는 항상 "YYYY-MM-DD (요일)" 형태로 써서 요일 착각을 막는다.
 */

import { formatKo, toISODate, weekdayKo, type ISODate } from "./date";
import type { Holiday, LongWeekend } from "./holidays";

export function holidayLine(h: Holiday): string {
  const suffix = h.type === "대체공휴일" ? " (대체공휴일)" : h.type === "임시공휴일" ? " (임시공휴일)" : h.type === "선거일" ? " (선거일)" : h.type === "근로자의날" ? " (근로자의 날 · 관공서 공휴일 아님)" : "";
  return `- ${h.date} (${h.weekday}) ${h.name}${suffix}`;
}

export function holidayListText(holidays: Holiday[]): string {
  if (holidays.length === 0) return "해당 기간에 공휴일이 없습니다.";
  return holidays.map(holidayLine).join("\n");
}

export function longWeekendLine(lw: LongWeekend): string {
  const s = `${lw.start} (${weekdayKo(new Date(`${lw.start}T00:00:00Z`))})`;
  const e = `${lw.end} (${weekdayKo(new Date(`${lw.end}T00:00:00Z`))})`;
  return `- ${s} ~ ${e} · ${lw.days}일 — ${lw.holidays.join(", ")}`;
}

export function dayDescription(date: Date): string {
  return formatKo(date);
}

export function ymd(date: Date): ISODate {
  return toISODate(date);
}
