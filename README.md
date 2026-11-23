# Fox Schema Multi Endpoint Node for n8n

Custom community node for n8n designed to dispatch and orchestrate multiple HTTP requests in a single execution step.
Authored by **Huy Phan**

## Highlights

- **Multi-Request Execution**: Define a sequence of API endpoints (chained pipeline) or run them concurrently in parallel.
- **Dynamic Context Passing**: Downstream endpoints can read data from earlier steps (`{{ $pipeline.step1.data }}`), immediate predecessor (`{{ $prev.data }}`), or the input item (`{{ $json.field }}`).
- **Configurable Response Output**:
  - `Merge All Responses into an Object`: Combined object keyed by step alias.
  - `Last Response Only`: Data from the final executed step.
  - `First Response Only`: Data from the first executed step.
  - `All Responses as Array`: Array of all responses.
  - `Split Each Response to New Item`: Individual n8n items.
  - `Merge into Input Item`: Enriches incoming `$json`.
- **Configurable Timeout**: Top-level default of `500ms`, editable globally or overridden per endpoint.
- **Request Body Options**: Supports JSON editor with expressions, visual field builder, form-urlencoded data, and raw text.
- **Direct Auth**: No credentials required; configure authorization headers directly.

## Visual Walkthrough

### Properties Panel & Timeout
![Properties Panel](screenshots/timeout_500ms.png)

### Response Output Selection
![Response Output](screenshots/response_output_dropdown.png)

### Body Configuration
![Body Configuration](screenshots/properties_panel_body.png)

## Installation

### In n8n (Community Nodes)
1. Go to **Settings** > **Community Nodes**.
2. Select **Install a community node**.
3. Enter `n8n-nodes-fox-schema-multi-enpoints` and click **Install**.

### Via CLI / Docker
```bash
npm install n8n-nodes-fox-schema-multi-enpoints
```

## CI / CD & Publishing

This repository includes automated GitHub Actions workflows:
- **CI (`.github/workflows/ci.yml`)**: Runs unit tests and builds on pushes and PRs to `main` across Node 20.x and 22.x.
- **Publish to npm (`.github/workflows/publish.yml`)**: Automatically publishes to npm on GitHub Releases or via manual trigger (**Actions** > **Publish to npm** > **Run workflow**).
  - *Setup*: Add your npm automation token as `NPM_TOKEN` under **Settings** > **Secrets and variables** > **Actions** in GitHub.

## Package

- Package Name: `n8n-nodes-fox-schema-multi-enpoints`
- License: MIT
