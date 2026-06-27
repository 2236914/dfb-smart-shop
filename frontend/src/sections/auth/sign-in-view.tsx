import { useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import InputAdornment from '@mui/material/InputAdornment';

import { useRouter } from 'src/routes/hooks';
import { RouterLink } from 'src/routes/components';

import { useAuth } from 'src/auth';
import { supabase } from 'src/lib/supabase';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------
// Unified Sign In — the single source of truth for authentication.
// One form for everyone. After Supabase auth we read the account's role via
// the is_admin() RPC and send the user to the matching panel:
//   admin  → /admin   (owner back-office)
//   buyer  → /buyer   (customer account app)
// The role decides the destination, not which page the user started on, so an
// owner who signs in here still lands in the admin panel.
// ----------------------------------------------------------------------

export function SignInView() {
  const router = useRouter();
  const { signIn, session, isAdmin, metaUserId, loading: authLoading } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Already signed in (e.g. returning to /login) → bounce to the right panel.
  useEffect(() => {
    if (authLoading || !session) return;
    if (metaUserId !== session.user.id) return; // role not resolved yet
    router.replace(isAdmin ? '/admin' : '/buyer');
  }, [authLoading, session, isAdmin, metaUserId, router]);

  const handleSignIn = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Please enter your email and password.');
      return;
    }
    setError('');
    setLoading(true);

    const { error: signInError } = await signIn(email, password);
    if (signInError) {
      setError(signInError);
      setLoading(false);
      return;
    }

    // Read the role straight from the source of truth, then route accordingly.
    const { data: admin } = await supabase.rpc('is_admin');
    setLoading(false);
    router.replace(admin === true ? '/admin' : '/buyer');
  };

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <Box sx={{ textAlign: 'center', mb: 4 }}>
        <Typography variant="h4">Welcome Back</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>
          Sign in to your account to continue.
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Box
        component="form"
        onSubmit={(e) => {
          e.preventDefault();
          handleSignIn();
        }}
        sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}
      >
        <TextField
          fullWidth
          label="Email Address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <TextField
          fullWidth
          type={showPassword ? 'text' : 'password'}
          label="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          slotProps={{
            inputLabel: { shrink: true },
            input: {
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={() => setShowPassword(!showPassword)} edge="end">
                    <Iconify icon={showPassword ? 'solar:eye-bold' : 'solar:eye-closed-bold'} />
                  </IconButton>
                </InputAdornment>
              ),
            },
          }}
        />
        <Link
          component={RouterLink}
          href="/login/forgot-password"
          variant="body2"
          color="inherit"
          sx={{ alignSelf: 'flex-end' }}
        >
          Forgot password?
        </Link>
        <Button fullWidth size="large" type="submit" variant="contained" loading={loading}>
          Sign In
        </Button>
      </Box>

      <Divider sx={{ my: 3, typography: 'body2', color: 'text.disabled' }}>New here?</Divider>

      <Button
        fullWidth
        size="large"
        variant="outlined"
        color="inherit"
        component={RouterLink}
        href="/login/register"
      >
        Create an Account
      </Button>
    </Box>
  );
}
