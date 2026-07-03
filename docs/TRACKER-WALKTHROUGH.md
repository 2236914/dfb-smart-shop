# DFB Smart Shop — Live Delivery Tracker Walkthrough (Side by Side)

Live site: **https://dfbsupply.store**

This guide shows how to demonstrate the **live delivery tracker** with two views
open **side by side**:

- **Rider view** — `/track/<orderId>` — the delivery rider shares their moving
  GPS location.
- **Buyer view** — `/buyer/orders/<orderId>` — the customer watches the rider
  move on their order page in real time.

The two sides talk over **Supabase Realtime broadcast** on a per-order channel
(`order-tracking:<orderId>`). It is ephemeral — nothing is written to the
database — so both views must use the **same order ID**.

---

## What you need

| # | Requirement | Notes |
| --- | --- | --- |
| 1 | Two browser windows (or two devices) | One for the rider, one for the buyer |
| 2 | A **delivery** order (not pickup) | Tracking only appears for `fulfilment = delivery` orders |
| 3 | The order's **ID** (a UUID) | Both views share it; see "Get the order ID" below |
| 4 | Buyer login | `buyer@test.com` / `buyer1234` |
| 5 | Admin login (optional) | `owner@dfbsmartshop.com` / `admin1234` — easiest way to open the rider link |

> **Solo demo?** You don't need a second phone or real GPS. The rider page has a
> **"Simulate movement"** toggle that animates a rider driving along real streets
> (Pasig → Cainta, ~60 seconds end to end). Use it for a one-person demo.

---

## Get the order ID (once)

Pick **one** of these:

- **Via Admin (recommended):** sign in at `/login/admin` → **Orders** → open a
  **delivery** order → the browser URL ends in the order ID
  (`/admin/orders/<orderId>`). This page also has an **"Open Rider Tracking"**
  button that opens `/track/<orderId>` in a new tab for you.
- **Via Buyer:** sign in at `/login` → **Orders** → open a **delivery** order →
  the URL is `/buyer/orders/<orderId>`.

Copy that `<orderId>` — you'll paste it into the rider URL.

> Tip: for the cleanest demo, set the order **Status** to *Out for delivery*
> (Admin → order → Status → **Ready** → Update Status) so the buyer's page is in
> the "on the way" state.

---

## Side-by-side layout

Put the two windows next to each other:

```
┌───────────────────────────┐   ┌───────────────────────────┐
│  RIDER                     │   │  BUYER                     │
│  /track/<orderId>          │   │  /buyer/orders/<orderId>   │
│                            │   │                            │
│  [ Simulate movement  ▢ ]  │   │  Delivery tracking         │
│  [ Start sharing ]         │   │   • Live / Paused chip     │
│   → dot starts moving      │   │   • "Rider on the way …km" │
│                            │   │   • map dot moves live     │
└───────────────────────────┘   └───────────────────────────┘
        broadcasts  ─────────────►  subscribes (Supabase Realtime)
```

---

## Steps

### 1. Open the BUYER view (left/right — your choice)
1. Sign in as **Buyer** (`buyer@test.com` / `buyer1234`).
2. Go to **Orders** → open the **delivery** order you chose.
3. Scroll to the **Delivery tracking** card.
   - **Expected before the rider starts:** a placeholder —
     *"Waiting for the rider to start sharing their location…"* (if the order is
     confirmed/out for delivery), plus the destination pin if the address geocodes.

### 2. Open the RIDER view in the second window
1. Go to `https://dfbsupply.store/track/<orderId>` (same order ID).
   - Or, from the **Admin** order page, click **Open Rider Tracking**.
2. You'll see the **Rider Tracking** page with a map and a
   *"Not sharing"* chip.

### 3. Start sharing (pick one)
- **Real GPS (two devices):** tap **Start sharing my location** and allow the
  location permission. Your real position streams to the buyer.
- **Simulated (solo demo):** flip **Simulate movement (demo, no real GPS)** ON,
  then tap **Start simulated delivery**. A pin starts driving Pasig → Cainta.

### 4. Watch them sync — side by side
- On the **rider** window: the chip turns green **"Sharing location"** and the
  dot moves; live coordinates show under it.
- On the **buyer** window (within a second or two):
  - The chip turns green **"Live"**.
  - A banner appears: **"Rider is on the way · ≈ X km away (Y min)"**.
  - The rider dot moves along the map toward the destination pin.

### 5. Show the "paused" state (optional talking point)
- On the rider window, tap **Stop sharing** (or switch tabs so the page is
  backgrounded).
- On the buyer window, after ~20 seconds the chip flips to **"Paused • Ns ago"**
  and the map holds the rider's **last known** location. This proves the buyer
  always sees a graceful state, never a frozen "live" lie.

---

## What each side is doing (for questions)

- **Rider page** (`/track/:orderId`): reads GPS via `navigator.geolocation`
  (or the simulator), and **broadcasts** each fix on the order's Realtime
  channel. It keeps the screen awake (Wake Lock) and sends a heartbeat every few
  seconds so a stationary rider still reads as *Live*.
- **Buyer page** (`/buyer/orders/:id`): **subscribes** to the same channel and
  moves the map pin. It geocodes the delivery address for the destination pin and
  computes distance/ETA. A fix older than **20 seconds** flips the status from
  *Live* to *Paused*.
- **Transport:** Supabase Realtime **broadcast** — no database table, no polling.
  Closing the rider page stops the stream.

---

## Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| Buyer shows "Live tracking will appear here once your order is on the way." | The order isn't a **delivery** order, or it's not yet confirmed. Use a delivery order and set status to Confirmed/Ready. |
| Buyer stays on "Waiting for the rider…" | Rider hasn't tapped **Start sharing**, or the two views use **different order IDs**. Confirm the UUID matches. |
| Rider says "Location permission denied." | Allow location in the browser, or use **Simulate movement** instead. |
| Dot doesn't move on the buyer side | Both tabs must be the same order; the rider tab must stay **open and in the foreground** (backgrounding pauses GPS/Realtime). |
| Rider and buyer destination pins differ (simulate mode) | Expected — the simulator drives to a fixed Cainta point, while the buyer's destination pin is geocoded from the order's real address. The moving dot still syncs. |

---

## One-line summary for the panel

> "The rider opens a link and taps *Start sharing*; the customer's order page
> shows the rider moving on a live map with distance and ETA — streamed
> peer-to-peer over Supabase Realtime, with an automatic *Paused* fallback if the
> rider drops signal."
