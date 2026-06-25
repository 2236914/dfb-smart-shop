import type { Product } from 'src/data/types';
import type { Tensor } from '@tensorflow/tfjs';
import type { MobileNet } from '@tensorflow-models/mobilenet';
import type { KNNClassifier } from '@tensorflow-models/knn-classifier';

// ----------------------------------------------------------------------
// AI visual search (Objective 2) — TensorFlow.js + MobileNet, client-side.
//
// MobileNet returns *general* ImageNet categories (e.g. "window screen",
// "sliding door", "mirror"). Those don't map directly to SKUs, and ImageNet
// labels almost never contain shop words like "glass" or "aluminum". So we
// bridge them in two steps:
//   1. translate each generic label to the shop's vocabulary via LABEL_BRIDGE,
//   2. score products by how many bridged words hit their admin-set Visual
//      Search Keywords / name / category (see Admin A-6).
// This is the "bridge" described in the manuscript's Data Flow & AI Logic
// section. The model + matching run entirely in the browser.
// ----------------------------------------------------------------------

export type Prediction = { label: string; score: number };

// Maps substrings of MobileNet/ImageNet labels onto catalogue concept words.
// Keep keys lowercase; the longest useful match wins by virtue of adding more
// concept hits. Extend this as the catalogue grows.
const LABEL_BRIDGE: { match: string; concepts: string[] }[] = [
  { match: 'window screen', concepts: ['screen', 'window', 'mesh', 'insect'] },
  { match: 'mosquito net', concepts: ['screen', 'mesh', 'window', 'mosquito'] },
  { match: 'window shade', concepts: ['window', 'screen'] },
  { match: 'shoji', concepts: ['door', 'sliding', 'window', 'frame', 'glass'] },
  { match: 'sliding door', concepts: ['door', 'sliding', 'aluminum', 'frame', 'profile'] },
  { match: 'patio', concepts: ['door', 'sliding', 'aluminum'] },
  { match: 'greenhouse', concepts: ['glass', 'frame', 'window'] },
  { match: 'mirror', concepts: ['glass', 'mirror'] },
  { match: 'glass', concepts: ['glass'] },
  { match: 'pane', concepts: ['glass', 'window'] },
  { match: 'pole', concepts: ['aluminum', 'profile', 'metal'] },
  { match: 'bannister', concepts: ['aluminum', 'profile', 'metal', 'frame'] },
  { match: 'padlock', concepts: ['lock', 'hardware'] },
  { match: 'lock', concepts: ['lock', 'hardware'] },
  { match: 'latch', concepts: ['lock', 'hardware'] },
  { match: 'knob', concepts: ['handle', 'hardware', 'door'] },
  { match: 'handle', concepts: ['handle', 'hardware'] },
  { match: 'hook', concepts: ['hardware', 'accessory'] },
  { match: 'screw', concepts: ['hardware', 'accessory'] },
  { match: 'hinge', concepts: ['hardware', 'door'] },
  { match: 'door', concepts: ['door', 'frame', 'aluminum'] },
  { match: 'frame', concepts: ['frame', 'aluminum', 'profile'] },
  { match: 'screen', concepts: ['screen', 'mesh'] },
];

// Turn raw predictions into the set of catalogue words to search for: the
// label's own words plus any bridged concepts.
function bridgeLabels(predictions: Prediction[]): string[] {
  const words = new Set<string>();
  for (const { label } of predictions) {
    const lower = label.toLowerCase();
    lower
      .split(/[\s,]+/)
      .filter((w) => w.length >= 3)
      .forEach((w) => words.add(w));
    for (const { match, concepts } of LABEL_BRIDGE) {
      if (lower.includes(match)) concepts.forEach((c) => words.add(c));
    }
  }
  return [...words];
}

/**
 * Bridge MobileNet predictions to catalog products by matching the bridged
 * label words against each product's keywords / name / category.
 */
