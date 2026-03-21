

## Plan: Create `vercel.json`

Create a `vercel.json` file in the project root with SPA rewrite configuration:

```json
{
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

Single file creation, no other changes needed.

