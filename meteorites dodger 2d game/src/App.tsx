/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { 
  Volume2, 
  VolumeX, 
  Pause, 
  Play, 
  RotateCcw, 
  Download, 
  Copy, 
  Check, 
  Shield, 
  Zap, 
  Clock, 
  Sparkles, 
  ExternalLink,
  ChevronRight,
  Trophy,
  Rocket
} from 'lucide-react';

// --- Type Definitions ---
type GameState = 'MENU' | 'PLAYING' | 'PAUSED' | 'GAMEOVER';
type ShipType = 'interceptor' | 'phantom' | 'vanguard';
type DifficultyMode = 'cadet' | 'veteran';

interface PowerupItem {
  name: string;
  type: 'shield' | 'slowmo' | 'multiplier' | 'emp';
  color: string;
  duration: number;
}

const POWERUP_DEFS: Record<string, PowerupItem> = {
  shield: { name: 'Energy Shield', type: 'shield', color: '#06b6d4', duration: 0 },
  slowmo: { name: 'Chrono Warp', type: 'slowmo', color: '#a855f7', duration: 6 },
  multiplier: { name: '2x Hyper Score', type: 'multiplier', color: '#f59e0b', duration: 8 },
  emp: { name: 'EMP Shockwave', type: 'emp', color: '#10b981', duration: 0 }
};

