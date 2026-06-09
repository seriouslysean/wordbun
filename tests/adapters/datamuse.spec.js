import { beforeEach, describe, expect, it, vi } from 'vitest';

globalThis.fetch = vi.fn();

const mockResponse = (status, data = []) => ({
  ok: status >= 200 && status < 300,
  status,
  json: () => Promise.resolve(data),
  text: () => Promise.resolve(JSON.stringify(data)),
});

describe('datamuse adapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchDatamuseRelations', () => {
    it('maps each relation list (syn, ant, trg) to plain words', async () => {
      const { fetchDatamuseRelations } = await import('#adapters/datamuse');
      globalThis.fetch
        .mockResolvedValueOnce(mockResponse(200, [{ word: 'fast', score: 100 }, { word: 'quick', score: 90 }]))
        .mockResolvedValueOnce(mockResponse(200, [{ word: 'slow', score: 80 }]))
        .mockResolvedValueOnce(mockResponse(200, [{ word: 'velocity', score: 70 }]));

      const result = await fetchDatamuseRelations('speed');
      expect(result).toEqual({
        synonyms: ['fast', 'quick'],
        antonyms: ['slow'],
        related: ['velocity'],
      });
    });

    it('returns empty arrays when a relation has no matches', async () => {
      const { fetchDatamuseRelations } = await import('#adapters/datamuse');
      globalThis.fetch.mockResolvedValue(mockResponse(200, []));

      const result = await fetchDatamuseRelations('zzxqjk');
      expect(result).toEqual({ synonyms: [], antonyms: [], related: [] });
    });

    it('throws when a request fails so the caller can swallow it', async () => {
      const { fetchDatamuseRelations } = await import('#adapters/datamuse');
      globalThis.fetch.mockResolvedValue(mockResponse(500));

      await expect(fetchDatamuseRelations('speed')).rejects.toThrow('Datamuse request failed');
    });
  });
});
