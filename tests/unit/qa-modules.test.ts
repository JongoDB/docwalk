import { describe, it, expect, vi } from "vitest";
import { chunkPage, chunkPages } from "../../src/qa/chunker.js";
import { VectorStore } from "../../src/qa/vector-store.js";
import { generateEmbeddings } from "../../src/qa/embedder.js";
import { buildQAIndex } from "../../src/qa/index.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Generate a string of approximately `n` tokens (n * 4 chars). */
function makeText(tokenCount: number, word = "word"): string {
  // Each "word " is 5 chars ~ 1.25 tokens. We build to a target char count.
  const targetChars = tokenCount * 4;
  const repetitions = Math.ceil(targetChars / (word.length + 1));
  return Array(repetitions)
    .fill(word)
    .join(" ")
    .slice(0, targetChars);
}

/** Cosine similarity between two vectors (for test assertions). */
function cosine(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0,
    na = 0,
    nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const mag = Math.sqrt(na) * Math.sqrt(nb);
  return mag === 0 ? 0 : dot / mag;
}

/** Magnitude of a vector. */
function magnitude(v: number[]): number {
  return Math.sqrt(v.reduce((s, x) => s + x * x, 0));
}

// ===========================================================================
// 1. Chunker
// ===========================================================================

describe("Chunker", () => {
  // ---- splitByHeadings (tested indirectly through chunkPage) ---------------

  describe("splitByHeadings (via chunkPage)", () => {
    it("splits markdown by heading lines and keeps heading with its content", () => {
      const md = [
        "# First Heading",
        makeText(80), // ~80 tokens of content
        "## Second Heading",
        makeText(80),
      ].join("\n");

      const chunks = chunkPage("page.md", "Page", md);
      expect(chunks.length).toBeGreaterThanOrEqual(2);
      expect(chunks[0].heading).toBe("First Heading");
      expect(chunks[1].heading).toBe("Second Heading");
    });

    it("handles ### level headings", () => {
      const md = [
        "### Sub Section",
        makeText(80),
      ].join("\n");

      const chunks = chunkPage("page.md", "Page", md);
      expect(chunks.length).toBe(1);
      expect(chunks[0].heading).toBe("Sub Section");
    });

    it("produces section with no heading for content before first heading", () => {
      const md = [
        makeText(80),
        "# Heading After",
        makeText(80),
      ].join("\n");

      const chunks = chunkPage("page.md", "Page", md);
      // The first chunk should have no heading (content before any heading)
      expect(chunks[0].heading).toBeUndefined();
      expect(chunks[1].heading).toBe("Heading After");
    });
  });

  // ---- chunkPage basics ---------------------------------------------------

  describe("chunkPage", () => {
    it("returns empty array for empty content", () => {
      expect(chunkPage("p.md", "P", "")).toEqual([]);
    });

    it("returns empty array for content shorter than MIN_CHUNK_TOKENS (50 tokens ~ 200 chars)", () => {
      // ~30 tokens => 120 chars, well below the 50-token minimum
      const short = makeText(30);
      const chunks = chunkPage("p.md", "P", short);
      expect(chunks).toEqual([]);
    });

    it("returns single chunk for content between MIN and MAX (50-500 tokens)", () => {
      const content = makeText(100); // ~100 tokens
      const chunks = chunkPage("p.md", "P", content);
      expect(chunks.length).toBe(1);
      expect(chunks[0].content.length).toBeGreaterThan(0);
    });

    it("splits large sections into paragraph-level chunks at \\n\\n boundaries", () => {
      // Create a section that exceeds MAX_CHUNK_TOKENS (500)
      // Use paragraphs separated by \n\n
      const para = makeText(200);
      const content = [para, para, para, para].join("\n\n");
      const chunks = chunkPage("p.md", "P", content);
      expect(chunks.length).toBeGreaterThan(1);
    });

    it("assigns correct chunk IDs: ${pagePath}:${index}", () => {
      const content = [
        "# Section A",
        makeText(100),
        "# Section B",
        makeText(100),
      ].join("\n");

      const chunks = chunkPage("docs/api.md", "API", content);
      chunks.forEach((chunk, i) => {
        expect(chunk.id).toBe(`docs/api.md:${i}`);
      });
    });

    it("sets heading context from nearest parent heading", () => {
      const md = [
        "# Overview",
        makeText(80),
        "## Details",
        makeText(80),
        "### Deep",
        makeText(80),
      ].join("\n");

      const chunks = chunkPage("p.md", "P", md);
      const headings = chunks.map((c) => c.heading);
      expect(headings).toContain("Overview");
      expect(headings).toContain("Details");
      expect(headings).toContain("Deep");
    });

    it("strips YAML frontmatter (---...---) before chunking", () => {
      const md = [
        "---",
        "title: Test",
        "date: 2024-01-01",
        "---",
        "",
        makeText(100),
      ].join("\n");

      const chunks = chunkPage("p.md", "P", md);
      expect(chunks.length).toBe(1);
      // None of the chunk content should contain frontmatter delimiters at the start
      expect(chunks[0].content).not.toMatch(/^---/);
      expect(chunks[0].content).not.toContain("title: Test");
    });

    it("sets pagePath and pageTitle on every chunk", () => {
      const chunks = chunkPage("mypath.md", "My Title", makeText(100));
      for (const c of chunks) {
        expect(c.pagePath).toBe("mypath.md");
        expect(c.pageTitle).toBe("My Title");
      }
    });

    it("estimates tokenCount using content.length / 4", () => {
      const content = makeText(100);
      const chunks = chunkPage("p.md", "P", content);
      for (const c of chunks) {
        expect(c.tokenCount).toBe(Math.ceil(c.content.length / 4));
      }
    });
  });

  // ---- chunkPages ---------------------------------------------------------

  describe("chunkPages", () => {
    it("processes multiple pages and returns combined chunks", () => {
      const pages = [
        { path: "a.md", title: "A", content: makeText(100) },
        { path: "b.md", title: "B", content: makeText(100) },
        { path: "c.md", title: "C", content: makeText(100) },
      ];

      const chunks = chunkPages(pages);

      // Should have chunks from all three pages
      const paths = new Set(chunks.map((c) => c.pagePath));
      expect(paths.size).toBe(3);
      expect(paths).toContain("a.md");
      expect(paths).toContain("b.md");
      expect(paths).toContain("c.md");
    });

    it("returns empty array when all pages have content below MIN_CHUNK_TOKENS", () => {
      const pages = [
        { path: "a.md", title: "A", content: "short" },
        { path: "b.md", title: "B", content: "tiny" },
      ];
      expect(chunkPages(pages)).toEqual([]);
    });
  });

  // ---- Token estimation ---------------------------------------------------

  describe("Token estimation", () => {
    it("uses content.length / 4 (ceil) for token count", () => {
      // A string of exactly 100 characters => ceil(100/4) = 25 tokens
      const content = "a".repeat(100);
      // This is below MIN_CHUNK_TOKENS, so let's just test with a bigger string
      const bigContent = "a".repeat(400); // ceil(400/4) = 100 tokens
      const chunks = chunkPage("p.md", "P", bigContent);
      expect(chunks.length).toBe(1);
      expect(chunks[0].tokenCount).toBe(Math.ceil(chunks[0].content.length / 4));
    });
  });
});

