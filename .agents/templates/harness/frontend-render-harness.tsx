/**
 * @file frontend-render-harness.tsx
 * @description Frontend Test Harness combining React Testing Library, Mock Service Worker (MSW),
 * TanStack QueryClient with test configurations, and MemoryRouter.
 */

import React, { ReactElement, ReactNode } from 'react';
import { render, RenderOptions, RenderResult } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, MemoryRouterProps } from 'react-router-dom';

export interface ExtendedRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  initialEntries?: MemoryRouterProps['initialEntries'];
  queryClient?: QueryClient;
}

/**
 * Creates a QueryClient pre-configured for deterministic testing:
 * Disables retries, garbage collection timers, and window focus refetching.
 */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: Infinity,
        staleTime: Infinity,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

/**
 * Custom test render wrapper providing all foundational application contexts:
 * - QueryClientProvider (TanStack Query)
 * - MemoryRouter (React Router / URL navigation)
 */
export function renderWithHarness(
  ui: ReactElement,
  options: ExtendedRenderOptions = {}
): RenderResult & { queryClient: QueryClient } {
  const {
    initialEntries = ['/'],
    queryClient = createTestQueryClient(),
    ...renderOptions
  } = options;

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={initialEntries}>
          {children}
        </MemoryRouter>
      </QueryClientProvider>
    );
  }

  const result = render(ui, { wrapper: Wrapper, ...renderOptions });

  return {
    ...result,
    queryClient,
  };
}

