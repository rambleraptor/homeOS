# Homestead Frontend

This is the frontend application for Homestead, built with Next.js, React, and TypeScript.

## Tech Stack

- **Framework**: Next.js 15
- **UI Library**: React 19
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **State Management**: TanStack Query (React Query)
- **Testing**: Vitest + React Testing Library
- **Icons**: Lucide React

## Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run tests
npm test

# Run linter
npm run lint

# Run type checker
npm run type-check
```

## Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# Override the engine base that server-side helpers call. Defaults to
# http://127.0.0.1:3000/api/v1/aep — only set this when the engine is elsewhere.
AEPBASE_URL=http://127.0.0.1:3000/api/v1/aep
NEXT_PUBLIC_APP_NAME=Homestead
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your_vapid_public_key
```

**Note**: Environment variables in Next.js must be prefixed with `NEXT_PUBLIC_` to be accessible in the browser.

## Project Structure

```
src/
├── app/              # Next.js App Router pages
├── core/             # Core infrastructure
│   ├── auth/         # Authentication
│   ├── api/          # aepbase client
│   ├── layout/       # Layout components
│   └── router/       # Routing configuration
├── apps/          # Feature apps
│   ├── registry.ts   # App registry
│   ├── dashboard/    # Dashboard app
│   ├── gift-cards/   # Gift cards app
│   └── ...           # Other apps
├── shared/           # Shared components and utilities
└── test/             # Test setup and utilities
```

## Adding a New App

1. Create app folder in `src/apps/`
2. Define `app.config.ts` with metadata
3. Create routes and components
4. Register in `src/apps/registry.ts`

Run the `create-app` skill to scaffold a new app end-to-end
(resource definitions, hooks, components, config wiring, e2e fixtures).

## Testing

This project uses Vitest for unit and integration testing:

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## Code Quality

Before committing, ensure all checks pass:

```bash
# Run all checks
cd .. && make ci && make test
```

This runs:
- ESLint
- TypeScript type checking
- Build verification
- All tests

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [React Documentation](https://react.dev)
- [Tailwind CSS](https://tailwindcss.com)
- [TanStack Query](https://tanstack.com/query)
