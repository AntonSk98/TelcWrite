# TelcWrite

A web application to practice German writing skills for the TELC B1 exam with AI-powered feedback and corrections.

## Why TelcWrite?

Preparing for the TELC B1 writing exam is challenging without a teacher to review your texts. TelcWrite solves this by providing instant AI feedback on your German writing:

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
- 🐳 Easy Docker deployment

## Getting Started

### Option 1: Docker (Recommended)

**Build the image:**
```bash
docker build -t telcwrite .
```

**Run the container:**
```bash
docker run -d \
  --name telcwrite \
  -p 3000:3000 \
  -e OPENAI_TOKEN=your-openai-api-key \
  -e MODEL=gpt-5.2 \
  -v telcwrite-data:/app/data \
  telcwrite
```

Open http://localhost:3000

**Manage the container:**
```bash
docker stop telcwrite    # Stop
docker start telcwrite   # Start again
docker logs telcwrite    # View logs
docker rm telcwrite      # Remove
```

### Option 2: Run Locally

1. **Install dependencies:**
   ```bash
   cd backend
   npm install
   ```

2. **Create `.env` file in `backend/`:**
   ```env
   OPENAI_TOKEN=your-openai-api-key
   MODEL=gpt-5.2
   ```

3. **Start the server:**
   ```bash
   npm start
   ```

Open http://localhost:3000

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

- **Backend:** Node.js, Express
- **Database:** LowDB (JSON file)
- **AI:** OpenAI API
- **Frontend:** Bootstrap 5, Vanilla JS
- **Deployment:** Docker

## License

Apache 2.0