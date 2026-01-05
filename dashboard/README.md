# RAL Dashboard

React/TypeScript dashboard for the Reality Anchoring Layer context intelligence platform.

## Features

- **Dashboard Overview**: Real-time context health metrics and statistics
- **Context Management**: View, edit, delete, and verify context data
- **Drift Report**: Identify and resolve context drift issues
- **Version History**: Track changes to context over time
- **Settings**: Manage profile, security, API keys, and notifications

## Tech Stack

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **TailwindCSS** - Styling
- **React Query** - Server state management
- **Zustand** - Client state management
- **React Router** - Routing
- **Axios** - HTTP client

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

The dashboard will be available at `http://localhost:3000`.

### Environment Variables

Create a `.env` file:

```env
VITE_API_URL=http://localhost:8000/api/v1
```

### Building for Production

```bash
# Build
npm run build

# Preview production build
npm run preview
```

## Project Structure

```
src/
├── components/     # Reusable UI components
│   └── Layout.tsx  # Main layout with sidebar
├── lib/
│   ├── api.ts      # Axios instance with auth
│   └── utils.ts    # Utility functions
├── pages/          # Page components
│   ├── DashboardPage.tsx
│   ├── ContextsPage.tsx
│   ├── ContextDetailPage.tsx
│   ├── DriftReportPage.tsx
│   ├── LoginPage.tsx
│   └── SettingsPage.tsx
├── stores/
│   └── authStore.ts # Authentication state
├── types/
│   └── index.ts    # TypeScript types
├── App.tsx         # Root component with routing
├── main.tsx        # Entry point
└── index.css       # Global styles
```

## Development

### Type Checking

```bash
npm run type-check
```

### Linting

```bash
npm run lint
```

## API Integration

The dashboard connects to the RAL Core API. Configure the API URL via `VITE_API_URL` environment variable.

### Authentication

JWT-based authentication with tokens stored in localStorage via Zustand persist.

### Mock Data

The dashboard includes mock data fallbacks for development without a backend.
