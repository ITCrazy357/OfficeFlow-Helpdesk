import assert from "node:assert/strict";
import { test } from "node:test";
import { createSourceLoader } from "./helpers/source-loader.mjs";

test("clearing knowledge summary and tags survives JSON serialization", () => {
  const { toKnowledgeArticlePayload } = createSourceLoader()(
    "features/knowledge/schemas.ts",
  );
  const payload = JSON.parse(
    JSON.stringify(
      toKnowledgeArticlePayload({
        title: "VPN guide",
        content: "A detailed VPN setup guide",
        summary: " ",
        tags: " , ",
        isPublished: false,
      }),
    ),
  );
  assert.equal(payload.summary, "");
  assert.equal(payload.tags, "");
});

test("knowledge suggestion requests respect API limits without changing the draft", () => {
  const { prepareKnowledgeSuggestionInput } = createSourceLoader()("features/knowledge/suggestions.ts");
  const input = { title: 'x'.repeat(200), description: 'y'.repeat(15000) };
  const request = prepareKnowledgeSuggestionInput(input);
  assert.equal(request.title.length, 150);
  assert.equal(request.description.length, 5000);
  assert.equal(input.description.length, 15000);
  assert.equal(prepareKnowledgeSuggestionInput({ title: '  ', description: '' }), null);
  assert.deepEqual(prepareKnowledgeSuggestionInput({ title: '', description: ' VPN timeout ' }), { title: 'VPN timeout', description: 'VPN timeout' });
});

test("knowledge suggestion queries use normalized input and pass cancellation to Axios", async () => {
  const calls = [];
  const load = createSourceLoader({
    '@tanstack/react-query': { useQuery: options => options },
    '@/lib/axios': { api: { post: async (url, body, options) => { calls.push({ url, body, options }); return { data: { data: [] } }; } } },
  });
  const { useSuggestKnowledgeArticles } = load('features/knowledge/hooks.ts');
  const empty = useSuggestKnowledgeArticles({ title: ' ' });
  assert.equal(empty.enabled, false);
  const controller = new AbortController();
  const options = useSuggestKnowledgeArticles({ title: ' VPN ', description: ' x ' });
  await options.queryFn({ signal: controller.signal });
  assert.deepEqual(calls, [{ url: '/knowledge/suggest-for-ticket', body: { title: 'VPN', description: 'x' }, options: { signal: controller.signal } }]);
  assert.equal(options.refetchOnWindowFocus, false);
});
