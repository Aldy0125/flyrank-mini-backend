# BE-09: Build an AI Decision Flow with React Flow + Inngest

A visual AI workflow application built with Next.js, React Flow, Inngest, the OpenAI SDK, Groq, and SQLite.

The application allows users to create decision nodes, connect them through YES/NO branches, execute workflows using AI, and inspect execution history and decision logs.

## Features

- Visual workflow editor powered by React Flow.
- Create decision nodes and edit their prompts.
- Connect nodes using YES and NO branches.
- Execute AI decisions through Inngest.
- Use Groq through the OpenAI SDK.
- Validate AI responses as YES or NO.
- Track workflow execution status and decision logs.
- Store execution history in a local SQLite database.
- View previous executions and their details.
- Handle workflow errors and invalid graph connections.

## Tech Stack

- Next.js
- React and TypeScript
- React Flow (`@xyflow/react`)
- Inngest
- OpenAI SDK
- Groq API
- SQLite using Node.js `node:sqlite`
- Tailwind CSS and shadcn/ui

## Prerequisites

- Node.js with support for `node:sqlite`. Node.js 24 is recommended.
- npm
- A Groq API key
- Git

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/Aldy0125/flyrank-mini-backend.git
cd flyrank-mini-backend/be-09-ai-decision-flow
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env.local` file in the `be-09-ai-decision-flow` directory.

Add your Groq API key:

```env
GROQ_API_KEY=your_groq_api_key_here
```

Replace the placeholder with your own API key.

Never commit `.env.local` or expose your API key in source code or public repositories.

### 4. Start the Next.js application

Open a terminal in the project directory and run:

```bash
npm run dev
```

The application normally runs at:

http://localhost:3000

### 5. Start the Inngest Dev Server

Open a second terminal in the same project directory and run:

```bash
npx inngest-cli@latest dev
```

The Inngest Dev Server normally runs at:

http://localhost:8288

Keep both development servers running while testing workflow execution.

## How It Works

1. Create decision nodes in the visual editor.
2. Enter a prompt for each node.
3. Connect nodes using YES and NO branches.
4. Start workflow execution from the application.
5. Inngest executes the workflow steps.
6. The AI evaluates each visited node and returns YES or NO.
7. The workflow follows the matching outgoing edge.
8. Execution status and decision logs are stored and displayed in the application.
9. Open an item in Execution History to inspect its details.

The workflow includes validation for node IDs, prompts, graph connections, and AI responses. It also detects cycles and limits the number of nodes processed in a single execution.

## API Endpoints

| Endpoint | Purpose |
|---|---|
| `POST /api/run-workflow` | Starts a workflow execution |
| `GET /api/executions` | Retrieves execution history |
| `GET /api/executions/[executionId]` | Retrieves an execution and its decision logs |
| `/api/inngest` | Inngest integration endpoint |
| `/api/test-ai` | Tests the AI integration |

## Data Storage

Workflow execution records and decision logs are stored in a local SQLite database:

```text
.data/be09.sqlite
```

The database directory is excluded from Git. The application creates the database when it initializes the workflow store.

The local SQLite database is intended for development. Production deployment requires an appropriate persistent database strategy.

## Validation

Run the following commands from the project directory:

### TypeScript

```bash
npx tsc --noEmit
```

### ESLint

```bash
npm run lint
```

### Production build

```bash
npm run build
```

The project should pass these checks before submission.

## Repository

https://github.com/Aldy0125/flyrank-mini-backend

## Assignment Information

- Assignment: BE-09
- Track: Backend AI Engineering
- Week: 7
- Title: Build an AI Decision Flow with React Flow + Inngest
