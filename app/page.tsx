import { headers } from "next/headers";

import CopyButton from "./CopyButton";
import { addDays, diffDays, formatKo, parseISODate, todayKST } from "@/lib/date";
import {
  getHolidaysInRange,
  getLongWeekends,
  MAX_YEAR,
  MIN_YEAR,
} from "@/lib/holidays";

const GITHUB_URL = "https://github.com/bhyunco/korea-holiday-mcp";

const TOOLS: { name: string; summary: string; example: string }[] = [
  {
    name: "check_holiday",
    summary: "특정 날짜가 공휴일·영업일인지 확인",
    example: "2026년 2월 17일 쉬는 날이야?",
  },
  {
    name: "list_holidays",
    summary: "연도·월별 공휴일 전체 목록",
    example: "2027년 공휴일 다 알려줘",
  },
  {
    name: "next_holidays",
    summary: "다가오는 공휴일과 남은 일수",
    example: "다음 공휴일 언제야?",
  },
  {
    name: "count_business_days",
    summary: "두 날짜 사이 영업일 수",
    example: "9월 1일부터 10월 15일까지 영업일 며칠?",
  },
  {
    name: "add_business_days",
    summary: "기준일 + N영업일 날짜 계산",
    example: "오늘부터 7영업일 뒤가 며칠이야?",
  },
  {
    name: "list_long_weekends",
    summary: "연휴 구간과 길이",
    example: "2027년 3일 이상 연휴 정리해줘",
  },
];

