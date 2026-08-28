/**
 * 규칙 엔진 검증 스크립트.
 *
 * 공개된 공식 공휴일 목록(2024~2027년)과 엔진이 계산한 결과를 대조한다.
 * 규칙을 고칠 때마다 `npm run verify`로 회귀를 잡는다.
 *
 * 기대값 출처: publicholidays.co.kr, 인사혁신처 보도자료, 한국천문연구원 월력요항
 */

import {
  addDays,
  makeDate,
  parseISODate,
  toISODate,
} from "../lib/date";
import {
  getHolidays,
  getLongWeekends,
  isBusinessDay,
  type Holiday,
} from "../lib/holidays";

/** 연도별 기대 공휴일 (근로자의 날 제외, 날짜만 비교) */
const EXPECTED: Record<number, string[]> = {
  2024: [
    "2024-01-01", // 신정
    "2024-02-09", "2024-02-10", "2024-02-11", "2024-02-12", // 설날 + 대체
    "2024-03-01", // 삼일절
    "2024-04-10", // 국회의원선거
    "2024-05-05", "2024-05-06", // 어린이날(일) + 대체
    "2024-05-15", // 부처님오신날
    "2024-06-06", // 현충일
    "2024-08-15", // 광복절
    "2024-09-16", "2024-09-17", "2024-09-18", // 추석
    "2024-10-01", // 임시공휴일 (국군의 날)
    "2024-10-03", // 개천절
    "2024-10-09", // 한글날
    "2024-12-25", // 성탄절
  ],
  2025: [
    "2025-01-01",
    "2025-01-27", // 임시공휴일
    "2025-01-28", "2025-01-29", "2025-01-30", // 설날
    "2025-03-01", // 삼일절(토)
    "2025-03-03", // 삼일절 대체
    "2025-05-05", // 어린이날 = 부처님오신날
    "2025-05-06", // 대체
    "2025-06-03", // 대통령선거
    "2025-06-06", // 현충일
    "2025-08-15", // 광복절
    "2025-10-03", // 개천절
    "2025-10-05", "2025-10-06", "2025-10-07", // 추석
    "2025-10-08", // 추석 대체
    "2025-10-09", // 한글날
    "2025-12-25",
  ],
  2026: [
    "2026-01-01",
    "2026-02-16", "2026-02-17", "2026-02-18", // 설날
    "2026-03-01", "2026-03-02", // 삼일절(일) + 대체
    "2026-05-05", // 어린이날(화)
    "2026-05-24", "2026-05-25", // 부처님오신날(일) + 대체
    "2026-06-03", // 지방선거
    "2026-06-06", // 현충일(토) — 대체 없음
    "2026-07-17", // 제헌절 (2026년 재지정)
    "2026-08-15", "2026-08-17", // 광복절(토) + 대체
    "2026-09-24", "2026-09-25", "2026-09-26", // 추석
    "2026-10-03", "2026-10-05", // 개천절(토) + 대체
    "2026-10-09", // 한글날
    "2026-12-25",
  ],
  2027: [
    "2027-01-01",
    "2027-02-06", "2027-02-07", "2027-02-08", // 설날(일요일 포함)
    "2027-02-09", // 설날 대체
    "2027-03-01", // 삼일절(월)
    "2027-05-05", // 어린이날(수)
    "2027-05-13", // 부처님오신날(목)
    "2027-06-06", // 현충일(일) — 대체 없음
    "2027-07-17", "2027-07-19", // 제헌절(토) + 대체
    "2027-08-15", "2027-08-16", // 광복절(일) + 대체
    "2027-09-14", "2027-09-15", "2027-09-16", // 추석
    "2027-10-03", "2027-10-04", // 개천절(일) + 대체
    "2027-10-09", "2027-10-11", // 한글날(토) + 대체
    "2027-12-25", "2027-12-27", // 성탄절(토) + 대체
  ],
};

let failures = 0;

function fail(msg: string) {
  failures++;
  console.error(`  ✗ ${msg}`);
}

function describe(hs: Holiday[]): string {
  return hs.map((h) => `${h.date} ${h.name}`).join("\n    ");
}

console.log("한국 공휴일 규칙 엔진 검증\n");

for (const [yearStr, expected] of Object.entries(EXPECTED)) {
  const year = Number(yearStr);
  const actual = getHolidays(year).filter((h) => h.type !== "근로자의날");
  const actualDates = [...new Set(actual.map((h) => h.date))].sort();
  const expectedSorted = [...expected].sort();

  const missing = expectedSorted.filter((d) => !actualDates.includes(d));
  const extra = actualDates.filter((d) => !expectedSorted.includes(d));

  if (missing.length === 0 && extra.length === 0) {
    console.log(`${year}년: ✓ 공휴일 ${actualDates.length}일 일치`);
  } else {
    console.log(`${year}년: 불일치`);
    if (missing.length) fail(`누락: ${missing.join(", ")}`);
    if (extra.length) fail(`초과: ${extra.join(", ")}`);
    console.error(`    계산 결과:\n    ${describe(actual)}`);
  }
}

// --- 영업일 계산 스팟 체크 -------------------------------------------------

console.log("\n영업일 판정");
const businessDayCases: [string, boolean, string][] = [
  ["2026-02-17", false, "설날 당일"],
  ["2026-02-19", true, "설 연휴 다음 목요일"],
  ["2026-06-06", false, "현충일(토)"],
  ["2026-06-08", true, "현충일 다음 월요일 (대체공휴일 없음)"],
  ["2027-06-07", true, "2027 현충일(일) 다음 월요일 — 대체공휴일 아님"],
  ["2026-05-01", true, "근로자의 날 (기본값에서는 영업일)"],
  ["2026-10-05", false, "개천절 대체공휴일"],
];
for (const [date, expected, label] of businessDayCases) {
  const got = isBusinessDay(parseISODate(date));
  if (got === expected) {
    console.log(`  ✓ ${date} ${label} → ${got ? "영업일" : "휴일"}`);
  } else {
    fail(`${date} ${label}: 기대 ${expected}, 실제 ${got}`);
  }
}

// 근로자의 날 옵션
if (isBusinessDay(parseISODate("2026-05-01"), { includeLaborDay: true })) {
  fail("includeLaborDay=true 일 때 2026-05-01은 휴일이어야 합니다");
} else {
  console.log("  ✓ 2026-05-01 근로자의 날 (includeLaborDay=true) → 휴일");
}

// --- 연휴 탐지 -------------------------------------------------------------

console.log("\n2026년 3일 이상 연휴");
for (const lw of getLongWeekends(2026)) {
  console.log(`  ${lw.start} ~ ${lw.end} (${lw.days}일) — ${lw.holidays.join(", ")}`);
}

// --- 타임존 안전성 ---------------------------------------------------------

console.log("\n타임존 안전성");
const d = makeDate(2026, 2, 17);
if (toISODate(d) !== "2026-02-17" || toISODate(addDays(d, 1)) !== "2026-02-18") {
  fail("날짜 왕복 변환이 깨졌습니다");
} else {
  console.log(`  ✓ TZ=${process.env.TZ ?? "(시스템 기본값)"} 에서 날짜 변환 정상`);
}

console.log(
  failures === 0
    ? "\n전체 통과 ✓"
    : `\n실패 ${failures}건 ✗`,
);
process.exit(failures === 0 ? 0 : 1);
