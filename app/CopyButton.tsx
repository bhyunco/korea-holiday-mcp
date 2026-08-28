"use client";

import { useRef, useState } from "react";

type State = "idle" | "copied" | "manual";

const LABEL: Record<State, string> = {
  idle: "URL 복사",
  copied: "복사됨",
  manual: "Ctrl+C 로 복사",
};

/**
 * 커넥터 URL 표시 + 복사.
 *
 * 클립보드 API는 권한이 거부되는 환경(임베드된 브라우저, 일부 모바일 앱 내 웹뷰)이
 * 있어서 3단계로 폴백한다: Clipboard API → execCommand → URL 텍스트 자동 선택.
 * 마지막 단계까지 가면 사용자가 직접 Ctrl+C 하면 되도록 안내 문구를 바꾼다.
 */
export default function CopyButton({ value }: { value: string }) {
  const [state, setState] = useState<State>("idle");
  const codeRef = useRef<HTMLElement>(null);

  function flash(next: State) {
    setState(next);
    setTimeout(() => setState("idle"), 2500);
  }

  function selectUrlText(): boolean {
    const el = codeRef.current;
    const selection = window.getSelection();
    if (!el || !selection) return false;
    const range = document.createRange();
    range.selectNodeContents(el);
    selection.removeAllRanges();
    selection.addRange(range);
    return true;
  }

  function copyViaExecCommand(): boolean {
    if (!selectUrlText()) return false;
    try {
      return document.execCommand("copy");
    } catch {
      return false;
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      flash("copied");
      return;
    } catch {
      // 클립보드 권한 거부 — 아래 폴백으로 넘어간다.
    }
    if (copyViaExecCommand()) {
      flash("copied");
      return;
    }
    selectUrlText();
    flash("manual");
  }

  return (
    <div className="url-row">
      <code ref={codeRef}>{value}</code>
      <button
        className="copy"
        data-state={state}
        onClick={copy}
        type="button"
        aria-live="polite"
      >
        {LABEL[state]}
      </button>
    </div>
  );
}
