# WAT Framework Project

This project uses the **WAT (Workflows, Agents, Tools)** architecture for reliable AI-powered automation.

## Architecture Overview

The WAT framework separates concerns into three layers:

1. **Workflows** - Plain language SOPs that define what needs to be done
2. **Agents** - AI decision-makers that orchestrate tool execution
3. **Tools** - Deterministic scripts that handle actual execution

See [Claude.md](Claude.md) for complete framework documentation.

## Project Structure

```
.
├── workflows/          # Markdown SOPs defining processes
├── tools/              # Node.js scripts for execution
├── .tmp/               # Temporary files (auto-generated, disposable)
├── .env                # Environment variables (not tracked in git)
├── .env.template       # Template for required environment variables
└── Claude.md           # Framework documentation and agent instructions
```

## Getting Started

### 1. Set up environment variables

```bash
cp .env.template .env
```

Then edit `.env` and add your API keys.

### 2. Install dependencies (when needed)

As you add tools that require npm packages:

```bash
npm init -y
npm install <package-name>
```

### 3. Create workflows

Add new workflow SOPs to the `workflows/` directory. Each workflow should define:
- Objective
- Required inputs
- Tools to use
- Expected outputs
- Edge case handling

### 4. Create tools

Add execution scripts to the `tools/` directory. Keep them:
- Focused on a single task
- Deterministic and testable
- Well-documented

## Core Principles

- **Local files are for processing only** - Final deliverables go to cloud services
- **Workflows evolve** - Update SOPs as you learn and improve
- **Tools are deterministic** - Let AI handle decisions, not execution
- **Secrets stay in .env** - Never hardcode credentials

## Self-Improvement Loop

1. Identify what broke
2. Fix the tool
3. Verify the fix works
4. Update the workflow
5. Move forward with a stronger system
