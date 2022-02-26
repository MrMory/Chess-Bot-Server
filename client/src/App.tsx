import React, { useCallback, useEffect } from 'react';
import './App.css';
import { ChessInstance, Move, Square } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { useState } from 'react';
import { io } from 'socket.io-client';
import { Box, Button, Container, FormControl, Grid, InputLabel, List, ListItem, ListItemIcon, ListItemText, ListSubheader, MenuItem, Paper, Select, SelectChangeEvent, Typography } from '@mui/material';
import Countdown from './components/countdown';
import { Link, LinkOff } from '@mui/icons-material';

const ChessReq: any = require('chess.js');
const Chess: ChessInstance = new ChessReq();

const ENDPOINT = "http://localhost:5001";

type GAMESTATE = 'START' | 'STOP' | 'PLAYING' | 'RESET';

interface ConnectedBot {
  customBotId: string,
  clientId: string,
  elo: number,
}

interface NewBoardStateData {
  boardState: string, // FEN format of current board state
  turn: 'w' | 'b',
  timeWhite: number,
  timeBlack: number,
}

const App = () => {
  const [ game, setGame ] = useState(Chess);
  const [ gameState, setGameState ] = useState<GAMESTATE>();
  const [ currentBotList, setCurrentBotList ] = useState<ConnectedBot[]>();
  const [ white, setWhite ] = useState<string>('player');
  const [ black, setBlack ] = useState<string>('player');
  const [ newMove, setNewMove ] = useState<Move | null>();
  const [ currentTurn, setCurrentTurn ] = useState<'w' | 'b' | 'NONE'>();
  const [ whiteTime, setWhiteTime ] = useState<number>(5*60);
  const [ blackTime, setBlackTime ] = useState<number>(5*60);

  useEffect(() => {
    const socket = io(ENDPOINT);
    socket.emit("REQUEST_BOT_LIST");
    socket.onAny(console.log);
    socket.on("NEW_BOARD_STATE", (data: NewBoardStateData) => {
      setGame((g) => {
        const update = { ...g };
        update.load(data.boardState);
        setCurrentTurn(data.turn);
        setWhiteTime(data.timeWhite);
        setBlackTime(data.timeBlack);
        return update;
      })
    });
    if(newMove !== null && gameState === 'PLAYING' && (white === 'player' || black === 'player')){
      socket.emit("PLAYER_MOVE", newMove);
    }
    socket.on("CURRENT_BOT_LIST", (data: ConnectedBot[]) => {
      console.log('Bots:', data);
      setCurrentBotList(data);
    });
    socket.on("GAME_STARTED", () => {
      setGameState('PLAYING');
    })
    if(gameState === 'START'){
      socket.emit("GAME_START", ({white: white, black: black}));
      setCurrentTurn('w');
    }
    if(gameState === 'STOP'){
      socket.emit("GAME_STOP");
      setCurrentTurn('NONE');
    }
    if(gameState === 'RESET'){
      socket.emit("GAME_RESET");
      setWhiteTime(5*60);
      setBlackTime(5*60);
    }
    return () => { socket.disconnect() };
  }, [black, gameState, white, newMove]);

  const onDrop = useCallback((sourceSquare: Square, targetSquare: Square) => {
    let move = game.move({
      from: sourceSquare,
      to: targetSquare,
      promotion: 'q'
    });

    console.log('Making a move:', move);
    setNewMove(move);

    // TODO: send move to server for validation
    
    if (move === null) return false;
    return true;
  }, [setNewMove, game])

  const changeWhite = useCallback((event: SelectChangeEvent) => {
    setWhite(event.target.value as string);
  }, [setWhite]);

  const changeBlack = useCallback((event: SelectChangeEvent) => {
    setBlack(event.target.value as string);
  }, [setBlack]);

  const handleStart = useCallback(() => {
    setGameState('START')
  }, [setGameState]);

  const handleStop = useCallback(() => {
    setNewMove(null);
    setCurrentTurn('NONE');
    setGameState('STOP');
  }, [setGameState]);
  
  const resetGame = useCallback(() => {
    setNewMove(null);
    setCurrentTurn('NONE');
    setGameState('RESET');
  }, [setGameState, setNewMove]);

  return (
    <div className="App">
      <header className="App-header">
        <Grid container justifyContent="center" rowSpacing={5}>
          <Grid item xs="auto">
            <Container>
              <Box sx={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px'}}>
                <FormControl size="small" sx={{minWidth: '150px', textAlign: 'left'}}>
                  <InputLabel id="demo-simple-select-label">Black</InputLabel>
                  <Select
                    labelId="demo-simple-select-label"
                    id="demo-simple-select"
                    value={black}
                    label="Black"
                    onChange={changeBlack}
                  >
                    <MenuItem key='black-player' value={`player`}>Player</MenuItem>
                    {currentBotList?.map((bot) => (
                      <MenuItem key={`black-${bot.customBotId}`} value={bot.customBotId}>{bot.customBotId}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Typography variant="h6" component="div"><Countdown time={blackTime} isCounting={currentTurn === 'b' && gameState === 'PLAYING'}/></Typography>
              </Box>
              <Chessboard 
                position={game.fen()}
                onPieceDrop={onDrop}
                arePiecesDraggable={(white === 'player' || black === 'player') ? true : false}
                customLightSquareStyle={{backgroundColor: '#FF5100'}}
                customDarkSquareStyle={{backgroundColor: '#BF3D00'}}
              />
              <Box sx={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px'}}>
                <FormControl size="small" sx={{minWidth: '150px', textAlign: 'left'}}>
                  <InputLabel id="demo-simple-select-label">White</InputLabel>
                  <Select
                    labelId="demo-simple-select-label"
                    id="demo-simple-select"
                    value={white}
                    label="White"
                    onChange={changeWhite}
                  >
                    <MenuItem key='white-player' value={`player`}>Player</MenuItem>
                    {currentBotList?.map((bot) => (
                      <MenuItem key={`white-${bot.customBotId}`} value={bot.customBotId}>{bot.customBotId}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Typography variant="h6" component="div"><Countdown time={whiteTime} isCounting={currentTurn === 'w' && gameState === 'PLAYING'}/></Typography>
              </Box>
            </Container>
          </Grid>
          <Grid item xs={3}>
            <Box sx={{display: 'flex', justifyContent: 'space-between', marginBottom: '12px'}}>
                <Button variant='outlined' onClick={handleStart}>START</Button>
                <Button variant='outlined' onClick={handleStop}>STOP</Button>
                <Button variant='outlined' onClick={resetGame}>RESET</Button>
            </Box>
            <Paper>
              <List
                sx={{
                  width: '100%',
                  bgcolor: 'background.paper',
                  overflow: 'auto',
                  maxHeight: 300,
                  '& ul': { padding: 0 },
                }}
                subheader={<li />}
              >
                <li key={'bot-list'}>
                  <ul>
                    <ListSubheader>CONNECTED BOTS</ListSubheader>
                    {currentBotList?.map((bot) => (
                      <ListItem key={`bot-${bot.customBotId}`} sx={{display: 'grid', gridTemplateColumns: 'auto 1fr auto'}}>
                        <ListItemIcon><Link/></ListItemIcon>
                        <ListItemText primary={bot.customBotId} />
                        <ListItemText primary={bot.elo} />
                      </ListItem>
                    ))}
                  </ul>
                </li>
              </List>
            </Paper>
          </Grid>
        </Grid>
      </header>
    </div>
  );
}

export default App;
