# Contributing to Research Canvas

Thank you for your interest in contributing! This document provides guidelines for contributing to the project.

## Code of Conduct

Be respectful, inclusive, and professional in all interactions.

## Development Setup

### Prerequisites
- Node.js 18+
- Python 3.12+
- Git

### Initial Setup

```bash
# Clone the repository
git clone <repository-url>
cd research-canvas

# Install dependencies
npm install

# Copy environment template
cp .env.example .env.local

# Add your API keys to .env.local
```

### Running Locally

```bash
# Start the development server (frontend + agent)
npm run dev

# Frontend will run on http://localhost:3000
# Agent will run on http://localhost:2024
```

## Branch Strategy

- **`main`** - Primary development branch
- **`production`** - Production releases only (protected)
- **`feature/*`** - Feature branches
- **`fix/*`** - Bug fix branches

## Making Changes

### 1. Create a Branch

```bash
# For new features
git checkout -b feature/your-feature-name

# For bug fixes
git checkout -b fix/bug-description
```

### 2. Make Your Changes

Follow the project's coding guidelines (see below).

### 3. Test Your Changes

```bash
# Run linting
npm run lint

# Run type checking
npm run type-check

# Build the project
npm run build

# Test manually
npm run dev
```

### 4. Commit Your Changes

Use clear, descriptive commit messages:

```bash
# Good commit messages
git commit -m "Add search functionality to knowledge base"
git commit -m "Fix: Resolve infinite loop in agent state"
git commit -m "Docs: Update deployment guide"

# Bad commit messages
git commit -m "fix stuff"
git commit -m "wip"
git commit -m "updates"
```

### 5. Push and Create PR

```bash
git push origin feature/your-feature-name
```

Then create a Pull Request on GitHub targeting the `main` branch.

## Coding Guidelines

### TypeScript/JavaScript

- Use TypeScript for type safety
- Follow existing code style
- Use meaningful variable names
- Add comments for complex logic
- Avoid any type where possible

### Python

- Follow PEP 8 style guide
- Use type hints
- Add docstrings for functions/classes
- Use meaningful variable names
- Format code with Black (if available)

### General

- Write self-documenting code
- Keep functions small and focused
- Don't repeat yourself (DRY)
- Test your changes thoroughly
- Update documentation when needed

## Pull Request Process

1. **Create PR** - Use the PR template
2. **Fill out template** - Provide all requested information
3. **Request review** - Tag relevant maintainers
4. **Address feedback** - Respond to review comments
5. **Get approval** - At least 1 approval required
6. **Merge** - Maintainer will merge when ready

## Testing

### Manual Testing

Always test your changes manually:

1. Start the dev server
2. Test the specific feature you changed
3. Test related features that might be affected
4. Check console for errors
5. Test in different browsers (if UI changes)

### Automated Tests

```bash
# Run tests (when available)
npm test

# Run Python tests
cd agents/python
pytest
```

## Documentation

Update documentation when you:

- Add new features
- Change existing behavior
- Add new environment variables
- Change deployment process
- Add new dependencies

Documentation files:
- `README.md` - Project overview
- `QUICKSTART.md` - Getting started guide
- `DEPLOYMENT.md` - Deployment instructions
- `CLAUDE.md` - Development philosophy

## Reporting Issues

When reporting bugs:

1. **Search existing issues** - Maybe it's already reported
2. **Use issue templates** - Provide all requested info
3. **Be specific** - Include steps to reproduce
4. **Add context** - OS, browser, versions
5. **Include logs** - Error messages, console output

## Feature Requests

When suggesting features:

1. **Check existing requests** - Avoid duplicates
2. **Explain the use case** - Why is this needed?
3. **Describe the solution** - How should it work?
4. **Consider alternatives** - Are there other approaches?

## Getting Help

- **Documentation** - Check README and QUICKSTART first
- **Issues** - Search existing issues
- **Discussions** - Use GitHub Discussions for questions

## License

By contributing, you agree that your contributions will be licensed under the same license as the project (MIT License).

## Recognition

Contributors will be recognized in the project documentation and release notes.

Thank you for contributing! 🎉
