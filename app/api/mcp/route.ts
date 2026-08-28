/**
 * 한국 공휴일 MCP 서버 (Streamable HTTP).
 *
 * Claude 커스텀 커넥터에 이 라우트의 절대 URL을 등록하면 바로 쓸 수 있다.
 *   https://<배포도메인>/api/mcp
 *
 * 인증 없는 공개 서버다. 개인정보를 받지 않고, 순수 날짜 계산만 한다.
 */

import { createMcpHandler } from "mcp-handler";
import { z } from "zod";

import { addDays, diffDays, formatKo, parseISODate, todayKST, toISODate } from "@/lib/date";
import { holidayListText, longWeekendLine } from "@/lib/format";
import {
  assertYearSupported,
  getHolidays,
  getHolidaysInRange,
  getLongWeekends,
  holidaysOn,
  isBusinessDay,
  MAX_YEAR,
  MIN_YEAR,
} from "@/lib/holidays";

/** 공휴일 계산은 CPU 작업뿐이라 오래 걸리지 않지만, 콜드스타트 여유를 둔다. */
export const maxDuration = 30;

const dateArg = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD 형식이어야 합니다");

const laborDayArg = z
  .boolean()
  .default(false)
  .describe("근로자의 날(5월 1일)을 휴일로 계산할지. 관공서 기준이면 false, 일반 사기업 기준이면 true");

const saturdayArg = z
  .boolean()
  .default(false)
  .describe("토요일을 영업일로 계산할지. 주5일제 기준이면 false");

function text(body: string) {
  return { content: [{ type: "text" as const, text: body }] };
}

