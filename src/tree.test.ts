import { describe, it, expect } from "vitest";

import { buildTree } from "./tree";
import type { Message } from "./types";

function msg(id: string, level: number, overrides?: Partial<Message>): Message {
  return { id, text: `msg-${id}`, timestamp: 0, level, ...overrides };
}

describe("buildTree", () => {
  it("returns empty array for empty input", () => {
    expect(buildTree([])).toEqual([]);
  });

  it("builds a single root node", () => {
    const result = buildTree([msg("1", 0)]);
    expect(result).toEqual([{ message: msg("1", 0), children: [] }]);
  });

  it("builds multiple root siblings", () => {
    const result = buildTree([msg("1", 0), msg("2", 0)]);
    expect(result).toEqual([
      { message: msg("1", 0), children: [] },
      { message: msg("2", 0), children: [] },
    ]);
  });

  it("nests a child under its parent", () => {
    const result = buildTree([msg("1", 0), msg("2", 1)]);
    expect(result).toEqual([
      {
        message: msg("1", 0),
        children: [{ message: msg("2", 1), children: [] }],
      },
    ]);
  });

  it("builds grandparent → parent → child", () => {
    const result = buildTree([msg("1", 0), msg("2", 1), msg("3", 2)]);
    expect(result).toEqual([
      {
        message: msg("1", 0),
        children: [
          {
            message: msg("2", 1),
            children: [{ message: msg("3", 2), children: [] }],
          },
        ],
      },
    ]);
  });

  it("attaches multiple children to the same parent", () => {
    const result = buildTree([msg("1", 0), msg("2", 1), msg("3", 1)]);
    expect(result).toEqual([
      {
        message: msg("1", 0),
        children: [
          { message: msg("2", 1), children: [] },
          { message: msg("3", 1), children: [] },
        ],
      },
    ]);
  });

  it("handles level gap (0 → 2), attaching to nearest ancestor", () => {
    const result = buildTree([msg("1", 0), msg("2", 2)]);
    expect(result).toEqual([
      {
        message: msg("1", 0),
        children: [{ message: msg("2", 2), children: [] }],
      },
    ]);
  });

  it("creates a new root when level decreases to 0", () => {
    const result = buildTree([msg("1", 0), msg("2", 1), msg("3", 0)]);
    expect(result).toEqual([
      {
        message: msg("1", 0),
        children: [{ message: msg("2", 1), children: [] }],
      },
      { message: msg("3", 0), children: [] },
    ]);
  });

  it("builds a complex tree with multiple levels and siblings", () => {
    const result = buildTree([msg("A", 0), msg("B", 1), msg("C", 2), msg("D", 1), msg("E", 0)]);
    expect(result).toEqual([
      {
        message: msg("A", 0),
        children: [
          {
            message: msg("B", 1),
            children: [{ message: msg("C", 2), children: [] }],
          },
          { message: msg("D", 1), children: [] },
        ],
      },
      { message: msg("E", 0), children: [] },
    ]);
  });

  it("handles decreasing level to an intermediate depth", () => {
    const result = buildTree([msg("1", 0), msg("2", 1), msg("3", 2), msg("4", 1)]);
    expect(result).toEqual([
      {
        message: msg("1", 0),
        children: [
          {
            message: msg("2", 1),
            children: [{ message: msg("3", 2), children: [] }],
          },
          { message: msg("4", 1), children: [] },
        ],
      },
    ]);
  });
});
