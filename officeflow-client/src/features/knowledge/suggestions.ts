import type { SuggestKnowledgeArticlesInput } from "./types";

// The suggestion API accepts less text than the ticket form. Keep the draft intact.
export function prepareKnowledgeSuggestionInput(
  input: SuggestKnowledgeArticlesInput,
): SuggestKnowledgeArticlesInput | null {
  const description = input.description?.trim() ?? "";
  const title = input.title.trim();
  const searchTitle =
    title.length >= 3 ? title : `${title} ${description}`.trim();
  if (searchTitle.length < 3) return null;
  return {
    title: searchTitle.slice(0, 150),
    description: description.slice(0, 5000),
  };
}
