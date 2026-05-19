# PRP Customization Guide

This guide explains how to customize the PRP template for different stacks and project conventions.

## Python Projects

### Package Manager: uv
```bash
# Validation commands
uv run ruff check src/
uv run mypy src/
uv run pytest tests/ -v
```

### Package Manager: pip
```bash
# Validation commands
python -m ruff check src/
python -m mypy src/
python -m pytest tests/ -v
```

### Package Manager: poetry
```bash
# Validation commands
poetry run ruff check src/
poetry run mypy src/
poetry run pytest tests/ -v
```

### FastAPI Specific
- Use async/await for all route handlers
- Use Pydantic for request/response models
- Include dependency injection for services

---

## Node.js Projects

### Package Manager: npm
```bash
# Validation commands
npm run lint
npm run typecheck
npm test
```

### Package Manager: pnpm
```bash
# Validation commands
pnpm lint
pnpm typecheck
pnpm test
```

### Package Manager: yarn
```bash
# Validation commands
yarn lint
yarn typecheck
yarn test
```

### Express Specific
- Use middleware for authentication
- Follow controller/service pattern
- Use async/await with try/catch

---

## TypeScript Projects

### Framework: Next.js
```bash
# Validation commands
npm run lint
npm run typecheck
npm run test
```

### Framework: NestJS
- Use decorators for DI
- Follow module pattern
- Use DTOs with class-validator

---

## Rust Projects

### Package Manager: cargo
```bash
# Validation commands
cargo clippy
cargo check
cargo test
```

### Framework: Actix
- Use extractors for request parsing
- Use handlers withaw for async
- Follow actor pattern for state

---

## Customization Examples

### Adding Custom Validation

Edit `prp_base.md` to add custom commands:

```markdown
### Level 1: Syntax & Style
```bash
# Run FIRST - fix errors before proceeding
[YOUR_LINT_COMMAND]
[YOUR_TYPECHECK_COMMAND]
```
```

### Custom Test Patterns

If using a specific testing framework:

```markdown
### Level 2: Unit Tests
```python
def test_happy_path():
    """Basic functionality works"""
    result = new_feature("valid_input")
    assert result.status == "success"
```

### Gotchas from AGENTS.md

Include any project-specific rules:

```markdown
### Known Gotchas & Library Quirks
```python
# CRITICAL: [Project rule from AGENTS.md]
```

---

## Best Practices

1. **Always validate commands work** before adding to template
2. **Use exactly what's in your project** - don't guess
3. **Include all environment setup** if needed
4. **Document integration points** specific to your project
5. **Keep template minimal** - only essential overrides