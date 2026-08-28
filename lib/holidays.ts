/**
 * 한국 공휴일 규칙 엔진.
 *
 * 하드코딩된 날짜 표가 아니라, 「관공서의 공휴일에 관한 규정」을 코드로 옮긴 것이다.
 * 음력 공휴일(설날·추석·부처님오신날)은 korean-lunar-calendar로 환산하고,
 * 대체공휴일은 제3조를 그대로 구현한다. 임시공휴일·선거일만 overrides.ts에서 수동 관리.
 *
 * 검증: 2024~2027년 결과를 공개 자료와 대조 (scripts/verify.mjs)
 */

import KoreanLunarCalendar from "korean-lunar-calendar";
import {
  addDays,
  dayOfWeek,
  diffDays,
  isSunday,
  makeDate,
  parseISODate,
  toISODate,
  weekdayKo,
  type ISODate,
} from "./date";
import { overridesForYear } from "./overrides";

export const MIN_YEAR = 2015;
/** korean-lunar-calendar가 음력 데이터를 보유한 마지막 해 */
export const MAX_YEAR = 2050;

export type HolidayType =
  | "법정공휴일"
  | "대체공휴일"
  | "임시공휴일"
  | "선거일"
  | "근로자의날";

export interface Holiday {
  /** YYYY-MM-DD */
  date: ISODate;
  /** 일~토 */
  weekday: string;
  name: string;
  type: HolidayType;
  /** 대체공휴일인 경우, 원래 공휴일 이름 */
  substituteFor?: string;
}

// ---------------------------------------------------------------------------
// 음력 → 양력 환산
// ---------------------------------------------------------------------------

/** 해당 양력 연도의 음력 (month, day)에 대응하는 양력 날짜 */
function lunarToSolar(year: number, lunarMonth: number, lunarDay: number): Date {
  const cal = new KoreanLunarCalendar();
  if (!cal.setLunarDate(year, lunarMonth, lunarDay, false)) {
    throw new Error(
      `음력 ${year}-${lunarMonth}-${lunarDay} 환산에 실패했습니다. 지원 범위는 ${MIN_YEAR}~${MAX_YEAR}년입니다.`,
    );
  }
  const s = cal.getSolarCalendar();
  return makeDate(s.year, s.month, s.day);
}

// ---------------------------------------------------------------------------
// 제2조: 공휴일 정의
// ---------------------------------------------------------------------------

/**
 * 대체공휴일 발동 조건 (제3조)
 * - "weekend": 토요일 또는 일요일과 겹치면 대체 (국경일, 부처님오신날, 성탄절)
 * - "sunday-in-group": 연휴 중 일요일과 겹치는 날 수만큼 대체 (설날, 추석)
 * - "saturday-or-holiday": 토요일 또는 다른 공휴일과 겹치면 대체 (어린이날)
 * - null: 대체공휴일 없음 (신정, 현충일)
 */
type SubstituteRule =
  | {
      trigger: "weekend" | "sunday-in-group" | "saturday-or-holiday";
      sinceYear: number;
    }
  | null;

interface HolidaySpec {
  name: string;
  /** 해당 연도의 날짜들 (설날·추석은 3일) */
  resolve: (year: number) => Date[];
  /** 공휴일로 지정된 첫 해 */
  sinceYear: number;
  substitute: SubstituteRule;
  type: HolidayType;
}

const fixed =
  (month: number, day: number) =>
  (year: number): Date[] => [makeDate(year, month, day)];

/**
 * 설날/추석 연휴: 전날 + 당일 + 다음날.
 * 설날 전날은 음력 12월 말일(29일 또는 30일)이지만, 양력에서 -1일 하면 항상 정확하다.
 */
const threeDayLunar =
  (lunarMonth: number, lunarDay: number) =>
  (year: number): Date[] => {
    const mid = lunarToSolar(year, lunarMonth, lunarDay);
    return [addDays(mid, -1), mid, addDays(mid, 1)];
  };

