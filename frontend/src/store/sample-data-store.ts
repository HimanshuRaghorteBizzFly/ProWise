import { useEffect } from "react";
import { createStore, type StoreApi } from "zustand/vanilla";

/**
 * Registry of screens currently showing typed fixture data. The TopNav "Sample data" badge
 * is visible while any source is registered, so fixture data is never silent.
 */
export interface SampleDataState {
  sources: Record<string, number>;
  register: (source: string) => () => void;
  active: () => boolean;
}

export function createSampleDataStore(): StoreApi<SampleDataState> {
  return createStore<SampleDataState>((set, get) => ({
    sources: {},
    register: (source) => {
      set((state) => ({ sources: { ...state.sources, [source]: (state.sources[source] ?? 0) + 1 } }));
      let released = false;
      return () => {
        if (released) return;
        released = true;
        set((state) => {
          const next = { ...state.sources };
          const count = (next[source] ?? 0) - 1;
          if (count > 0) next[source] = count;
          else delete next[source];
          return { sources: next };
        });
      };
    },
    active: () => Object.keys(get().sources).length > 0,
  }));
}

export const sampleDataStore = createSampleDataStore();

/** Registers `source` with the Sample data badge while `active` is true. */
export function useSampleDataNotice(source: string, active: boolean) {
  useEffect(() => {
    if (!active) return;
    return sampleDataStore.getState().register(source);
  }, [source, active]);
}