async function resolveBaseUrl(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export default async function Home() {
  const baseUrl = await resolveBaseUrl();
  const mcpUrl = `${baseUrl}/api/mcp`;

  // 페이지 자체가 규칙 엔진을 그대로 쓴다 — 아래 숫자는 실제 계산 결과다.
  const today = todayKST();
  const horizon = parseISODate(`${Math.min(today.getUTCFullYear() + 1, MAX_YEAR)}-12-31`);
  const upcoming = getHolidaysInRange(addDays(today, 1), horizon).slice(0, 3);
  const thisYearLongWeekends = getLongWeekends(today.getUTCFullYear()).length;

  return (
    <div className="wrap">
      <header className="hero">
        <p className="eyebrow">Claude 커스텀 커넥터 · MCP</p>
        <h1>한국 공휴일 MCP</h1>
        <p className="lede">
          Claude에 URL 하나만 등록하면 음력 명절, 대체공휴일, 영업일 계산을 정확하게
          답합니다. 설치도, 로그인도, API 키도 필요 없습니다.
        </p>

        <div className="url-card">
          <div className="label">커넥터 URL</div>
          <div className="url-row">
            <code>{mcpUrl}</code>
            <CopyButton value={mcpUrl} />
          </div>
        </div>
      </header>

      <section>
        <h2>왜 필요한가</h2>
        <p>
          LLM은 날짜 산수에 약합니다. 특히 한국 공휴일은{" "}
          <strong>음력 기반 명절</strong>(설날·추석·부처님오신날)과{" "}
          <strong>대체공휴일 규칙</strong>이 얽혀 있어서, 모델이 그럴듯한 오답을 내기
          쉽습니다. 실제로 자주 틀리는 지점들:
        </p>
        <ul className="plain">
          <li>
            <strong>현충일은 대체공휴일이 없습니다.</strong> 2027년 6월 6일은
            일요일이지만 6월 7일은 정상 근무일입니다 — 현충일은 국경일이 아니라서 제3조
            적용 대상이 아닙니다.
          </li>
          <li>
            <strong>설날·추석은 일요일과 겹칠 때만</strong> 대체공휴일이 생깁니다.
            토요일과 겹쳐도 늘어나지 않습니다.
          </li>
          <li>
            <strong>제헌절이 2026년부터 다시 공휴일</strong>입니다. 2008년 제외 후 18년
            만의 복귀라 학습 데이터에 거의 없습니다.
          </li>
        </ul>
        <p>
          이 커넥터는 「관공서의 공휴일에 관한 규정」을 코드로 구현해서, 매번 결정적으로
          같은 답을 냅니다.
        </p>

        <div className="note">
          <p className="small muted" style={{ marginBottom: 8 }}>
            지금 이 페이지가 커넥터와 같은 엔진으로 계산한 값
          </p>
          <p style={{ marginBottom: 8 }}>
            오늘은 {formatKo(today)}입니다. 다가오는 공휴일:
          </p>
          <ul className="plain small" style={{ marginBottom: 8 }}>
            {upcoming.map((h) => (
              <li key={`${h.date}-${h.name}`}>
                {h.date} ({h.weekday}) {h.name} — D+
                {diffDays(today, parseISODate(h.date))}
              </li>
            ))}
          </ul>
          <p className="small muted">
            {today.getUTCFullYear()}년에는 3일 이상 연휴가 {thisYearLongWeekends}회
            있습니다.
          </p>
        </div>
      </section>

      <section>
        <h2>연결 방법</h2>

        <h3>Claude 웹 · 데스크톱 앱</h3>
        <ol className="steps">
          <li>
            <strong>설정 → 커넥터</strong>로 이동합니다.
          </li>
          <li>
            <strong>커스텀 커넥터 추가</strong>를 누릅니다.
          </li>
          <li>
            이름에 <code>한국 공휴일</code>, URL에 위 커넥터 URL을 붙여넣습니다.
          </li>
          <li>추가한 뒤 대화창의 도구 메뉴에서 켜면 끝입니다.</li>
        </ol>
        <p className="small muted">
          인증이 없는 공개 서버라 로그인 단계는 나오지 않습니다. 조직 관리자가 배포하는
          경우에는 OAuth를 기대하는 화면이 나올 수 있으니, 개인 커넥터로 추가하세요.
        </p>

        <h3>Claude Code</h3>
        <pre>
          <code>{`claude mcp add --transport http korea-holiday ${mcpUrl}`}</code>
        </pre>

        <h3>직접 설정 파일을 쓸 때</h3>
        <pre>
          <code>{JSON.stringify(
            {
              mcpServers: {
                "korea-holiday": { type: "http", url: mcpUrl },
              },
            },
            null,
            2,
          )}</code>
        </pre>
      </section>

      <section>
        <h2>도구 6개</h2>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>도구</th>
                <th>하는 일</th>
              </tr>
            </thead>
            <tbody>
              {TOOLS.map((t) => (
                <tr key={t.name}>
                  <td>
                    <code>{t.name}</code>
                  </td>
                  <td>{t.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2>이렇게 물어보세요</h2>
        <ul className="quotes">
          {TOOLS.map((t) => (
            <li key={t.name}>{t.example}</li>
          ))}
        </ul>
      </section>

      <section>
        <h2>데이터 근거와 한계</h2>
        <ul className="plain">
          <li>
            <strong>근거 법령</strong>: 「관공서의 공휴일에 관한 규정」 제2조(공휴일)·
            제3조(대체공휴일). 음력 환산은{" "}
            <code>korean-lunar-calendar</code> 라이브러리를 씁니다.
          </li>
          <li>
            <strong>조회 범위</strong>: {MIN_YEAR}~{MAX_YEAR}년. 음력 데이터가{" "}
            {MAX_YEAR}년까지만 있어서 그 이후는 계산하지 않고 오류를 냅니다.
          </li>
          <li>
            <strong>임시공휴일·선거일</strong>은 규칙으로 예측할 수 없어 확정·공포된
            것만 수동 등재합니다. 새로 지정되면 저장소에 한 줄 추가하면 됩니다.
          </li>
          <li>
            <strong>근로자의 날(5월 1일)</strong>은 관공서 공휴일이 아니라 기본값에서는
            영업일로 계산합니다. 사기업 기준이 필요하면 Claude에게 &ldquo;근로자의 날도
            휴일로 계산해줘&rdquo;라고 말하면 됩니다.
          </li>
          <li>
            회사별 창립기념일, 업종별 휴무는 포함하지 않습니다.
          </li>
        </ul>
        <p className="small muted">
          중요한 의사결정에는 관보나 인사혁신처 공고로 한 번 더 확인하세요. 계산 결과에
          이상이 있으면{" "}
          <a href={`${GITHUB_URL}/issues`}>이슈로 알려주시면</a> 고칩니다.
        </p>
      </section>

      <footer>
        <p>
          오픈소스 · <a href={GITHUB_URL}>GitHub</a> · 만든 사람{" "}
          <a href="https://vibecodingschool.co.kr">바이브코딩스쿨</a>
        </p>
        <p className="small">
          개인정보를 수집하지 않습니다. 서버는 날짜 문자열만 받아 계산 결과를 돌려줍니다.
        </p>
      </footer>
    </div>
  );
}
