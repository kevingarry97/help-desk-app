import type { ReactElement, ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, type RenderOptions } from "@testing-library/react";

/**
 * A QueryClient configured for tests, plus the provider that supplies it. Retries are off
 * so a test asserting an error state sees it on the first rejection rather than after the
 * app's retry budget.
 */
export function createQueryWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  return { queryClient, Wrapper };
}

/**
 * Renders a component inside a React Query provider. A fresh QueryClient per call — a
 * shared one would carry cached data and mutation state from one test into the next.
 */
export function renderWithQuery(ui: ReactElement, options?: Omit<RenderOptions, "wrapper">) {
  const { queryClient, Wrapper } = createQueryWrapper();

  return { queryClient, ...render(ui, { wrapper: Wrapper, ...options }) };
}
