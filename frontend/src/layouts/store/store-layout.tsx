import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import List from '@mui/material/List';
import Menu from '@mui/material/Menu';
import Badge from '@mui/material/Badge';
import AppBar from '@mui/material/AppBar';
import Drawer from '@mui/material/Drawer';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Toolbar from '@mui/material/Toolbar';
import MenuItem from '@mui/material/MenuItem';
import ListItem from '@mui/material/ListItem';
import Container from '@mui/material/Container';
import { useTheme } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import ListItemButton from '@mui/material/ListItemButton';

import { usePathname } from 'src/routes/hooks';
import { RouterLink } from 'src/routes/components';

import { useAuth } from 'src/auth';

import { Logo } from 'src/components/logo';
import { Iconify } from 'src/components/iconify';
import { OfflineNotice } from 'src/components/offline-notice';

import { useCart } from 'src/sections/store/cart-context';
import { useStoreTour } from 'src/sections/store/use-store-tour';
import { VisualSearchProvider } from 'src/sections/store/visual-search';

import { StoreSearchbar } from './store-searchbar';
import { LanguageSwitcher } from '../components/language-switcher';

// ----------------------------------------------------------------------
// Public Webshop storefront shell — top navigation + footer (W-1 … W-10).
// ----------------------------------------------------------------------

const NAV_LINKS = [
  { key: 'nav.home', href: '/' },
  { key: 'nav.shop', href: '/catalog' },
  { key: 'nav.about', href: '/about' },
  { key: 'nav.contact', href: '/contact' },
];

const FOOTER_LINKS = [
  { key: 'footer.shop', href: '/catalog' },
  { key: 'footer.visualSearch', href: '/visual-search' },
  { key: 'footer.aboutUs', href: '/about' },
  { key: 'footer.contact', href: '/contact' },
  { key: 'footer.storeHours', href: '/contact' },
];

