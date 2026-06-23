import type { CardProps } from '@mui/material/Card';
import type { PaletteColorKey } from 'src/theme/core';

import { varAlpha } from 'minimal-shared/utils';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import { useTheme } from '@mui/material/styles';
import Typography from '@mui/material/Typography';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

type Props = CardProps & {
  title: string;
  total: number | string;
  icon: string;
  color?: PaletteColorKey;
};

export function DfbSummaryCard({ title, total, icon, color = 'primary', sx, ...other }: Props) {
  const theme = useTheme();

  return (
    <Card
      sx={[
        {
          p: 3,
          gap: 2,
          display: 'flex',
          alignItems: 'center',
          boxShadow: 'none',
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
      {...other}
    >
      <Box
        sx={{
          width: 56,
          height: 56,
          flexShrink: 0,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: `${color}.darker`,
          bgcolor: varAlpha(theme.vars.palette[color].mainChannel, 0.12),
        }}
      >
        <Iconify icon={icon} width={28} />
      </Box>

      <Box sx={{ minWidth: 0 }}>
        <Typography variant="h4">{total}</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.3 }}>
          {title}
        </Typography>
      </Box>
    </Card>
  );
}
