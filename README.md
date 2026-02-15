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
├── package.json          # Dependencies and scripts
├── .env                  # Environment variables (not tracked)
├── Dockerfile
├── backend/
│   ├── server.js         # Express server and API routes
│   ├── repository.js     # LowDB database operations
│   ├── openai.js         # OpenAI API integration
│   ├── pdf-export.js     # Server-side PDF generation (PDFKit)
│   ├── prompt-review.txt # AI review prompt template
├── public/               # Static assets served by Express
│   ├── index.html        # Main page shell
│   └── styles.css        # Shared styles (Bootstrap overrides)
└── views/                # Server-rendered templates and partials
    ├── template.ejs      # Document editor page (EJS)
    ├── create-text.html  # New document form (HTMX partial)
    └── action-buttons.html # FAB buttons (HTMX partial)
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
| `MODEL` | Yes | OpenAI model to use (e.g., `gpt-5.2`) |
| `DB_PATH` | No | Database file path |

## Tech Stack

- **Backend:** Node.js, Express, EJS
- **Database:** LowDB (JSON file)
- **AI:** OpenAI API
- **Frontend:** Bootstrap 5, HTMX, Alpine.js
- **PDF:** PDFKit (server-side)
- **Deployment:** Docker

## License

Apache 2.0