// ===========================================================================
// 2. VectorStore
// ===========================================================================

describe("VectorStore", () => {
  describe("addEntries", () => {
    it("adds chunks with matching embeddings", () => {
      const store = new VectorStore();
      const chunks = [
        { id: "c1", pagePath: "p.md", pageTitle: "P", content: "text one", tokenCount: 10 },
        { id: "c2", pagePath: "p.md", pageTitle: "P", content: "text two", tokenCount: 10 },
      ];
      const embeddings = [
        { chunkId: "c1", vector: [1, 0, 0] },
        { chunkId: "c2", vector: [0, 1, 0] },
      ];

      store.addEntries(chunks, embeddings);
      expect(store.size).toBe(2);
    });

    it("skips chunks without matching embeddings", () => {
      const store = new VectorStore();
      const chunks = [
        { id: "c1", pagePath: "p.md", pageTitle: "P", content: "text one", tokenCount: 10 },
        { id: "c2", pagePath: "p.md", pageTitle: "P", content: "text two", tokenCount: 10 },
      ];
      // Only provide an embedding for c1
      const embeddings = [{ chunkId: "c1", vector: [1, 0, 0] }];

      store.addEntries(chunks, embeddings);
      expect(store.size).toBe(1);
    });
  });

  describe("search", () => {
    it("returns top-k results sorted by cosine similarity score (descending)", () => {
      const store = new VectorStore();
      const chunks = [
        { id: "c1", pagePath: "p.md", pageTitle: "P", content: "a", tokenCount: 1 },
        { id: "c2", pagePath: "p.md", pageTitle: "P", content: "b", tokenCount: 1 },
        { id: "c3", pagePath: "p.md", pageTitle: "P", content: "c", tokenCount: 1 },
      ];
      const embeddings = [
        { chunkId: "c1", vector: [1, 0, 0] },
        { chunkId: "c2", vector: [0.7, 0.7, 0] }, // partially similar to [1,0,0]
        { chunkId: "c3", vector: [0, 0, 1] }, // orthogonal
      ];
      store.addEntries(chunks, embeddings);

      const results = store.search([1, 0, 0], 3);
      expect(results.length).toBe(3);
      // Should be sorted descending by score
      expect(results[0].score).toBeGreaterThanOrEqual(results[1].score);
      expect(results[1].score).toBeGreaterThanOrEqual(results[2].score);
      // Best match is c1 (exact match)
      expect(results[0].chunk.id).toBe("c1");
    });

    it("respects the top-k parameter", () => {
      const store = new VectorStore();
      const chunks = Array.from({ length: 10 }, (_, i) => ({
        id: `c${i}`,
        pagePath: "p.md",
        pageTitle: "P",
        content: `text ${i}`,
        tokenCount: 5,
      }));
      const embeddings = chunks.map((c, i) => {
        const v = new Array(3).fill(0);
        v[i % 3] = 1;
        return { chunkId: c.id, vector: v };
      });
      store.addEntries(chunks, embeddings);

      const results = store.search([1, 0, 0], 3);
      expect(results.length).toBe(3);
    });
  });

  describe("search with identical vectors", () => {
    it("returns score of 1.0", () => {
      const store = new VectorStore();
      const chunks = [
        { id: "c1", pagePath: "p.md", pageTitle: "P", content: "text", tokenCount: 5 },
      ];
      const vec = [0.5, 0.3, 0.8, 0.1];
      store.addEntries(chunks, [{ chunkId: "c1", vector: vec }]);

      const results = store.search(vec, 1);
      expect(results[0].score).toBeCloseTo(1.0, 5);
    });
  });

  describe("search with orthogonal vectors", () => {
    it("returns score of 0.0", () => {
      const store = new VectorStore();
      const chunks = [
        { id: "c1", pagePath: "p.md", pageTitle: "P", content: "text", tokenCount: 5 },
      ];
      store.addEntries(chunks, [{ chunkId: "c1", vector: [1, 0, 0] }]);

      const results = store.search([0, 1, 0], 1);
      expect(results[0].score).toBeCloseTo(0.0, 5);
    });
  });

  describe("search with opposite vectors", () => {
    it("returns negative score", () => {
      const store = new VectorStore();
      const chunks = [
        { id: "c1", pagePath: "p.md", pageTitle: "P", content: "text", tokenCount: 5 },
      ];
      store.addEntries(chunks, [{ chunkId: "c1", vector: [1, 0, 0] }]);

      const results = store.search([-1, 0, 0], 1);
      expect(results[0].score).toBeCloseTo(-1.0, 5);
    });
  });

  describe("size", () => {
    it("returns number of entries", () => {
      const store = new VectorStore();
      expect(store.size).toBe(0);

      store.addEntries(
        [{ id: "c1", pagePath: "p.md", pageTitle: "P", content: "a", tokenCount: 1 }],
        [{ chunkId: "c1", vector: [1] }],
      );
      expect(store.size).toBe(1);

      store.addEntries(
        [{ id: "c2", pagePath: "p.md", pageTitle: "P", content: "b", tokenCount: 1 }],
        [{ chunkId: "c2", vector: [0] }],
      );
      expect(store.size).toBe(2);
    });
  });

  describe("serialize/deserialize roundtrip", () => {
    it("serialized data can be deserialized back to a working store", () => {
      const store = new VectorStore();
      const chunks = [
        {
          id: "page.md:0",
          pagePath: "page.md",
          pageTitle: "Page Title",
          heading: "Section One",
          content: "This is the content of section one with enough text.",
          tokenCount: 15,
        },
        {
          id: "page.md:1",
          pagePath: "page.md",
          pageTitle: "Page Title",
          heading: "Section Two",
          content: "This is the content of section two.",
          tokenCount: 10,
        },
      ];
      const embeddings = [
        { chunkId: "page.md:0", vector: [0.1, 0.2, 0.3] },
        { chunkId: "page.md:1", vector: [0.4, 0.5, 0.6] },
      ];
      store.addEntries(chunks, embeddings);

      const serialized = store.serialize();
      const restored = VectorStore.deserialize(serialized);

      expect(restored.size).toBe(2);
    });

    it("preserves chunk content, pagePath, pageTitle, heading", () => {
      const store = new VectorStore();
      const chunks = [
        {
          id: "docs/api.md:0",
          pagePath: "docs/api.md",
          pageTitle: "API Docs",
          heading: "Overview",
          content: "The API provides several endpoints for data retrieval.",
          tokenCount: 12,
        },
      ];
      store.addEntries(chunks, [{ chunkId: "docs/api.md:0", vector: [1, 0] }]);

      const serialized = store.serialize();
      const restored = VectorStore.deserialize(serialized);

      // Search with same vector to retrieve the entry
      const results = restored.search([1, 0], 1);
      expect(results.length).toBe(1);
      expect(results[0].chunk.pagePath).toBe("docs/api.md");
      expect(results[0].chunk.pageTitle).toBe("API Docs");
      expect(results[0].chunk.heading).toBe("Overview");
      expect(results[0].chunk.content).toBe(
        "The API provides several endpoints for data retrieval.",
      );
    });

    it("recalculates tokenCount from content length", () => {
      const store = new VectorStore();
      const content = "Some content here for token count check";
      const chunks = [
        {
          id: "p:0",
          pagePath: "p",
          pageTitle: "P",
          content,
          tokenCount: 999, // intentionally wrong
        },
      ];
      store.addEntries(chunks, [{ chunkId: "p:0", vector: [1] }]);

      const serialized = store.serialize();
      const restored = VectorStore.deserialize(serialized);

      const results = restored.search([1], 1);
      // Deserialized store recalculates tokenCount as ceil(content.length / 4)
      expect(results[0].chunk.tokenCount).toBe(Math.ceil(content.length / 4));
    });

    it("sets version to 1", () => {
      const store = new VectorStore();
      store.addEntries(
        [{ id: "c1", pagePath: "p", pageTitle: "P", content: "x", tokenCount: 1 }],
        [{ chunkId: "c1", vector: [1] }],
      );

      const serialized = store.serialize();
      expect(serialized.version).toBe(1);
    });
  });

  describe("Edge cases", () => {
    it("search with empty store returns empty array", () => {
      const store = new VectorStore();
      const results = store.search([1, 0, 0], 5);
      expect(results).toEqual([]);
    });

    it("vectors of different lengths return 0 similarity", () => {
      const store = new VectorStore();
      const chunks = [
        { id: "c1", pagePath: "p", pageTitle: "P", content: "t", tokenCount: 1 },
      ];
      store.addEntries(chunks, [{ chunkId: "c1", vector: [1, 0, 0] }]);

      // Query with a different length vector
      const results = store.search([1, 0], 1);
      expect(results[0].score).toBeCloseTo(0.0, 5);
    });

    it("zero vector returns 0 similarity", () => {
      const store = new VectorStore();
      const chunks = [
        { id: "c1", pagePath: "p", pageTitle: "P", content: "t", tokenCount: 1 },
      ];
      store.addEntries(chunks, [{ chunkId: "c1", vector: [0, 0, 0] }]);

      const results = store.search([1, 0, 0], 1);
      expect(results[0].score).toBeCloseTo(0.0, 5);
    });
  });
});

