import express from "express";
import path from "path";
import { Server } from 'socket.io';
import cors from 'cors';
import EloRank from 'elo-rank';
import { Move, ShortMove, ChessInstance, Chess } from 'chess.js';

// const Chess = require('chess.js').Chess;
const chess: ChessInstance = new Chess();

interface ConnectedBot {
  customBotId: string,
  clientId: string,
  elo: number,
}

let bots: ConnectedBot[] = [];
let waitTime = 100;

interface ICurrentGame {
  state: 'INPROGRESS' | 'PAUSED' | 'STOPPED',
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

io.on("connection", (socket: any) => {
  console.log('Someone connected');
  socket.on('REGISTER_BOT', (data) => {
    const botIndex = bots.findIndex(bot => bot.customBotId === data.customBotId);
    if(botIndex > -1){
      bots[botIndex].clientId = data.clientId;
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

  socket.on('disconnect', (data) => {
    for( var i=0, len=bots.length; i<len; ++i ){
      var c = bots[i];
      if(c.clientId == socket.id){
          console.log(c.customBotId, 'disconnected!');
          bots[i].clientId="";
          break;
      }
    }
  });

  socket.on("REQUEST_BOT_LIST", () => {
    io.emit("CURRENT_BOT_LIST", bots);
  });

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
    safeGameMutatue(move);
  });

  socket.onAny((...args) => console.log('[incomming]', ...args));

  socket.on("PLAYER_MOVE", (move: Move | ShortMove) => {
    const turnColor = chess.turn();
    console.log('Turn Color: ', turnColor);
    if((turnColor === 'w' && currentGame.white !== 'player') || (turnColor === 'b' && currentGame.black !== 'player')){
      console.log('Player tried to make a move but its not their turn');
      return;
    }
    console.log('PLAYER_MOVE DATA:', move)
    safeGameMutatue(move);
  });

  interface GameStartData {
    white: string,
    black: string,
  }
  socket.on("GAME_START", (data: GameStartData) => {
    const { white, black } = data;
    currentGame = {
      state: 'INPROGRESS',
      white: white,
      black: black,
      timeLeftWhite: 300,
      whiteTurnStartTime: new Date(),
      timeLeftBlack: 300,
    }
    if(white !== 'player') {
      io.emit("YOUR_MOVE", chess.fen());
    }
    io.emit("GAME_STARTED");
    nextTurn();
  });

  socket.on("GAME_PAUSE", () => {

  })

  socket.on("GAME_STOP", (data) => {
    currentGame.state = 'STOPPED';
    io.emit("GAME_STOPPED");
  })

  socket.on("GAME_RESET", (data) => {
    console.log('game reset');
    chess.reset();
    currentGame.timeLeftWhite = 300;
    currentGame.timeLeftBlack = 300;
    sendNewBoardState();
  })
  
  
});

// All other unmatched requests will return the React app
app.get("/", (req, res) => {
  res.sendFile(path.resolve(__dirname, "client", "build", "index.html"));
});

const safeGameMutatue = (move: Move | ShortMove | null) => {
  if (move === null) return; // if null was given, don't update the board
  if(chess.turn() === 'w'){
    const currentTime = new Date();
    const timeSpentByWhite = Math.round((currentTime.getTime() - currentGame.whiteTurnStartTime.getTime()) / 1000);
    const currentTimeWhite = currentGame.timeLeftWhite;
    currentGame.timeLeftWhite = currentTimeWhite - timeSpentByWhite;
    currentGame.blackTurnStartTime = currentTime;
  }
  if(chess.turn() === 'b'){
    const currentTime = new Date();
    const timeSpentByBlack = Math.round((currentTime.getTime() - currentGame.blackTurnStartTime.getTime()) / 1000);
    const currentTimeBlack = currentGame.timeLeftBlack;
    currentGame.timeLeftBlack = currentTimeBlack - timeSpentByBlack;
    currentGame.whiteTurnStartTime = currentTime;
  }
  chess.move(move);
  sendNewBoardState()
  nextTurn();
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
  const turnColor = chess.turn();
  if(chess.game_over()){
    if(chess.in_threefold_repetition() || chess.in_draw || chess.in_stalemate){
      currentGame.winState = "DRAW";
    }
    if(chess.in_checkmate()){
      (turnColor === 'w' ? currentGame.winState = 'BLACK' : currentGame.winState = 'WHITE');
    }
    if(currentGame.white !== 'player' && currentGame.black !== 'player'){
      const whiteBotIndex = bots.findIndex(bot => bot.customBotId === currentGame.white);
      const blackBotIndex = bots.findIndex(bot => bot.customBotId === currentGame.black);
      const expectedScoreWhite = elo.getExpected(bots[whiteBotIndex].elo, bots[blackBotIndex].elo);
      const expectedScoreBlack = elo.getExpected(bots[blackBotIndex].elo, bots[whiteBotIndex].elo);
      const whiteWinFactor = (currentGame.winState === 'WHITE' ? 1 : currentGame.winState === 'DRAW' ? 0.5 : 0);
      bots[whiteBotIndex].elo = elo.updateRating(expectedScoreWhite, whiteWinFactor, bots[whiteBotIndex].elo);
      const blackWinFactor = (currentGame.winState === 'BLACK' ? 1 : currentGame.winState === 'DRAW' ? 0.5 : 0);
      bots[blackBotIndex].elo = elo.updateRating(expectedScoreBlack, blackWinFactor, bots[blackBotIndex].elo);
    }
    io.emit("GAME_OVER", currentGame);
    io.emit("CURRENT_BOT_LIST", bots);
    return;
  }
  if(currentGame.state === 'STOPPED'){
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
