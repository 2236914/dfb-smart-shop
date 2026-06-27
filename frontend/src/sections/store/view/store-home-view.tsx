import { useMemo } from 'react';
import { varAlpha } from 'minimal-shared/utils';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import Link from '@mui/material/Link';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';

import { RouterLink } from 'src/routes/components';

import { useAsync } from 'src/hooks/use-async';
import { useRealtimeRefetch } from 'src/hooks/use-realtime';

import { fetchActivePromos, fetchVisibleProducts } from 'src/services/db';

import { Iconify } from 'src/components/iconify';

import { StoreProductCard } from '../product-card';

// ----------------------------------------------------------------------
// W-1. Home / Landing Page — hero (live promoList), quick actions, featured.
// ----------------------------------------------------------------------

const QUICK_ACTIONS = [
  {
    title: 'Browse Catalog',
    body: 'See all glass, aluminum profiles, and hardware.',
    link: 'Open Catalog',
    href: '/catalog',
    icon: 'solar:widget-5-bold-duotone',
    tour: 'browse',
  },
  {
    title: 'Snap & Search',
    body: "Upload a photo of a part and we'll match it to our stock.",
    link: 'Start Visual Search',
    href: '/visual-search',
    icon: 'solar:camera-bold-duotone',
    tour: 'visual-search',
  },
  {
    title: 'Instant Quote',
    body: 'Enter width and height to get a price in seconds.',
    link: 'Get a Quote',
    href: '/quote',
    icon: 'solar:calculator-bold-duotone',
    tour: 'quote',
  },
];

export function StoreHomeView() {
  const { data, refetch } = useAsync(async () => {
    const [promos, products] = await Promise.all([fetchActivePromos(), fetchVisibleProducts()]);
    return { activeBanner: promos[0], featured: products.slice(0, 4) };
  }, []);
  useRealtimeRefetch(['promos', 'products'], refetch);

  const activeBanner = data?.activeBanner;
  const featured = useMemo(() => data?.featured ?? [], [data]);

  return (
    <Box>
      {/* Hero */}
      <Card
        sx={{
          p: { xs: 4, md: 6 },
          mb: 2,
          color: 'common.white',
          position: 'relative',
          overflow: 'hidden',
          background: (theme) =>
            `linear-gradient(120deg, ${theme.vars.palette.primary.darker}, ${theme.vars.palette.primary.main})`,
        }}
      >
        <Box sx={{ position: 'relative', zIndex: 1, maxWidth: 620 }}>
          <Typography variant="h2" sx={{ mb: 2 }}>
            Glass &amp; Aluminum, Made Simple.
          </Typography>
          <Typography variant="h6" sx={{ fontWeight: 400, opacity: 0.9, mb: 4 }}>
            Get instant prices for custom sizes. Find the part you need — even if you don&apos;t
            know its name.
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Button
              component={RouterLink}
              href="/catalog"
              size="large"
              variant="contained"
              sx={{
                bgcolor: 'common.white',
                color: 'primary.main',
                fontWeight: 700,
                '&:hover': { bgcolor: 'grey.200' },
              }}
            >
              Shop Now
            </Button>
            <Button
              component={RouterLink}
              href="/visual-search"
              size="large"
              variant="outlined"
              sx={{ color: 'common.white', borderColor: varAlpha('255 255 255', 0.5) }}
            >
              Try Visual Search
            </Button>
          </Box>
        </Box>
        {activeBanner && (
          <Box
            component="img"
            src={activeBanner.image}
            alt={activeBanner.caption}
            sx={{
              right: 0,
              top: 0,
              height: 1,
              width: '40%',
              objectFit: 'cover',
              position: 'absolute',
              display: { xs: 'none', md: 'block' },
              opacity: 0.35,
            }}
          />
        )}
      </Card>

      {/* Rotating promo strip */}
      {activeBanner && (
        <Box
          sx={{
            py: 1.25,
            px: 2,
            mb: 4,
            borderRadius: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            bgcolor: (theme) => varAlpha(theme.vars.palette.warning.mainChannel, 0.16),
          }}
        >
          <Iconify icon="solar:bell-bing-bold" sx={{ color: 'warning.darker' }} />
          <Typography variant="subtitle2" sx={{ color: 'warning.darker' }}>
            {activeBanner.caption}
          </Typography>
        </Box>
      )}

      {/* Quick actions */}
      <Grid container spacing={3} sx={{ mb: 6 }}>
        {QUICK_ACTIONS.map((action) => (
          <Grid key={action.title} size={{ xs: 12, md: 4 }}>
            <Card data-tour={action.tour} sx={{ p: 3, height: 1 }}>
              <Iconify icon={action.icon} width={40} sx={{ color: 'primary.main', mb: 2 }} />
              <Typography variant="h6">{action.title}</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', my: 1 }}>
                {action.body}
              </Typography>
              <Link component={RouterLink} href={action.href} variant="subtitle2">
                {action.link} →
              </Link>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Featured */}
      <Typography variant="h4" sx={{ mb: 3 }}>
        Popular Items
      </Typography>
      <Grid container spacing={3}>
        {featured.map((product) => (
          <Grid key={product.id} size={{ xs: 6, md: 3 }}>
            <StoreProductCard product={product} />
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
