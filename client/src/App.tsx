import React, { useCallback, useEffect, useRef } from 'react';
import './App.css';
import { ChessInstance, Move, Square } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { Box, Button, Container, Grid, List, ListItem, ListItemIcon, ListItemText, ListSubheader, Paper, SelectChangeEvent, Slider } from '@mui/material';
import { Link, LinkOff, Speed, AddAlarm } from '@mui/icons-material';
import { ConnectedBot, GameOverState } from './types';
import PlayerBar from './components/playerBar';
import VictoryPopup from './components/victoryPopup';
import { isNumberObject } from 'util/types';

const ChessReq: any = require('chess.js');
const Chess: ChessInstance = new ChessReq();

const ENDPOINT = "http://localhost:5001";

type GAMESTATE = 'START' | 'STOP' | 'PLAYING' | 'RESET' | 'GAME_OVER';

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
  const [ gameOverState, setGameOverState ] = useState<GameOverState>();
  const [ serverSpeed, setServerSpeed ] = useState<number>(0);
  const [ extraTime, setExtraTime ] = useState<number>(0);
  
  const socket = useRef<Socket>();

  useEffect(() => {
    socket.current = io(process.env.NODE_ENV === 'production' ? window.location.host : ENDPOINT);
    socket.current.on('connect', () => {
      if(process.env.NODE_ENV !== 'production'){
        return;
      }
      const cachedKey = window.localStorage.getItem('dashboardKey');
      const key = cachedKey || window.prompt('The admin can fill in a access key. Else just press cancel.');
      socket.current?.emit('REGISTER_DASHBOARD', key);
      window.localStorage.setItem('dashboardKey', key || '');
    });
    socket.current.on("NEW_BOARD_STATE", (data: NewBoardStateData) => {
      setGame((g) => {
        const update = { ...g };
        update.load(data.boardState);
        setCurrentTurn(data.turn);
        setWhiteTime(data.timeWhite);
        setBlackTime(data.timeBlack);
        return update;
      })
    });
    socket.current.on("CURRENT_BOT_LIST", (data: ConnectedBot[]) => {
      console.log('Bots:', data);
      setCurrentBotList(data);
    });
    socket.current.on("GAME_STARTED", () => {
      setGameState('PLAYING');
    });
    socket.current.on("GAME_OVER", (data) => {
      setGameState('GAME_OVER');
      const { gameOverState } = data;
      console.log("Game Over:", gameOverState);
      setGameOverState(gameOverState);
    });
    socket.current.on("CURRENT_SERVER_SETTINGS", settings => {
      setServerSpeed(settings.serverSpeed);
      setExtraTime(settings.addedTimePerMove);
    })
    return () => { socket.current?.disconnect() };
  }, []);

  useEffect(() => {
    socket.current?.emit("REQUEST_BOT_LIST");
    if(newMove !== null && gameState === 'PLAYING' && (white === 'player' || black === 'player')){
      socket.current?.emit("PLAYER_MOVE", newMove);
    }
    if(gameState === 'START'){
      socket.current?.emit("GAME_START", ({white: white, black: black}));
      setCurrentTurn('w');
    }
    if(gameState === 'STOP'){
      socket.current?.emit("GAME_STOP");
      setCurrentTurn('NONE');
    }
    if(gameState === 'RESET'){
      socket.current?.emit("GAME_RESET");
    }
  }, [black, gameState, white, newMove]);

  useEffect(() => {
    socket.current?.emit("REQUEST_SERVER_SETTINGS");
  }, []);

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

  const changeAddedTime = useCallback((event: Event, value: number | Array<number>, activeThumb: number) => {
    if(!Array.isArray(value) && Number.isInteger(value)){
      setExtraTime(value);
    }
  }, []);

  const updateAddedTime = useCallback((event: React.SyntheticEvent | Event, value: number | Array<number>) => {
    socket.current?.emit("UPDATE_TIME_TO_ADD", value);
  }, []);

  const changeSpeed = useCallback((event: Event, value: number | Array<number>, activeThumb: number) => {
    if(!Array.isArray(value) && Number.isInteger(value)){
      setServerSpeed(value);
    }
  }, []);

  const updateSpeed = useCallback((event: React.SyntheticEvent | Event, value: number | Array<number>) => {
    socket.current?.emit("UPDATE_WAIT_TIME", value);
  }, []);
  

  return (
    <div className="App">
      <header className="App-header">
        <Grid container justifyContent="center" rowSpacing={5}>
          {gameOverState && <VictoryPopup gameOverState={gameOverState} setGameOverState={setGameOverState} white={white} black={black}/>}
          <Grid item xs="auto">
            <Container>
              <PlayerBar color='BLACK' socket={socket} selected={black} onChange={changeBlack} list={currentBotList} time={blackTime} isCounting={currentTurn === 'b' && gameState === 'PLAYING'}/>
              <Box sx={{marginBottom: '10px'}}>
                <Chessboard 
                  position={game.fen()}
                  onPieceDrop={onDrop}
                  arePiecesDraggable={(white === 'player' || black === 'player') ? true : false}
                  customLightSquareStyle={{backgroundColor: '#FF5100'}}
                  customDarkSquareStyle={{backgroundColor: '#BF3D00'}}
                />
              </Box>
              <PlayerBar color='WHITE' socket={socket} selected={white} onChange={changeWhite} list={currentBotList} time={whiteTime} isCounting={currentTurn === 'w' && gameState === 'PLAYING'}/>
            </Container>
          </Grid>
          <Grid item xs={3}>
            <Box sx={{display: 'flex', justifyContent: 'space-between', marginBottom: '12px'}}>
                <Button variant='outlined' onClick={handleStart}>START</Button>
                <Button variant='outlined' onClick={handleStop}>STOP</Button>
                <Button variant='outlined' onClick={resetGame}>RESET</Button>
            </Box>
            <Box>
              <Grid container spacing={1}>
                <Grid item>
                  <AddAlarm/>
                </Grid>
                <Grid item xs>
                  <Slider
                    size="small"
                    value={extraTime}
                    aria-label="Small"
                    valueLabelDisplay="auto"
                    step={1}
                    marks
                    min={0}
                    max={10}
                    onChange={changeAddedTime}
                    onChangeCommitted={updateAddedTime}
                    valueLabelFormat={value => `${value} s`}
                  />
                </Grid>
              </Grid>
              <Grid container spacing={1}>
                <Grid item>
                  <Speed/>
                </Grid>
                <Grid item xs>
                  <Slider
                    size="small"
                    value={serverSpeed}
                    aria-label="Small"
                    valueLabelDisplay="auto"
                    step={100}
                    marks
                    min={0}
                    max={3000}
                    onChange={changeSpeed}
                    onChangeCommitted={updateSpeed}
                    valueLabelFormat={value => `${value} ms`}
                  />
                </Grid>
              </Grid>
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
                    {currentBotList?.sort((a, b) => b.elo - a.elo).map((bot) => (
                      <ListItem key={`bot-${bot.customBotId}`} sx={{display: 'grid', gridTemplateColumns: 'auto 1fr auto'}}>
                        <ListItemIcon>{bot.clientId === '' ? <LinkOff/> : <Link/>}</ListItemIcon>
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
