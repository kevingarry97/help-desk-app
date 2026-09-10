import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// jsdom implements no matchMedia. Embla (behind BrandPanel, which LoginPage renders) calls
// it while setting up its breakpoint options and crashes on the undefined return, so any
// test touching those components needs this before the first render.
if (!window.matchMedia) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

// Embla also observes its slides. Neither observer exists in jsdom, and both are only
// needed so the carousel can mount — nothing under test asserts on what they report.
if (!window.IntersectionObserver) {
  window.IntersectionObserver = class {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
    takeRecords = vi.fn(() => []);
    root = null;
    rootMargin = "";
    thresholds = [];
  } as unknown as typeof IntersectionObserver;
}

if (!window.ResizeObserver) {
  window.ResizeObserver = class {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
  } as unknown as typeof ResizeObserver;
}

// jsdom implements no PointerEvent either. Base UI's Radio re-dispatches a click as one so
// that a modifier-click on an option behaves the way it would on a native input, and throws
// on the missing constructor before any state changes — so a radio simply never checks.
// MouseEvent carries every property that path reads.
if (!window.PointerEvent) {
  class PointerEventPolyfill extends MouseEvent {
    readonly pointerId: number;
    readonly pointerType: string;
    readonly isPrimary: boolean;

    constructor(type: string, params: PointerEventInit = {}) {
      super(type, params);
      this.pointerId = params.pointerId ?? 0;
      this.pointerType = params.pointerType ?? "";
      this.isPrimary = params.isPrimary ?? false;
    }
  }

  window.PointerEvent = PointerEventPolyfill as unknown as typeof PointerEvent;
}

afterEach(cleanup);
