import { useRef, useEffect, useCallback } from 'react';
import type { BoardState, Move, Player } from '../engine/types';

interface BoardProps {
  board: BoardState;
  currentPlayer: Player;
  selectedSource: number | 'bar' | null;
  legalDestinations: Move[];
  movableSources: (number | 'bar')[];
  onSelectSource: (source: number | 'bar') => void;
  onSelectDestination: (move: Move) => void;
  flipped?: boolean; // if true, black's home is at bottom-right
}

// Colors — warm wood / felt aesthetic
const BOARD_BG = '#3a6e3a';       // green felt playing surface
const DARK_POINT = '#5c3317';     // dark walnut triangle
const LIGHT_POINT = '#c49a6c';    // light maple triangle
const BORDER_COLOR = '#4a2c17';   // rich wood frame
const BAR_COLOR = '#4a2c17';      // wood bar
const WHITE_CHECKER = '#F5ECD7';  // ivory
const WHITE_CHECKER_BORDER = '#D4C5A0';
const BLUE_CHECKER = '#1a2e5a';   // navy blue
const BLUE_CHECKER_BORDER = '#2a4070';
const HIGHLIGHT_MOVABLE = 'rgba(255, 230, 100, 0.55)';
const HIGHLIGHT_SELECTED = 'rgba(255, 200, 0, 0.7)';
const HIGHLIGHT_DEST = 'rgba(120, 220, 255, 0.7)';
const BEAR_OFF_BG = '#3d2212';    // dark wood tray

// Layout constants - will be scaled
const BASE_WIDTH = 780;
const BASE_HEIGHT = 600;
const POINT_WIDTH = 50;
const POINT_HEIGHT = 220;
const CHECKER_RADIUS = 22;
const BAR_WIDTH = 40;
const BORDER = 30;
const BEAR_OFF_WIDTH = 50;

