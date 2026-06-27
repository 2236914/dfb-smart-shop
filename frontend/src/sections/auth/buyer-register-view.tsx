import { useState } from 'react';

import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import FormControlLabel from '@mui/material/FormControlLabel';

import { useRouter } from 'src/routes/hooks';
import { RouterLink } from 'src/routes/components';

import { useAuth } from 'src/auth';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------
// B-2. Create Account / Register Page — Supabase Authentication (Objective 4).
// ----------------------------------------------------------------------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function BuyerRegisterView() {
  const router = useRouter();
  const { signUp } = useAuth();

  const [form, setForm] = useState({
    fullName: '',
    mobile: '',
    email: '',
    password: '',
    confirm: '',
    agree: false,
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirmSent, setConfirmSent] = useState(false);

  const set = (key: keyof typeof form, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleCreate = async () => {
    if (!form.fullName.trim()) {
      setError('Please enter your full name.');
      return;
    }
    if (!EMAIL_RE.test(form.email)) {
      setError('Please enter a valid email address.');
      return;
    }
    if (form.password.length < 8) {
      setError('Please use at least 8 characters for your password.');
      return;
    }
    if (form.password !== form.confirm) {
      setError('Passwords do not match.');
      return;
    }
    setError('');
    setLoading(true);

    const { error: signUpError, needsConfirmation } = await signUp(
      form.email,
      form.password,
      form.fullName,
      form.mobile
    );
    setLoading(false);

    if (signUpError) {
      setError(signUpError);
      return;
    }
    if (needsConfirmation) {
      setConfirmSent(true); // email confirmation required before sign-in
      return;
    }
    router.push('/buyer'); // signed in immediately
  };

  if (confirmSent) {
    return (
      <Box sx={{ textAlign: 'center' }}>
        <Iconify icon="solar:letter-opened-bold-duotone" width={64} sx={{ color: 'primary.main' }} />
        <Typography variant="h5" sx={{ mt: 2 }}>
          Confirm your email
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1, mb: 3 }}>
          We sent a confirmation link to <strong>{form.email}</strong>. Click it, then sign in.
        </Typography>
        <Button component={RouterLink} href="/login" variant="contained">
          Back to Sign In
        </Button>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ textAlign: 'center', mb: 4 }}>
        <Typography variant="h4">Create Your Account</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>
          Save your details for faster ordering.
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
          handleCreate();
        }}
        sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}
      >
        <TextField
          fullWidth
          label="Full Name"
          value={form.fullName}
          onChange={(e) => set('fullName', e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <TextField
          fullWidth
          label="Mobile Number"
          placeholder="09XX XXX XXXX"
          value={form.mobile}
          onChange={(e) => set('mobile', e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <TextField
          fullWidth
          label="Email Address"
          value={form.email}
          onChange={(e) => set('email', e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <TextField
          fullWidth
          type="password"
          label="Password"
          helperText="At least 8 characters."
          value={form.password}
          onChange={(e) => set('password', e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <TextField
          fullWidth
          type="password"
          label="Confirm Password"
          value={form.confirm}
          onChange={(e) => set('confirm', e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={form.agree}
              onChange={(e) => set('agree', e.target.checked)}
            />
          }
          label={
            <Typography variant="body2">
              I agree the shop may contact me to confirm my orders.
            </Typography>
          }
        />
        <Button
          fullWidth
          size="large"
          type="submit"
          variant="contained"
          disabled={!form.agree}
          loading={loading}
        >
          Create Account
        </Button>
      </Box>

      <Typography variant="body2" sx={{ textAlign: 'center', mt: 3 }}>
        Already have an account?{' '}
        <RouterLink href="/login" style={{ fontWeight: 600 }}>
          Sign In
        </RouterLink>
      </Typography>
    </Box>
  );
}
