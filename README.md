# AI Podcast SaaS Application

A Next.js application for processing podcast audio files with AI-powered transcription and content generation.

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Authentication:** Clerk
- **Database:** Convex
- **Background Jobs:** Inngest
- **AI Services:** OpenAI, AssemblyAI
- **File Storage:** Vercel Blob
- **Deployment:** Vercel

## Getting Started

### Prerequisites

- Node.js 18+ and pnpm
- Accounts for: Clerk, Convex, Inngest, Vercel
- API keys for: OpenAI, AssemblyAI (optional - users provide their own)

### Local Development

1. Clone the repository:
```bash
git clone https://github.com/your-username/ai-podcast.git
cd ai-podcast
```

2. Install dependencies:
```bash
pnpm install
```

3. Set up environment variables (see `ENV_SETUP.md` or `.env.local`):
```bash
# Copy the example and fill in your values
cp .env.example .env.local
```

4. Start development servers:
```bash
pnpm dev
```

This will start both Next.js and Convex dev servers concurrently.

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Environment Variables

See `ENV_SETUP.md` for a complete list of required environment variables.

**Required:**
- Clerk authentication keys
- Convex deployment URL
- Encryption key (for API key encryption)

**Optional:**
- OpenAI API key (fallback)
- AssemblyAI API key (fallback)

## Deployment

For detailed deployment instructions, see [DEPLOYMENT.md](./DEPLOYMENT.md).

### Quick Deploy to Vercel

1. Push your code to GitHub
2. Import project in Vercel
3. Add all environment variables (see `ENV_SETUP.md`)
4. Deploy!

## Project Structure

```
app/                    # Next.js App Router pages
components/             # React components
convex/                 # Convex database schema and functions
inngest/               # Inngest background job functions
lib/                   # Utility functions and configurations
```

## Features

- 🎙️ Audio transcription with speaker diarization
- 📝 AI-powered content generation (summaries, titles, social posts, etc.)
- 🔐 User authentication with Clerk
- 💾 Real-time database with Convex
- ⚡ Background job processing with Inngest
- 🔒 Encrypted API key storage (BYOK - Bring Your Own Key)
- 📁 File storage with Vercel Blob
