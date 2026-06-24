import type { BoxProps } from '@mui/material/Box';

import Box from '@mui/material/Box';
import Link from '@mui/material/Link';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------
// LocationMap — a real, interactive map with a pin, embedded via Google Maps
// (no API key needed). `query` is an address or "lat,lng"; the map geocodes it
// and drops a marker. Includes a "Open in Google Maps" link for directions.
// ----------------------------------------------------------------------

type LocationMapProps = BoxProps & {
  query: string;
  height?: number | string;
  zoom?: number;
  showDirections?: boolean;
};

export function LocationMap({
  query,
  height = 240,
  zoom = 15,
  showDirections = true,
  sx,
  ...other
}: LocationMapProps) {
  const encoded = encodeURIComponent(query);
  const embedSrc = `https://www.google.com/maps?q=${encoded}&z=${zoom}&output=embed`;
  const openSrc = `https://www.google.com/maps/search/?api=1&query=${encoded}`;

  return (
    <Box sx={[{ position: 'relative' }, ...(Array.isArray(sx) ? sx : [sx])]} {...other}>
      <Box
        component="iframe"
        title={`Map of ${query}`}
        src={embedSrc}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        sx={{
          width: '100%',
          height,
          border: 0,
          display: 'block',
          borderRadius: 1.5,
        }}
      />
      {showDirections && (
        <Link
          href={openSrc}
          target="_blank"
          rel="noopener"
          variant="caption"
          sx={{
            mt: 1,
            gap: 0.5,
            display: 'inline-flex',
            alignItems: 'center',
            fontWeight: 600,
          }}
        >
          <Iconify icon="solar:map-point-bold" width={16} />
          Open in Google Maps
        </Link>
      )}
    </Box>
  );
}
