/**
 * 규칙으로 계산할 수 없는 공휴일 — 임시공휴일과 선거일.
 *
 * 이 두 종류는 매번 국무회의/공직선거법으로 개별 지정되므로 수동 관리한다.
 * 새 임시공휴일이 지정되면 이 파일에만 한 줄 추가하면 된다.
 *
 * 출처: 관공서의 공휴일에 관한 규정 제2조 제10호의2(선거일), 제11호(기타 지정일)
 */

import type { ISODate } from "./date";

export interface OverrideHoliday {
  date: ISODate;
  name: string;
  kind: "임시공휴일" | "선거일";
}

/** 확정·공포된 것만 등재한다. 추측한 미래 일정은 넣지 않는다. */
export const OVERRIDE_HOLIDAYS: readonly OverrideHoliday[] = [
  { date: "2015-08-14", name: "임시공휴일 (광복 70주년)", kind: "임시공휴일" },
  { date: "2016-04-13", name: "제20대 국회의원선거", kind: "선거일" },
  { date: "2016-05-06", name: "임시공휴일 (어린이날 연휴)", kind: "임시공휴일" },
  { date: "2017-05-09", name: "제19대 대통령선거", kind: "선거일" },
  { date: "2017-10-02", name: "임시공휴일 (추석 연휴)", kind: "임시공휴일" },
  { date: "2018-06-13", name: "제7회 전국동시지방선거", kind: "선거일" },
  { date: "2020-04-15", name: "제21대 국회의원선거", kind: "선거일" },
  { date: "2020-08-17", name: "임시공휴일", kind: "임시공휴일" },
  { date: "2022-03-09", name: "제20대 대통령선거", kind: "선거일" },
  { date: "2022-06-01", name: "제8회 전국동시지방선거", kind: "선거일" },
  { date: "2023-10-02", name: "임시공휴일 (추석 연휴)", kind: "임시공휴일" },
  { date: "2024-04-10", name: "제22대 국회의원선거", kind: "선거일" },
  { date: "2024-10-01", name: "임시공휴일 (국군의 날)", kind: "임시공휴일" },
  { date: "2025-01-27", name: "임시공휴일 (설 연휴)", kind: "임시공휴일" },
  { date: "2025-06-03", name: "제21대 대통령선거", kind: "선거일" },
  { date: "2026-06-03", name: "제9회 전국동시지방선거", kind: "선거일" },
];

export function overridesForYear(year: number): OverrideHoliday[] {
  const prefix = `${year}-`;
  return OVERRIDE_HOLIDAYS.filter((h) => h.date.startsWith(prefix));
}
