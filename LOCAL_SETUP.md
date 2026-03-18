# Schedule AI Chatbot - Local Setup Guide

## Quick Start (Local Testing)

### Step 1: Start the Express Server

Open PowerShell and run:

```powershell
cd "c:\Users\markb\OneDrive\Desktop\Face Image\server"
npm install
node server.js
```

You should see:
```
✅ Local OpenRouter proxy running on http://localhost:3000
📤 Chat will call: http://localhost:3000/api/openrouter
```

### Step 2: Add Your API Key

Edit `server/.env`:
```
OPENROUTER_KEY=sk-or-v1-your-actual-key-here
```

### Step 3: Start the Web Server

In a **new PowerShell window**:

```powershell
cd "c:\Users\markb\OneDrive\Desktop\Face Image"
python -m http.server 8000
```

Or if you have Node:
```powershell
npx http-server -p 8000
```

### Step 4: Open in Browser

Go to: `http://localhost:8000`

Click the chat bubble and test:
- Type `create` → add a schedule
- Type `search` → find a schedule
- Click calendar dates to view events
- Confirm/Cancel at the scheduled time → moves to history

---

## How It Works Locally

- **Frontend** (`index.html`, `styles.css`, `scripts.js`) runs on `http://localhost:8000`
- **Backend** (Express server) runs on `http://localhost:3000`
- Chat calls `http://localhost:3000/api/openrouter` (local proxy)
- API key stays safe in `server/.env` (never sent to browser)

---

## Deploy to Vercel

1. Push code to GitHub (make sure `.gitignore` excludes `server/.env`)
2. Connect repo to Vercel
3. Add environment variable in Vercel Dashboard:
   - Name: `OPENROUTER_KEY`
   - Value: your OpenRouter key
4. Vercel will automatically use `/api/openrouter` (serverless function)

---

## Troubleshooting

**Chat not responding?**
- Check browser console (F12): are there errors?
- Confirm `node server.js` is running in PowerShell
- Confirm `.env` has your API key

**API key error?**
- Make sure `server/.env` exists and has: `OPENROUTER_KEY=your_key`
- Restart `node server.js` after changing `.env`

**Port already in use?**
- Change port in `server/server.js`: `const PORT = 3001;`
- Update `scripts.js` to call `http://localhost:3001/api/openrouter`
