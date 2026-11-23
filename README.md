# Fox Multi-Endpoint Pipe (n8n Node)

Custom n8n node to dispatch multiple HTTP requests in a single execution step, supporting sequential chaining and parallel fan-out.

## Overview

Instead of placing multiple separate HTTP request nodes in an n8n workflow, Fox Multi-Endpoint Pipe lets users configure a series of network calls within one node.

### Core Capabilities

- **Pipeline Execution**: Requests run sequentially. Each subsequent call can access previous step payloads using expressions like `{{ $pipeline.stepName.data }}`.
- **Parallel Execution**: Requests execute concurrently with a user-defined concurrency cap.
- **Dynamic Expression Resolution**: Interpolates input fields (`$json`), previous step responses (`$pipeline`), and immediate predecessor data (`$prev`).
- **Flexible Result Aggregation**: Return results as a dictionary keyed by alias, return only the last response, return an array of all responses, or merge directly into the incoming item.
- **Fault Tolerance**: Per-endpoint settings for retries, timeouts, and `continueOnFail`.

## Repository Setup

```bash
# Clone
git clone https://github.com/tedious-code/n8n-nodes-fox-schema-multi-enpoints.git

# Build
npm run build
```

## License

MIT - Huy Phan (tedious-code)
