# @theletterf/beautiful-mermaid

A maintained fork of [beautiful-mermaid](https://github.com/lukilabs/beautiful-mermaid) that fixes existing bugs and type errors.

Render Mermaid diagrams as beautiful SVGs or ASCII art. Ultra-fast, fully themeable, zero DOM dependencies.

## Installation

```bash
npm install @theletterf/beautiful-mermaid
```

## Usage

```typescript
import { renderMermaid } from '@theletterf/beautiful-mermaid'

const svg = await renderMermaid(`
  graph TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Action]
    B -->|No| D[End]
`)
```

For the full API and theming documentation, see the [upstream README](https://github.com/lukilabs/beautiful-mermaid#readme).

## License

MIT