export function matchProductsByLabels(
  predictions: Prediction[],
  products: Product[]
): Product[] {
  const words = bridgeLabels(predictions);

  const scored = products
    .map((product) => {
      const haystack = [product.name, product.category, ...product.keywords]
        .join(' ')
        .toLowerCase();
      const score = words.reduce((acc, word) => (haystack.includes(word) ? acc + 1 : acc), 0);
      return { product, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.map((entry) => entry.product);
}

// MobileNet is loaded lazily on first use (heavy) and cached for the session.
// The model weights are fetched from Google's CDN at runtime, so the browser
// needs internet — consistent with the app's online (Supabase) requirement.
let modelPromise: Promise<MobileNet> | null = null;

async function loadModel() {
  if (!modelPromise) {
    modelPromise = (async () => {
      await import('@tensorflow/tfjs');
      const mobilenet = await import('@tensorflow-models/mobilenet');
      return mobilenet.load();
    })();
  }
  return modelPromise;
}

/**
 * Classify an image element with MobileNet (client-side, Objective 2).
 */
export async function classifyImage(image: HTMLImageElement): Promise<Prediction[]> {
  const model = await loadModel();
  const predictions = await model.classify(image);
  return predictions.map((p) => ({ label: p.className, score: p.probability }));
}

// ----------------------------------------------------------------------
// Transfer learning (Objective 2). We train a K-Nearest-Neighbour classifier on
// MobileNet embeddings of a curated photo set per product CATEGORY (Glass,
// Aluminum Profiles, Hardware & Accessories, Screens). The model then predicts
// the category of an uploaded photo and returns the matching products.
// Fully open source (@tensorflow-models/knn-classifier), runs in the browser.
// Accuracy is measured on a held-out test set — see benchmarkModel().
// ----------------------------------------------------------------------

type Dataset = {
  categories: Record<string, string>; // slug -> category name
  train: Record<string, string[]>; // slug -> image paths
  test: Record<string, string[]>;
};

let knn: KNNClassifier | null = null;
let knnExamples = 0;
let datasetCache: Dataset | null = null;

function loadImageEl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image load failed'));
    img.src = url;
  });
}

async function loadDataset(): Promise<Dataset> {
  if (!datasetCache) {
    const res = await fetch('/assets/ai/dataset.json');
    datasetCache = (await res.json()) as Dataset;
  }
  return datasetCache;
}

/**
 * Train the KNN classifier on the curated dataset (label = category name), using
 * MobileNet embeddings. Cached for the session. Returns examples learned.
 */
export async function trainCategoryModel(): Promise<number> {
  if (isKnnTrained()) return knnExamples;
  const model = await loadModel();
  const knnClassifier = await import('@tensorflow-models/knn-classifier');
  const classifier = knnClassifier.create();
  const dataset = await loadDataset();
  let learned = 0;
  for (const [slug, paths] of Object.entries(dataset.train)) {
    const label = dataset.categories[slug];
    for (const path of paths) {
      try {
        const img = await loadImageEl(path);  
        const embedding = model.infer(img, true) as Tensor;
        classifier.addExample(embedding, label);
        embedding.dispose();
        learned += 1;
      } catch {
        /* skip an image that fails to load */
      }
    }
  }
  knn = classifier;
  knnExamples = learned;
  return learned;
}

export function isKnnTrained(): boolean {
  return !!knn && knnExamples > 0 && knn.getNumClasses() > 0;
}

/** Predict the category of a query image (transfer-learned). */
export async function predictCategory(
  image: HTMLImageElement
): Promise<{ label: string; confidence: number } | null> {
  if (!knn || knn.getNumClasses() === 0) return null;
  const model = await loadModel();
  const embedding = model.infer(image, true) as Tensor;
  const prediction = await knn.predictClass(embedding, Math.min(7, knnExamples));
  embedding.dispose();
  return { label: prediction.label, confidence: prediction.confidences[prediction.label] ?? 0 };
}

/**
 * Match products to a query image: predict its category, return that category's
 * products. Returns [] when untrained or no category match.
 */
export async function matchProductsByImage(
  image: HTMLImageElement,
  products: Product[]
): Promise<Product[]> {
  const predicted = await predictCategory(image);
  if (!predicted) return [];
  return products.filter((p) => p.category === predicted.label);
}

export type BenchmarkResult = {
  overall: number;
  total: number;
  correct: number;
  perCategory: { label: string; correct: number; total: number }[];
};

/**
 * Measure real accuracy on the held-out test set (images never used in
 * training): top-1 category accuracy overall and per category.
 */
export async function benchmarkModel(): Promise<BenchmarkResult> {
  await trainCategoryModel();
  const dataset = await loadDataset();
  const perCategory: { label: string; correct: number; total: number }[] = [];
  let correct = 0;
  let total = 0;
  for (const [slug, paths] of Object.entries(dataset.test)) {
    const label = dataset.categories[slug];
    let c = 0;
    let t = 0;
    for (const path of paths) {
      try {
        const img = await loadImageEl(path);  
        const predicted = await predictCategory(img);  
        t += 1;
        total += 1;
        if (predicted && predicted.label === label) {
          c += 1;
          correct += 1;
        }
      } catch {
        /* skip */
      }
    }
    perCategory.push({ label, correct: c, total: t });
  }
  return { overall: total ? correct / total : 0, total, correct, perCategory };
}
