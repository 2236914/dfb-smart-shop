import { useState } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import { useAsync } from 'src/hooks/use-async';

import { fetchBranches, fetchSettings } from 'src/services/db';

import { useToast } from 'src/components/toast';
import { Iconify } from 'src/components/iconify';
import { LocationMap } from 'src/components/location-map';

// ----------------------------------------------------------------------
// W-9. Contact Page.
// ----------------------------------------------------------------------

export function StoreContactView() {
  const { showToast, toast } = useToast();
  const { data: settings } = useAsync(fetchSettings, []);
  const { data: branches } = useAsync(fetchBranches, []);
  const [form, setForm] = useState({ name: '', contact: '', message: '' });

  const set = (key: keyof typeof form, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <Box>
      <Typography variant="h3" sx={{ mb: 4 }}>
        Contact Us
      </Typography>

      <Grid container spacing={4}>
        <Grid size={{ xs: 12, md: 5 }}>
          <Stack spacing={2.5}>
            <InfoRow icon="solar:map-point-bold" label="Address" value={settings?.address ?? ''} />
            <InfoRow icon="solar:clock-circle-bold" label="Store Hours" value={settings?.hours ?? ''} />
            <InfoRow icon="solar:phone-bold" label="Phone" value={settings?.contact ?? ''} />
            <InfoRow icon="solar:letter-bold" label="Email" value="hello@dfbsmartshop.com" />
          </Stack>
        </Grid>

        <Grid size={{ xs: 12, md: 7 }}>
          <Card sx={{ p: 3 }}>
            <Stack spacing={2.5}>
              <TextField
                fullWidth
                label="Your Name"
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <TextField
                fullWidth
                label="Mobile / Email"
                value={form.contact}
                onChange={(e) => set('contact', e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <TextField
                fullWidth
                multiline
                rows={4}
                label="Message"
                value={form.message}
                onChange={(e) => set('message', e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <Button
                variant="contained"
                onClick={() => {
                  showToast('Message sent. The shop will get back to you.');
                  setForm({ name: '', contact: '', message: '' });
                }}
              >
                Send Message
              </Button>
              <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                For order questions, include your order number.
              </Typography>
            </Stack>
          </Card>
        </Grid>
      </Grid>

      {/* Visit us — real map per branch */}
      <Typography variant="h5" sx={{ mt: 6, mb: 1 }}>
        Visit Us
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
        Find our branches on the map below.
      </Typography>
      <Grid container spacing={3}>
        {(branches ?? []).map((branch) => (
          <Grid key={branch.id} size={{ xs: 12, md: 6 }}>
            <Card sx={{ p: 2.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <Typography variant="subtitle1">
                  {branch.name === 'Main' ? 'Main Branch' : `${branch.name}`}
                </Typography>
                {branch.isMain && (
                  <Iconify icon="solar:star-bold" width={16} sx={{ color: 'warning.main' }} />
                )}
              </Box>
              <LocationMap query={branch.address} height={240} />
              <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1.5 }}>
                {branch.address}
              </Typography>
              {(branch.telephone || branch.mobile) && (
                <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                  {[branch.telephone, branch.mobile].filter(Boolean).join(' · ')}
                </Typography>
              )}
            </Card>
          </Grid>
        ))}
      </Grid>

      {toast}
    </Box>
  );
}

// ----------------------------------------------------------------------

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
      <Iconify icon={icon} width={24} sx={{ color: 'primary.main', mt: 0.5 }} />
      <Box>
        <Typography variant="subtitle2">{label}</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {value}
        </Typography>
      </Box>
    </Box>
  );
}
