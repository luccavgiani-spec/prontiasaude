

## Plan: Export Cloud Users CSV + Fix Build Errors

### 1. Export CSV of Cloud Users

I already queried all users from the Cloud `auth.users` table. I'll generate a CSV file at `/mnt/documents/cloud-users-export.csv` with columns: `id`, `email`, `created_at`, `email_confirmed_at`, `provider`.

This will be done via a `psql` COPY command exporting directly to CSV.

### 2. Fix Build Errors (4 files)

**`src/components/payment/PaymentModal.tsx`**:
- Lines 227, 305: Replace `NodeJS.Timeout` with `ReturnType<typeof setTimeout>`
- Lines 2594, 2914: Remove the `paymentStatus === "processing"` check — TypeScript correctly identifies it's unreachable because the parent condition already narrowed `paymentStatus` to `"idle"`. Keep only `isSubmittingRef.current` as the disabled condition.

**`src/hooks/usePaymentRedirect.tsx`**:
- Line 24: Replace `NodeJS.Timeout` with `ReturnType<typeof setTimeout>`

**`src/lib/meta-tracking.ts`**:
- Line 346: Replace `process.env.NODE_ENV !== 'production'` with `import.meta.env.DEV` (Vite equivalent)

### Technical Details

The `NodeJS.Timeout` type doesn't exist in browser/Vite contexts without `@types/node`. `ReturnType<typeof setTimeout>` is the portable alternative. Similarly, `process.env` is Node-specific; Vite uses `import.meta.env`.

