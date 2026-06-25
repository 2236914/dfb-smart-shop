import type { Product } from 'src/data/types';
import type { BenchmarkResult } from 'src/services/ai';

import { useState, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Table from '@mui/material/Table';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Select from '@mui/material/Select';
import Divider from '@mui/material/Divider';
import TableRow from '@mui/material/TableRow';
import MenuItem from '@mui/material/MenuItem';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import Typography from '@mui/material/Typography';
import CardHeader from '@mui/material/CardHeader';
import TableContainer from '@mui/material/TableContainer';
import LinearProgress from '@mui/material/LinearProgress';

import { useAsync } from 'src/hooks/use-async';

import { fetchVisibleProducts } from 'src/services/db';
import { DashboardContent } from 'src/layouts/dashboard';
import {
  isKnnTrained,
  classifyImage,
  benchmarkModel,
  trainCategoryModel,
  matchProductsByImage,
  matchProductsByLabels,
} from 'src/services/ai';

import { Iconify } from 'src/components/iconify';
import { Scrollbar } from 'src/components/scrollbar';

// ----------------------------------------------------------------------
// AI Visual Search — Accuracy (Objective 2). Transfer learning: a KNN
// classifier over MobileNet embeddings of a curated per-category photo set.
// "Run benchmark" trains the model, then evaluates it on a HELD-OUT test set
// and reports the full metrics (confusion matrix, precision/recall/F1, macro
// averages, overall accuracy) with the formulas used.
// ----------------------------------------------------------------------

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const dec = (x: number) => x.toFixed(3);

type Row = {
  id: string;
  url: string;
  expectedId: string;
  topLabel?: string;
  matches?: Product[];
  done?: boolean;
};

let counter = 0;

export function AiAccuracyView() {
  const { data } = useAsync(fetchVisibleProducts, []);
  const products = data ?? [];

  const [bench, setBench] = useState<BenchmarkResult | null>(null);
  const [benching, setBenching] = useState(false);

  const [rows, setRows] = useState<Row[]>([]);
  const [running, setRunning] = useState(false);

  const runBenchmark = useCallback(async () => {
    setBenching(true);
    try {
      setBench(await benchmarkModel());
    } finally {
      setBenching(false);
    }
  }, []);

  const addFiles = useCallback((files: FileList | null) => {
    if (!files) return;
    const added: Row[] = Array.from(files).map((f) => {
      counter += 1;
      return { id: `img-${counter}`, url: URL.createObjectURL(f), expectedId: '' };
    });
    setRows((r) => [...r, ...added]);
  }, []);

  const setExpected = (id: string, expectedId: string) =>
    setRows((r) => r.map((row) => (row.id === id ? { ...row, expectedId } : row)));

  const run = useCallback(async () => {
    setRunning(true);
    if (!isKnnTrained()) await trainCategoryModel();
    for (const row of rows) {
      try {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = row.url;
         
        await img.decode();
         
        const preds = await classifyImage(img);
         
        const matches = isKnnTrained()
          ? await matchProductsByImage(img, products)
          : matchProductsByLabels(preds, products);
        setRows((cur) =>
          cur.map((r) =>
            r.id === row.id ? { ...r, topLabel: preds[0]?.label ?? '—', matches, done: true } : r
          )
        );
      } catch {
        setRows((cur) =>
          cur.map((r) => (r.id === row.id ? { ...r, topLabel: 'error', matches: [], done: true } : r))
        );
      }
    }
    setRunning(false);
  }, [rows, products]);

  const catOf = (id: string) => products.find((p) => p.id === id)?.category;
  const readyToRun = rows.length > 0 && rows.some((r) => r.expectedId);

  return (
    <DashboardContent>
      <Typography variant="h4" sx={{ mb: 1 }}>
        AI Visual Search — Accuracy
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
        Transfer learning with a KNN classifier over MobileNet embeddings. The benchmark trains the
        model, then evaluates it on a <b>held-out test set</b> and reports the full metrics below.
      </Typography>

      <Button
        variant="contained"
        size="large"
        disabled={benching}
        startIcon={<Iconify icon="solar:test-tube-bold" />}
        onClick={runBenchmark}
        sx={{ mb: 3 }}
      >
        {benching ? 'Running benchmark…' : 'Run benchmark'}
      </Button>

      {benching && <LinearProgress sx={{ mb: 3 }} />}

      {bench && (
        <Stack spacing={3} sx={{ mb: 3 }}>
          {/* Model / training */}
          <Card sx={{ p: 3 }}>
            <Typography variant="subtitle1" sx={{ mb: 2 }}>
              Training model
            </Typography>
            <Box
              sx={{
                display: 'grid',
                gap: 2,
                gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' },
              }}
            >
              <Info label="Architecture" value="MobileNet + KNN" />
              <Info label="Embedding size" value={`${bench.model.embeddingDim}-D`} />
              <Info label="Neighbors (k)" value={`${bench.model.k}`} />
              <Info label="Training photos" value={`${bench.model.trainTotal}`} />
            </Box>
            <Divider sx={{ my: 2, borderStyle: 'dashed' }} />
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Training photos per class:{' '}
              {bench.model.trainPerClass.map((t) => `${t.label} (${t.count})`).join(' · ')}
            </Typography>
          </Card>

          {/* Headline metrics */}
          <Box
            sx={{
              display: 'grid',
              gap: 2,
              gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' },
            }}
          >
            <Metric
              label="Overall accuracy"
              value={pct(bench.accuracy)}
              sub={`${bench.correct} / ${bench.total} correct`}
              color={bench.accuracy >= 0.8 ? 'success.main' : bench.accuracy >= 0.6 ? 'warning.main' : 'error.main'}
            />
            <Metric label="Macro precision" value={dec(bench.macroPrecision)} />
            <Metric label="Macro recall" value={dec(bench.macroRecall)} />
            <Metric label="Macro F1-score" value={dec(bench.macroF1)} />
          </Box>

          {/* Per-class metrics */}
          <Card>
            <CardHeader title="Per-class metrics" subheader="Held-out test set" />
            <Scrollbar>
              <TableContainer sx={{ p: 2 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Category</TableCell>
                      <TableCell align="center">Support</TableCell>
                      <TableCell align="center">TP</TableCell>
                      <TableCell align="center">FP</TableCell>
                      <TableCell align="center">FN</TableCell>
                      <TableCell align="right">Precision</TableCell>
                      <TableCell align="right">Recall</TableCell>
                      <TableCell align="right">F1</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {bench.perClass.map((m) => (
                      <TableRow key={m.label}>
                        <TableCell>{m.label}</TableCell>
                        <TableCell align="center">{m.support}</TableCell>
                        <TableCell align="center">{m.tp}</TableCell>
                        <TableCell align="center">{m.fp}</TableCell>
                        <TableCell align="center">{m.fn}</TableCell>
                        <TableCell align="right">{dec(m.precision)}</TableCell>
                        <TableCell align="right">{dec(m.recall)}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>
                          {dec(m.f1)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Scrollbar>
          </Card>

          {/* Confusion matrix */}
          <Card>
            <CardHeader
              title="Confusion matrix"
              subheader="Rows = actual category · Columns = predicted category"
            />
            <Scrollbar>
              <TableContainer sx={{ p: 2 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ color: 'text.secondary' }}>actual ↓ / pred →</TableCell>
                      {bench.labels.map((l) => (
                        <TableCell key={l} align="center">
                          {l}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {bench.confusion.map((rowArr, i) => (
                      <TableRow key={bench.labels[i]}>
                        <TableCell sx={{ fontWeight: 600 }}>{bench.labels[i]}</TableCell>
                        {rowArr.map((n, j) => (
                          <TableCell
                            key={bench.labels[j]}
                            align="center"
                            sx={{
                              fontWeight: i === j ? 700 : 400,
                              bgcolor: i === j && n > 0 ? 'success.lighter' : n > 0 ? 'error.lighter' : 'transparent',
                            }}
                          >
                            {n}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Scrollbar>
          </Card>

          {/* Formulas */}
          <Alert severity="info" icon={<Iconify icon="solar:calculator-bold" />}>
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
              How the numbers are calculated
            </Typography>
            <Box component="div" sx={{ typography: 'body2', '& code': { fontFamily: 'monospace' } }}>
              <div>• Accuracy = correct ÷ total = {bench.correct} ÷ {bench.total} = {pct(bench.accuracy)}</div>
              <div>• Precision = TP ÷ (TP + FP)</div>
              <div>• Recall = TP ÷ (TP + FN)</div>
              <div>• F1 = 2 × (Precision × Recall) ÷ (Precision + Recall)</div>
              <div>• Macro average = mean of each class&apos;s score (every class weighted equally)</div>
            </Box>
          </Alert>
        </Stack>
      )}

      {/* Manual try-your-own-photo */}
      <Card>
        <CardHeader
          title="Try your own photos"
          subheader="Upload photos, mark the expected product, and run the model on them."
        />
        <Box sx={{ p: 3 }}>
          <Stack direction="row" spacing={1.5} sx={{ mb: 2 }}>
            <Button
              variant="outlined"
              component="label"
              startIcon={<Iconify icon="solar:gallery-add-bold" />}
            >
              Add photos
              <input
                hidden
                multiple
                type="file"
                accept="image/*"
                onChange={(e) => addFiles(e.target.files)}
              />
            </Button>
            <Button
              variant="contained"
              disabled={!readyToRun || running}
              startIcon={<Iconify icon="solar:play-bold" />}
              onClick={run}
            >
              {running ? 'Running…' : 'Run on my photos'}
            </Button>
          </Stack>

          {running && <LinearProgress sx={{ mb: 2 }} />}

          {rows.length > 0 && (
            <Scrollbar>
              <TableContainer>
                <Table sx={{ minWidth: 720 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell>Photo</TableCell>
                      <TableCell>Expected product</TableCell>
                      <TableCell>Matched category</TableCell>
                      <TableCell align="center">Result</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rows.map((row) => {
                      const ok = !!row.done && row.matches?.[0]?.category === catOf(row.expectedId);
                      return (
                        <TableRow key={row.id}>
                          <TableCell>
                            <Avatar variant="rounded" src={row.url} sx={{ width: 56, height: 56 }} />
                          </TableCell>
                          <TableCell sx={{ minWidth: 200 }}>
                            <Select
                              size="small"
                              fullWidth
                              displayEmpty
                              value={row.expectedId}
                              onChange={(e) => setExpected(row.id, e.target.value)}
                            >
                              <MenuItem value="">
                                <em>Choose…</em>
                              </MenuItem>
                              {products.map((p) => (
                                <MenuItem key={p.id} value={p.id}>
                                  {p.name}
                                </MenuItem>
                              ))}
                            </Select>
                          </TableCell>
                          <TableCell sx={{ color: 'text.secondary' }}>
                            {row.matches?.length ? row.matches[0].category : row.done ? 'No match' : '—'}
                          </TableCell>
                          <TableCell align="center">
                            {!row.done || !row.expectedId ? (
                              '—'
                            ) : ok ? (
                              <Iconify icon="solar:check-circle-bold" sx={{ color: 'success.main' }} />
                            ) : (
                              <Iconify icon="solar:close-circle-bold" sx={{ color: 'error.main' }} />
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </Scrollbar>
          )}
        </Box>
      </Card>
    </DashboardContent>
  );
}

// ----------------------------------------------------------------------

function Metric({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <Card sx={{ p: 2.5, bgcolor: 'background.neutral' }}>
      <Typography variant="h3" sx={{ color: color ?? 'text.primary' }}>
        {value}
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        {label}
      </Typography>
      {sub && (
        <Typography variant="caption" sx={{ color: 'text.disabled' }}>
          {sub}
        </Typography>
      )}
    </Card>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Typography variant="h6">{value}</Typography>
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        {label}
      </Typography>
    </Box>
  );
}
