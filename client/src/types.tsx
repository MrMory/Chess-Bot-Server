export interface ConnectedBot {
  customBotId: string,
  clientId: string,
  elo: number,
}

export interface GameOverState {
  winState: 'WHITE' | 'BLACK' | 'DRAW',
  currentEloWhite: number,
  currentEloBlack: number,
  newEloWhite: number,
  newEloBlack: number,
  eloPointsChangedWhite: number,
  eloPointsChangedBlack: number,
}