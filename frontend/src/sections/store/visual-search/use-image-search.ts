import type { Product } from 'src/data/types';

import { useState, useCallback } from 'react';

import { fetchVisibleProducts } from 'src/services/db';
import {
  isKnnTrained,
  classifyImage,
  trainCategoryModel,
  matchProductsByImage,
  matchProductsByLabels,
} from 'src/services/ai';

// ----------------------------------------------------------------------
// Shared client-side image search engine (TensorFlow.js + MobileNet).
// Used by both the visual search page and the Shopee-style camera modal.
// Uses a KNN classifier trained on the catalog photos (transfer learning) when
// available, falling back to the generic ImageNet keyword bridge.
// ----------------------------------------------------------------------

export type SearchPhase = 'idle' | 'processing' | 'results' | 'no-match' | 'error';

export function useImageSearch() {
  const [phase, setPhase] = useState<SearchPhase>('idle');
  const [preview, setPreview] = useState('');
  const [topLabel, setTopLabel] = useState('');
  const [matches, setMatches] = useState<Product[]>([]);

  const runSearch = useCallback(async (file: File) => {
    const url = URL.createObjectURL(file);
    setPreview(url);
    setPhase('processing');

    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.src = url;

    try {
      await image.decode();
      const products = await fetchVisibleProducts();

      // Transfer-learn the category model once per session.
      if (!isKnnTrained()) await trainCategoryModel();

      const predictions = await classifyImage(image);
      setTopLabel(predictions[0]?.label ?? '');

      // Prefer the transfer-learned KNN match; fall back to the keyword bridge.
      let matched: Product[] = isKnnTrained() ? await matchProductsByImage(image, products) : [];
      if (matched.length === 0) matched = matchProductsByLabels(predictions, products);

      if (matched.length === 0) {
        setPhase('no-match');
        return;
      }
      setMatches(matched);
      setPhase('results');
    } catch {
      setPhase('error');
    }
  }, []);

  const reset = useCallback(() => {
    setPhase('idle');
    setPreview('');
    setMatches([]);
    setTopLabel('');
  }, []);

  return { phase, preview, topLabel, matches, runSearch, reset };
}