export default function App() {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<'game' | 'code' | 'guide'>('game');

  // Game UI State
  const [gameState, setGameState] = useState<GameState>('MENU');
  const [score, setScore] = useState<number>(0);
  const [highScore, setHighScore] = useState<number>(() => {
    return parseInt(localStorage.getItem('meteorite_dodger_high_score') || '0', 10);
  });
  const [dodgedCount, setDodgedCount] = useState<number>(0);
  const [survivalSeconds, setSurvivalSeconds] = useState<number>(0);
  const [powerupsCollected, setPowerupsCollected] = useState<number>(0);
  const [isSoundEnabled, setIsSoundEnabled] = useState<boolean>(true);
  const [selectedShip, setSelectedShip] = useState<ShipType>('interceptor');
  const [difficulty, setDifficulty] = useState<DifficultyMode>('cadet');
  const [isNewRecord, setIsNewRecord] = useState<boolean>(false);
  const [copySuccess, setCopySuccess] = useState<boolean>(false);

  // Active power-up countdowns for HUD
  const [activeShield, setActiveShield] = useState<boolean>(false);
  const [slowMoRemaining, setSlowMoRemaining] = useState<number>(0);
  const [multiplierRemaining, setMultiplierRemaining] = useState<number>(0);

  // Canvas & Audio References
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const keysRef = useRef<{ left: boolean; right: boolean }>({ left: false, right: false });
  const touchLeftRef = useRef<boolean>(false);
  const touchRightRef = useRef<boolean>(false);
  const isDraggingRef = useRef<boolean>(false);

  // Game Mutable State Container for high-frequency 60-144fps loop
  const gameData = useRef<{
    state: GameState;
    score: number;
    dodged: number;
    startTime: number;
    elapsed: number;
    lastTime: number;
    spawnTimer: number;
    powerupTimer: number;
    shake: number;
    player: {
      x: number;
      y: number;
      radius: number;
      targetX: number;
      width: number;
      tilt: number;
      shield: boolean;
      slowMoTimer: number;
      multiplierTimer: number;
      speed: number;
      shipType: ShipType;
    };
    meteorites: Array<{
      x: number;
      y: number;
      size: number;
      speed: number;
      rotation: number;
      rotSpeed: number;
      color: string;
      vertices: Array<{ x: number; y: number }>;
      craters: Array<{ x: number; y: number; r: number }>;
    }>;
    powerups: Array<{
      x: number;
      y: number;
      radius: number;
      speed: number;
      pulse: number;
      item: PowerupItem;
    }>;
    particles: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      color: string;
      life: number;
      maxLife: number;
    }>;
    floatingTexts: Array<{
      text: string;
      x: number;
      y: number;
      color: string;
      life: number;
      maxLife: number;
    }>;
    stars: Array<{
      x: number;
      y: number;
      size: number;
      speed: number;
      opacity: number;
      twinkle: number;
    }>;
    shockwaves: Array<{
      x: number;
      y: number;
      r: number;
      maxR: number;
      color: string;
      opacity: number;
    }>;
  }>({
    state: 'MENU',
    score: 0,
    dodged: 0,
    startTime: 0,
    elapsed: 0,
    lastTime: 0,
    spawnTimer: 0,
    powerupTimer: 0,
    shake: 0,
    player: {
      x: 300,
      y: 500,
      radius: 18,
      targetX: 300,
      width: 38,
      tilt: 0,
      shield: false,
      slowMoTimer: 0,
      multiplierTimer: 0,
      speed: 480,
      shipType: 'interceptor'
    },
    meteorites: [],
    powerups: [],
    particles: [],
    floatingTexts: [],
    stars: [],
    shockwaves: []
  });

  // Sound Synthesizer via Web Audio API
  const initAudio = useCallback(() => {
    if (!audioCtxRef.current) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        audioCtxRef.current = new AudioCtx();
      }
    }
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
  }, []);

  const playSfx = useCallback((type: 'dodge' | 'powerup' | 'shield' | 'explosion' | 'emp') => {
    if (!isSoundEnabled || !audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    const now = ctx.currentTime;

    try {
      if (type === 'dodge') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.exponentialRampToValueAtTime(800, now + 0.07);
        gain.gain.setValueAtTime(0.04, now);
        gain.gain.linearRampToValueAtTime(0.001, now + 0.07);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.07);
      } else if (type === 'powerup') {
        const notes = [440, 554, 659, 880];
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now + idx * 0.07);
          gain.gain.setValueAtTime(0.09, now + idx * 0.07);
          gain.gain.linearRampToValueAtTime(0.005, now + (idx + 1) * 0.07);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + idx * 0.07);
          osc.stop(now + (idx + 1) * 0.07);
        });
      } else if (type === 'shield') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(120, now + 0.22);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.22);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.22);
      } else if (type === 'emp') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(110, now + 0.4);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.4);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.4);
      } else if (type === 'explosion') {
        const bufferSize = ctx.sampleRate * 0.45;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
        }
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(750, now);
        filter.frequency.linearRampToValueAtTime(50, now + 0.45);
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.45);
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        noise.start(now);
      }
    } catch {
      // Audio fallback safe
    }
  }, [isSoundEnabled]);

  // Starfield initialization
  const initStars = (width: number, height: number) => {
    const stars = [];
    for (let i = 0; i < 90; i++) {
      stars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() < 0.2 ? Math.random() * 1.8 + 1.2 : Math.random() * 1.0 + 0.4,
        speed: Math.random() * 0.9 + 0.4,
        opacity: Math.random() * 0.6 + 0.25,
        twinkle: Math.random() * 0.05 + 0.01
      });
    }
    gameData.current.stars = stars;
  };

  // Start game action
  const startGame = () => {
    initAudio();
    const canvas = canvasRef.current;
    const width = canvas ? canvas.clientWidth : 500;
    const height = canvas ? canvas.clientHeight : 700;

    const shipSpeed = selectedShip === 'phantom' ? 530 : (selectedShip === 'vanguard' ? 440 : 480);
    const startShield = selectedShip === 'vanguard';

    gameData.current = {
      ...gameData.current,
      state: 'PLAYING',
      score: 0,
      dodged: 0,
      startTime: performance.now(),
      elapsed: 0,
      lastTime: performance.now(),
      spawnTimer: 0,
      powerupTimer: 0,
      shake: 0,
      meteorites: [],
      powerups: [],
      particles: [],
      floatingTexts: [],
      shockwaves: [],
      player: {
        x: width / 2,
        y: height - 85,
        radius: selectedShip === 'vanguard' ? 21 : 18,
        targetX: width / 2,
        width: selectedShip === 'vanguard' ? 42 : 36,
        tilt: 0,
        shield: startShield,
        slowMoTimer: 0,
        multiplierTimer: 0,
        speed: shipSpeed,
        shipType: selectedShip
      }
    };

    setGameState('PLAYING');
    setScore(0);
    setDodgedCount(0);
    setSurvivalSeconds(0);
    setPowerupsCollected(0);
    setActiveShield(startShield);
    setSlowMoRemaining(0);
    setMultiplierRemaining(0);
    setIsNewRecord(false);
  };

  // Pause toggle
  const togglePause = () => {
    if (gameState === 'PLAYING') {
      gameData.current.state = 'PAUSED';
      setGameState('PAUSED');
    } else if (gameState === 'PAUSED') {
      gameData.current.state = 'PLAYING';
      gameData.current.lastTime = performance.now();
      setGameState('PLAYING');
    }
  };

  // Particle creation helper
  const addExplosion = (x: number, y: number, count = 28, color = '#f97316') => {
    gameData.current.shake = 14;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 5 + 1.5;
      const palette = [color, '#fbbf24', '#ef4444', '#ffffff'];
      gameData.current.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: Math.random() * 4 + 2,
        color: palette[Math.floor(Math.random() * palette.length)],
        life: Math.random() * 0.45 + 0.35,
        maxLife: 0.8
      });
    }
  };

  // Collision Math (circle to circle Euclidean distance)
  const checkCircleCollision = (x1: number, y1: number, r1: number, x2: number, y2: number, r2: number) => {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return dx * dx + dy * dy <= (r1 + r2) * (r1 + r2);
  };

  // Trigger EMP Wave that clears all screen hazards
  const triggerEMP = (px: number, py: number) => {
    playSfx('emp');
    gameData.current.shockwaves.push({
      x: px,
      y: py,
      r: 10,
      maxR: 450,
      color: '#10b981',
      opacity: 1
    });

    const destroyedCount = gameData.current.meteorites.length;
    gameData.current.meteorites.forEach((m) => {
      addExplosion(m.x, m.y, 14, '#10b981');
    });
    gameData.current.meteorites = [];

    const bonus = destroyedCount * 75;
    if (bonus > 0) {
      gameData.current.score += bonus;
      gameData.current.dodged += destroyedCount;
      gameData.current.floatingTexts.push({
        text: `EMP CLEARED +${bonus}!`,
        x: px,
        y: py - 40,
        color: '#10b981',
        life: 1.2,
        maxLife: 1.2
      });
    }
  };

  // Game Loop Implementation via RequestAnimationFrame
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const handleResize = () => {
      const container = containerRef.current;
      if (!container || !canvas) return;
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      if (gameData.current.stars.length === 0) {
        initStars(rect.width, rect.height);
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    // Main animation loop
    const loop = (timestamp: number) => {
      const g = gameData.current;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;

      // Handle pause or menu state background drawing
      if (g.state !== 'PLAYING') {
        // Clear screen with soft space gradient
        ctx.fillStyle = '#060a14';
        ctx.fillRect(0, 0, width, height);

        // Draw twinkling stars
        for (const s of g.stars) {
          s.y += s.speed * 0.4;
          if (s.y > height + 5) s.y = -5;
          ctx.fillStyle = `rgba(255, 255, 255, ${s.opacity})`;
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
          ctx.fill();
        }

        animId = requestAnimationFrame(loop);
        return;
      }

      // Compute Delta Time (bounded to prevent frame jumps)
      const dt = Math.min((timestamp - g.lastTime) / 1000, 0.08);
      g.lastTime = timestamp;
      g.elapsed += dt;

      // Continuous Survival Scoring
      const multiplier = g.player.multiplierTimer > 0 ? 2 : 1;
      const diffBonus = difficulty === 'veteran' ? 1.4 : 1.0;
      g.score += dt * 10 * multiplier * diffBonus;

      // Sync React state periodically for UI displays
      setScore(Math.floor(g.score));
      setDodgedCount(g.dodged);
      setSurvivalSeconds(Math.floor(g.elapsed));
      setActiveShield(g.player.shield);
      setSlowMoRemaining(Math.max(0, Math.ceil(g.player.slowMoTimer)));
      setMultiplierRemaining(Math.max(0, Math.ceil(g.player.multiplierTimer)));

      // Keyboard & Virtual Touch Inputs
      if (keysRef.current.left || touchLeftRef.current) {
        g.player.targetX -= g.player.speed * dt;
      }
      if (keysRef.current.right || touchRightRef.current) {
        g.player.targetX += g.player.speed * dt;
      }

      // Smooth Ship Lerp & Screen Edge Boundary Clamping
      const dx = g.player.targetX - g.player.x;
      g.player.x += dx * Math.min(1, dt * 14);
      g.player.y = height - 85;

      const halfW = g.player.width / 2;
      if (g.player.x < halfW) {
        g.player.x = halfW;
        g.player.targetX = halfW;
      }
      if (g.player.x > width - halfW) {
        g.player.x = width - halfW;
        g.player.targetX = width - halfW;
      }

      // Visual Ship Banking Tilt
      const targetTilt = Math.max(-0.4, Math.min(0.4, dx * 0.02));
      g.player.tilt += (targetTilt - g.player.tilt) * 0.16;

      // Engine Flame Exhaust Particles
      if (Math.random() < 0.9) {
        const exhaustColor = g.player.shipType === 'phantom' 
          ? (Math.random() < 0.5 ? '#22d3ee' : '#0284c7')
          : (g.player.shipType === 'vanguard' ? '#f59e0b' : '#38bdf8');
        g.particles.push({
          x: g.player.x + (Math.random() * 8 - 4),
          y: g.player.y + 16,
          vx: (Math.random() - 0.5) * 1.5,
          vy: Math.random() * 3 + 4,
          size: Math.random() * 3 + 2,
          color: exhaustColor,
          life: 0.35,
          maxLife: 0.35
        });
      }

      // Count down Power-ups
      if (g.player.slowMoTimer > 0) g.player.slowMoTimer -= dt;
      if (g.player.multiplierTimer > 0) g.player.multiplierTimer -= dt;

      // Dynamic Difficulty Progression: Spawning Interval decreases over survival time
      const diffMod = difficulty === 'veteran' ? 1.3 : 1.0;
      const baseInterval = 950 / diffMod;
      const minInterval = 260 / diffMod;
      const currentSpawnInterval = Math.max(minInterval, baseInterval - g.elapsed * 12);

      g.spawnTimer += dt * 1000;
      if (g.spawnTimer >= currentSpawnInterval) {
        g.spawnTimer = 0;
        
        // Spawn Meteorite with Procedural Jagged Shape
        const size = Math.random() * 24 + 14; // 14px to 38px radius
        const speedVar = (40 - size) * 4.5;
        const speedMult = 0.85 + (g.elapsed / 45) * 0.4;
        const fallSpeed = (145 + speedVar + Math.random() * 50) * speedMult * diffMod;
        const spawnX = Math.random() * (width - size * 2) + size;

        const numPoints = Math.floor(Math.random() * 4) + 8;
        const vertices = [];
        for (let i = 0; i < numPoints; i++) {
          const angle = (i / numPoints) * Math.PI * 2;
          const variance = Math.random() * 0.35 + 0.82;
          vertices.push({
            x: Math.cos(angle) * (size * variance),
            y: Math.sin(angle) * (size * variance)
          });
        }

        const colors = ['#64748b', '#475569', '#52525b', '#3f3f46'];
        g.meteorites.push({
          x: spawnX,
          y: -size,
          size,
          speed: fallSpeed,
          rotation: Math.random() * Math.PI * 2,
          rotSpeed: (Math.random() - 0.5) * 2.2,
          color: colors[Math.floor(Math.random() * colors.length)],
          vertices,
          craters: [
            { x: size * 0.25, y: -size * 0.2, r: size * 0.2 },
            { x: -size * 0.3, y: size * 0.15, r: size * 0.22 }
          ]
        });
      }

      // Power-up Spawning (every 13-17s)
      g.powerupTimer += dt;
      if (g.powerupTimer >= 14) {
        g.powerupTimer = 0;
        const keys = Object.keys(POWERUP_DEFS);
        const randomKey = keys[Math.floor(Math.random() * keys.length)];
        const item = POWERUP_DEFS[randomKey];
        g.powerups.push({
          x: Math.random() * (width - 60) + 30,
          y: -20,
          radius: 14,
          speed: 135,
          pulse: 0,
          item
        });
      }

      // Update Power-ups
      for (let i = g.powerups.length - 1; i >= 0; i--) {
        const p = g.powerups[i];
        p.y += p.speed * dt;
        p.pulse += dt * 5;

        // Pickup collision with ship
        if (checkCircleCollision(g.player.x, g.player.y, g.player.radius + 2, p.x, p.y, p.radius)) {
          playSfx('powerup');
          setPowerupsCollected((prev) => prev + 1);

          if (p.item.type === 'shield') {
            g.player.shield = true;
            g.floatingTexts.push({
              text: 'SHIELD DEPLOYED',
              x: g.player.x,
              y: g.player.y - 25,
              color: '#06b6d4',
              life: 1,
              maxLife: 1
            });
          } else if (p.item.type === 'slowmo') {
            g.player.slowMoTimer = p.item.duration;
            g.floatingTexts.push({
              text: 'CHRONO WARP (6s)',
              x: g.player.x,
              y: g.player.y - 25,
              color: '#a855f7',
              life: 1,
              maxLife: 1
            });
          } else if (p.item.type === 'multiplier') {
            g.player.multiplierTimer = p.item.duration;
            g.floatingTexts.push({
              text: '2X HYPER SCORE (8s)',
              x: g.player.x,
              y: g.player.y - 25,
              color: '#f59e0b',
              life: 1,
              maxLife: 1
            });
          } else if (p.item.type === 'emp') {
            triggerEMP(g.player.x, g.player.y);
          }

          g.powerups.splice(i, 1);
          continue;
        }

        if (p.y > height + 30) {
          g.powerups.splice(i, 1);
        }
      }

      // Update Meteorites & Hazard Collision Detection
      const isSlowMo = g.player.slowMoTimer > 0;
      for (let i = g.meteorites.length - 1; i >= 0; i--) {
        const m = g.meteorites[i];
        const speedFactor = isSlowMo ? 0.35 : 1.0;
        m.y += m.speed * speedFactor * dt;
        m.rotation += m.rotSpeed * speedFactor * dt;

        // Atmospheric friction spark particles
        if (Math.random() < 0.22) {
          g.particles.push({
            x: m.x + (Math.random() * m.size - m.size / 2),
            y: m.y - m.size * 0.4,
            vx: (Math.random() - 0.5) * 1.5,
            vy: -Math.random() * 2 - 1,
            size: Math.random() * 2.5 + 1.2,
            color: '#f97316',
            life: 0.3,
            maxLife: 0.3
          });
        }

        // Precision collision with Player Starship
        const hitRadius = g.player.radius * 0.88 + m.size * 0.88;
        if (checkCircleCollision(g.player.x, g.player.y, g.player.radius * 0.88, m.x, m.y, m.size * 0.88)) {
          if (g.player.shield) {
            // Shield absorbs lethal hit!
            playSfx('shield');
            g.player.shield = false;
            addExplosion(m.x, m.y, 22, '#06b6d4');
            g.floatingTexts.push({
              text: 'SHIELD DEFLECTED HIT!',
              x: g.player.x,
              y: g.player.y - 25,
              color: '#38bdf8',
              life: 1,
              maxLife: 1
            });
            g.meteorites.splice(i, 1);
            continue;
          } else {
            // Lethal hit -> Trigger Game Over
            playSfx('explosion');
            addExplosion(g.player.x, g.player.y, 45, '#38bdf8');
            g.state = 'GAMEOVER';

            const finalScoreVal = Math.floor(g.score);
            const currentRecord = parseInt(localStorage.getItem('meteorite_dodger_high_score') || '0', 10);
            if (finalScoreVal > currentRecord) {
              localStorage.setItem('meteorite_dodger_high_score', finalScoreVal.toString());
              setHighScore(finalScoreVal);
              setIsNewRecord(true);
            }

            setTimeout(() => {
              setGameState('GAMEOVER');
            }, 600);
            return;
          }
        }

        // Successfully dodged meteorite
        if (m.y > height + m.size) {
          g.meteorites.splice(i, 1);
          g.dodged++;
          const dodgePoints = 50 * multiplier;
          g.score += dodgePoints;
          playSfx('dodge');
          g.floatingTexts.push({
            text: `+${dodgePoints}`,
            x: m.x,
            y: height - 40,
            color: '#38bdf8',
            life: 0.75,
            maxLife: 0.75
          });
        }
      }

      // Update Particles
      for (let i = g.particles.length - 1; i >= 0; i--) {
        const pt = g.particles[i];
        pt.x += pt.vx * dt * 60;
        pt.y += pt.vy * dt * 60;
        pt.life -= dt;
        if (pt.life <= 0) g.particles.splice(i, 1);
      }

      // Update Floating Text
      for (let i = g.floatingTexts.length - 1; i >= 0; i--) {
        const ft = g.floatingTexts[i];
        ft.y -= dt * 35;
        ft.life -= dt;
        if (ft.life <= 0) g.floatingTexts.splice(i, 1);
      }

      // Update Shockwaves
      for (let i = g.shockwaves.length - 1; i >= 0; i--) {
        const sw = g.shockwaves[i];
        sw.r += dt * 450;
        sw.opacity = Math.max(0, 1 - sw.r / sw.maxR);
        if (sw.r >= sw.maxR) g.shockwaves.splice(i, 1);
      }

      // Update Stars
      const starSpeed = isSlowMo ? 0.5 : 1.2;
      for (const s of g.stars) {
        s.y += s.speed * starSpeed;
        if (s.y > height + 10) s.y = -10;
      }

      // ================= RENDERING PIPELINE =================
      ctx.save();

      // Screen Shake
      if (g.shake > 0) {
        const sx = (Math.random() - 0.5) * g.shake;
        const sy = (Math.random() - 0.5) * g.shake;
        ctx.translate(sx, sy);
        g.shake *= 0.88;
        if (g.shake < 0.4) g.shake = 0;
      }

      // Background
      ctx.fillStyle = '#060a14';
      ctx.fillRect(0, 0, width, height);

      // Stars
      for (const s of g.stars) {
        ctx.fillStyle = `rgba(255, 255, 255, ${s.opacity})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fill();
      }

      // EMP Shockwave Rings
      for (const sw of g.shockwaves) {
        ctx.save();
        ctx.strokeStyle = sw.color;
        ctx.globalAlpha = sw.opacity;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(sw.x, sw.y, sw.r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Power-ups
      for (const p of g.powerups) {
        ctx.save();
        ctx.translate(p.x, p.y);
        const scale = 1 + Math.sin(p.pulse) * 0.12;
        ctx.scale(scale, scale);

        ctx.strokeStyle = p.item.color;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
        ctx.lineWidth = 2.2;
        ctx.shadowColor = p.item.color;
        ctx.shadowBlur = 12;

        ctx.beginPath();
        ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const label = p.item.type === 'shield' ? 'S' : (p.item.type === 'slowmo' ? 'T' : (p.item.type === 'multiplier' ? '2X' : 'EMP'));
        ctx.fillText(label, 0, 1);
        ctx.restore();
      }

      // Meteorites
      for (const m of g.meteorites) {
        ctx.save();
        ctx.translate(m.x, m.y);
        ctx.rotate(m.rotation);

        ctx.fillStyle = m.color;
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1.8;

        ctx.beginPath();
        for (let j = 0; j < m.vertices.length; j++) {
          const v = m.vertices[j];
          if (j === 0) ctx.moveTo(v.x, v.y);
          else ctx.lineTo(v.x, v.y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = 'rgba(15, 23, 42, 0.45)';
        for (const c of m.craters) {
          ctx.beginPath();
          ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      // Particles
      for (const pt of g.particles) {
        const prog = pt.life / pt.maxLife;
        ctx.fillStyle = pt.color;
        ctx.globalAlpha = Math.max(0, prog);
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.size * prog, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // Player Ship Rendering
      ctx.save();
      ctx.translate(g.player.x, g.player.y);
      ctx.rotate(g.player.tilt);

      if (g.player.shipType === 'phantom') {
        // Sleek stealth delta
        ctx.fillStyle = '#0f172a';
        ctx.strokeStyle = '#22d3ee';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(0, -24);
        ctx.lineTo(16, 12);
        ctx.lineTo(8, 14);
        ctx.lineTo(0, 10);
        ctx.lineTo(-8, 14);
        ctx.lineTo(-16, 12);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Cockpit
        ctx.fillStyle = '#22d3ee';
        ctx.shadowColor = '#22d3ee';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.moveTo(0, -14);
        ctx.lineTo(3, 0);
        ctx.lineTo(-3, 0);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
      } else if (g.player.shipType === 'vanguard') {
        // Heavy armored cruiser
        ctx.fillStyle = '#1e293b';
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(0, -20);
        ctx.lineTo(8, -8);
        ctx.lineTo(20, 10);
        ctx.lineTo(14, 16);
        ctx.lineTo(0, 14);
        ctx.lineTo(-14, 16);
        ctx.lineTo(-20, 10);
        ctx.lineTo(-8, -8);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(-4, -6, 8, 10);
      } else {
        // Standard Interceptor
        ctx.fillStyle = '#0f172a';
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(0, -22);
        ctx.lineTo(18, 14);
        ctx.lineTo(12, 16);
        ctx.lineTo(6, 12);
        ctx.lineTo(0, 15);
        ctx.lineTo(-6, 12);
        ctx.lineTo(-12, 16);
        ctx.lineTo(-18, 14);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#38bdf8';
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.moveTo(0, -12);
        ctx.lineTo(4, 2);
        ctx.lineTo(-4, 2);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
      }
      ctx.restore();

      // Shield Forcefield
      if (g.player.shield) {
        ctx.save();
        ctx.translate(g.player.x, g.player.y);
        ctx.strokeStyle = '#06b6d4';
        ctx.lineWidth = 2.5;
        ctx.shadowColor = '#06b6d4';
        ctx.shadowBlur = 14;
        ctx.fillStyle = 'rgba(6, 182, 212, 0.12)';
        ctx.beginPath();
        ctx.arc(0, 0, g.player.radius + 12, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fill();
        ctx.restore();
      }

      // Floating Points / Statuses
      for (const ft of g.floatingTexts) {
        ctx.save();
        ctx.globalAlpha = ft.life / ft.maxLife;
        ctx.fillStyle = ft.color;
        ctx.font = 'bold 13px sans-serif';
        ctx.textAlign = 'center';
        ctx.shadowColor = ft.color;
        ctx.shadowBlur = 8;
        ctx.fillText(ft.text, ft.x, ft.y);
        ctx.restore();
      }

      // Slow-Mo chromatic tint
      if (isSlowMo) {
        ctx.fillStyle = 'rgba(168, 85, 247, 0.08)';
        ctx.fillRect(0, 0, width, height);
      }

      ctx.restore();

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, [difficulty, selectedShip, playSfx]);

  // Global Keyboard event listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      initAudio();
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        keysRef.current.left = true;
      }
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        keysRef.current.right = true;
      }
      if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
        togglePause();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        keysRef.current.left = false;
      }
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        keysRef.current.right = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [initAudio]);

  // Mouse & Touch Dragging Handlers
  const handlePointerDrag = (clientX: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const relativeX = clientX - rect.left;
    gameData.current.player.targetX = relativeX;
  };

  // Copy standalone HTML code helper
  const copyStandaloneCode = async () => {
    try {
      const response = await fetch('/meteorite-dodger.html');
      const text = await response.text();
      await navigator.clipboard.writeText(text);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2200);
    } catch {
      // Fallback
    }
  };

  const downloadStandaloneFile = () => {
    const link = document.createElement('a');
    link.href = '/meteorite-dodger.html';
    link.download = 'meteorite-dodger.html';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-sky-500/30">
      
      {/* Top Bar Contract (Wordmark, Nav Links, Primary CTA) */}
      <header className="flex items-center justify-between gap-8 px-6 py-3.5 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md sticky top-0 z-30">
        {/* Zone 1: Brand title wordmark */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
            <Rocket className="w-4 h-4" />
          </div>
          <span className="text-base font-bold tracking-tight text-white whitespace-nowrap shrink-0">
            Meteorite Dodger
          </span>
        </div>

        {/* Zone 2: Navigation Links */}
        <nav className="hidden sm:flex items-center gap-6 text-sm font-medium text-slate-400">
          <button 
            onClick={() => setActiveTab('game')}
            className={`transition-colors whitespace-nowrap shrink-0 ${activeTab === 'game' ? 'text-sky-400 font-semibold' : 'hover:text-slate-200'}`}
          >
            Play Arcade
          </button>
          <button 
            onClick={() => setActiveTab('code')}
            className={`transition-colors whitespace-nowrap shrink-0 ${activeTab === 'code' ? 'text-sky-400 font-semibold' : 'hover:text-slate-200'}`}
          >
            Single-File Code & Export
          </button>
          <button 
            onClick={() => setActiveTab('guide')}
            className={`transition-colors whitespace-nowrap shrink-0 ${activeTab === 'guide' ? 'text-sky-400 font-semibold' : 'hover:text-slate-200'}`}
          >
            Flight Manual
          </button>
        </nav>

        {/* Zone 3: Primary Action CTA */}
        <div className="flex items-center gap-3 shrink-0">
          <button 
            onClick={() => {
              setActiveTab('game');
              if (gameState !== 'PLAYING') startGame();
            }}
            className="px-4 py-1.5 text-xs font-semibold text-slate-950 bg-sky-400 hover:bg-sky-300 rounded-md transition-colors whitespace-nowrap shrink-0"
          >
            {gameState === 'PLAYING' ? 'Mission Active' : 'Launch Ship'}
          </button>
        </div>
      </header>

      {/* Main Content Body */}
      <main className="flex-1 flex flex-col items-center justify-center p-3 sm:p-6">
        
        {/* TAB 1: PLAY ARCADE VIEW */}
        {activeTab === 'game' && (
          <div className="w-full max-w-xl flex flex-col items-center">
            
            {/* Game Canvas Container */}
            <div 
              ref={containerRef}
              className="relative w-full aspect-[3/4.2] max-h-[720px] bg-slate-900/90 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl shadow-sky-950/20"
            >
              <canvas 
                ref={canvasRef}
                className="w-full h-full block cursor-crosshair"
                onMouseDown={(e) => {
                  initAudio();
                  isDraggingRef.current = true;
                  handlePointerDrag(e.clientX);
                }}
                onMouseMove={(e) => {
                  if (isDraggingRef.current && gameState === 'PLAYING') {
                    handlePointerDrag(e.clientX);
                  }
                }}
                onMouseUp={() => { isDraggingRef.current = false; }}
                onTouchStart={(e) => {
                  initAudio();
                  if (e.touches.length > 0) {
                    isDraggingRef.current = true;
                    handlePointerDrag(e.touches[0].clientX);
                  }
                }}
                onTouchMove={(e) => {
                  if (isDraggingRef.current && e.touches.length > 0 && gameState === 'PLAYING') {
                    handlePointerDrag(e.touches[0].clientX);
                  }
                }}
                onTouchEnd={() => { isDraggingRef.current = false; }}
              />

              {/* Top Action HUD Controls */}
              <div className="absolute top-4 right-4 flex items-center gap-2 z-20">
                <button 
                  onClick={() => setIsSoundEnabled(!isSoundEnabled)}
                  className="w-8 h-8 rounded-md bg-slate-900/80 border border-slate-700/60 text-slate-300 hover:text-white flex items-center justify-center transition-colors backdrop-blur-sm"
                  title="Toggle Sound FX"
                >
                  {isSoundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
                </button>
                {gameState === 'PLAYING' && (
                  <button 
                    onClick={togglePause}
                    className="w-8 h-8 rounded-md bg-slate-900/80 border border-slate-700/60 text-slate-300 hover:text-white flex items-center justify-center transition-colors backdrop-blur-sm"
                    title="Pause Mission"
                  >
                    <Pause className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* HUD Header Scores */}
              <div className="absolute top-4 left-4 flex gap-6 z-10 pointer-events-none">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Score</div>
                  <div className="text-2xl font-bold font-mono tabular-nums text-white leading-tight">
                    {score.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-amber-400/90 flex items-center gap-1">
                    <Trophy className="w-3 h-3 inline" /> Record
                  </div>
                  <div className="text-2xl font-bold font-mono tabular-nums text-amber-400 leading-tight">
                    {highScore.toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Active Powerups Floating Badges */}
              <div className="absolute top-16 left-4 flex flex-col gap-1.5 z-10 pointer-events-none">
                {activeShield && (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-cyan-950/80 border border-cyan-500/30 text-cyan-300 text-xs font-semibold backdrop-blur-sm">
                    <Shield className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Shield Armed</span>
                  </div>
                )}
                {slowMoRemaining > 0 && (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-purple-950/80 border border-purple-500/30 text-purple-300 text-xs font-semibold backdrop-blur-sm">
                    <Clock className="w-3.5 h-3.5 text-purple-400" />
                    <span>Chrono Warp {slowMoRemaining}s</span>
                  </div>
                )}
                {multiplierRemaining > 0 && (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-950/80 border border-amber-500/30 text-amber-300 text-xs font-semibold backdrop-blur-sm">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>2X Multiplier {multiplierRemaining}s</span>
                  </div>
                )}
              </div>

              {/* Mobile Virtual Touch Controls */}
              <div className="sm:hidden absolute bottom-4 left-0 right-0 flex justify-between px-6 pointer-events-none z-10">
                <button
                  onPointerDown={(e) => { e.preventDefault(); touchLeftRef.current = true; }}
                  onPointerUp={() => { touchLeftRef.current = false; }}
                  onPointerCancel={() => { touchLeftRef.current = false; }}
                  className="w-14 h-14 rounded-full bg-slate-800/60 border border-slate-700/60 text-white flex items-center justify-center text-xl pointer-events-auto backdrop-blur-sm active:bg-sky-500/30 active:scale-95 transition-transform"
                >
                  ◀
                </button>
                <button
                  onPointerDown={(e) => { e.preventDefault(); touchRightRef.current = true; }}
                  onPointerUp={() => { touchRightRef.current = false; }}
                  onPointerCancel={() => { touchRightRef.current = false; }}
                  className="w-14 h-14 rounded-full bg-slate-800/60 border border-slate-700/60 text-white flex items-center justify-center text-xl pointer-events-auto backdrop-blur-sm active:bg-sky-500/30 active:scale-95 transition-transform"
                >
                  ▶
                </button>
              </div>

              {/* Overlay 1: Start Screen Menu */}
              {gameState === 'MENU' && (
                <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-20">
                  <div className="w-12 h-12 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-400 flex items-center justify-center mb-4">
                    <Rocket className="w-6 h-6" />
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-1">
                    Meteorite Dodger
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-400 max-w-xs mb-6">
                    Maneuver through the asteroid belt. Collect energy pods and dodge lethal impacts.
                  </p>

                  {/* Ship Selection */}
                  <div className="w-full max-w-xs mb-5 text-left">
                    <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                      Select Starship Model
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => setSelectedShip('interceptor')}
                        className={`p-2.5 rounded-lg border text-left transition-all ${selectedShip === 'interceptor' ? 'bg-sky-950/60 border-sky-500 text-sky-300' : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'}`}
                      >
                        <div className="font-bold text-xs">Falcon</div>
                        <div className="text-[10px] text-slate-400">Balanced</div>
                      </button>
                      <button
                        onClick={() => setSelectedShip('phantom')}
                        className={`p-2.5 rounded-lg border text-left transition-all ${selectedShip === 'phantom' ? 'bg-cyan-950/60 border-cyan-500 text-cyan-300' : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'}`}
                      >
                        <div className="font-bold text-xs">Phantom</div>
                        <div className="text-[10px] text-slate-400">+10% Spd</div>
                      </button>
                      <button
                        onClick={() => setSelectedShip('vanguard')}
                        className={`p-2.5 rounded-lg border text-left transition-all ${selectedShip === 'vanguard' ? 'bg-amber-950/60 border-amber-500 text-amber-300' : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'}`}
                      >
                        <div className="font-bold text-xs">Aegis</div>
                        <div className="text-[10px] text-slate-400">Free Shield</div>
                      </button>
                    </div>
                  </div>

                  {/* Difficulty selector */}
                  <div className="flex items-center gap-2 p-1 bg-slate-900 rounded-lg border border-slate-800 mb-6 text-xs">
                    <button
                      onClick={() => setDifficulty('cadet')}
                      className={`px-3 py-1 rounded font-medium transition-colors ${difficulty === 'cadet' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                    >
                      Cadet (Standard)
                    </button>
                    <button
                      onClick={() => setDifficulty('veteran')}
                      className={`px-3 py-1 rounded font-medium transition-colors ${difficulty === 'veteran' ? 'bg-rose-950 text-rose-300 border border-rose-800/60' : 'text-slate-400 hover:text-white'}`}
                    >
                      Veteran (+40% Score)
                    </button>
                  </div>

                  {/* Start Button */}
                  <button 
                    onClick={startGame}
                    className="w-full max-w-xs py-3 px-6 bg-sky-400 hover:bg-sky-300 active:scale-98 text-slate-950 font-bold rounded-lg shadow-lg shadow-sky-500/25 transition-all text-sm uppercase tracking-wider"
                  >
                    Launch Mission
                  </button>

                  <div className="mt-4 text-[11px] text-slate-500">
                    Arrows / A-D to Steer · Drag Mouse or Touch
                  </div>
                </div>
              )}

              {/* Overlay 2: Pause Screen */}
              {gameState === 'PAUSED' && (
                <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-20">
                  <h2 className="text-2xl font-bold text-white mb-2">Flight Suspended</h2>
                  <p className="text-sm text-slate-400 mb-6">Asteroid field coordinates held in buffer.</p>
                  
                  <div className="flex flex-col gap-3 w-48">
                    <button 
                      onClick={togglePause}
                      className="py-2.5 px-4 bg-sky-400 hover:bg-sky-300 text-slate-950 font-bold rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
                    >
                      <Play className="w-4 h-4 fill-current" /> Resume
                    </button>
                    <button 
                      onClick={startGame}
                      className="py-2 px-4 bg-slate-900 border border-slate-700 hover:border-slate-600 text-slate-300 font-medium rounded-lg text-xs transition-colors flex items-center justify-center gap-2"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Restart Mission
                    </button>
                  </div>
                </div>
              )}

              {/* Overlay 3: Game Over Screen */}
              {gameState === 'GAMEOVER' && (
                <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-20">
                  <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mb-3">
                    <Zap className="w-6 h-6" />
                  </div>
                  <h2 className="text-2xl font-extrabold text-rose-400 tracking-tight mb-1">
                    Ship Destroyed
                  </h2>
                  
                  {isNewRecord && (
                    <div className="text-xs font-bold text-amber-400 uppercase tracking-widest mb-4 animate-pulse">
                      ★ New Galactic High Score! ★
                    </div>
                  )}

                  {/* Summary Metric Grid */}
                  <div className="w-full max-w-xs bg-slate-900/80 border border-slate-800 rounded-xl p-4 my-4 grid grid-cols-2 gap-3 text-left">
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider">Final Score</div>
                      <div className="text-xl font-bold font-mono text-white tabular-nums">
                        {score.toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider">Best Record</div>
                      <div className="text-xl font-bold font-mono text-amber-400 tabular-nums">
                        {highScore.toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider">Dodged Rocks</div>
                      <div className="text-base font-bold font-mono text-slate-300 tabular-nums">
                        {dodgedCount.toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider">Flight Time</div>
                      <div className="text-base font-bold font-mono text-slate-300 tabular-nums">
                        {survivalSeconds}s
                      </div>
                    </div>
                  </div>

                  <button 
                    onClick={startGame}
                    className="w-full max-w-xs py-3 px-6 bg-sky-400 hover:bg-sky-300 active:scale-98 text-slate-950 font-bold rounded-lg text-sm uppercase tracking-wider transition-all shadow-lg shadow-sky-500/20"
                  >
                    Play Again
                  </button>
                </div>
              )}
            </div>

            {/* Quick Helper Below Canvas */}
            <div className="w-full flex items-center justify-between text-xs text-slate-500 mt-3 px-2">
              <div className="flex items-center gap-2">
                <span>Power-ups:</span>
                <span className="text-cyan-400">Shield</span>
                <span>·</span>
                <span className="text-purple-400">Slow-Mo</span>
                <span>·</span>
                <span className="text-amber-400">2x Multiplier</span>
                <span>·</span>
                <span className="text-emerald-400">EMP Blast</span>
              </div>
              <button 
                onClick={() => setActiveTab('code')}
                className="text-sky-400 hover:underline flex items-center gap-1"
              >
                Export Standalone HTML <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: STANDALONE SINGLE-FILE CODE & EXPORT */}
        {activeTab === 'code' && (
          <div className="w-full max-w-3xl flex flex-col gap-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-xl bg-slate-900/60 border border-slate-800">
              <div>
                <h2 className="text-lg font-bold text-white mb-1">
                  Single-File HTML Deliverable
                </h2>
                <p className="text-xs text-slate-400">
                  100% self-contained HTML document with embedded CSS and vanilla JavaScript. Runs offline in any web browser without build tools or external image dependencies.
                </p>
              </div>

              <div className="flex items-center gap-2.5 shrink-0">
                <button
                  onClick={copyStandaloneCode}
                  className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-2 border border-slate-700 transition-colors"
                >
                  {copySuccess ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copySuccess ? 'Copied Code!' : 'Copy Code'}
                </button>
                <button
                  onClick={downloadStandaloneFile}
                  className="px-3.5 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold flex items-center gap-2 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" /> Download .html
                </button>
                <a
                  href="/meteorite-dodger.html"
                  target="_blank"
                  rel="noreferrer"
                  className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                  title="Open Standalone File in New Tab"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>

            {/* Architecture breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800">
                <div className="text-xs font-bold text-sky-400 mb-1 font-mono">spawnMeteorite()</div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Generates procedural rocky polygon coordinates with variable fall velocities that scale dynamically with survival time.
                </p>
              </div>
              <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800">
                <div className="text-xs font-bold text-sky-400 mb-1 font-mono">checkCollision()</div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  High-performance circle-to-circle Euclidean collision algorithm avoiding expensive sqrt calls via <code className="text-slate-300">dx*dx + dy*dy &lt;= rSum*rSum</code>.
                </p>
              </div>
              <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800">
                <div className="text-xs font-bold text-sky-400 mb-1 font-mono">gameLoop()</div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Delta-time normalized animation pipeline rendering at maximum refresh rates (60Hz, 120Hz, 144Hz) with particle lifecycle management.
                </p>
              </div>
            </div>

            {/* Code Snippet Preview Window */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/90 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900 border-b border-slate-800 text-xs text-slate-400">
                <span className="font-mono text-slate-300">public/meteorite-dodger.html</span>
                <span>Vanilla HTML5 / Canvas API / Web Audio</span>
              </div>
              <pre className="p-4 text-xs font-mono text-slate-300 overflow-x-auto max-h-[380px] leading-relaxed selection:bg-sky-500/30">
                <code>{`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Meteorite Dodger</title>
  <style>
    /* Responsive Canvas, Overlays, and Starfield styles */
    ...
  </style>
</head>
<body>
  <div id="gameContainer">
    <canvas id="gameCanvas"></canvas>
    <!-- HUD, Power-ups, Overlays -->
  </div>

  <script>
    // 1. Web Audio API synthesizer for retro sound FX
    // 2. spawnMeteorite() with dynamic speed & difficulty ramp
    // 3. checkCollision() with Euclidean circle distance
    // 4. gameLoop() with requestAnimationFrame & delta time
    // 5. LocalStorage high score persistence
  </script>
</body>
</html>`}</code>
              </pre>
            </div>
          </div>
        )}

        {/* TAB 3: FLIGHT MANUAL / INSTRUCTIONS */}
        {activeTab === 'guide' && (
          <div className="w-full max-w-2xl flex flex-col gap-5">
            <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800">
              <h2 className="text-base font-bold text-white mb-2">Controls & Flight Dynamics</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-300">
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                  <span className="font-bold text-white block mb-1">Keyboard Navigation</span>
                  Use <span className="text-sky-400 font-mono">Left / Right Arrows</span> or <span className="text-sky-400 font-mono">A / D</span> keys to bank the starship across the horizontal plane. Press <span className="text-sky-400 font-mono">P</span> or <span className="text-sky-400 font-mono">Esc</span> to pause.
                </div>
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                  <span className="font-bold text-white block mb-1">Mouse & Touch Drag</span>
                  Click and drag anywhere inside the flight window to smoothly steer the starship. Mobile screens also offer on-screen virtual steering buttons.
                </div>
              </div>
            </div>

            <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800">
              <h2 className="text-base font-bold text-white mb-3">Power-Up Ordnance</h2>
              <div className="space-y-2.5 text-xs">
                <div className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                  <div className="w-7 h-7 rounded-full bg-cyan-950 border border-cyan-500/40 text-cyan-400 flex items-center justify-center font-bold">S</div>
                  <div>
                    <span className="font-bold text-cyan-300">Energy Forcefield Shield:</span> Absorbs one direct meteorite impact without hull breach or game over.
                  </div>
                </div>
                <div className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                  <div className="w-7 h-7 rounded-full bg-purple-950 border border-purple-500/40 text-purple-400 flex items-center justify-center font-bold">T</div>
                  <div>
                    <span className="font-bold text-purple-300">Chrono Warp (Slow-Mo):</span> Warps space-time to slow down incoming meteorites to 35% velocity for 6 seconds.
                  </div>
                </div>
                <div className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                  <div className="w-7 h-7 rounded-full bg-amber-950 border border-amber-500/40 text-amber-400 flex items-center justify-center font-bold">2X</div>
                  <div>
                    <span className="font-bold text-amber-300">2x Hyper Score Multiplier:</span> Doubles both continuous survival points and bonus dodge points for 8 seconds.
                  </div>
                </div>
                <div className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                  <div className="w-7 h-7 rounded-full bg-emerald-950 border border-emerald-500/40 text-emerald-400 flex items-center justify-center font-bold">EMP</div>
                  <div>
                    <span className="font-bold text-emerald-300">EMP Shockwave:</span> Emits an expanding particle nova that obliterates all current meteorites on screen!
                  </div>
                </div>
              </div>
            </div>

            <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-400 leading-relaxed">
              <span className="font-bold text-white block mb-1">Scoring Breakdown</span>
              You gain 10 points for every second survived. Each meteorite that safely flies past your ship awards 50 bonus dodge points. High scores are automatically saved to your browser's persistent storage so you can challenge your personal best anytime.
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
