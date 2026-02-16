# Klar

A web application to practice German writing skills for the TELC B1 exam with AI-powered feedback and corrections.

## Why Klar?

Preparing for the TELC B1 writing exam is challenging without a teacher to review your texts. Klar solves this by providing instant AI feedback on your German writing:

- **Instant corrections** - See exactly what's wrong with highlighted deletions and additions
- **TELC B1 scoring** - Get a score based on official TELC criteria
- **Detailed feedback** - Understand your mistakes and learn from them
- **Practice anytime** - No need to wait for a teacher's availability

## Features

- 📝 Create and manage multiple writing exercises
- 🤖 AI-powered German text correction using OpenAI
- ✅ Visual markup showing errors and corrections
- 📊 Score and feedback based on TELC B1 standards
- 💾 Auto-save your work
- 📄 Paginated document list
- 📑 Export all exercises to PDF (with colored corrections)
- 💿 Export and import database as JSON for backup/restore
- 🐳 Easy Docker deployment

## Getting Started

### Option 1: Docker (Recommended)

**Build the image:**
```bash
docker build -t klar .
```

**Run the container:**
```bash
docker run -d \
  --name klar \
  -p 3000:3000 \
  -e OPENAI_TOKEN=your-openai-api-key \
  -e MODEL=gpt-5.2 \
  -v klar-data:/app/data \
  klar
```

Open http://localhost:3000

**Manage the container:**
```bash
docker stop klar    # Stop
docker start klar   # Start again
docker logs klar    # View logs
docker rm klar      # Remove
```

### Option 2: Run Locally

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Create `.env` file in the project root:**
   ```env
   OPENAI_TOKEN=your-openai-api-key
   MODEL=gpt-5.2
   ```

3. **Start the server:**
   ```bash
   npm start
   ```

Open http://localhost:3000

## Project Structure

```
Klar/
├── package.json
├── Dockerfile
├── .env                    # Environment variables (not tracked)
├── backend/
│   ├── server.js           # Express server setup
│   ├── config.js           # Configuration and env vars
│   ├── repository.js       # SQLite database operations
│   ├── klar.sqlite         # SQLite database (auto-created)
│   ├── routes/
│   │   ├── api.js          # REST API endpoints
│   │   └── partials.js     # HTMX partial routes
│   └── services/
│       ├── openai.js       # OpenAI API integration
│       ├── pdf-export.js   # PDF generation
│       ├── prompt-generate.txt
│       └── prompt-review.txt
├── public/
│   ├── index.html          # Main SPA shell
│   ├── styles.css          # Custom styles
│   ├── manifest.json       # PWA manifest
│   ├── service-worker.js   # PWA service worker
│   └── icons/
│       ├── icon-192.svg
│       └── icon-512.svg
└── views/
    ├── template.ejs        # Document editor page
    ├── text-list.ejs       # Document list partial
    ├── create-exercise.html
    └── action-buttons.html
```

## Usage

1. **Create a new exercise** - Enter a name (e.g., "E-Mail an Vermieter")
2. **Add the task** - Paste the TELC task description
3. **Write your text** - Write your German response (minimum 100 words)
4. **Submit for review** - Click "Text korrigieren lassen"
5. **Review feedback** - See your score, feedback, and corrected text with highlighted errors

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_TOKEN` | Yes | Your OpenAI API key |
| `MODEL` | Yes | OpenAI model to use (e.g., `gpt-4o`) |
| `PORT` | No | Server port (default: 3000) |
| `DB_PATH` | No | SQLite database path (default: `backend/klar.sqlite`) |

## Tech Stack

- **Backend:** Node.js, Express, EJS
- **Database:** SQLite (better-sqlite3)
- **AI:** OpenAI API
- **Frontend:** Bootstrap 5, HTMX, Alpine.js
- **PDF:** PDFKit (server-side)
- **Deployment:** Docker, PWA

## License

Apache 2.0

---

## 📱 Mobile App (PWA)

Klar kann als Progressive Web App auf deinem Handy installiert werden!

### Setup für Handy-Zugriff

1. **Finde die IP-Adresse deines PCs:**
   ```bash
   # Windows (PowerShell)
   ipconfig
   # Suche nach "IPv4 Address" unter deinem Netzwerk-Adapter (z.B. 192.168.1.100)
   ```

2. **Starte den Server mit externer Erreichbarkeit:**
   ```bash
   npm start
   ```

3. **Öffne auf deinem Handy:**
   ```
   http://192.168.1.100:3000
   ```
   (Ersetze mit deiner IP-Adresse)

4. **Installiere die App:**
   - **Android (Chrome):** Menü (⋮) → "App installieren" oder "Zum Startbildschirm hinzufügen"
   - **iOS (Safari):** Teilen-Button → "Zum Home-Bildschirm"

### Voraussetzungen
- PC und Handy müssen im gleichen WLAN sein
- Der Server auf dem PC muss laufen

### Alternative: Termux (Echte Standalone-App)

Für eine vollständig standalone Android-App ohne PC:

1. Installiere [Termux](https://f-droid.org/en/packages/com.termux/) von F-Droid
2. In Termux:
   ```bash
   pkg update && pkg install nodejs git
   git clone <your-repo-url> klar
   cd klar
   npm install
   npm start
   ```
3. Öffne `http://localhost:3000` im Android-Browser