// ===========================================================================
// 3. Embedder (generateSimpleEmbeddings via generateEmbeddings fallback)
// ===========================================================================

describe("Embedder (generateSimpleEmbeddings)", () => {
  const VOCAB_SIZE = 256;

  it("anthropic provider returns bag-of-words vectors of length 256", async () => {
    const texts = [{ id: "c1", content: "anthropic does not have an embedding API" }];
    const results = await generateEmbeddings(texts, {
      provider: "anthropic",
      apiKey: "unused",
    });

    expect(results.length).toBe(1);
    expect(results[0].vector.length).toBe(VOCAB_SIZE);
    expect(results[0].chunkId).toBe("c1");
    // Should be normalized
    const mag = magnitude(results[0].vector);
    expect(mag).toBeCloseTo(1.0, 5);
  });

  it("returns embeddings with correct chunkIds", async () => {
    const texts = [
      { id: "chunk-a", content: "hello world this is a test document" },
      { id: "chunk-b", content: "another test document with more words" },
    ];
    const results = await generateEmbeddings(texts, {
      provider: "anthropic",
      apiKey: "unused",
      model: "unused",
    });

    expect(results.length).toBe(2);
    expect(results[0].chunkId).toBe("chunk-a");
    expect(results[1].chunkId).toBe("chunk-b");
  });

  it("returns vectors of length 256 (VOCAB_SIZE)", async () => {
    const texts = [{ id: "c1", content: "some content for embedding generation" }];
    const results = await generateEmbeddings(texts, {
      provider: "anthropic",
      apiKey: "unused",
      model: "unused",
    });

    expect(results[0].vector.length).toBe(VOCAB_SIZE);
  });

  it("vectors are normalized (magnitude ~ 1.0)", async () => {
    const texts = [
      { id: "c1", content: "The quick brown fox jumps over the lazy dog" },
    ];
    const results = await generateEmbeddings(texts, {
      provider: "anthropic",
      apiKey: "unused",
      model: "unused",
    });

    const mag = magnitude(results[0].vector);
    expect(mag).toBeCloseTo(1.0, 5);
  });

  it("similar content produces similar vectors (cosine similarity > 0.5)", async () => {
    const texts = [
      { id: "c1", content: "TypeScript is a programming language developed by Microsoft" },
      { id: "c2", content: "TypeScript is a typed programming language built by Microsoft" },
    ];
    const results = await generateEmbeddings(texts, {
      provider: "anthropic",
      apiKey: "unused",
      model: "unused",
    });

    const sim = cosine(results[0].vector, results[1].vector);
    expect(sim).toBeGreaterThan(0.5);
  });

  it("different content produces different vectors", async () => {
    const texts = [
      { id: "c1", content: "quantum physics explores subatomic particles and wave functions" },
      { id: "c2", content: "chocolate cake recipe requires flour sugar eggs and butter" },
    ];
    const results = await generateEmbeddings(texts, {
      provider: "anthropic",
      apiKey: "unused",
      model: "unused",
    });

    const sim = cosine(results[0].vector, results[1].vector);
    // Different content should have notably lower similarity than identical content
    expect(sim).toBeLessThan(0.9);
    // Vectors should not be identical
    const areEqual = results[0].vector.every(
      (v, i) => v === results[1].vector[i],
    );
    expect(areEqual).toBe(false);
  });

  it("empty content returns zero vector (or near-zero)", async () => {
    const texts = [{ id: "c1", content: "" }];
    const results = await generateEmbeddings(texts, {
      provider: "anthropic",
      apiKey: "unused",
      model: "unused",
    });

    const mag = magnitude(results[0].vector);
    expect(mag).toBeCloseTo(0.0, 5);
  });
});

