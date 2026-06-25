import { useMemo, useState } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';

import { RouterLink } from 'src/routes/components';

import { useAsync } from 'src/hooks/use-async';

import { fetchVisibleProducts } from 'src/services/db';
import { fPeso, computeUnitPrice } from 'src/data/pricing';

import { useToast } from 'src/components/toast';
import { Iconify } from 'src/components/iconify';

import { useCart } from '../cart-context';

// ----------------------------------------------------------------------
// W-2b. Instant Quote — pick a product, enter a size, and the price updates
// LIVE as you type (Objective 3: the pricing algorithm dynamically updates the
// total cost based on user-defined dimensions — a real-time price quote).
// ----------------------------------------------------------------------

export function StoreQuoteView() {
  const { addItem } = useCart();
  const { showToast, toast } = useToast();
  const { data, loading } = useAsync(fetchVisibleProducts, []);
  const products = useMemo(() => data ?? [], [data]);

  const [productId, setProductId] = useState('');
  const [width, setWidth] = useState('');
  const [height, setHeight] = useState('');
  const [qty, setQty] = useState('1');

  const product = products.find((p) => p.id === productId);
  const quantity = Math.max(1, Number(qty) || 1);

  const w = Number(width);
  const h = Number(height);
  const dimsValid = !!width && !!height && !Number.isNaN(w) && !Number.isNaN(h) && w > 0 && h > 0;

  // Live price: recomputes on every change to product / width / height — no
  // "calculate" button, so the quote is genuinely real-time (Objective 3).
  const result = useMemo(
    () => (product && dimsValid ? computeUnitPrice({ base: product.basePrice, width: w, height: h }) : null),
    [product, dimsValid, w, h]
  );

  const handleAddToCart = () => {
    if (!product || !result) return;
    addItem({
      productId: product.id,
      name: product.name,
      image: product.images[0] ?? '',
      basePrice: product.basePrice,
      width: w,
      height: h,
      qty: quantity,
      unitPrice: result.unit,
      source: 'manual',
    });
    showToast('Added to cart.');
  };

  return (
    <Box>
      <Typography variant="h4">Instant Quote</Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
        Choose an item and enter your measurements — the estimated price updates instantly as you
        type. The shop confirms the final amount.
      </Typography>

      {loading && <LinearProgress sx={{ mb: 3 }} />}

      <Grid container spacing={3}>
        {/* Inputs */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ p: 3 }}>
            <TextField
              select
              fullWidth
              label="Product"
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              sx={{ mb: 2.5 }}
              slotProps={{ inputLabel: { shrink: true } }}
            >
              <MenuItem value="" disabled>
                Select a product…
              </MenuItem>
              {products.map((p) => (
                <MenuItem key={p.id} value={p.id}>
                  {p.name} — {fPeso(p.basePrice)} base
                </MenuItem>
              ))}
            </TextField>

            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="Width (inches)"
                placeholder="e.g., 24"
                value={width}
                onChange={(e) => setWidth(e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <TextField
                label="Height (inches)"
                placeholder="e.g., 36"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <TextField
                label="Qty"
                type="number"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                sx={{ width: 96 }}
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Box>

            <Typography variant="caption" sx={{ display: 'block', color: 'text.disabled', mt: 2 }}>
              {!product
                ? 'Select a product to begin.'
                : dimsValid
                  ? 'Your estimate updates automatically on the right.'
                  : 'Enter a width and height greater than 0 to see the price.'}
            </Typography>
          </Card>
        </Grid>

        {/* Result */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ p: 3, height: 1, bgcolor: 'background.neutral' }}>
            {!result ? (
              <Box
                sx={{
                  height: 1,
                  minHeight: 220,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'text.disabled',
                  textAlign: 'center',
                }}
              >
                <Iconify icon="solar:calculator-bold-duotone" width={48} />
                <Typography variant="body2" sx={{ mt: 1 }}>
                  Your estimate will appear here.
                </Typography>
              </Box>
            ) : (
              <>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <Typography variant="subtitle1" sx={{ flexGrow: 1 }}>
                    {product?.name}
                  </Typography>
                  <Chip
                    size="small"
                    color="success"
                    label="Live estimate"
                    icon={<Iconify icon="solar:bolt-bold" width={14} />}
                  />
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 2 }}>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    Estimated price:
                  </Typography>
                  <Typography variant="h4">{fPeso(result.unit * quantity)}</Typography>
                </Box>

                <Row label="Base material" value={fPeso(result.base)} />
                <Row label="Surface area (W × H × 1.5)" value={fPeso(result.surface)} />
                <Row label="Frame / perimeter (2 × (W + H) × 2)" value={fPeso(result.perimeter)} />
                <Divider sx={{ my: 1, borderStyle: 'dashed' }} />
                <Row label="Per unit" value={fPeso(result.unit)} bold />
                <Row
                  label={`× ${quantity} unit${quantity > 1 ? 's' : ''}`}
                  value={fPeso(result.unit * quantity)}
                  bold
                />

                <Typography variant="caption" sx={{ display: 'block', color: 'text.disabled', mt: 1.5 }}>
                  Estimate only — the shop confirms the final amount based on stock and finishing.
                </Typography>

                <Box sx={{ display: 'flex', gap: 1.5, mt: 2.5 }}>
                  <Button
                    fullWidth
                    variant="contained"
                    startIcon={<Iconify icon="solar:cart-plus-bold" />}
                    onClick={handleAddToCart}
                  >
                    Add to Cart
                  </Button>
                  {product && (
                    <Button
                      fullWidth
                      variant="outlined"
                      color="inherit"
                      component={RouterLink}
                      href={`/product/${product.id}`}
                    >
                      View Product
                    </Button>
                  )}
                </Box>
              </>
            )}
          </Card>
        </Grid>
      </Grid>

      {toast}
    </Box>
  );
}

// ----------------------------------------------------------------------

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.25 }}>
      <Typography
        variant={bold ? 'subtitle2' : 'body2'}
        sx={{ color: bold ? 'text.primary' : 'text.secondary' }}
      >
        {label}
      </Typography>
      <Typography variant={bold ? 'subtitle2' : 'body2'}>{value}</Typography>
    </Box>
  );
}
