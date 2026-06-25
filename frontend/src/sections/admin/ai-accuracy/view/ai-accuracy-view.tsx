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
// AI Visual Search — Accuracy (Objective 2). The model is a KNN classifier
// trained on MobileNet embeddings of a curated per-category photo set
// (transfer learning). "Run benchmark" measures real top-1 category accuracy on
// a HELD-OUT test set (photos never used in training) — overall and per
// category. A second tool lets you try your own photos.
// ----------------------------------------------------------------------

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
  const [trainedCount, setTrainedCount] = useState<number | null>(null);

  const [rows, setRows] = useState<Row[]>([]);
  const [running, setRunning] = useState(false);

  const runBenchmark = useCallback(async () => {
    setBenching(true);
    try {
      const n = await trainCategoryModel();
      setTrainedCount(n);
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
    if (!isKnnTrained()) setTrainedCount(await trainCategoryModel());
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
  const overallPct = bench ? Math.round(bench.overall * 100) : 0;

  return (
    <DashboardContent>
      <Typography variant="h4" sx={{ mb: 1 }}>
        AI Visual Search — Accuracy
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
        The visual search uses transfer learning: a KNN classifier trained on MobileNet embeddings of
        a per-category photo set. The benchmark below measures <b>real top-1 category accuracy</b> on a
        held-out test set (photos the model never trained on).
      </Typography>

      {/* Benchmark */}
      <Card sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="subtitle1">Benchmark (held-out test set)</Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Trains the model, then tests it on unseen photos and reports accuracy per category.
            </Typography>
          </Box>
          <Button
            variant="contained"
            disabled={benching}
            startIcon={<Iconify icon="solar:test-tube-bold" />}
            onClick={runBenchmark}
          >
            {benching ? 'Running…' : 'Run benchmark'}
          </Button>
        </Box>

        {benching && <LinearProgress sx={{ mt: 2 }} />}

        {bench && (
          <Box sx={{ mt: 3 }}>
            <Box
              sx={{
                display: 'grid',
                gap: 2,
                mb: 3,
                gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(3, 1fr)' },
              }}
            >
              <Metric
                label="Overall top-1 accuracy"
                value={`${overallPct}%`}
                color={overallPct >= 80 ? 'success.main' : overallPct >= 60 ? 'warning.main' : 'error.main'}
              />
              <Metric label="Held-out test photos" value={`${bench.correct}/${bench.total}`} />
              <Metric label="Training photos learned" value={`${trainedCount ?? 0}`} />
            </Box>

            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Category (dimension)</TableCell>
                    <TableCell align="center">Correct / Total</TableCell>
                    <TableCell align="right">Accuracy</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {bench.perCategory.map((c) => {
                    const p = c.total ? Math.round((c.correct / c.total) * 100) : 0;
                    return (
                      <TableRow key={c.label}>
                        <TableCell>{c.label}</TableCell>
                        <TableCell align="center">
                          {c.correct} / {c.total}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>
                          {p}%
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}
      </Card>

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

          <Scrollbar>
            <TableContainer>
              <Table sx={{ minWidth: 720 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Photo</TableCell>
                    <TableCell>Expected product</TableCell>
                    <TableCell>AI label</TableCell>
                    <TableCell>Matched category</TableCell>
                    <TableCell align="center">Result</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} sx={{ color: 'text.disabled' }}>
                        No photos added yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((row) => {
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
                          <TableCell sx={{ color: 'text.secondary' }}>{row.topLabel ?? '—'}</TableCell>
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
                    })
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Scrollbar>
        </Box>
      </Card>

      <Alert severity="info" sx={{ mt: 2 }}>
        The benchmark is the figure to cite for accuracy. Add more training photos per category (in
        the dataset) to raise it; the held-out test set keeps the measure honest.
      </Alert>
    </DashboardContent>
  );
}

// ----------------------------------------------------------------------

function Metric({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <Card sx={{ p: 2.5, bgcolor: 'background.neutral' }}>
      <Typography variant="h3" sx={{ color: color ?? 'text.primary' }}>
        {value}
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        {label}
      </Typography>
    </Card>
  );
}
