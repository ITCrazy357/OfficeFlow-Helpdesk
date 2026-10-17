"use client";

import { useSyncExternalStore } from "react";

const key = "officeflow-theme";
const event = "officeflow-theme-change";

function subscribe(notify: () => void) {
  const system = window.matchMedia("(prefers-color-scheme: dark)");
  const update = () => {
    let saved: string | null = null;
    try { saved = localStorage.getItem(key); } catch { /* Storage may be blocked. */ }
    document.documentElement.classList.toggle(
      "dark", saved === "dark" || (saved !== "light" && system.matches),
    );
    notify();
  };
  window.addEventListener(event, notify);
  window.addEventListener("storage", update);
  system.addEventListener("change", update);
  update();
  return () => {
    window.removeEventListener(event, notify);
    window.removeEventListener("storage", update);
    system.removeEventListener("change", update);
  };
}

export function ThemeToggle() {
  const dark = useSyncExternalStore(
    subscribe,
    () => document.documentElement.classList.contains("dark"),
    () => false,
  );

  return (
    <button
      type="button"
      role="switch"
      aria-label="Giao diện tối"
      aria-checked={dark}
      title={dark ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối"}
      className="theme-switch shrink-0"
      onClick={() => {
        const next = !dark;
        document.documentElement.classList.toggle("dark", next);
        try { localStorage.setItem(key, next ? "dark" : "light"); } catch { /* Keep the in-memory choice. */ }
        window.dispatchEvent(new Event(event));
      }}
    >
      <span className="theme-switch-track" aria-hidden="true"><span /></span>
    </button>
  );
}
