# ClaudeIQ

ClaudeIQ is a full-stack legal document intelligence platform that helps teams upload contracts, extract clauses, score risk, summarize terms in plain English, and surface similar documents for context. It is built as a product demo, but the codebase is structured like a real workflow system with authentication, background processing, storage abstraction, analytics, and exportable reports.

## Why This Project Matters

Legal review is repetitive, slow, and easy to get wrong when teams are juggling many contracts at once. ClaudeIQ turns that manual review flow into a guided workflow where a user can upload a document, watch it process, inspect the important clauses, compare it against similar documents, and export a clean report for stakeholders.

## Problem, Solution, Impact

- **Problem:** legal and business teams spend too much time scanning long contracts for risk, missing clauses, or inconsistent terms.
- **Solution:** ClaudeIQ combines document upload, AI analysis, vector similarity search, and executive-style reporting in one workflow.
- **Impact:** users can triage documents faster, surface high-risk clauses earlier, and reuse context from previous documents instead of starting from scratch each time.

## What it does

- Upload PDF, DOCX, or DOC files
- Authenticate users with a custom JWT flow
- Process documents in the background
- Extract clauses, risk factors, recommendations, and summaries
- Score risk on a 0-100 scale
- Highlight risky clause areas with explanations and suggested checks
- Search documents by name, status, type, and analysis content
- Show document similarity using vector search and ranking
- Track analytics with dashboard and trend views
- Export an executive-style report from any analyzed document
- Cancel in-progress analysis when a review needs to stop
- Store files locally or in Supabase Storage

## Product Surfaces

- **Login / Register**: branded auth experience with JWT-based session handling.
- **Dashboard**: quick workspace snapshot with status metrics and upload cadence.
- **Documents**: searchable, paginated library for scanning document status at a glance.
- **Document detail**: primary review workspace with processing state, risk score, clause findings, plain-language summary, download action, cancel action, and report export.
- **Analytics**: deeper trend views for intake, risk distribution, and review volume.
- **Report export**: printable executive report for sharing or saving as PDF.
- **Upload**: file intake flow that redirects a single upload into its analysis page.

## Key Features

- AI-powered legal analysis with provider support for Groq, Ollama, OpenAI, and Anthropic
- Pinecone vector search for semantic similarity
- PostgreSQL + Prisma for document and analysis data
- Redis-backed token bucket rate limiting
- Bull + Redis processing queue for background work
- Responsive dashboard, documents table, analytics, and report pages
- Pagination and search for the document library
- Secure upload flow with cleanup on partial failure
- Document processing cancellation for long-running reviews
- Graceful fallback paths for storage, queueing, and analysis errors

## Tech Stack

### Frontend
- Next.js 15 App Router
- React 19
- TypeScript
- Tailwind CSS
- shadcn/ui + Radix UI
- Recharts
- Zustand for auth/session state

### Backend
- Node.js + Express 5
- TypeScript
- Prisma ORM
- PostgreSQL
- Pinecone
- Redis
- Bull
- Supabase Storage
- Multer for uploads
- bcryptjs + JWT for auth

## Architecture

The app is split into two services:

- `backend/` handles auth, uploads, background processing, document retrieval, analysis, and similarity search
- `frontend/` handles the dashboard, document library, analytics, report export, and auth UI

Main backend flow:

1. User uploads a document.
2. The backend stores the file in local disk or Supabase Storage.
3. A document row is created in Prisma/Postgres.
4. The document is queued for background processing.
5. Text is extracted, analyzed, and stored.
6. Pinecone receives embeddings for document and clause similarity.
7. The frontend polls status until the analysis is ready.

### Document lifecycle

- `PENDING`: the file has been stored and the processing job is waiting to start.
- `PROCESSING`: extraction, analysis, and embedding work are in progress.
- `COMPLETED`: analysis finished successfully and the document is ready for review.
- `FAILED`: processing failed and should be retried or inspected.
- `CANCELLED`: a user stopped the review before completion.

### Analysis pipeline

