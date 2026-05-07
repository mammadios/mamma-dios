# 🍕 Mamma Dio's Pizza — Order Management System
### Setup Guide: Supabase + Vercel

---

## Overview
This is a full-stack Next.js app with:
- **Supabase** for the database + real-time updates
- **Vercel** for hosting
- **Twilio** for SMS notifications
- All your features: New Order, Live Board, History, Menu Editor, timestamps, returning customer tracking

---

## Step 1: Supabase Setup

### 1.1 Create Project
1. Go to [supabase.com](https://supabase.com) → New Project
2. Name it `mamma-dios` → choose a region close to you → set a strong DB password
3. Wait ~2 minutes for it to spin up

### 1.2 Run the Schema
1. In your Supabase project, go to **SQL Editor** → **New Query**
2. Copy the entire contents of `supabase-schema.sql` and paste it in
3. Click **Run** — this creates all tables, indexes, triggers, and seeds your menu

### 1.3 Get Your Keys
In your Supabase project → **Settings** → **API**:
- **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
- **anon (public)** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`  
- **service_role (secret)** key → `SUPABASE_SERVICE_ROLE_KEY`

### 1.4 Enable Realtime
Go to **Database** → **Replication** → enable the `orders` table for real-time.
(The SQL already adds it to the publication, but double-check in the UI.)

---

## Step 2: Twilio Setup

You already have:
- Account SID: `ACd24187ad53be4d832292d9a325d653e3`
- From number: `+17348384932`

You need:
1. Go to [twilio.com/console](https://www.twilio.com/console)
2. Copy your **Auth Token** from the dashboard
3. Keep it for the env vars below

> **Note:** SMS won't work until your A2P registration is approved. The app will still work — it just logs a warning instead of sending texts.

---

## Step 3: Deploy to Vercel

### 3.1 Push to GitHub
```bash
cd mamma-dios
git init
git add .
git commit -m "Initial Mamma Dio's app"
# Create a repo on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/mamma-dios.git
git push -u origin main
```

### 3.2 Import to Vercel
1. Go to [vercel.com](https://vercel.com) → **New Project**
2. Import your GitHub repo
3. Framework will auto-detect as **Next.js**

### 3.3 Add Environment Variables
In Vercel's project settings → **Environment Variables**, add:

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service role key |
| `TWILIO_ACCOUNT_SID` | `ACd24187ad53be4d832292d9a325d653e3` |
| `TWILIO_AUTH_TOKEN` | Your Twilio auth token |
| `TWILIO_FROM_NUMBER` | `+17348384932` |

### 3.4 Deploy
Click **Deploy** — Vercel builds and hosts the app. You'll get a URL like `mamma-dios.vercel.app`.

---

## Step 4: Local Development

```bash
# Install dependencies
npm install

# Copy env template and fill in your values
cp .env.local.example .env.local
# Edit .env.local with your actual keys

# Run dev server
npm run dev
# Open http://localhost:3000
```

---

## App Features

### 🍕 New Order
- Select customer name + phone
- Add items from the menu with quantity controls
- Special requests field
- Automatic returning customer detection (by phone number)
- Submits and switches to Live Orders tab

### 📋 Live Orders Board
- 3 columns: **Queue** | **In Process** | **Ready**
- **Start Order** → moves to In Process, records timestamp, sends "order started" SMS
- **Mark Ready** → moves to Ready, records timestamp, calculates cook time, sends "ready for pickup" SMS
- **Picked Up** → archives the order, removes from board
- Real-time updates via Supabase (all devices sync instantly)
- Sound alerts: ping on new order, melody when order is ready
- Elapsed timer on each card

### 📊 History
- Searchable archive of all completed orders
- Stats: total orders, revenue, avg cook time, returning customers
- Full order details including timestamps

### ✏️ Menu Editor
- Toggle items on/off menu
- Edit name and price inline
- Add new items
- Delete items
- Changes reflect immediately in New Order form

### ⭐ Returning Customers
- Detected automatically by phone number
- Flagged visually on order cards
- Tracked in separate `customers` table with visit count

---

## Database Tables

| Table | Purpose |
|-------|---------|
| `orders` | Active/live orders |
| `orders_archive` | Completed/archived orders |
| `menu_items` | Menu with prices |
| `customers` | Phone-based customer tracking |

---

## SMS Messages

**When order starts:**
> Hi [Name]! 🍕 Mamma Dio's has started on your order #[X]. We'll text you when it's ready for pickup!

**When order is ready:**
> Hey [Name]! 🔔 Your order #[X] from Mamma Dio's is READY for pickup! Come grab it while it's hot! 🍕

---

## Troubleshooting

**"Missing Supabase environment variables"**
→ Check your `.env.local` file has all three Supabase vars

**Real-time not working**
→ Go to Supabase → Database → Replication → confirm `orders` table is checked

**SMS not sending**
→ Check Twilio auth token, confirm A2P registration status

**Orders not saving**
→ Run the SQL schema again in Supabase SQL editor, check RLS policies are set correctly