const HOLIDAY_SPECS: readonly HolidaySpec[] = [
  {
    name: "신정",
    resolve: fixed(1, 1),
    sinceYear: 1949,
    substitute: null, // 제3조 대상 아님
    type: "법정공휴일",
  },
  {
    name: "설날",
    resolve: threeDayLunar(1, 1),
    sinceYear: 1989,
    substitute: { trigger: "sunday-in-group", sinceYear: 2014 },
    type: "법정공휴일",
  },
  {
    name: "삼일절",
    resolve: fixed(3, 1),
    sinceYear: 1949,
    // 2021-08-04 시행이라 2021년 삼일절(3/1)에는 적용되지 않았다.
    substitute: { trigger: "weekend", sinceYear: 2022 },
    type: "법정공휴일",
  },
  {
    name: "근로자의 날",
    resolve: fixed(5, 1),
    sinceYear: 1994,
    substitute: null, // 관공서 공휴일이 아니라 근로기준법상 유급휴일
    type: "근로자의날",
  },
  {
    name: "부처님오신날",
    resolve: (year) => [lunarToSolar(year, 4, 8)],
    sinceYear: 1975,
    substitute: { trigger: "weekend", sinceYear: 2023 }, // 2023-05-04 시행
    type: "법정공휴일",
  },
  {
    name: "어린이날",
    resolve: fixed(5, 5),
    sinceYear: 1975,
    substitute: { trigger: "saturday-or-holiday", sinceYear: 2014 },
    type: "법정공휴일",
  },
  {
    name: "현충일",
    resolve: fixed(6, 6),
    sinceYear: 1956,
    substitute: null, // 국경일이 아니므로 제3조 대상 아님
    type: "법정공휴일",
  },
  {
    name: "제헌절",
    resolve: fixed(7, 17),
    sinceYear: 2026, // 2008년 공휴일에서 제외 → 2026년 재지정
    substitute: { trigger: "weekend", sinceYear: 2026 },
    type: "법정공휴일",
  },
  {
    name: "광복절",
    resolve: fixed(8, 15),
    sinceYear: 1949,
    substitute: { trigger: "weekend", sinceYear: 2021 }, // 2021년 광복절부터 적용
    type: "법정공휴일",
  },
  {
    name: "추석",
    resolve: threeDayLunar(8, 15),
    sinceYear: 1949,
    substitute: { trigger: "sunday-in-group", sinceYear: 2014 },
    type: "법정공휴일",
  },
  {
    name: "개천절",
    resolve: fixed(10, 3),
    sinceYear: 1949,
    substitute: { trigger: "weekend", sinceYear: 2021 },
    type: "법정공휴일",
  },
  {
    name: "한글날",
    resolve: fixed(10, 9),
    sinceYear: 2013,
    substitute: { trigger: "weekend", sinceYear: 2021 },
    type: "법정공휴일",
  },
  {
    name: "성탄절",
    resolve: fixed(12, 25),
    sinceYear: 1949,
    substitute: { trigger: "weekend", sinceYear: 2023 }, // 2023-05-04 시행
    type: "법정공휴일",
  },
];

// ---------------------------------------------------------------------------
// 연도별 공휴일 계산
// ---------------------------------------------------------------------------

export function assertYearSupported(year: number): void {
  if (!Number.isInteger(year) || year < MIN_YEAR || year > MAX_YEAR) {
    throw new Error(
      `지원하지 않는 연도입니다: ${year}. ${MIN_YEAR}~${MAX_YEAR}년만 조회할 수 있습니다.`,
    );
  }
}

const yearCache = new Map<number, Holiday[]>();

function toHoliday(
  date: Date,
  name: string,
  type: HolidayType,
  substituteFor?: string,
): Holiday {
  return {
    date: toISODate(date),
    weekday: weekdayKo(date),
    name,
    type,
    ...(substituteFor ? { substituteFor } : {}),
  };
}

/** 해당 연도의 모든 공휴일 (날짜 오름차순). 근로자의 날도 포함해서 반환한다. */
export function getHolidays(year: number): Holiday[] {
  assertYearSupported(year);
  const cached = yearCache.get(year);
  if (cached) return cached;

  // 1단계: 기본 공휴일 수집
  const groups: { spec: HolidaySpec; dates: Date[] }[] = [];
  for (const spec of HOLIDAY_SPECS) {
    if (year < spec.sinceYear) continue;
    groups.push({ spec, dates: spec.resolve(year) });
  }

  const base: Holiday[] = [];
  /** 대체공휴일 계산에서 "공휴일"로 간주되는 날짜 (근로자의 날 제외) */
  const publicHolidaySet = new Set<ISODate>();

  for (const { spec, dates } of groups) {
    for (const d of dates) {
      base.push(toHoliday(d, spec.name, spec.type));
      if (spec.type !== "근로자의날") publicHolidaySet.add(toISODate(d));
    }
  }
  for (const o of overridesForYear(year)) {
    base.push(toHoliday(parseISODate(o.date), o.name, o.kind));
    publicHolidaySet.add(o.date);
  }

  // 2단계: 대체공휴일 (제3조). 기준 공휴일 날짜 순서대로 적용해야 결과가 결정적이다.
  const isBlocked = (d: Date): boolean =>
    isSunday(d) || dayOfWeek(d) === 6 || publicHolidaySet.has(toISODate(d));

  /** "그 공휴일 다음의 첫 번째 비공휴일" — 토·일과 다른 공휴일은 건너뛴다. */
  const nextFreeDay = (after: Date): Date => {
    let cursor = addDays(after, 1);
    while (isBlocked(cursor)) cursor = addDays(cursor, 1);
    return cursor;
  };

  const substitutes: Holiday[] = [];
  const sortedGroups = [...groups].sort(
    (a, b) => a.dates[0].getTime() - b.dates[0].getTime(),
  );

  for (const { spec, dates } of sortedGroups) {
    const rule = spec.substitute;
    if (!rule || year < rule.sinceYear) continue;

    let count = 0;
    if (rule.trigger === "sunday-in-group") {
      count = dates.filter(isSunday).length;
    } else if (rule.trigger === "weekend") {
      count = dates.filter((d) => isSunday(d) || dayOfWeek(d) === 6).length;
    } else {
      // 어린이날: 토요일이거나, 일요일이거나, 다른 공휴일과 겹치는 경우
      count = dates.filter((d) => {
        if (dayOfWeek(d) === 6 || isSunday(d)) return true;
        const iso = toISODate(d);
        return (
          base.filter((h) => h.date === iso && h.type !== "근로자의날").length > 1
        );
      }).length;
    }

    let anchor = dates[dates.length - 1];
    for (let i = 0; i < count; i++) {
      const sub = nextFreeDay(anchor);
      substitutes.push(
        toHoliday(sub, `${spec.name} 대체공휴일`, "대체공휴일", spec.name),
      );
      publicHolidaySet.add(toISODate(sub));
      anchor = sub;
    }
  }

  const all = [...base, ...substitutes].sort((a, b) =>
    a.date.localeCompare(b.date),
  );
  yearCache.set(year, all);
  return all;
}