export default function Board({
  board,
  currentPlayer,
  selectedSource,
  legalDestinations,
  movableSources,
  onSelectSource,
  onSelectDestination,
  flipped = false,
}: BoardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Map logical point index (0-23) to visual position on the board
  // Points 0-5: bottom right (white home), 6-11: bottom left
  // Points 12-17: top left, 18-23: top right
  const getPointX = useCallback(
    (index: number): number => {
      const visualIndex = flipped ? 23 - index : index;
      let col: number;
      if (visualIndex < 6) {
        col = 5 - visualIndex; // bottom right, right to left
      } else if (visualIndex < 12) {
        col = 11 - visualIndex; // bottom left, right to left
      } else if (visualIndex < 18) {
        col = visualIndex - 12; // top left, left to right
      } else {
        col = visualIndex - 18; // top right, left to right
      }

      const isRight = visualIndex < 6 || visualIndex >= 18;
      const baseX = isRight
        ? BORDER + 6 * POINT_WIDTH + BAR_WIDTH + col * POINT_WIDTH
        : BORDER + col * POINT_WIDTH;

      return baseX + POINT_WIDTH / 2;
    },
    [flipped]
  );

  const isTopPoint = useCallback(
    (index: number): boolean => {
      const visualIndex = flipped ? 23 - index : index;
      return visualIndex >= 12;
    },
    [flipped]
  );

  const getCheckerY = useCallback(
    (index: number, stackPos: number): number => {
      const top = isTopPoint(index);
      const spacing = Math.min(CHECKER_RADIUS * 2, POINT_HEIGHT / 7);
      if (top) {
        return BORDER + CHECKER_RADIUS + stackPos * spacing;
      } else {
        return BASE_HEIGHT - BORDER - CHECKER_RADIUS - stackPos * spacing;
      }
    },
    [isTopPoint]
  );

  // Draw the board
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const displayWidth = canvas.clientWidth;
    const displayHeight = canvas.clientHeight;
    canvas.width = displayWidth * dpr;
    canvas.height = displayHeight * dpr;
    ctx.scale(dpr, dpr);

    const sx = displayWidth / BASE_WIDTH;
    const sy = displayHeight / BASE_HEIGHT;
    ctx.save();
    ctx.scale(sx, sy);

    // Background
    ctx.fillStyle = BORDER_COLOR;
    ctx.fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);

    // Playing surface
    ctx.fillStyle = BOARD_BG;
    ctx.fillRect(BORDER, BORDER, BASE_WIDTH - 2 * BORDER - BEAR_OFF_WIDTH, BASE_HEIGHT - 2 * BORDER);

    // Bear-off tray
    ctx.fillStyle = BEAR_OFF_BG;
    ctx.fillRect(BASE_WIDTH - BORDER - BEAR_OFF_WIDTH, BORDER, BEAR_OFF_WIDTH, BASE_HEIGHT - 2 * BORDER);

    // Bar
    ctx.fillStyle = BAR_COLOR;
    ctx.fillRect(BORDER + 6 * POINT_WIDTH, BORDER, BAR_WIDTH, BASE_HEIGHT - 2 * BORDER);

    // Draw points (triangles)
    for (let i = 0; i < 24; i++) {
      const x = getPointX(i);
      const top = isTopPoint(i);
      const isEven = (flipped ? 23 - i : i) % 2 === 0;
      ctx.fillStyle = isEven ? DARK_POINT : LIGHT_POINT;

      ctx.beginPath();
      if (top) {
        ctx.moveTo(x - POINT_WIDTH / 2, BORDER);
        ctx.lineTo(x + POINT_WIDTH / 2, BORDER);
        ctx.lineTo(x, BORDER + POINT_HEIGHT);
      } else {
        ctx.moveTo(x - POINT_WIDTH / 2, BASE_HEIGHT - BORDER);
        ctx.lineTo(x + POINT_WIDTH / 2, BASE_HEIGHT - BORDER);
        ctx.lineTo(x, BASE_HEIGHT - BORDER - POINT_HEIGHT);
      }
      ctx.closePath();
      ctx.fill();
    }

    // Draw checkers on points
    for (let i = 0; i < 24; i++) {
      const val = board.points[i];
      if (val === 0) continue;
      const count = Math.abs(val);
      const isWhite = val > 0;
      const x = getPointX(i);

      for (let j = 0; j < count; j++) {
        const y = getCheckerY(i, j);
        drawChecker(ctx, x, y, isWhite);
        // Show count if stacked too high
        if (j === 4 && count > 5) {
          ctx.fillStyle = isWhite ? '#333' : '#fff';
          ctx.font = 'bold 14px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(`${count}`, x, y);
          break;
        }
      }
    }

    // Highlight movable sources — draw yellow rings around the top checker
    const movableSet = new Set(movableSources.filter(s => s !== 'bar') as number[]);
    for (const source of movableSet) {
      const val = board.points[source];
      if (val === 0) continue;
      const count = Math.min(Math.abs(val), 5);
      const x = getPointX(source);
      const y = getCheckerY(source, count - 1); // top checker
      const isSelected = selectedSource === source;

      ctx.strokeStyle = isSelected ? HIGHLIGHT_SELECTED : HIGHLIGHT_MOVABLE;
      ctx.lineWidth = isSelected ? 4 : 3;
      ctx.beginPath();
      ctx.arc(x, y, CHECKER_RADIUS + 3, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Highlight legal destinations
    for (const move of legalDestinations) {
      if (move.to === 'off') {
        // Highlight bear-off area
        const bearY = currentPlayer === 'white'
          ? (flipped ? BORDER : BASE_HEIGHT / 2)
          : (flipped ? BASE_HEIGHT / 2 : BORDER);
        ctx.fillStyle = HIGHLIGHT_DEST;
        ctx.fillRect(BASE_WIDTH - BORDER - BEAR_OFF_WIDTH, bearY, BEAR_OFF_WIDTH, BASE_HEIGHT / 2 - BORDER);
      } else {
        const x = getPointX(move.to);
        const top = isTopPoint(move.to);
        const count = Math.abs(board.points[move.to]);
        // Draw a cyan circle at where the checker would land
        const landY = count > 0
          ? getCheckerY(move.to, Math.min(count, 5))
          : (top ? BORDER + CHECKER_RADIUS : BASE_HEIGHT - BORDER - CHECKER_RADIUS);
        ctx.strokeStyle = HIGHLIGHT_DEST;
        ctx.lineWidth = 3;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.arc(x, landY, CHECKER_RADIUS, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // Draw bar checkers
    const barCenterX = BORDER + 6 * POINT_WIDTH + BAR_WIDTH / 2;
    for (let j = 0; j < board.bar.white; j++) {
      drawChecker(ctx, barCenterX, BASE_HEIGHT / 2 + 30 + j * (CHECKER_RADIUS * 2 + 4), true);
    }
    for (let j = 0; j < board.bar.black; j++) {
      drawChecker(ctx, barCenterX, BASE_HEIGHT / 2 - 30 - j * (CHECKER_RADIUS * 2 + 4), false);
    }

    // Highlight bar if movable
    if (movableSources.includes('bar')) {
      const barY = currentPlayer === 'white' ? BASE_HEIGHT / 2 + 10 : BASE_HEIGHT / 2 - CHECKER_RADIUS * 2 - 10;
      ctx.strokeStyle = selectedSource === 'bar' ? HIGHLIGHT_SELECTED : HIGHLIGHT_MOVABLE;
      ctx.lineWidth = 3;
      ctx.strokeRect(barCenterX - CHECKER_RADIUS - 4, barY - CHECKER_RADIUS, CHECKER_RADIUS * 2 + 8, CHECKER_RADIUS * 2 + 20);
    }

    // Draw borne off checkers
    const bearX = BASE_WIDTH - BORDER - BEAR_OFF_WIDTH / 2;
    for (let j = 0; j < board.borneOff.white; j++) {
      const y = flipped ? BORDER + 8 + j * 16 : BASE_HEIGHT - BORDER - 8 - j * 16;
      drawMiniChecker(ctx, bearX, y, true);
    }
    for (let j = 0; j < board.borneOff.black; j++) {
      const y = flipped ? BASE_HEIGHT - BORDER - 8 - j * 16 : BORDER + 8 + j * 16;
      drawMiniChecker(ctx, bearX, y, false);
    }

    // Point numbers
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#888';
    for (let i = 0; i < 24; i++) {
      const x = getPointX(i);
      const top = isTopPoint(i);
      const label = flipped ? 24 - i : i + 1;
      if (top) {
        ctx.fillText(`${label}`, x, BORDER - 8);
      } else {
        ctx.fillText(`${label}`, x, BASE_HEIGHT - BORDER + 16);
      }
    }

    ctx.restore();
  }, [board, selectedSource, legalDestinations, movableSources, currentPlayer, flipped, getPointX, isTopPoint, getCheckerY]);

  // Handle click/tap
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      let clientX: number, clientY: number;

      if ('touches' in e) {
        if (e.touches.length === 0) return;
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else {
        clientX = e.clientX;
        clientY = e.clientY;
      }

      const sx = BASE_WIDTH / rect.width;
      const sy = BASE_HEIGHT / rect.height;
      const x = (clientX - rect.left) * sx;
      const y = (clientY - rect.top) * sy;

      // Check if clicking bear-off area
      if (x > BASE_WIDTH - BORDER - BEAR_OFF_WIDTH) {
        const bearOffMove = legalDestinations.find(m => m.to === 'off');
        if (bearOffMove) {
          onSelectDestination(bearOffMove);
          return;
        }
      }

      // Check if clicking bar
      const barLeft = BORDER + 6 * POINT_WIDTH;
      if (x >= barLeft && x <= barLeft + BAR_WIDTH) {
        if (movableSources.includes('bar')) {
          onSelectSource('bar');
          return;
        }
      }

      // Check if clicking a destination
      if (selectedSource !== null) {
        for (const move of legalDestinations) {
          if (move.to === 'off') continue;
          const px = getPointX(move.to);
          const top = isTopPoint(move.to);
          const count = Math.abs(board.points[move.to]);
          // Match the same landing position used for drawing the dashed circles
          const py = count > 0
            ? getCheckerY(move.to, Math.min(count, 5))
            : (top ? BORDER + CHECKER_RADIUS : BASE_HEIGHT - BORDER - CHECKER_RADIUS);
          const dist = Math.sqrt((x - px) ** 2 + (y - py) ** 2);
          if (dist < POINT_WIDTH) {
            onSelectDestination(move);
            return;
          }
        }

        // Also allow clicking anywhere on the destination triangle (more forgiving)
        for (const move of legalDestinations) {
          if (move.to === 'off') continue;
          const px = getPointX(move.to);
          const top = isTopPoint(move.to);
          if (Math.abs(x - px) < POINT_WIDTH / 2) {
            if ((top && y < BASE_HEIGHT / 2) || (!top && y > BASE_HEIGHT / 2)) {
              onSelectDestination(move);
              return;
            }
          }
        }
      }

      // Check if clicking a point with checkers
      for (let i = 0; i < 24; i++) {
        const px = getPointX(i);
        if (Math.abs(x - px) < POINT_WIDTH / 2) {
          const top = isTopPoint(i);
          if ((top && y < BASE_HEIGHT / 2) || (!top && y > BASE_HEIGHT / 2)) {
            onSelectSource(i);
            return;
          }
        }
      }
    },
    [board, selectedSource, legalDestinations, movableSources, onSelectSource, onSelectDestination, getPointX, isTopPoint, getCheckerY]
  );

  return (
    <canvas
      ref={canvasRef}
      className="w-full max-w-[780px] aspect-[780/600] cursor-pointer touch-none"
      onClick={handleClick}
      onTouchStart={handleClick}
    />
  );
}

function drawChecker(ctx: CanvasRenderingContext2D, x: number, y: number, isWhite: boolean) {
  ctx.beginPath();
  ctx.arc(x, y, CHECKER_RADIUS, 0, Math.PI * 2);
  ctx.fillStyle = isWhite ? WHITE_CHECKER : BLUE_CHECKER;
  ctx.fill();
  ctx.strokeStyle = isWhite ? WHITE_CHECKER_BORDER : BLUE_CHECKER_BORDER;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Inner ring for visual depth
  ctx.beginPath();
  ctx.arc(x, y, CHECKER_RADIUS - 5, 0, Math.PI * 2);
  ctx.strokeStyle = isWhite ? '#C8B88A' : '#3a5090';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawMiniChecker(ctx: CanvasRenderingContext2D, x: number, y: number, isWhite: boolean) {
  ctx.beginPath();
  ctx.arc(x, y, 10, 0, Math.PI * 2);
  ctx.fillStyle = isWhite ? WHITE_CHECKER : BLUE_CHECKER;
  ctx.fill();
  ctx.strokeStyle = isWhite ? WHITE_CHECKER_BORDER : BLUE_CHECKER_BORDER;
  ctx.lineWidth = 1;
  ctx.stroke();
}
