import React, { useEffect, useState } from "react";
import {
  api,
  GameResponse,
  LoadedGameResponse,
  GameStatus,
  PlayerID,
  GameStatusResponse,
} from "./api";
import "./index.css";

type View = "start" | "create" | "load" | "game";

type Cell = PlayerID | null;

interface Hint {
  row: number;
  col: number;
  playerId: PlayerID;
}

interface LocalGameState {
  board: Cell[][];
  currentPlayerIndex: number;
  status: GameStatus;
  winner: PlayerID | 0 | null;
  hint: Hint | null;
}

const generateRandomPlayerId = (): PlayerID => {
  return Math.floor(Math.random() * 1_000_000_000);
};

const getOrCreatePlayerId = (): PlayerID => {
  const key = "board-games-player-id";
  const stored = window.localStorage.getItem(key);
  if (stored) {
    const parsed = Number(stored);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  const id = generateRandomPlayerId();
  window.localStorage.setItem(key, String(id));
  return id;
};

const createEmptyBoard = (w: number, h: number): Cell[][] =>
  Array.from({ length: h }, () => Array.from({ length: w }, () => null));

const isAiPlayer = (id: PlayerID): boolean => id === -1;

/** Display marks for players: X, O, then extra symbols for 3+ players. */
const PLAYER_MARKS = ["X", "O", "△", "□", "★", "●", "◆", "▲"];

const getPlayerMark = (playerIndex: number): string =>
  PLAYER_MARKS[playerIndex] ?? String(playerIndex + 1);

const buildLocalStateFromLoaded = (loaded: LoadedGameResponse): LocalGameState => {
  const board = createEmptyBoard(loaded.board_width, loaded.board_height);

  loaded.moves.forEach((m) => {
    const [rStr, cStr] = m.move.split(" ");
    const row = Number(rStr);
    const col = Number(cStr);
    const playerIndex = loaded.players.indexOf(m.player_id);
    if (
      Number.isFinite(row) &&
      Number.isFinite(col) &&
      row >= 0 &&
      row < board.length &&
      col >= 0 &&
      col < board[0].length &&
      playerIndex >= 0
    ) {
      board[row][col] = m.player_id;
    }
  });

  const turnIndex = loaded.players.indexOf(loaded.turn);

  return {
    board,
    currentPlayerIndex: turnIndex >= 0 ? turnIndex : 0,
    status: loaded.status,
    winner: loaded.winner || 0,
    hint: null,
  };
};

const App: React.FC = () => {
  const [view, setView] = useState<View>("start");
  const [playerId, setPlayerId] = useState<PlayerID | null>(null);
  const [game, setGame] = useState<GameResponse | null>(null);
  const [localGame, setLocalGame] = useState<LocalGameState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [boardWidth, setBoardWidth] = useState(3);
  const [boardHeight, setBoardHeight] = useState(3);
  const [winLength, setWinLength] = useState(3);
  const [numPlayers, setNumPlayers] = useState(2);
  const [aiFlags, setAiFlags] = useState<boolean[]>([false, false]);
  const [loadGameId, setLoadGameId] = useState("");

  useEffect(() => {
    const id = getOrCreatePlayerId();
    setPlayerId(id);
  }, []);

  useEffect(() => {
    setAiFlags((prev) => {
      const copy = [...prev];
      if (copy.length < numPlayers) {
        while (copy.length < numPlayers) {
          copy.push(false);
        }
      } else if (copy.length > numPlayers) {
        copy.length = numPlayers;
      }
      return copy;
    });
  }, [numPlayers]);

  const handleResetToStart = () => {
    setGame(null);
    setLocalGame(null);
    setView("start");
  };

  const derivedStatus: GameStatus =
    localGame?.status ?? game?.status ?? "Ready to start";

  const handleCreateGame = async () => {
    if (playerId == null) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const players: PlayerID[] = [];

      for (let i = 0; i < numPlayers; i += 1) {
        if (aiFlags[i]) {
          players.push(-1);
        } else if (i === 0) {
          players.push(playerId);
        } else {
          players.push(i + 1);
        }
      }

      const input = {
        name: "tic-tac-toe",
        players,
        board_width: boardWidth,
        board_height: boardHeight,
        additional_info: String(winLength),
      };

      const created = await api.createGame(input);
      setGame(created);
      setLocalGame({
        board: createEmptyBoard(created.board_width, created.board_height),
        currentPlayerIndex: 0,
        status: created.status ?? "Ready to start",
        winner: 0,
        hint: null,
      });
      setView("game");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadGame = async () => {
    setLoading(true);
    setError(null);
    try {
      const loaded = await api.loadGame(loadGameId.trim());
      console.error(loaded.moves)
      setGame(loaded);
      let localGame: LocalGameState | null = null;
      localGame = {
        board: createEmptyBoard(loaded.board_width, loaded.board_height),
        currentPlayerIndex: 0,
        status: loaded.status,
        winner: loaded.winner || 0,
        hint: null,
      };
      setLocalGame(localGame);
      setView("game");
      for (const [index, move] of loaded.moves.entries()) {
        const [rStr, cStr] = move.move.split(" ");
        const row = Number(rStr);
        const col = Number(cStr);
        const playerIndex = loaded.players.indexOf(move.player_id);
        if (Number.isFinite(row) && Number.isFinite(col) && row >= 0 && row < loaded.board_width && col >= 0 && col < loaded.board_height && playerIndex >= 0) {
          localGame.board[row][col] = move.player_id;
          await new Promise(resolve => setTimeout(resolve, 200));
        }
        setLocalGame({...localGame});
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const doStartGame = async () => {
    if (!game || !localGame) {
      return;
    }
    setError(null);
    try {
      const res = await api.startGame(game.id);
      const turnIdx = game.players.indexOf(res.turn);
      setLocalGame({
        ...localGame,
        status: res.status,
        currentPlayerIndex: turnIdx >= 0 ? turnIdx : localGame.currentPlayerIndex,
        winner: res.winner || 0,
        hint: null,
      });
      if (res.turn < 0) {
        await makeAiMove(game, localGame, setLocalGame);
      }
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const doStopGame = async () => {
    if (!game || !localGame) {
      return;
    }
    setError(null);
    try {
      await api.stopGame(game.id);
      // After OK response, return to main menu.
      handleResetToStart();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const doCancelGame = async () => {
    if (!game) {
      return;
    }
    setError(null);
    try {
      await api.cancelGame(game.id);
      handleResetToStart();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleCellClick = async (row: number, col: number) => {
    if (!game || !localGame || localGame.status !== "In progress") {
      return;
    }

    if (localGame.winner && localGame.winner !== 0) {
      return;
    }

    const board = localGame.board.map((r) => [...r]);
    if (board[row][col] !== null) {
      return;
    }

    const currentPlayerId = game.players[localGame.currentPlayerIndex];
    if (isAiPlayer(currentPlayerId)) {
      return;
    }

    setError(null);

    try {
      const moveString = `${row} ${col}`;
      const res = await api.makeMove(game.id, {
        player_id: currentPlayerId,
        move: moveString,
      });

      if (
        Number.isFinite(row) &&
        Number.isFinite(col) &&
        row >= 0 &&
        row < localGame.board.length &&
        col >= 0 &&
        col < localGame.board[0].length
      ) {
        localGame.board[row][col] = currentPlayerId;
        setLocalGame({
          ...localGame,
          status: res.status,
          currentPlayerIndex: game.players.indexOf(res.turn),
          winner: res.winner || 0,
          hint: null,
        });
      }

      // If after this move it's AI's turn and game is still in progress, let backend perform AI move.
      if (isAiPlayer(res.turn) && res.status === "In progress") {
        await makeAiMove(game, localGame, setLocalGame);
      }

    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleUndo = async () => {
    if (!game || !localGame) {
      return;
    }
    try {
      setError(null);
      const res = await api.undoMove(game.id);
      const lastMove = res.move.split(" ").map(Number);
      const row = lastMove[0];
      const col = lastMove[1];
      if (Number.isFinite(row) && Number.isFinite(col) && row >= 0 && row < localGame.board.length && col >= 0 && col < localGame.board[0].length) {
        localGame.board[row][col] = null;
        setLocalGame({
          ...localGame,
          status: res.status,
          currentPlayerIndex: game.players.indexOf(res.turn),
          winner: res.winner || 0,
          hint: null,
        });
      }
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleHint = async () => {
    if (!game || !localGame) {
      return;
    }
    setError(null);
    try {
      const res = await api.getHint(game.id);
      const [rStr, cStr] = res.move.split(" ");
      const row = Number(rStr);
      const col = Number(cStr);
      if (
        Number.isFinite(row) &&
        Number.isFinite(col) &&
        row >= 0 &&
        row < localGame.board.length &&
        col >= 0 &&
        col < localGame.board[0].length
      ) {
        setLocalGame({
          ...localGame,
          hint: { row, col, playerId: res.player_id },
        });
      }
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="app-root">
      <header className="app-header">
        <h1>Tabulares</h1>
        {playerId != null && (
          <div className="player-id-badge">Your Player ID: {playerId}</div>
        )}
      </header>

      {error && <div className="error-banner">{error}</div>}
      {loading && <div className="loading-overlay">Loading...</div>}

      {view === "start" && (
        <StartScreen
          onCreate={() => setView("create")}
          onLoad={() => setView("load")}
        />
      )}

      {view === "create" && (
        <CreateGameScreen
          boardWidth={boardWidth}
          boardHeight={boardHeight}
          winLength={winLength}
          numPlayers={numPlayers}
          aiFlags={aiFlags}
          onBoardWidthChange={setBoardWidth}
          onBoardHeightChange={setBoardHeight}
          onWinLengthChange={setWinLength}
          onNumPlayersChange={setNumPlayers}
          onAiToggle={(idx) =>
            setAiFlags((prev) => {
              const copy = [...prev];
              copy[idx] = !copy[idx];
              return copy;
            })
          }
          onCreate={handleCreateGame}
          onBack={handleResetToStart}
        />
      )}

      {view === "load" && (
        <LoadGameScreen
          loadGameId={loadGameId}
          onChangeLoadGameId={setLoadGameId}
          onLoad={handleLoadGame}
          onBack={handleResetToStart}
        />
      )}

      {view === "game" && game && localGame && (
        <GameScreen
          game={game}
          localGame={localGame}
          status={derivedStatus}
          onStart={doStartGame}
          onStop={doStopGame}
          onCancel={doCancelGame}
          onUndo={handleUndo}
          onHint={handleHint}
          onCellClick={handleCellClick}
          onBack={handleResetToStart}
        />
      )}
    </div>
  );
};

interface StartScreenProps {
  onCreate: () => void;
  onLoad: () => void;
}

const StartScreen: React.FC<StartScreenProps> = ({ onCreate, onLoad }) => (
  <div className="screen start-screen">
    <div className="board-animation">
      <div className="board-grid">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="board-cell">
            <span className={`mark mark-${i % 3 === 0 ? "x" : "o"}`} />
          </div>
        ))}
      </div>
    </div>
    <div className="start-actions">
      <button type="button" className="primary" onClick={onCreate}>
          Create Game
      </button>
      <button type="button" className="secondary" onClick={onLoad}>
          Load Game
      </button>
    </div>
  </div>
);

interface CreateGameScreenProps {
  boardWidth: number;
  boardHeight: number;
  winLength: number;
  numPlayers: number;
  aiFlags: boolean[];
  onBoardWidthChange: (v: number) => void;
  onBoardHeightChange: (v: number) => void;
  onWinLengthChange: (v: number) => void;
  onNumPlayersChange: (v: number) => void;
  onAiToggle: (index: number) => void;
  onCreate: () => void;
  onBack: () => void;
}

const CreateGameScreen: React.FC<CreateGameScreenProps> = ({
  boardWidth,
  boardHeight,
  winLength,
  numPlayers,
  aiFlags,
  onBoardWidthChange,
  onBoardHeightChange,
  onWinLengthChange,
  onNumPlayersChange,
  onAiToggle,
  onCreate,
  onBack,
}) => (
  <div className="screen form-screen">
    <h2>Create Tic-Tac-Toe Game</h2>
    <div className="form-grid">
      <div className="form-row">
        <label>Game Name</label>
        <input type="text" value="tic-tac-toe" readOnly />
      </div>
      <div className="form-row">
        <label>Board Width</label>
        <input
          type="number"
          min={1}
          value={boardWidth}
          onChange={(e) => onBoardWidthChange(Number(e.target.value) || 1)}
        />
      </div>
      <div className="form-row">
        <label>Board Height</label>
        <input
          type="number"
          min={1}
          value={boardHeight}
          onChange={(e) => onBoardHeightChange(Number(e.target.value) || 1)}
        />
      </div>
      <div className="form-row">
        <label>Consecutive marks to win</label>
        <input
          type="number"
          min={1}
          value={winLength}
          onChange={(e) => onWinLengthChange(Number(e.target.value) || 1)}
        />
      </div>
      <div className="form-row">
        <label>Number of players</label>
        <input
          type="number"
          min={1}
          value={numPlayers}
          onChange={(e) => onNumPlayersChange(Number(e.target.value) || 1)}
        />
      </div>
    </div>

    <div className="players-section">
      <h3>Players</h3>
      <p>Toggle AI for each slot. AI players have ID -1.</p>
      <div className="players-list">
        {Array.from({ length: numPlayers }).map((_, i) => (
          <label key={i} className="player-row">
            <span>Player {i + 1}</span>
            <span className="player-type">
              <input
                type="checkbox"
                checked={aiFlags[i] ?? false}
                onChange={() => onAiToggle(i)}
              />
              <span>AI</span>
            </span>
          </label>
        ))}
      </div>
    </div>

    <div className="form-actions">
        <button type="button" className="secondary" onClick={onBack}>
          Back
        </button>
        <button type="button" className="primary" onClick={onCreate}>
          Create
        </button>
    </div>
  </div>
);

interface LoadGameScreenProps {
  loadGameId: string;
  onChangeLoadGameId: (v: string) => void;
  onLoad: () => void;
  onBack: () => void;
}

const LoadGameScreen: React.FC<LoadGameScreenProps> = ({
  loadGameId,
  onChangeLoadGameId,
  onLoad,
  onBack,
}) => (
  <div className="screen form-screen">
    <h2>Load Game</h2>
    <div className="form-row">
      <label>Game ID (UUID)</label>
      <input
        type="text"
        value={loadGameId}
        onChange={(e) => onChangeLoadGameId(e.target.value)}
        placeholder="Paste game UUID here"
      />
    </div>
    <div className="form-actions">
      <button type="button" className="secondary" onClick={onBack}>
          Back
        </button>
      <button
        type="button"
        className="primary"
        onClick={onLoad}
        disabled={!loadGameId.trim()}
      >
        Load Game
      </button>
    </div>
  </div>
);

interface GameScreenProps {
  game: GameResponse;
  localGame: LocalGameState;
  status: LocalGameState["status"];
  onStart: () => void;
  onStop: () => void;
  onCancel: () => void;
  onUndo: () => void;
   onHint: () => void;
  onCellClick: (row: number, col: number) => void;
  onBack: () => void;
}

const GameScreen: React.FC<GameScreenProps> = ({
  game,
  localGame,
  status,
  onStart,
  onStop,
  onCancel,
  onUndo,
  onHint,
  onCellClick,
  onBack,
}) => {
  const { board, currentPlayerIndex, winner, hint } = localGame;

  const isCurrentTurnAi = isAiPlayer(game.players[currentPlayerIndex]);
  const hasWinner = !!winner && winner !== 0;

  const renderCell = (cell: Cell, row: number, col: number) => {
    let label = "";
    let isHintCell = false;
    let markIndex = -1;

    if (cell === null) {
      if (hint && hint.row === row && hint.col === col) {
        const pIdx = game.players.indexOf(hint.playerId);
        if (pIdx >= 0) {
          label = getPlayerMark(pIdx);
          isHintCell = true;
          markIndex = pIdx;
        }
      }
    } else {
      const playerIndex = game.players.indexOf(cell);
      label = getPlayerMark(playerIndex);
      markIndex = playerIndex;
    }

    return (
      <button
        type="button"
        key={`${row}-${col}`}
        className={`tic-cell ${
          markIndex >= 0 ? `tic-cell--${markIndex}` : ""
        } ${isHintCell ? "tic-cell--hint" : ""}`}
        onClick={() => onCellClick(row, col)}
        disabled={
          status !== "In progress" ||
          cell !== null ||
          isCurrentTurnAi ||
          hasWinner
        }
      >
        {label}
      </button>
    );
  };

  return (
    <div className="screen game-screen">
      <div className="game-header-row">
        <div>
          <h2>{game.name}</h2>
          <p className="game-id">Game ID: {game.id}</p>
        </div>
          <div className="status-pill">
            Status: {status}
            {hasWinner && (
              <span style={{ marginLeft: 8 }}>{winner} won!</span>
            )}
          </div>
      </div>

      <div className="game-main">
        <div className="board-wrapper">
          <div
            className="tic-board"
            style={{
              gridTemplateColumns: `repeat(${board[0]?.length || 0}, 1fr)`,
              ["--board-size" as string]: Math.max(
                board.length,
                board[0]?.length ?? 0
              ) || 3,
            }}
          >
            {board.map((row, r) =>
              row.map((cell, c) => renderCell(cell, r, c))
            )}
          </div>
        </div>

        <div className="sidebar">
          <section className="controls-section">
            <h3>Controls</h3>
            <div className="controls-buttons">
              <button
                type="button"
                className="primary"
                onClick={onStart}
                disabled={status !== "Ready to start"}
              >
                Start Game
              </button>
              <button
                type="button"
                className="secondary"
                onClick={onStop}
                disabled={ status === "Ready to start" || status === "Stopped"}
              >
                Stop Game
              </button>
              <button type="button" className="danger" onClick={onCancel}>
                Cancel Game
              </button>
            </div>
            <button
              type="button"
              className="secondary full-width"
              onClick={onUndo}
              disabled={
                status === "Ready to start" ||
                localGame.board.flat().filter(cell => cell !== null).length === 0
              }
            >
              Undo Move
            </button>
            <button
              type="button"
              className="hint full-width"
              onClick={onHint}
              disabled={status !== "In progress"  || isCurrentTurnAi || hasWinner}
            >
              Get Hint
            </button>
          </section>

          <section className="players-section">
            <h3>Players</h3>
            <ul>
              {game.players.map((p, idx) => (
                <li
                  key={`${p}-${idx}`}
                  className={
                    idx === currentPlayerIndex ? "player current-player" : "player"
                  }
                >
                  <span>
                    {isAiPlayer(p)
                      ? `AI (${getPlayerMark(idx)})`
                      : `${getPlayerMark(idx)} (ID: ${p})`}
                  </span>
                  {idx === currentPlayerIndex && (
                    <span className="badge">Current</span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      <div className="form-actions">
        <button type="button" className="secondary" onClick={onBack}>
          Back to main
        </button>
      </div>
    </div>
  );
};

export default App;

async function makeAiMove(game: GameResponse, localGame: LocalGameState, setLocalGame: React.Dispatch<React.SetStateAction<LocalGameState | null>>) {
  await new Promise(resolve => setTimeout(resolve, 700));
  const aiRes = await api.aiMove(game.id);
  if (aiRes) {
    const [rStr, cStr] = aiRes.move.split(" ");
    const row = Number(rStr);
    const col = Number(cStr);
    if (Number.isFinite(row) && Number.isFinite(col) && row >= 0 && row < localGame.board.length && col >= 0 && col < localGame.board[0].length) {
      localGame.board[row][col] = aiRes.player_id;
    }
    setLocalGame({
      ...localGame,
      status: aiRes.status,
      currentPlayerIndex: game.players.indexOf(aiRes.turn),
      winner: aiRes.winner || 0,
      hint: null,
    });
  }
}

