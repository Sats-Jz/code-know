import { NextRequest, NextResponse } from "next/server";

// 根据 NEXT_PUBLIC_BACKEND 配置自动切换后端
// spring → 代理到 localhost:8080
// node   → 使用内置 API Routes
export function middleware(request: NextRequest) {
  const backend = process.env.NEXT_PUBLIC_BACKEND || "spring";

  if (backend === "node") {
    return NextResponse.next(); // 走内置 API Routes
  }

  // Spring 模式：代理到 localhost:8080
  const url = request.nextUrl.clone();
  url.host = "localhost";
  url.port = "8080";
  return NextResponse.rewrite(url);
}

// 只拦截 /api/* 请求
export const config = {
  matcher: "/api/:path*",
};