const handler = createMcpHandler((server) => {
  // -------------------------------------------------------------------------
  server.registerTool(
    "check_holiday",
    {
      title: "공휴일 여부 확인",
      description:
        "특정 날짜가 한국 공휴일인지, 영업일인지 확인한다. 요일과 공휴일 이름도 함께 알려준다. 날짜를 생략하면 한국 시각 기준 오늘을 본다.",
      inputSchema: z.object({
        date: dateArg.optional().describe("확인할 날짜 (YYYY-MM-DD). 생략하면 오늘(KST)"),
        includeLaborDay: laborDayArg,
      }),
    },
    async ({ date, includeLaborDay }) => {
      const d = date ? parseISODate(date) : todayKST();
      const hits = holidaysOn(d, { includeLaborDay });
      const business = isBusinessDay(d, { includeLaborDay });

      const lines = [`${formatKo(d)}`];
      if (hits.length > 0) {
        lines.push(`공휴일입니다: ${hits.map((h) => h.name).join(", ")}`);
        for (const h of hits) {
          if (h.substituteFor) lines.push(`  · ${h.name} — ${h.substituteFor}이 주말과 겹쳐 지정된 대체공휴일`);
        }
      } else {
        lines.push("공휴일이 아닙니다.");
      }
      lines.push(business ? "영업일입니다 (주5일제 기준)." : "영업일이 아닙니다 (주말 또는 공휴일).");
      return text(lines.join("\n"));
    },
  );

  // -------------------------------------------------------------------------
  server.registerTool(
    "list_holidays",
    {
      title: "연도별 공휴일 목록",
      description: `특정 연도(또는 특정 월)의 한국 공휴일 전체 목록을 반환한다. 대체공휴일, 임시공휴일, 선거일을 모두 포함한다. 조회 가능 범위는 ${MIN_YEAR}~${MAX_YEAR}년.`,
      inputSchema: z.object({
        year: z.number().int().describe(`연도 (${MIN_YEAR}~${MAX_YEAR})`),
        month: z
          .number()
          .int()
          .min(1)
          .max(12)
          .optional()
          .describe("특정 월만 볼 때 지정 (1~12). 생략하면 1년 전체"),
        includeLaborDay: laborDayArg,
      }),
    },
    async ({ year, month, includeLaborDay }) => {
      assertYearSupported(year);
      let holidays = getHolidays(year);
      if (!includeLaborDay) holidays = holidays.filter((h) => h.type !== "근로자의날");
      if (month) {
        const prefix = `${year}-${String(month).padStart(2, "0")}-`;
        holidays = holidays.filter((h) => h.date.startsWith(prefix));
      }
      const scope = month ? `${year}년 ${month}월` : `${year}년`;
      return text(
        `${scope} 한국 공휴일 (총 ${holidays.length}일)\n\n${holidayListText(holidays)}`,
      );
    },
  );

  // -------------------------------------------------------------------------
  server.registerTool(
    "next_holidays",
    {
      title: "다음 공휴일 조회",
      description:
        "기준일 이후로 다가오는 공휴일을 순서대로 알려준다. 각 공휴일까지 며칠 남았는지도 함께 계산한다. \"다음 공휴일 언제야?\" 같은 질문에 쓴다.",
      inputSchema: z.object({
        from: dateArg.optional().describe("기준일 (YYYY-MM-DD). 생략하면 오늘(KST)"),
        count: z.number().int().min(1).max(20).default(3).describe("몇 개까지 볼지 (1~20)"),
        includeLaborDay: laborDayArg,
      }),
    },
    async ({ from, count, includeLaborDay }) => {
      const base = from ? parseISODate(from) : todayKST();
      const baseIso = toISODate(base);
      const endYear = Math.min(base.getUTCFullYear() + 2, MAX_YEAR);
      const upcoming = getHolidaysInRange(
        addDays(base, 1),
        parseISODate(`${endYear}-12-31`),
        { includeLaborDay },
      ).slice(0, count);

      if (upcoming.length === 0) {
        return text(`${formatKo(base)} 이후 ${MAX_YEAR}년까지 남은 공휴일 데이터가 없습니다.`);
      }
      const lines = upcoming.map((h) => {
        const days = diffDays(base, parseISODate(h.date));
        return `- ${h.date} (${h.weekday}) ${h.name} — D+${days}`;
      });
      return text(`기준일 ${baseIso} 이후 다가오는 공휴일\n\n${lines.join("\n")}`);
    },
  );

  // -------------------------------------------------------------------------
  server.registerTool(
    "count_business_days",
    {
      title: "영업일 수 계산",
      description:
        "두 날짜 사이의 영업일 수를 센다 (주말과 공휴일 제외, 시작일과 종료일 포함). 마감일까지 실제 며칠 일할 수 있는지 계산할 때 쓴다.",
      inputSchema: z.object({
        start: dateArg.describe("시작일 (포함)"),
        end: dateArg.describe("종료일 (포함)"),
        saturdayIsBusinessDay: saturdayArg,
        includeLaborDay: laborDayArg,
      }),
    },
    async ({ start, end, saturdayIsBusinessDay, includeLaborDay }) => {
      const s = parseISODate(start);
      const e = parseISODate(end);
      if (s.getTime() > e.getTime()) {
        throw new Error(`시작일(${start})이 종료일(${end})보다 늦습니다.`);
      }
      const total = diffDays(s, e) + 1;
      if (total > 3660) {
        throw new Error("한 번에 조회할 수 있는 기간은 최대 10년입니다.");
      }
      const opts = { saturdayIsBusinessDay, includeLaborDay };
      let business = 0;
      for (let d = s; d.getTime() <= e.getTime(); d = addDays(d, 1)) {
        if (isBusinessDay(d, opts)) business++;
      }
      const holidays = getHolidaysInRange(s, e, { includeLaborDay });
      return text(
        [
          `${start} ~ ${end}`,
          `전체 ${total}일 중 영업일 ${business}일, 휴일 ${total - business}일`,
          `(토요일은 ${saturdayIsBusinessDay ? "영업일로" : "휴일로"} 계산)`,
          "",
          `기간 내 공휴일 ${holidays.length}일`,
          holidayListText(holidays),
        ].join("\n"),
      );
    },
  );

  // -------------------------------------------------------------------------
  server.registerTool(
    "add_business_days",
    {
      title: "영업일 더하기",
      description:
        "기준일에서 영업일 N일 뒤(또는 앞)의 날짜를 구한다. 주말과 공휴일은 건너뛴다. \"3영업일 내 처리\", \"5영업일 후 마감\" 같은 날짜를 계산할 때 쓴다. days에 음수를 넣으면 과거로 센다.",
      inputSchema: z.object({
        from: dateArg.describe("기준일 (YYYY-MM-DD). 이 날짜 자체는 세지 않는다"),
        days: z
          .number()
          .int()
          .refine((n) => n !== 0, "0이 아닌 값이어야 합니다")
          .describe("더할 영업일 수. 음수면 과거 방향"),
        saturdayIsBusinessDay: saturdayArg,
        includeLaborDay: laborDayArg,
      }),
    },
    async ({ from, days, saturdayIsBusinessDay, includeLaborDay }) => {
      if (Math.abs(days) > 2000) {
        throw new Error("한 번에 계산할 수 있는 영업일은 최대 2000일입니다.");
      }
      const opts = { saturdayIsBusinessDay, includeLaborDay };
      const step = days > 0 ? 1 : -1;
      let remaining = Math.abs(days);
      let cursor = parseISODate(from);
      const skipped: string[] = [];

      while (remaining > 0) {
        cursor = addDays(cursor, step);
        if (isBusinessDay(cursor, opts)) {
          remaining--;
        } else {
          const hits = holidaysOn(cursor, { includeLaborDay });
          if (hits.length > 0) skipped.push(`${toISODate(cursor)} ${hits[0].name}`);
        }
      }
      const lines = [
        `${from} 기준 ${days > 0 ? `${days}영업일 후` : `${-days}영업일 전`} → ${formatKo(cursor)}`,
      ];
      if (skipped.length > 0) {
        lines.push("", `건너뛴 공휴일 ${skipped.length}일:`, ...skipped.map((s) => `- ${s}`));
      }
      return text(lines.join("\n"));
    },
  );

  // -------------------------------------------------------------------------
  server.registerTool(
    "list_long_weekends",
    {
      title: "연휴 목록",
      description:
        "특정 연도의 연휴(주말과 공휴일이 이어져 쉬는 구간)를 길이와 함께 알려준다. 여행 계획이나 휴가 설계에 쓴다.",
      inputSchema: z.object({
        year: z.number().int().describe(`연도 (${MIN_YEAR}~${MAX_YEAR})`),
        minDays: z
          .number()
          .int()
          .min(2)
          .max(10)
          .default(3)
          .describe("최소 연휴 길이 (기본 3일)"),
        includeLaborDay: laborDayArg,
      }),
    },
    async ({ year, minDays, includeLaborDay }) => {
      assertYearSupported(year);
      const weekends = getLongWeekends(year, minDays, { includeLaborDay });
      if (weekends.length === 0) {
        return text(`${year}년에는 ${minDays}일 이상 연휴가 없습니다.`);
      }
      const longest = weekends.reduce((a, b) => (b.days > a.days ? b : a));
      return text(
        [
          `${year}년 ${minDays}일 이상 연휴 (총 ${weekends.length}회)`,
          "",
          ...weekends.map(longWeekendLine),
          "",
          `가장 긴 연휴: ${longest.start} ~ ${longest.end} (${longest.days}일)`,
        ].join("\n"),
      );
    },
  );
});

export { handler as GET, handler as POST };
