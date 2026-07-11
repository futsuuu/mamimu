# Contributing

## Development Setup

This project uses [mise](https://mise.jdx.dev) for tool and task management, but you can manually install tools and run tasks if you don't use it.

### Requirements

- Node.js
- pnpm

### Task List

Run `mise tasks` or `pnpm run`.

### Environment Variables

Copy `.env.example` to `.env` and fill in the values.

## Commit Message Convention

This project uses [Scoped Commits](https://scopedcommits.com):

```
<scope>: <description>

[optional body]

[optional trailer(s)]
```

## Before Committing

You should run `mise run check` to ensure code passes formatting and lint checks.