// ===========================================================================
// 4. buildQAIndex orchestrator
// ===========================================================================

describe("buildQAIndex", () => {
  const makePage = (
    path: string,
    title: string,
    content: string,
  ) => ({
    path,
    title,
    content,
    navGroup: "API",
    navOrder: 0,
  });

  it("calls chunkPages, generateEmbeddings, creates VectorStore and returns correct counts", async () => {
    const pages = [
      makePage("a.md", "Page A", `# Section A\n${makeText(100)}`),
      makePage("b.md", "Page B", `# Section B\n${makeText(100)}`),
    ];

    const result = await buildQAIndex({
      pages,
      embedder: { provider: "anthropic", apiKey: "unused", model: "unused" },
    });

    expect(result.pageCount).toBe(2);
    expect(result.chunkCount).toBeGreaterThan(0);
    expect(result.serialized).toBeDefined();
    expect(result.serialized.entries.length).toBeGreaterThan(0);
  });

  it("returns correct chunkCount and pageCount", async () => {
    const pages = [
      makePage("x.md", "X", `# Heading\n${makeText(150)}`),
    ];

    const result = await buildQAIndex({
      pages,
      embedder: { provider: "anthropic", apiKey: "unused", model: "unused" },
    });

    expect(result.pageCount).toBe(1);
    // chunkCount should match the number of chunks produced by chunkPages
    const expectedChunks = chunkPages(
      pages.map((p) => ({ path: p.path, title: p.title, content: p.content })),
    );
    expect(result.chunkCount).toBe(expectedChunks.length);
  });

  it("calls onProgress callback with status messages", async () => {
    const onProgress = vi.fn();
    const pages = [
      makePage("a.md", "A", `# H\n${makeText(100)}`),
    ];

    await buildQAIndex({
      pages,
      embedder: { provider: "anthropic", apiKey: "unused", model: "unused" },
      onProgress,
    });

    expect(onProgress).toHaveBeenCalled();
    // Check that it was called with the expected message patterns
    const calls = onProgress.mock.calls.map((c) => c[0] as string);
    expect(calls.some((m) => m.includes("Chunking"))).toBe(true);
    expect(calls.some((m) => m.includes("chunks"))).toBe(true);
    expect(calls.some((m) => m.includes("embeddings") || m.includes("Embedding"))).toBe(true);
  });

  it("the serialized output has version 1", async () => {
    const pages = [
      makePage("a.md", "A", `# H\n${makeText(100)}`),
    ];

    const result = await buildQAIndex({
      pages,
      embedder: { provider: "anthropic", apiKey: "unused", model: "unused" },
    });

    expect(result.serialized.version).toBe(1);
  });
});
