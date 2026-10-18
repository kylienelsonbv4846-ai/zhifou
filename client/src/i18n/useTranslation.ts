import { zhCN } from "./zh-CN";

/**
 * Hook for accessing translations
 * Currently only supports Chinese (Simplified)
 */
export function useTranslation() {
  return zhCN;
}

/**
 * Get nested translation value by key path
 * Example: t("common.loading") -> "加载中..."
 */
export function getTranslation(keyPath: string): string {
  const keys = keyPath.split(".");
  let value: any = zhCN;

  for (const key of keys) {
    if (value && typeof value === "object" && key in value) {
      value = value[key];
    } else {
      return keyPath; // Return key path if translation not found
    }
  }

  return typeof value === "string" ? value : keyPath;
}
