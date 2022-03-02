import express from "express";
import path from "path";
import { Server, Socket } from 'socket.io';
import cors from 'cors';
import EloRank from 'elo-rank';
import { Move, ShortMove, ChessInstance, Chess } from 'chess.js';

let waitTime = 2000; // server wait time in miliseconds
let extraMoveTime = 3; // extra time in seconds
let startingTime = 300; // starting time per player in seconds


// const Chess = require('chess.js').Chess;
const chess: ChessInstance = new Chess();

interface ConnectedBot {
  customBotId: string,
  clientId: string,
  elo: number,
}

let bots: ConnectedBot[] = [];
let superUsers: Set<String> = new Set();

interface ICurrentGame {
  state: 'INPROGRESS' | 'PAUSED' | 'STOPPED' | 'GAMEOVER',
  white: string,
  timeLeftWhite: number,
  whiteTurnStartTime?: Date,
  black: string,
  timeLeftBlack: number,
  blackTurnStartTime?: Date,
  currentTurn?: 'w' | 'b',
  moveRequestedTo?: string,
  winState?: 'WHITE' | 'BLACK' | 'DRAW',
}

let currentGame: ICurrentGame = {
  state: 'STOPPED',
  white: '',
  timeLeftWhite: 300,
  whiteTurnStartTime: new Date(),
  black: '',
  timeLeftBlack: 300,
  blackTurnStartTime: new Date(),
}

const PORT = process.env.PORT || 5001;
const app = express();
const elo = new EloRank();

app.use(cors());
app.use(express.json());

const server = app.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
});
const io = new Server(server, {cors: {origin: "*"}});

// app.use(express.json());
// Serve the React static files after build
app.use(express.static("../client/build"));

// All other unmatched requests will return the React app
app.get("/", (req, res) => {
  res.sendFile(path.resolve(__dirname, "client", "build", "index.html"));
});

