"use client";

import { useState } from "react";

export default function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // 클립보드 권한이 없는 환경 — 사용자가 직접 선택해서 복사하면 된다.
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <button className="copy" data-copied={copied} onClick={copy} type="button">
      {copied ? "복사됨" : "URL 복사"}
    </button>
  );
}
