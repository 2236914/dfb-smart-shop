import type { ProductCategory } from 'src/data/types';

import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import Button from '@mui/material/Button';
import Select from '@mui/material/Select';
import Switch from '@mui/material/Switch';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import Checkbox from '@mui/material/Checkbox';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';
import FormControlLabel from '@mui/material/FormControlLabel';

import { useAsync } from 'src/hooks/use-async';
import { useRealtimeRefetch } from 'src/hooks/use-realtime';

import { getStockStatus } from 'src/data/status';
import { PRODUCT_CATEGORIES } from 'src/data/types';
import { fetchVisibleProducts } from 'src/services/db';

import { StoreProductCard } from '../product-card';

// ----------------------------------------------------------------------
// W-2. Catalog / Shop Page — live inventory with filters + sort.
// ----------------------------------------------------------------------

type SortKey = 'newest' | 'price_asc' | 'price_desc' | 'name';

export function StoreCatalogView() {
  const [searchParams] = useSearchParams();
  const query = (searchParams.get('q') ?? '').trim().toLowerCase();

  const { data, loading, refetch } = useAsync(fetchVisibleProducts, []);
  useRealtimeRefetch('products', refetch);
  const allProducts = useMemo(() => data ?? [], [data]);

  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [sort, setSort] = useState<SortKey>('newest');

  const toggleCategory = (category: ProductCategory) =>
    setCategories((prev) =>
      prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category]
    );

  const clearFilters = () => {
    setCategories([]);
    setInStockOnly(false);
    setSort('newest');
  };

  const products = useMemo(() => {
    let list = allProducts;
    if (query)
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(query) || p.description.toLowerCase().includes(query)
      );
    if (categories.length) list = list.filter((p) => categories.includes(p.category));
    if (inStockOnly) list = list.filter((p) => getStockStatus(p) !== 'out_of_stock');

    list = [...list];
    switch (sort) {
      case 'price_asc':
        return [...list].sort((a, b) => a.basePrice - b.basePrice);
      case 'price_desc':
        return [...list].sort((a, b) => b.basePrice - a.basePrice);
      case 'name':
        return [...list].sort((a, b) => a.name.localeCompare(b.name));
      default:
        return list;
    }
  }, [allProducts, query, categories, inStockOnly, sort]);

  return (
    <Box>
      <Typography variant="h4">
        {query ? `Results for “${query}”` : 'Shop All Products'}
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
        Showing {products.length} item{products.length === 1 ? '' : 's'}
      </Typography>

      <Grid container spacing={3}>
        {/* Filter sidebar */}
        <Grid size={{ xs: 12, md: 3 }}>
          <Card sx={{ p: 2.5 }}>
            <Typography variant="h6" sx={{ mb: 1 }}>
              Filter
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
              {PRODUCT_CATEGORIES.map((category) => (
                <FormControlLabel
                  key={category}
                  control={
                    <Checkbox
                      checked={categories.includes(category)}
                      onChange={() => toggleCategory(category)}
                    />
                  }
                  label={category}
                />
              ))}
            </Box>

            <Divider sx={{ my: 2, borderStyle: 'dashed' }} />

            <FormControlLabel
              control={
                <Switch checked={inStockOnly} onChange={(e) => setInStockOnly(e.target.checked)} />
              }
              label="In stock only"
            />

            <Divider sx={{ my: 2, borderStyle: 'dashed' }} />

            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Sort by
            </Typography>
            <Select
              fullWidth
              size="small"
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
            >
              <MenuItem value="newest">Newest</MenuItem>
              <MenuItem value="price_asc">Price (Low to High)</MenuItem>
              <MenuItem value="price_desc">Price (High to Low)</MenuItem>
              <MenuItem value="name">Name (A–Z)</MenuItem>
            </Select>

            <Button fullWidth color="inherit" onClick={clearFilters} sx={{ mt: 2 }}>
              Clear Filters
            </Button>
          </Card>
        </Grid>

        {/* Product grid */}
        <Grid size={{ xs: 12, md: 9 }}>
          {loading ? (
            <Card sx={{ p: 8 }}>
              <LinearProgress sx={{ maxWidth: 320, mx: 'auto' }} />
            </Card>
          ) : products.length === 0 ? (
            <Card sx={{ p: 8, textAlign: 'center' }}>
              <Typography variant="body1" sx={{ color: 'text.secondary', mb: 2 }}>
                No products match your filters.
              </Typography>
              <Button variant="contained" onClick={clearFilters}>
                Reset Filters
              </Button>
            </Card>
          ) : (
            <Grid container spacing={3}>
              {products.map((product) => (
                <Grid key={product.id} size={{ xs: 6, sm: 4 }}>
                  <StoreProductCard product={product} />
                </Grid>
              ))}
            </Grid>
          )}
        </Grid>
      </Grid>
    </Box>
  );
}
