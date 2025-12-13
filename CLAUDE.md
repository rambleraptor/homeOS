# Claude AI Assistant Guidelines for HomeOS

This document provides guidelines for Claude AI assistants working on the HomeOS project, as well as general development practices for all contributors.

## Table of Contents

- [Pull Request Requirements](#pull-request-requirements)
- [Development Workflow](#development-workflow)
- [Testing Guidelines](#testing-guidelines)
- [Code Quality Standards](#code-quality-standards)
- [Project Structure](#project-structure)

## Pull Request Requirements

**Every PR MUST pass the following checks before being pushed:**

### 1. Build ✅

The application must build successfully without errors.

```bash
# From project root
make build

# Or from frontend directory
cd frontend && npm run build
```

**Why:** Ensures that the code compiles correctly and there are no build-time errors that would prevent deployment.

### 2. Lint ✅

Code must pass ESLint checks with no errors.

```bash
# From project root
make lint

# Or from frontend directory
cd frontend && npm run lint
```

**Why:** Maintains code consistency, catches common errors, and enforces coding standards across the project.

### 3. Type Check ✅

TypeScript must compile without type errors.

```bash
# From project root
make type-check

# Or from frontend directory
cd frontend && npm run type-check
```

**Why:** Catches type-related bugs early and ensures type safety throughout the codebase.

### 4. Tests ✅

All tests must pass.

```bash
# From project root
make test

# Or from frontend directory
cd frontend && npm run test
```

**Why:** Validates that new changes don't break existing functionality and that new features work as expected.

### 5. Migration Tests ✅

PocketBase migrations must be tested and verified.

```bash
# From project root
make test-migrations
```

**Why:** Ensures database migrations run successfully without crashing PocketBase and that schema changes are applied correctly.

## Development Workflow

### Complete Pre-Push Checklist

Before pushing any PR, run the CI command which combines all essential checks:

```bash
# From project root - runs lint, type-check, build, and all tests
make ci && make test-all
```

This single command ensures your code meets all quality standards.

### Recommended Development Process

1. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Write clean, modular code
   - Follow the existing architecture patterns
   - Add tests for new functionality

3. **Test locally**
   ```bash
   make ci && make test-all
   ```

4. **Commit with clear messages**
   ```bash
   git commit -m "Add feature: brief description"
   ```

5. **Push and create PR**
   ```bash
   git push origin feature/your-feature-name
   ```

## Testing Guidelines

### Frontend Tests

HomeOS uses Vitest for testing. Tests should cover:

- **Component behavior** - User interactions and rendering
- **Hooks** - Custom hook logic and state management
- **API integration** - PocketBase queries and mutations
- **Business logic** - Utilities and helper functions

```typescript
// Example test structure
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

describe('ComponentName', () => {
  it('should render correctly', () => {
    render(<ComponentName />);
    expect(screen.getByText('Expected Text')).toBeInTheDocument();
  });
});
```

### Migration Tests

Located in `tests/migrations/`, these tests:

- Download and run PocketBase 0.34.2
- Apply all migrations from `pb_migrations/`
- Verify PocketBase doesn't crash
- Check that collections are created with correct schema

See `tests/migrations/README.md` for more details.

## Code Quality Standards

### TypeScript

- Use strict type checking (enabled in `tsconfig.json`)
- Avoid `any` types - use proper type definitions
- Export types that might be reused
- Use interfaces for object shapes

### React

- Prefer functional components with hooks
- Use custom hooks for reusable logic
- Keep components focused and single-purpose
- Follow the modular architecture pattern

### Modular Architecture

Every feature should be a self-contained module:

```
src/modules/feature-name/
├── components/          # UI components
├── hooks/              # Custom hooks
├── types.ts            # TypeScript types
├── routes.tsx          # Route definitions
├── module.config.ts    # Module metadata
└── index.ts           # Public exports
```

### Code Style

- Use meaningful variable and function names
- Write self-documenting code
- Add comments only for complex logic
- Keep functions small and focused
- Avoid premature optimization

## Project Structure

### Frontend (`frontend/`)

- **`src/core/`** - Core infrastructure (auth, routing, API)
- **`src/modules/`** - Feature modules (dashboard, gift-cards, etc.)
- **`src/shared/`** - Shared components and utilities
- **`src/test/`** - Test setup and utilities

### Backend

- **`pb_migrations/`** - PocketBase database migrations
- **`pocketbase/`** - PocketBase binary and data (not in git)

### Tests

- **`frontend/src/**/*.test.ts(x)`** - Frontend unit/integration tests
- **`tests/migrations/`** - Migration testing suite

## Common Commands Quick Reference

```bash
# Install dependencies
make install

# Start development server
make dev

# Run all quality checks
make ci && make test-all

# Individual checks
make lint             # ESLint
make type-check       # TypeScript
make build            # Production build
make test             # Frontend tests only
make test-migrations  # Migration tests only
make test-all         # All tests (frontend + migrations)

# Clean build artifacts
make clean

# Security audit
make audit
```

## For Claude AI Assistants

When working on this project:

1. **Always run the full test suite** before marking tasks complete
2. **Follow the modular architecture** - don't create monolithic components
3. **Respect existing patterns** - review similar code before implementing
4. **Test migrations thoroughly** - database changes are critical
5. **Ask clarifying questions** if requirements are unclear
6. **Document complex logic** - but prefer self-explanatory code
7. **Security first** - validate inputs, sanitize outputs, follow OWASP guidelines

### Before Every PR Push

Run this command and verify all checks pass:

```bash
make ci && make test-all
```

Only push when all checks pass successfully.

---

**Remember:** The goal is to maintain high code quality while moving quickly. These checks exist to catch issues early and keep the codebase healthy.