// ---------------------------------------------------------------------------
// 조회 API
// ---------------------------------------------------------------------------

export interface HolidayOptions {
  /** 근로자의 날(5/1)을 휴일로 취급할지 (기본 false — 관공서 공휴일 기준) */
  includeLaborDay?: boolean;
}

/** 해당 날짜의 공휴일 목록. 같은 날 두 공휴일이 겹칠 수 있다 (예: 2025-05-05) */
export function holidaysOn(date: Date, opts: HolidayOptions = {}): Holiday[] {
  const iso = toISODate(date);
  return getHolidays(date.getUTCFullYear()).filter(
    (h) => h.date === iso && (opts.includeLaborDay || h.type !== "근로자의날"),
  );
}

export function isHoliday(date: Date, opts: HolidayOptions = {}): boolean {
  return holidaysOn(date, opts).length > 0;
}

export interface BusinessDayOptions extends HolidayOptions {
  /** 토요일을 영업일로 볼지 (기본 false) */
  saturdayIsBusinessDay?: boolean;
}

/** 영업일 = 일요일도 아니고, (기본값에서) 토요일도 아니며, 공휴일도 아닌 날 */
export function isBusinessDay(
  date: Date,
  opts: BusinessDayOptions = {},
): boolean {
  const dow = dayOfWeek(date);
  if (dow === 0) return false;
  if (dow === 6 && !opts.saturdayIsBusinessDay) return false;
  return !isHoliday(date, opts);
}

/** 기간 내 공휴일 (양 끝 포함) */
export function getHolidaysInRange(
  start: Date,
  end: Date,
  opts: HolidayOptions = {},
): Holiday[] {
  const from = toISODate(start);
  const to = toISODate(end);
  const out: Holiday[] = [];
  for (let y = start.getUTCFullYear(); y <= end.getUTCFullYear(); y++) {
    for (const h of getHolidays(y)) {
      if (!opts.includeLaborDay && h.type === "근로자의날") continue;
      if (h.date >= from && h.date <= to) out.push(h);
    }
  }
  return out;
}

export interface LongWeekend {
  start: ISODate;
  end: ISODate;
  days: number;
  /** 연휴를 구성하는 공휴일 이름들 */
  holidays: string[];
}

/** 해당 연도의 minDays일 이상 연휴 (주말 + 공휴일이 이어지는 구간) */
export function getLongWeekends(
  year: number,
  minDays = 3,
  opts: HolidayOptions = {},
): LongWeekend[] {
  assertYearSupported(year);
  const out: LongWeekend[] = [];
  const yearStart = `${year}-01-01`;

  let cursor = makeDate(year, 1, 1);
  const end = makeDate(year, 12, 31);

  while (cursor.getTime() <= end.getTime()) {
    if (isBusinessDay(cursor, opts)) {
      cursor = addDays(cursor, 1);
      continue;
    }
    // 쉬는 날 구간의 시작점을 뒤로 확장 (연도 경계를 넘지 않는 선에서)
    let s = cursor;
    while (
      addDays(s, -1).getUTCFullYear() >= MIN_YEAR &&
      !isBusinessDay(addDays(s, -1), opts)
    ) {
      s = addDays(s, -1);
    }
    let e = cursor;
    while (
      addDays(e, 1).getUTCFullYear() <= MAX_YEAR &&
      !isBusinessDay(addDays(e, 1), opts)
    ) {
      e = addDays(e, 1);
    }
    const days = diffDays(s, e) + 1;
    const names = getHolidaysInRange(s, e, opts).map((h) => h.name);
    // 시작이 전년도인 연휴는 그 해 목록에서 제외 (중복 방지)
    if (days >= minDays && names.length > 0 && toISODate(s) >= yearStart) {
      out.push({
        start: toISODate(s),
        end: toISODate(e),
        days,
        holidays: [...new Set(names)],
      });
    }
    cursor = addDays(e, 1);
  }
  return out;
}
