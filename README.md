# ⚖️ ClaudeIQ

This project is a full-stack AI platform that automates the analysis of legal documents. It leverages AI and vector search to extract clauses, assess risks, provide plain-English summaries, and offer contextual recommendations — streamlining legal workflows for firms, startups, and enterprise users.

---

## 🚀 Features

- ✅ **Automated Clause Detection** using OpenAI
- ⚠️ **Risk Scoring** for key legal clauses
- 📖 **Plain-English Summaries** of complex legal terms
- 📚 **Contextual Recommendations** to improve legal clarity
- 🧠 **Semantic Search** with Pinecone vector database
- 📄 Support for PDF and DOCX files
- 🧑‍💼 Multi-user organization support
- 💬 Real-time analysis progress and status updates
- 🔐 Secure login & protected routes

---

## 🧱 Tech Stack

### Frontend
- **React** with **Next.js 14 App Router**
- **TypeScript** & **Tailwind CSS**
- **ShadCN/UI**, **Lucide Icons**, **Framer Motion**
- **NextAuth.js** for authentication

### Backend
- **Node.js** with **TypeScript**
- **OpenAI API** for AI-driven analysis
- **Pinecone** for vector similarity search
- **PostgreSQL** + **Prisma ORM**
- **Multer** for file uploads
- **REST API** with custom middleware for status tracking

---

## 📁 Project Structure

ai-legal-intelligence/
├── backend/
│ ├── src/
│ │ ├── services/
│ │ │ ├── aiAnalyzer.ts
│ │ │ ├── documentProcessor.ts
│ │ │ └── pineconeService.ts
│ │ ├── routes/
│ │ └── prisma/
│ └── ...
├── frontend/
│ ├── src/
│ │ ├── app/
│ │ ├── components/
│ │ ├── hooks/
│ │ └── lib/
│ └── ...
└── prisma/

---

## 🛠️ Installation

### 1. Clone the Repository

```bash
git clone https://github.com/rahul24sharma/AI-Powered-Legal-Document-Intelligence-platform.git
cd AI-Powered-Legal-Document-Intelligence-platform
2. Setup Backend
bash
Copy
Edit
cd backend
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run dev
Create a .env file with:

env
Copy
Edit
DATABASE_URL=postgresql://user:password@localhost:5432/dbname
OPENAI_API_KEY=your_openai_key
PINECONE_API_KEY=your_pinecone_key
UPLOAD_DIR=./uploads
3. Setup Frontend
bash
Copy
Edit
cd frontend
npm install
npm run dev
Create a .env.local in the frontend with:

env
Copy
Edit
NEXT_PUBLIC_API_URL=http://localhost:5000
NEXTAUTH_SECRET=your_nextauth_secret
NEXTAUTH_URL=http://localhost:3000
