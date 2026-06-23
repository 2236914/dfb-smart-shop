import type { LinkProps } from '@mui/material/Link';

import { mergeClasses } from 'minimal-shared/utils';

import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import { styled } from '@mui/material/styles';

import { RouterLink } from 'src/routes/components';

import { logoClasses } from './classes';

// ----------------------------------------------------------------------
// DFB Smart Shop logo. `isSingle` (default) renders just the square "DFB"
// mark; otherwise it adds the "DFB Smart Shop" wordmark beside it.
// ----------------------------------------------------------------------

export type LogoProps = LinkProps & {
  isSingle?: boolean;
  disabled?: boolean;
};

export function Logo({
  sx,
  disabled,
  className,
  href = '/',
  isSingle = true,
  ...other
}: LogoProps) {
  return (
    <LogoRoot
      component={RouterLink}
      href={href}
      aria-label="DFB Smart Shop"
      underline="none"
      className={mergeClasses([logoClasses.root, className])}
      sx={[
        {
          height: 40,
          width: isSingle ? 40 : 'auto',
          ...(disabled && { pointerEvents: 'none' }),
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
      {...other}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box
          sx={{
            width: 40,
            height: 40,
            flexShrink: 0,
            borderRadius: 1.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'common.white',
            fontWeight: 800,
            fontSize: 13,
            letterSpacing: '0.5px',
            background: (theme) =>
              `linear-gradient(135deg, ${theme.vars.palette.primary.main}, ${theme.vars.palette.primary.dark})`,
          }}
        >
          DFB
        </Box>
        {!isSingle && (
          <Box
            component="span"
            sx={{
              fontWeight: 800,
              fontSize: 18,
              whiteSpace: 'nowrap',
              color: 'text.primary',
            }}
          >
            DFB Smart Shop
          </Box>
        )}
      </Box>
    </LogoRoot>
  );
}

// ----------------------------------------------------------------------

const LogoRoot = styled(Link)(() => ({
  flexShrink: 0,
  display: 'inline-flex',
  verticalAlign: 'middle',
}));
