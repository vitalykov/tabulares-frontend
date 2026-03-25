export type PlayerID = number;
export type GameID = string;

export interface NewGameInput {
  name: string;
  players: PlayerID[];
  board_width: number;
  board_height: number;
  additional_info: string;
}

export interface MoveInput {
  player_id: PlayerID;
  move: string;
}

// Use relative URLs. Vite dev server will proxy /game/* to the Go backend.
const BASE_URL = "";

async function handleJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
  }

  const text = (await res.text()).trim();
  if (!text) {
    throw new Error("Backend returned empty body for JSON endpoint.");
  }

  return JSON.parse(text) as T;
}

export type GameStatus =
  | "Ready to start"
  | "In progress"
  | "Stopped"
  | "Finished";

export interface GameResponse {
  id: GameID;
  name: string;
  players: PlayerID[];
  board_width: number;
  board_height: number;
  additional_info: string;
  status: GameStatus;
}

export interface MoveRecord {
  player_id: PlayerID;
  move: string;
}

export interface LoadedGameResponse extends GameResponse {
  moves: MoveRecord[];
  winner: PlayerID | 0;
  turn: PlayerID;
}

export interface GameStatusResponse {
  status: GameStatus;
  turn: PlayerID;
  winner: PlayerID | 0;
  player_id: PlayerID;
  move: string; // "row col"
}

// export interface AIGameStatusResponse extends GameStatusResponse {
//   player_id: PlayerID;
//   move: string; // "row col"
// }

export interface HintResponse {
  player_id: PlayerID;
  move: string; // "row col"
}

export const api = {
  async createGame(input: NewGameInput): Promise<GameResponse> {
    const res = await fetch(`${BASE_URL}/game/create/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return handleJson<GameResponse>(res);
  },

  async loadGame(id: GameID): Promise<LoadedGameResponse> {
    const res = await fetch(`${BASE_URL}/game/load/${id}/`, {
      method: "GET",
    });
    return handleJson<LoadedGameResponse>(res);
  },

  async startGame(id: GameID): Promise<GameStatusResponse> {
    const res = await fetch(`${BASE_URL}/game/start/${id}/`, {
      method: "PUT",
    });
    return handleJson<GameStatusResponse>(res);
  },

  async stopGame(id: GameID): Promise<void> {
    const res = await fetch(`${BASE_URL}/game/stop/${id}/`, {
      method: "PUT",
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Failed to stop game: ${text || res.statusText}`);
    }
  },

  async cancelGame(id: GameID): Promise<void> {
    const res = await fetch(`${BASE_URL}/game/cancel/${id}/`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Failed to cancel game: ${text || res.statusText}`);
    }
  },

  async makeMove(id: GameID, input: MoveInput): Promise<GameStatusResponse> {
    const res = await fetch(`${BASE_URL}/game/move/${id}/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return handleJson<GameStatusResponse>(res);
  },

  async undoMove(id: GameID): Promise<GameStatusResponse> {
    const res = await fetch(`${BASE_URL}/game/undo/${id}/`, {
      method: "PUT",
    });
    return handleJson<GameStatusResponse>(res);
  },

  async getHint(id: GameID): Promise<HintResponse> {
    const res = await fetch(`${BASE_URL}/game/hint/${id}/`, {
      method: "GET",
    });
    return handleJson<HintResponse>(res);
  },

  async aiMove(id: GameID): Promise<GameStatusResponse> {
    const res = await fetch(`${BASE_URL}/game/ai_move/${id}/`, {
      method: "POST",
    });
    return handleJson<GameStatusResponse>(res);
  },
};
