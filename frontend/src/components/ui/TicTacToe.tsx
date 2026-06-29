/**
 * TicTacToe — Interactive mini-game shown during analysis loading.
 * Minimalist design with neon accents.
 */

"use client";

import { useState, useCallback } from "react";

type Cell = "X" | "O" | null;
type Board = Cell[];

const WINNING_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // cols
  [0, 4, 8], [2, 4, 6],             // diags
];

function checkWinner(board: Board): { winner: Cell; line: number[] | null } {
  for (const [a, b, c] of WINNING_LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a], line: [a, b, c] };
    }
  }
  return { winner: null, line: null };
}

function isDraw(board: Board): boolean {
  return board.every((c) => c !== null) && !checkWinner(board).winner;
}

// Balanced AI — always takes winning moves, blocks 75% of the time, and plays strategically/randomly mid-game
function getAiMove(board: Board): number {
  const empty = board.map((c, i) => (c === null ? i : -1)).filter((i) => i !== -1);
  if (empty.length === 0) return -1;

  // 1. ALWAYS try to win if there is a winning move (looks competent)
  for (const i of empty) {
    const test = [...board];
    test[i] = "O";
    if (checkWinner(test).winner === "O") return i;
  }

  // 2. 75% chance to block player's win (25% chance to "miss" it and let player win)
  if (Math.random() < 0.75) {
    for (const i of empty) {
      const test = [...board];
      test[i] = "X";
      if (checkWinner(test).winner === "X") return i;
    }
  }

  // 3. 70% chance to play strategically (center/corners), 30% chance of random move
  if (Math.random() < 0.7) {
    // Take center
    if (board[4] === null) return 4;

    // Take corner
    const corners = [0, 2, 6, 8].filter((i) => board[i] === null);
    if (corners.length > 0) return corners[Math.floor(Math.random() * corners.length)];
  }

  // 4. Random fallback
  return empty[Math.floor(Math.random() * empty.length)];
}

export default function TicTacToe() {
  const [board, setBoard] = useState<Board>(Array(9).fill(null));
  const [gameOver, setGameOver] = useState(false);
  const [result, setResult] = useState<string>("");
  const [winLine, setWinLine] = useState<number[] | null>(null);
  const [aiThinking, setAiThinking] = useState(false);

  const resetGame = useCallback(() => {
    setBoard(Array(9).fill(null));
    setGameOver(false);
    setResult("");
    setWinLine(null);
    setAiThinking(false);
  }, []);

  const handleClick = useCallback(
    (index: number) => {
      if (board[index] || gameOver || aiThinking) return;

      const newBoard = [...board];
      newBoard[index] = "X";
      setBoard(newBoard);

      const { winner, line } = checkWinner(newBoard);
      if (winner) {
        setWinLine(line);
        setResult("Ви перемогли!");
        setGameOver(true);
        return;
      }
      if (isDraw(newBoard)) {
        setResult("Нічия");
        setGameOver(true);
        return;
      }

      // AI move with small delay
      setAiThinking(true);
      setTimeout(() => {
        const aiIdx = getAiMove(newBoard);
        if (aiIdx >= 0) {
          newBoard[aiIdx] = "O";
          setBoard([...newBoard]);

          const { winner: w2, line: l2 } = checkWinner(newBoard);
          if (w2) {
            setWinLine(l2);
            setResult("Комп'ютер переміг");
            setGameOver(true);
          } else if (isDraw(newBoard)) {
            setResult("Нічия");
            setGameOver(true);
          }
        }
        setAiThinking(false);
      }, 300);
    },
    [board, gameOver, aiThinking]
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", marginTop: "16px" }}>
      <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: 0, letterSpacing: "0.05em", textTransform: "uppercase" }}>
        Поки чекаєте — зіграйте
      </p>

      {/* Board */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "3px",
          width: "156px",
          height: "156px",
          background: "rgba(255, 255, 255, 0.06)",
          borderRadius: "10px",
          padding: "3px",
        }}
      >
        {board.map((cell, i) => {
          const isWin = winLine?.includes(i);
          return (
            <button
              key={i}
              onClick={() => handleClick(i)}
              disabled={!!cell || gameOver || aiThinking}
              className="tictactoe-cell"
              style={{
                width: "50px",
                height: "50px",
                border: "none",
                borderRadius: "6px",
                background: isWin
                  ? "rgba(139, 92, 246, 0.2)"
                  : "rgba(22, 22, 31, 0.9)",
                cursor: cell || gameOver ? "default" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "22px",
                fontWeight: 700,
                transition: "all 0.15s ease",
                color: cell === "X"
                  ? "var(--accent-teal, #06b6d4)"
                  : cell === "O"
                    ? "var(--accent-purple, #8b5cf6)"
                    : "transparent",
                textShadow: isWin
                  ? `0 0 12px ${cell === "X" ? "rgba(6, 182, 212, 0.8)" : "rgba(139, 92, 246, 0.8)"}`
                  : "none",
                boxShadow: isWin
                  ? `inset 0 0 12px ${cell === "X" ? "rgba(6, 182, 212, 0.15)" : "rgba(139, 92, 246, 0.15)"}`
                  : "none",
              }}
            >
              {cell === "X" ? "✕" : cell === "O" ? "○" : ""}
            </button>
          );
        })}
      </div>

      {/* Result / Reset */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", minHeight: "28px" }}>
        {result && (
          <span style={{
            fontSize: "13px",
            fontWeight: 600,
            color: result.includes("перемогли")
              ? "var(--accent-teal, #06b6d4)"
              : result.includes("Комп")
                ? "var(--accent-purple, #8b5cf6)"
                : "var(--text-secondary)",
          }}>
            {result}
          </span>
        )}
        {gameOver && (
          <button
            onClick={resetGame}
            style={{
              background: "none",
              border: "1px solid var(--border-subtle, rgba(255,255,255,0.1))",
              borderRadius: "6px",
              color: "var(--text-secondary)",
              fontSize: "11px",
              padding: "4px 10px",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLElement).style.borderColor = "var(--accent-teal, #06b6d4)";
              (e.target as HTMLElement).style.color = "var(--accent-teal, #06b6d4)";
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLElement).style.borderColor = "var(--border-subtle, rgba(255,255,255,0.1))";
              (e.target as HTMLElement).style.color = "var(--text-secondary)";
            }}
          >
            Ще раз
          </button>
        )}
      </div>
    </div>
  );
}