io.on("connection", async (socket) => {
  console.log('Someone connected');
  socket.on('REGISTER_BOT', (data) => {
    const botIndex = bots.findIndex(bot => bot.customBotId === data.customBotId);
    if(botIndex > -1){
      console.log('ClientId:', socket.id)
      bots[botIndex].clientId = socket.id;
    }
    else {
      let botInfo = {
        customBotId : data.customBotId,
        clientId : socket.id,
        elo: 800,
      }
      bots.push(botInfo);
    }
    console.log(data.customBotId, 'connected!');
    console.log('BotList:', bots);
    io.emit("CURRENT_BOT_LIST", bots);
  });

  socket.on('REGISTER_DASHBOARD', (data) => {
    const dashboardKey = process.env.DASHBOARD_KEY;
    if(data !== dashboardKey){
      return;
    }
    superUsers.add(socket.id);
  });

  socket.on('disconnect', (data) => {
    for( var i=0, len=bots.length; i<len; ++i ){
      var c = bots[i];
      if(c.clientId == socket.id){
          console.log(c.customBotId, 'disconnected!');
          bots[i].clientId="";
          break;
      }
    }
    io.emit("CURRENT_BOT_LIST", bots);
  });

  socket.on("REQUEST_BOT_LIST", () => {
    io.emit("CURRENT_BOT_LIST", bots);
  });

  socket.on("REQUEST_SERVER_SETTINGS", () => {
    const serverSettings = {
      serverSpeed: waitTime,
      addedTimePerMove: extraMoveTime,
      startingTime: startingTime,
    }
    io.emit("CURRENT_SERVER_SETTINGS", serverSettings);
  })

  interface BotMoveData {
    botId: string,
    newMove: Move | ShortMove
  }

  socket.on("BOT_MOVE", async ({botId, newMove: move }: BotMoveData) => {
    if(currentGame.moveRequestedTo !== botId){
      return;
    }
    currentGame.moveRequestedTo = '';
    console.log('BOT_MOVE DATA:', move);
    const validMove = safeGameMutatue(move);
    const currentBot = bots.find((bot) => bot.customBotId === botId );
    if(validMove){
      io.to(currentBot.clientId).emit("MOVE_CONFIRMED", chess.fen());
    }
    else {
      currentGame.moveRequestedTo = botId;
      io.to(currentBot.clientId).emit("MOVE_DENIED", chess.fen());
    }
  });

  socket.onAny((...args) => console.log('[incomming]', ...args));

  socket.on("PLAYER_MOVE", (move: Move | ShortMove) => {
    const turnColor = chess.turn();
    if((turnColor === 'w' && currentGame.white !== 'player') || (turnColor === 'b' && currentGame.black !== 'player')){
      console.log('Player tried to make a move but its not their turn');
      return;
    }
    safeGameMutatue(move);
  });

  interface GameStartData {
    white: string,
    black: string,
  }

  socket.on("GAME_START", (data: GameStartData) => {
    if(process.env.NODE_ENV === 'production' && !superUsers.has(socket.id)){
      return;
    }
    const { white, black } = data;
    currentGame = {
      state: 'INPROGRESS',
      white: white,
      black: black,
      timeLeftWhite: startingTime,
      whiteTurnStartTime: new Date(),
      timeLeftBlack: startingTime,
    }
    if(white !== 'player') {
      io.emit("YOUR_MOVE", chess.fen());
    }
    io.emit("GAME_STARTED");
    nextTurn();
  });

  socket.on("GAME_PAUSE", () => {
    if(process.env.NODE_ENV === 'production' && !superUsers.has(socket.id)){
      return;
    }
  });

  socket.on("GAME_CONTINUE", () => {
    if(process.env.NODE_ENV === 'production' && !superUsers.has(socket.id)){
      return;
    }
  });

  socket.on("GAME_STOP", (data) => {
    if(process.env.NODE_ENV === 'production' && !superUsers.has(socket.id)){
      return;
    }
    currentGame.state = 'STOPPED';
    io.emit("GAME_STOPPED");
  });

  socket.on("GAME_RESET", (data) => {
    if(process.env.NODE_ENV === 'production' && !superUsers.has(socket.id)){
      return;
    }
    console.log('game reset');
    chess.reset();
    currentGame.timeLeftWhite = 300;
    currentGame.timeLeftBlack = 300;
    sendNewBoardState();
  });

  socket.on("TIMEDOUT", (loser: 'WHITE' | 'BLACK') => {
    gameOver((loser === 'WHITE' ? 'BLACK' : 'WHITE'));
  });

  socket.on("UPDATE_TIME_TO_ADD", (seconds: number) => {
    extraMoveTime = seconds;
  });

  socket.on("UPDATE_WAIT_TIME", (miliseconds: number) => {
    waitTime = miliseconds;
  });

  socket.on("EARLY_WIN", (color: 'WHITE' | 'BLACK') => {
    if(process.env.NODE_ENV === 'production' && !superUsers.has(socket.id)){
      return;
    }
    if(currentGame.state === 'GAMEOVER'){
      return;
    }
    console.log('early win');
    gameOver(color, 0.75);
  })
});



const safeGameMutatue = (move: Move | ShortMove | null) => {
  if (move === null) return false; // if null was given, don't update the board
  if(chess.turn() === 'w'){
    try {
      const currentTime = new Date();
      const timeSpentByWhite = Math.round((currentTime.getTime() - currentGame.whiteTurnStartTime.getTime()) / 1000);
      const currentTimeWhite = currentGame.timeLeftWhite;
      currentGame.timeLeftWhite = currentTimeWhite - timeSpentByWhite + extraMoveTime;
      currentGame.blackTurnStartTime = currentTime;
    } catch (error) {
      return false;
    }
  }
  if(chess.turn() === 'b'){
    try {
      const currentTime = new Date();
      const timeSpentByBlack = Math.round((currentTime.getTime() - currentGame.blackTurnStartTime.getTime()) / 1000);
      const currentTimeBlack = currentGame.timeLeftBlack;
      currentGame.timeLeftBlack = currentTimeBlack - timeSpentByBlack + extraMoveTime;
      currentGame.whiteTurnStartTime = currentTime;
    } catch (error) {
      return false;
    }
  }
  const newMove = chess.move(move);
  console.log('New Move: ', newMove);
  if(newMove === null){
    return false;
  }
  sendNewBoardState();
  nextTurn();
  return true;
}

