# Meteorite Dodger 🚀

A 2D space-avoidance arcade game built with **React, TypeScript, Vite, and HTML Canvas**. Pilot a spaceship through a meteorite storm, dodge incoming obstacles, collect power-ups, and try to beat your high score.

## Features

- **Arcade-style gameplay** with a continuously scrolling space environment
- **Three selectable ships** to choose from
- **Two difficulty modes:** Cadet and Veteran
- **Power-ups** to help you survive:
  - **Energy Shield** — protects you from a collision
  - **Chrono Warp** — slows the action temporarily
  - **2x Hyper Score** — increases scoring for a limited time
  - **EMP Shockwave** — clears nearby meteorites
- **Sound effects** with an option to toggle sound on or off
- **Score tracking**, survival time, and meteorites dodged
- **Locally saved high score** using browser local storage
- **Responsive controls** for keyboard, mouse, and touch devices
- Animated particles and visual effects

## Tech Stack

- React
- TypeScript
- Vite
- HTML Canvas
- Tailwind CSS
- Lucide React icons
- Web Audio API

## Getting Started

### Prerequisites

Install **Node.js** (which includes npm). You can download it from [nodejs.org](https://nodejs.org/).

### Installation

1. Clone this repository:

   ```bash
   git clone https://github.com/YOUR-USERNAME/YOUR-REPOSITORY.git
   ```

2. Open the project directory:

   ```bash
   cd YOUR-REPOSITORY
   ```

3. Install dependencies:

   ```bash
   npm install
   ```

4. Start the development server:

   ```bash
   npm run dev
   ```

5. Open the local URL printed in your terminal by Vite.

## How to Play

1. Start the game and choose your spaceship and difficulty.
2. Move left and right to avoid incoming meteorites.
3. Collect power-ups when it is safe to do so.
4. Stay alive as long as possible and aim for a new high score.

### Controls

| Input | Action |
|---|---|
| `A` or `←` | Move left |
| `D` or `→` | Move right |
| Mouse | Move your ship by moving/dragging the pointer over the game area |
| Touch | Use touch controls on supported mobile devices |

The game may initialize audio after your first interaction, depending on your browser's audio policies.

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the local development server |
| `npm run build` | Build the app for production |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run the TypeScript compiler check |

## Project Structure

```text
.
├── public/
│   └── meteorite-dodger.html
├── src/
│   ├── App.tsx          # Main game interface and gameplay logic
│   ├── index.css        # Global styles
│   └── main.tsx         # React entry point
├── index.html           # HTML entry point and page metadata
├── package.json         # Dependencies and npm scripts
├── tsconfig.json        # TypeScript configuration
└── vite.config.ts       # Vite configuration
```

## Build for Production

Create an optimized production build:

```bash
npm run build
```

The generated files will be placed in the `dist/` directory. To test the build locally, run:

```bash
npm run preview
```

## High Scores and Data

Your high score is stored in your browser's local storage on the device and browser where you play. It does not automatically sync between devices or browsers.

## Contributing

Suggestions and improvements are welcome:

1. Fork the repository.
2. Create a branch for your change.
3. Commit your changes.
4. Open a pull request.

## License

No license has been specified for this project yet. Add a `LICENSE` file if you want to make the project open source, and choose a license that fits how you want others to use it.