export function StoreLayout({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  const pathname = usePathname();
  const { t } = useTranslation();
  const { count } = useCart();
  const { startTour } = useStoreTour();
  const { session, profile, isAdmin, signOut } = useAuth();
  const [openDrawer, setOpenDrawer] = useState(false);
  const [accountEl, setAccountEl] = useState<HTMLElement | null>(null);

  const isLoggedIn = !!session;
  const firstName = profile?.full_name?.trim().split(' ')[0] || (isAdmin ? 'Owner' : 'Account');
  const accountHref = isAdmin ? '/admin' : '/buyer';

  const renderLogo = <Logo isSingle={false} />;

  const renderActions = (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      <IconButton onClick={startTour} title="Take a tour">
        <Iconify icon="solar:question-circle-bold-duotone" width={24} />
      </IconButton>
      <IconButton component={RouterLink} href="/cart" data-tour="cart">
        <Badge badgeContent={count} color="error">
          <Iconify icon="solar:cart-large-2-bold-duotone" width={24} />
        </Badge>
      </IconButton>
      <LanguageSwitcher />

      {isLoggedIn ? (
        <>
          <Button
            onClick={(e) => setAccountEl(e.currentTarget)}
            color="inherit"
            size="small"
            startIcon={
              <Avatar sx={{ width: 24, height: 24, fontSize: 13, bgcolor: 'primary.main' }}>
                {firstName.charAt(0).toUpperCase()}
              </Avatar>
            }
            endIcon={<Iconify icon="eva:chevron-down-fill" width={16} />}
            sx={{ ml: 1, display: { xs: 'none', sm: 'inline-flex' } }}
          >
            {firstName}
          </Button>
          <Menu
            anchorEl={accountEl}
            open={!!accountEl}
            onClose={() => setAccountEl(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          >
            <MenuItem component={RouterLink} href={accountHref} onClick={() => setAccountEl(null)}>
              {isAdmin ? 'Admin Dashboard' : 'My Account'}
            </MenuItem>
            {!isAdmin && (
              <MenuItem
                component={RouterLink}
                href="/buyer/orders"
                onClick={() => setAccountEl(null)}
              >
                My Orders
              </MenuItem>
            )}
            <Divider />
            <MenuItem
              onClick={async () => {
                setAccountEl(null);
                await signOut();
              }}
              sx={{ color: 'error.main' }}
            >
              Sign Out
            </MenuItem>
          </Menu>
        </>
      ) : (
        <Button
          component={RouterLink}
          href="/login"
          variant="outlined"
          color="inherit"
          size="small"
          sx={{ ml: 1, display: { xs: 'none', sm: 'inline-flex' } }}
        >
          {t('nav.signIn')}
        </Button>
      )}
      <IconButton
        onClick={() => setOpenDrawer(true)}
        sx={{ display: { md: 'none' } }}
      >
        <Iconify icon="solar:hamburger-menu-line-duotone" width={24} />
      </IconButton>
    </Box>
  );

  return (
    <VisualSearchProvider>
      <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <AppBar
          position="sticky"
          elevation={0}
          sx={{
            bgcolor: 'background.paper',
            color: 'text.primary',
            borderBottom: `1px solid ${theme.vars.palette.divider}`,
          }}
        >
          <Container maxWidth="lg">
            <Toolbar disableGutters sx={{ gap: 2 }}>
              {renderLogo}

              <Box
                sx={{
                  flexGrow: 1,
                  gap: 1,
                  ml: 2,
                  display: { xs: 'none', md: 'flex' },
                }}
              >
                {NAV_LINKS.map((link) => {
                  const active = pathname === link.href;
                  return (
                    <Button
                      key={link.href}
                      component={RouterLink}
                      href={link.href}
                      color="inherit"
                      sx={{
                        color: active ? 'primary.main' : 'text.secondary',
                        fontWeight: active ? 700 : 500,
                      }}
                    >
                      {t(link.key)}
                    </Button>
                  );
                })}
              </Box>

              <Box sx={{ flexGrow: { xs: 1, md: 0 } }} />

              <Box sx={{ display: { xs: 'none', md: 'flex' }, mr: 1 }}>
                <StoreSearchbar />
              </Box>

              {renderActions}
            </Toolbar>
          </Container>
        </AppBar>

        <Drawer anchor="right" open={openDrawer} onClose={() => setOpenDrawer(false)}>
          <Box sx={{ width: 240, pt: 2 }}>
            <List>
              {NAV_LINKS.map((link) => (
                <ListItem key={link.href} disablePadding>
                  <ListItemButton
                    component={RouterLink}
                    href={link.href}
                    onClick={() => setOpenDrawer(false)}
                    selected={pathname === link.href}
                  >
                    {t(link.key)}
                  </ListItemButton>
                </ListItem>
              ))}
              {isLoggedIn ? (
                <>
                  <ListItem disablePadding>
                    <ListItemButton
                      component={RouterLink}
                      href={accountHref}
                      onClick={() => setOpenDrawer(false)}
                    >
                      {isAdmin ? 'Admin Dashboard' : 'My Account'}
                    </ListItemButton>
                  </ListItem>
                  {!isAdmin && (
                    <ListItem disablePadding>
                      <ListItemButton
                        component={RouterLink}
                        href="/buyer/orders"
                        onClick={() => setOpenDrawer(false)}
                      >
                        My Orders
                      </ListItemButton>
                    </ListItem>
                  )}
                  <ListItem disablePadding>
                    <ListItemButton
                      onClick={async () => {
                        setOpenDrawer(false);
                        await signOut();
                      }}
                      sx={{ color: 'error.main' }}
                    >
                      Sign Out
                    </ListItemButton>
                  </ListItem>
                </>
              ) : (
                <ListItem disablePadding>
                  <ListItemButton
                    component={RouterLink}
                    href="/login"
                    onClick={() => setOpenDrawer(false)}
                  >
                    {t('nav.signIn')}
                  </ListItemButton>
                </ListItem>
              )}
            </List>
          </Box>
        </Drawer>

        <Box component="main" sx={{ flex: 1 }}>
          <Container maxWidth="lg" sx={{ py: 4 }}>
            <OfflineNotice />
            {children}
          </Container>
        </Box>

        <Box
          component="footer"
          sx={{
            py: 5,
            mt: 4,
            borderTop: `1px solid ${theme.vars.palette.divider}`,
            bgcolor: 'background.neutral',
          }}
        >
          <Container maxWidth="lg">
            <Typography variant="subtitle2">New DFB Glass &amp; Aluminum</Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
              {t('footer.address')}
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 2 }}>
              {FOOTER_LINKS.map((link) => (
                <Link
                  key={link.key}
                  component={RouterLink}
                  href={link.href}
                  variant="body2"
                  color="text.secondary"
                >
                  {t(link.key)}
                </Link>
              ))}
            </Box>
            <Typography variant="caption" sx={{ color: 'text.disabled' }}>
              {t('footer.disclaimer')}
            </Typography>
          </Container>
        </Box>
      </Box>
    </VisualSearchProvider>
  );
}