const sendNewBoardState = () => {
  const newGameState = {
    boardState: chess.fen(),
    turn: chess.turn(),
    timeWhite: currentGame.timeLeftWhite,
    timeBlack: currentGame.timeLeftBlack,
  }
  io.emit("NEW_BOARD_STATE", newGameState);
}

const nextTurn = () => {
  if(currentGame.state !== 'INPROGRESS'){
    return;
  }
  const turnColor = chess.turn();
  if(chess.game_over()){
    if(chess.in_threefold_repetition() || chess.in_draw || chess.in_stalemate){
      gameOver('DRAW');
    }
    if(chess.in_checkmate()){
      (turnColor === 'w' ? gameOver('BLACK') : gameOver('WHITE'));
    }
    return;
  }
  if((turnColor === 'w' && currentGame.white !== 'player') || (turnColor === 'b' && currentGame.black !== 'player')){
    let currentBotTurn;
    if(turnColor === 'w'){
      currentBotTurn = currentGame.white;
    }
    if(turnColor === 'b'){
      currentBotTurn = currentGame.black;
    }
    const currentBot = bots.find((bot) => bot.customBotId === currentBotTurn );
    setTimeout(() => {
      console.log(`Requesting a move from ${currentBot.customBotId}`);
      currentGame.moveRequestedTo = currentBot.customBotId;
      io.to(currentBot.clientId).emit("YOUR_MOVE", chess.fen());
    }, waitTime);
    return;
  }
  io.emit("PLAYER_TURN");
}

const gameOver = (winner: 'WHITE' | 'BLACK' | 'DRAW', factor?: number) => {
  let gameOverState = {
    winState: winner,
    currentEloWhite: 0,
    currentEloBlack: 0,
    newEloWhite: 0,
    newEloBlack: 0,
    eloPointsChangedWhite: 0,
    eloPointsChangedBlack: 0,
  }
  const whiteBotIndex = bots.findIndex(bot => bot.customBotId === currentGame.white);
  const blackBotIndex = bots.findIndex(bot => bot.customBotId === currentGame.black);
  if(currentGame.white === '' || currentGame.black === ''){
    return;
  }
  if(currentGame.white !== 'player' && currentGame.black !== 'player'){
    const currentEloWhite = bots[whiteBotIndex].elo;
    const currentEloBlack = bots[blackBotIndex].elo;
    const expectedScoreWhite = elo.getExpected(currentEloWhite, currentEloBlack);
    const expectedScoreBlack = elo.getExpected(currentEloBlack, currentEloWhite);
    let whiteWinFactor;
    let blackWinFactor;
    if(winner == 'DRAW'){
      whiteWinFactor = 0.5;
      blackWinFactor = 0.5;
    }
    if(winner === 'WHITE'){
      whiteWinFactor = 1;
      blackWinFactor = 0;
      if(factor){
        whiteWinFactor = factor;
        blackWinFactor = 1 - factor;
      }
    }
    if(winner === 'BLACK'){
      whiteWinFactor = 0;
      blackWinFactor = 1;
      if(factor){
        whiteWinFactor = 1 - factor;
        blackWinFactor = factor;
      }
    }
    const newWhiteElo = elo.updateRating(expectedScoreWhite, whiteWinFactor, currentEloWhite)
    bots[whiteBotIndex].elo = newWhiteElo;
    const newBlackElo = elo.updateRating(expectedScoreBlack, blackWinFactor, currentEloBlack);
    bots[blackBotIndex].elo = newBlackElo;
    gameOverState = {
      winState: gameOverState.winState,
      currentEloWhite: currentEloWhite,
      currentEloBlack: currentEloBlack,
      newEloWhite: newWhiteElo,
      newEloBlack: newBlackElo,
      eloPointsChangedWhite: newWhiteElo - currentEloWhite,
      eloPointsChangedBlack: newBlackElo - currentEloBlack,
    }
  }
  io.emit("GAME_OVER", {gameOverState: gameOverState});
  io.emit("CURRENT_BOT_LIST", bots);
  currentGame.state = 'GAMEOVER';
}
