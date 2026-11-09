export function formatDateTime(value?: string | null) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
export function parseTags(tags?: string | null) {
  return (
    tags
      ?.split(",")
      .map((tag) => tag.trim())
      .filter(Boolean) ?? []
  );
}
