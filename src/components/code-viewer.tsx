"use client";

import { useEffect, useState } from "react";

export function CodeViewer({ content, language }: { content: string; language: string }) {
  const [html, setHtml] = useState("");

  useEffect(() => {
    let cancelled = false;
    import("shiki").then(({ codeToHtml }) => {
      if (!cancelled) codeToHtml(content, { lang: language, theme: "github-dark" }).then(setHtml);
    });
    return () => { cancelled = true; };
  }, [content, language]);

  return <div dangerouslySetInnerHTML={{ __html: html }} className="text-sm leading-relaxed overflow-auto" />;
}
