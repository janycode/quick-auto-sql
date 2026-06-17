---
name: codebase-docs
description: "Analyze a codebase and generate AGENTS.md or CLAUDE.md documentation for AI assistants"
---

# Codebase Documentation Generator

Generate comprehensive project documentation (AGENTS.md or CLAUDE.md) that helps AI assistants understand the codebase structure, conventions, and workflows.

## When to Use

- Setting up a new project for AI-assisted development
- Updating documentation after major architectural changes
- Creating onboarding docs for new team members
- Standardizing project knowledge across sessions

## Workflow

### Phase 1: Project Discovery (5-10 tool calls)

1. **Identify project root** — locate `package.json`, `Cargo.toml`, `go.mod`, `pyproject.toml`, or similar
2. **Read project manifest** — understand dependencies, scripts, and project type
3. **Scan directory structure** — `glob **/*.{ts,js,py,rs,go,vue,jsx,tsx}` to map codebase layout
4. **Read key config files** — `tsconfig.json`, `vite.config.*`, `.eslintrc`, `docker-compose.yml`, etc.

### Phase 2: Architecture Analysis (10-20 tool calls)

1. **Entry points** — find main files (`main.ts`, `app.ts`, `index.ts`, `App.vue`)
2. **Route/API structure** — scan `routes/`, `api/`, `pages/` directories
3. **State management** — identify stores, contexts, or state patterns
4. **Services/utilities** — map business logic layers
5. **Config patterns** — understand environment variables, feature flags, build configs

### Phase 3: Conventions Extraction (5-10 tool calls)

1. **Code style** — infer from existing code (imports, naming, structure)
2. **Testing patterns** — find test files, understand test framework
3. **Build/deploy** — read `Dockerfile`, CI configs, deployment scripts
4. **Key gotchas** — identify non-obvious behaviors, workarounds, or gotchas

### Phase 4: Documentation Assembly (1-2 tool calls)

1. **Draft sections** using the template below
2. **Write to file** — `AGENTS.md` (for MiMo/Claude Code) or `CLAUDE.md` (for Claude)
3. **Verify** — read back and confirm accuracy

## Documentation Template

```markdown
# [AGENTS.md | CLAUDE.md]

## Project

[1-2 sentence project description. What does it do? What tech stack?]

## Commands

### [Package/Service 1]
```bash
[command]        # [description]
```

### [Package/Service 2]
```bash
[command]        # [description]
```

### Dev startup order
1. [First step]
2. [Second step]

## Verification

[How to run tests, lint, type-check. Be specific about what checks exist.]

## Architecture

### [Layer 1] ([directory/])
- **Entry**: `[file]` — [purpose]
- **Pattern**: [key architectural pattern]
- **Key files**: [list important files with one-line purposes]

### [Layer 2] ([directory/])
[Same structure]

### Key gotchas
- [Non-obvious behavior 1]
- [Non-obvious behavior 2]
- [Gotcha 3]
```

## Writing Guidelines

1. **Be specific** — Include actual file paths, command names, port numbers
2. **Be concise** — Each section should be scannable in 30 seconds
3. **Include gotchas** — Document non-obvious behaviors that trip up developers
4. **Verify accuracy** — Read the files you reference; don't guess
5. **Match project tone** — If the project uses Chinese, write in Chinese

## Quality Checklist

- [ ] Project description is clear and accurate
- [ ] All commands are tested and working
- [ ] Architecture matches actual code structure
- [ ] Key gotchas are documented
- [ ] File paths are correct
- [ ] No placeholder text remains

## Integration

**Preceded by:** Nothing (standalone workflow)
**Followed by:** Ready for AI-assisted development

After generating documentation:

> "Documentation generated at `[path]`. The AI assistant now has context for this project."
