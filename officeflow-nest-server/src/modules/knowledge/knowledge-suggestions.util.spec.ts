import {
  extractKnowledgeKeywords,
  scoreKnowledgeSuggestion,
} from './knowledge-suggestions.util';

describe('Knowledge suggestion keywords', () => {
  it('keeps short IT terms and removes common Vietnamese request words', () => {
    expect(
      extractKnowledgeKeywords('Tôi không vào được VPN, cần đổi IP cho PC'),
    ).toEqual(['vao', 'vpn', 'doi', 'ip', 'pc']);
  });

  it('matches accented and unaccented Vietnamese without duplicate terms', () => {
    expect(extractKnowledgeKeywords('Máy in may in bị lỗi')).toEqual([
      'may',
      'in',
    ]);
  });

  it('does not search for empty input or generic request wording', () => {
    expect(extractKnowledgeKeywords('Xin yêu cầu hỗ trợ')).toEqual([]);
    expect(extractKnowledgeKeywords('Tôi cần được giúp?')).toEqual([]);
    expect(extractKnowledgeKeywords('không được cần lỗi')).toEqual([]);
    expect(extractKnowledgeKeywords('! @ #')).toEqual([]);
  });

  it('bounds keywords and ranks metadata matches above incidental body matches', () => {
    expect(
      extractKnowledgeKeywords(
        'vpn email wifi laptop printer dns sql ram azure teams',
      ),
    ).toHaveLength(8);
    expect(
      scoreKnowledgeSuggestion(
        { title: 'Hướng dẫn VPN', tags: 'vpn', summary: null },
        ['vpn'],
      ),
    ).toBeGreaterThan(
      scoreKnowledgeSuggestion(
        { title: 'Laptop', tags: null, summary: 'VPN có thể được nhắc ở đây.' },
        ['vpn'],
      ),
    );
  });
});
