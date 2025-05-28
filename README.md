# SankeyMATIC
## Make Beautiful Flow Diagrams
### A [Sankey diagram](https://en.wikipedia.org/wiki/Sankey_diagram) builder for everyone

[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)

* Describe your data using text.
* Customize your diagram's appearance interactively.
* Export a finished product as a PNG image and as SVG code.
* Export/import your work in progress as readable (and diff-able) plain text files.

Hosted and available for use at: **http://sankeymatic.com/build/**

Follow [@SankeyMATIC@vis.social](https://vis.social/@SankeyMATIC) on Mastodon for news and updates.

Produced by **Steve Bogart** ([@nowthis@tilde.zone](https://tilde.zone/@nowthis))

## Project Structure (Refactored Version)

The application has been refactored into a modular structure:

```

```

## Development Setup

### Prerequisites

- Node.js (v14 or later)
- npm (v6 or later)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/colinbendell/sankeymatic.git
   cd sankeymatic
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

### Development

Start the development server:
```bash
npm run dev
```

This will:
- Start a local development server
- Watch for file changes and rebuild automatically
- Provide live reloading

### Building for Production

To create a production build:
```bash
npm run build
```

The built files will be available in the `build/` directory.

### Linting

Run the linter:
```bash
npm run lint
```

## Key Features

- **Modular Architecture**: Code is organized into logical modules for better maintainability
- **Modern JavaScript**: Uses ES modules and modern JavaScript features
- **Build System**: Uses esbuild for fast builds
- **Responsive Design**: Works on desktop and mobile devices

## Dependencies

- [d3.js](https://github.com/d3/d3) version 7.x - For data visualization
- [Canvg](https://github.com/canvg/canvg) 3.0.9 - For SVG to PNG conversion
- [esbuild](https://esbuild.github.io/) - For fast JavaScript bundling

## Background

SankeyMATIC was inspired by the big energy flow diagram in [d3](http://d3js.org/)'s gallery of examples (visible these days [at ObservableHQ](https://observablehq.com/@d3/sankey)).

Initially built on a [fork of that very d3 Sankey library](https://github.com/nowthis/d3-plugin-captain-sankey) and evolving from there, SankeyMATIC is intended to make it possible for anyone with a web browser to generate complex and beautiful flow diagrams while requiring zero knowledge of coding.

## License

ISC
