# Contributing to dsh_ux_enhance

Thanks for your interest in contributing!

## Development Setup

```bash
# Clone the repo
git clone https://github.com/XQ-quadrant/dsh_ux_enhance.git
cd dsh_ux_enhance

# Install dependencies (if any in the future)
# npm install

# Build the browser bundle after modifying source files
node scripts/build.mjs
```

## Source Files

- `lib/session-color.js` — Sidebar session color feature
- `lib/layout-ui.js` — Chat layout optimization
- `lib/sound-alert.js` — Audio notification on session complete / question
- `lib/entry.js` — Browser entry point, composes all modules above
- `scripts/build.mjs` — Builds `lib/client.js` bundle from source files

After editing any `*.js` file under `lib/`, always run:

```bash
node scripts/build.mjs
```

Then commit both the source file and the generated `lib/client.js`.

## Code Style

- 2-space indentation, no tabs
- ESM (`import`/`export`)
- No unnecessary dependencies

## Pull Request Process

1. Fork the repo and create a feature branch from `main`
2. Make your changes and run `node scripts/build.mjs` to verify the bundle builds
3. Push to your fork and open a Pull Request
4. Describe the change clearly and link any related issue

## Reporting Bugs

Please open an issue with:
- DSH version you're using
- Browser and OS
- Steps to reproduce
- Expected vs actual behavior
