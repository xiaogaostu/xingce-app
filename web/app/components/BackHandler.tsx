"use client";

/**
 * 行测题库 · 作者 xiaogaostu
 * © 2026 xiaogaostu. All Rights Reserved.
 *
 * 返回键导航守卫
 * Next 客户端路由不产生 WebView 历史（canGoBack 恒 false），因此自己维护一份导航栈：
 *   - 首页 "/"                     → 返回 false，交给原生走「再按一次退出」
 *   - 其他页面                     → 回到栈里的上一页；没有上一页则回首页
 *   - 页面注册 __xcPageBack 时优先执行（如做题页弹「还没做完哦」）
 */
import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

const KEY = "xcNavStack";
/** 一级 Tab 页：返回统一回首页 */
const TAB_ROOTS = ["/practice", "/exam", "/wrong", "/me"];
const MAX = 30;

function norm(p: string): string {
  const s = (p || "/").split("?")[0].split("#")[0];
  return s.length > 1 ? s.replace(/\/+$/, "") : s || "/";
}
function readStack(): string[] {
  try {
    const raw = sessionStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : [];
  } catch { return []; }
}
function writeStack(s: string[]): void {
  try { sessionStorage.setItem(KEY, JSON.stringify(s.slice(-MAX))); } catch { /* 忽略 */ }
}

export default function BackHandler() {
  const router = useRouter();
  const pathname = usePathname() || "/";
  const pathRef = useRef(norm(pathname));

  // 记录导航栈：push 入栈；replace（如底部 Tab 切换）替换栈顶，不新增层级
  useEffect(() => {
    const p = norm(pathname);
    pathRef.current = p;

    // Tab 切换等 replace 导航会先写这个标记，消费一次即清除
    const w = window as unknown as { __xcNavMode?: "push" | "replace" };
    const mode = w.__xcNavMode;
    delete w.__xcNavMode;

    const s = readStack();
    const idx = s.lastIndexOf(p);
    if (idx >= 0) {
      // 回到栈里已有的页面：截断到该位置
      writeStack(s.slice(0, idx + 1));
      return;
    }
    // 栈底永远保留首页，保证任何页面都能退回首页
    if (s.length === 0) s.push("/");
    if (s[s.length - 1] === p) return;
    if (mode === "replace" && s.length > 1) {
      // replace（Tab 切换）：替换当前层级，不新增一层
      s[s.length - 1] = p;
      writeStack(s);
      return;
    }
    s.push(p);
    writeStack(s);
  }, [pathname]);

  useEffect(() => {
    (window as unknown as { __xcBack?: () => boolean }).__xcBack = () => {
      // 1) 页面自定义拦截（做题页确认框）
      const pageBack = (window as unknown as { __xcPageBack?: () => boolean }).__xcPageBack;
      if (typeof pageBack === "function") {
        try { if (pageBack()) return true; } catch { /* 忽略 */ }
      }

      const cur = pathRef.current;
      // 2) 首页：交给原生退出逻辑
      if (cur === "/") return false;

      // 2.5) 一级 Tab 页（专练/模考/错题/我的）：返回一律回首页
      //      不依赖历史栈，避免退到别的 Tab（如从 /wrong 退到 /exam）
      if (TAB_ROOTS.includes(cur)) {
        writeStack(["/"]);
        router.replace("/");
        return true;
      }

      // 3) 回导航栈的上一页
      let s = readStack();
      if (s[s.length - 1] !== cur) s.push(cur);
      if (s.length >= 2) {
        s.pop();
        const prev = s[s.length - 1];
        writeStack(s);
        router.push(prev);
        return true;
      }

      // 4) 没有上一页 → 回首页
      writeStack([cur]);
      router.replace("/");
      return true;
    };
    return () => { delete (window as unknown as { __xcBack?: () => boolean }).__xcBack; };
  }, [router]);

  return null;
}