- Text extraction handles PDF and DOCX/DOC input.
- The analysis service builds a structured prompt for clause extraction, risk scoring, and plain-English summaries.
- Groq is the fastest hosted provider path for demos when configured.
- Ollama remains the local/offline provider path.
- OpenAI and Anthropic remain supported alternatives.
- A heuristic fallback exists so the app can still complete a review when the model path fails.

### Similarity and context

- Document embeddings are stored in Pinecone for semantic lookup.
- Clause embeddings are also stored so important passages can be compared later.
- Similar documents are used as context for better analysis and for the report view.

### Storage and persistence

- PostgreSQL/Prisma stores users, documents, analyses, and processing metadata.
- Supabase Storage can hold uploaded files privately.
- Local disk storage remains available for development fallback.
- Redis powers queue coordination and rate limiting.

### Reliability and safeguards

- Route-specific token bucket rate limiting protects auth, uploads, and document reads differently.
- Upload cleanup removes orphaned files if database insertion fails.
- Document processing can be cancelled while running.
- The detail page and report page stay usable even if signed download URL generation fails.

## Project Structure

```text
backend/
  src/
    lib/
    middleware/
    routes/
    services/
    utils/
  prisma/
frontend/
  src/
    app/
    components/
    hooks/
    lib/
    config/
```

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL
- Redis
- Pinecone index
- Optional: Supabase project for file storage

### Backend setup

```bash
cd backend
npm install
npm run db:generate
npm run db:migrate
npm run dev
```

### Frontend setup

```bash
cd frontend
npm install
npm run dev
```

## Environment Variables

### `backend/.env`

```env
PORT=5050
FRONTEND_URL=http://localhost:3000
DATABASE_URL=postgresql://user:password@localhost:5432/dbname
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=7d

REDIS_URL=redis://localhost:6379
PINECONE_API_KEY=your_pinecone_key
PINECONE_INDEX_NAME=legal-documents

# Groq is the fastest free-tier option for demos when you set GROQ_API_KEY.
LLM_PROVIDER=groq
GROQ_API_KEY=your_groq_key
GROQ_BASE_URL=https://api.groq.com/openai/v1
GROQ_MODEL=llama-3.1-8b-instant

OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_LLM_MODEL=llama3.2:3b-instruct-q4_K_M
OLLAMA_EMBED_MODEL=nomic-embed-text

OPENAI_API_KEY=your_openai_key
OPENAI_MODEL=gpt-4o-mini
OPENAI_EMBED_MODEL=text-embedding-3-small

ANTHROPIC_API_KEY=your_anthropic_key
ANTHROPIC_MODEL=claude-3-haiku-20240307

SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SUPABASE_STORAGE_BUCKET=documents

MAX_FILE_SIZE=10485760
```

### `frontend/.env.local`

```env
NEXT_PUBLIC_API_URL=http://localhost:5050
```

## Scripts

### Backend

- `npm run dev` - start the Express server in development
- `npm run build` - compile TypeScript
- `npm run start` - run the compiled server
- `npm run db:generate` - generate Prisma client
- `npm run db:migrate` - run Prisma migrations

### Frontend

- `npm run dev` - start Next.js with Turbopack
- `npm run dev:legacy` - start the classic Next dev server
- `npm run build` - production build
- `npm run build:isolated` - production build using a separate output dir
- `npm run start` - run the built frontend

## Notable Product Flows

- Upload page auto-redirects single uploads to the document detail view
- Document detail shows processing, analysis, download, similarity, and report export
- Documents page supports search, pagination, and row-based scanning
- Dashboard gives a quick health snapshot
- Analytics gives deeper trend and risk breakdowns

## Notes

- The frontend uses a custom auth flow, not NextAuth.
- The backend can fall back to in-memory behavior if Redis is unavailable, but Redis is the preferred setup.
- Groq is the preferred fast free-tier LLM path for demos; Ollama remains the local/offline option.
- Local file storage is supported as a fallback, but Supabase Storage is the better production path.
- The analysis experience is designed to emphasize risky clauses first, then the summary, then supporting context.
- The document library is intentionally built for scanning, search, and pagination rather than a card-heavy layout.
- The project is currently optimized for local demo presentation and interview walkthroughs.

## License

No license has been specified yet.
