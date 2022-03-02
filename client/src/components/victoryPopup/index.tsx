import { Box, Typography } from "@mui/material";
import { GameOverState } from "../../types";
import { EmojiEvents, ArrowRightAlt, Close } from '@mui/icons-material';

interface VictoryPopupProps {
  gameOverState: GameOverState,
  setGameOverState: React.Dispatch<React.SetStateAction<GameOverState | undefined>>,
  white: string,
  black: string,
}

const VictoryPopup = (props: VictoryPopupProps) => {
  const { gameOverState, setGameOverState, white, black } = props;

  return(
    <Box onClick={() => setGameOverState(undefined)} sx={{backgroundColor: 'rgba(0,0,0,0.5)', position: 'absolute', width: '100%', height: '100%', top: '0', zIndex: '10', display: 'flex', justifyContent: 'center', alignItems: 'center'}}>
      <Box sx={{backgroundColor: '#262626', borderRadius: '15px', color: 'white', width: '450px', height: '500px', padding: '20px', display: 'flex', flexDirection: 'column'}}>
        <Box sx={{display: 'flex', flexDirection: 'row-reverse', cursor: 'pointer'}} onClick={() => setGameOverState(undefined)}><Close sx={{fontSize: '30px'}}/></Box>
        <Typography variant="h3">{gameOverState.winState === 'DRAW' ? 'Oh no, a draw!' : 'We have a winner!'}</Typography>
        <Box sx={{display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'center'}}>
          <Box sx={{height: '60px'}}>
            {gameOverState?.winState === 'BLACK' ? <EmojiEvents sx={{fontSize: '60px', color: '#FF5100'}}/> : null}
          </Box>
          <Box sx={{display: "flex", justifyContent: 'center', height: '40px', gap: '10px', paddingTop: '10px'}}>
            <Box>
              <Typography variant="h5">{gameOverState?.currentEloBlack}</Typography>
            </Box>
            <Box sx={{display: 'flex', flexDirection: 'column', justifyContent: 'center'}}>
              <Typography variant="h6" sx={{lineHeight: '0', fontSize: '14px'}}>{gameOverState?.eloPointsChangedBlack}</Typography>
              <ArrowRightAlt sx={{fontSize: '30px', padding: '0'}}/>
            </Box>
            <Box>
              <Typography variant="h5">{gameOverState?.newEloBlack}</Typography>
            </Box>
          </Box>
          <Typography variant="h4" sx={{color: (gameOverState.winState === 'BLACK') ? '#FF5100' : '#BF3D00'}}>{black}</Typography>
          <Typography variant="h5">VS</Typography>
          <Typography variant="h4" sx={{color: (gameOverState.winState === 'WHITE') ? '#FF5100' : '#BF3D00'}}>{white}</Typography>
          <Box sx={{display: "flex", justifyContent: 'center', height: '40px', gap: '10px', paddingTop: '10px'}}>
            <Box>
              <Typography variant="h5">{gameOverState?.currentEloWhite}</Typography>
            </Box>
            <Box sx={{display: 'flex', flexDirection: 'column', justifyContent: 'center'}}>
              <Typography variant="h6" sx={{lineHeight: '0', fontSize: '14px'}}>{gameOverState?.eloPointsChangedWhite}</Typography>
              <ArrowRightAlt sx={{fontSize: '30px', padding: '0'}}/>
            </Box>
            <Box>
              <Typography variant="h5">{gameOverState?.newEloWhite}</Typography>
            </Box>
          </Box>
          <Box sx={{height: '60px'}}>
            {gameOverState?.winState === 'WHITE' ? <EmojiEvents sx={{fontSize: '60px', color: '#FF5100'}}/> : null}
          </Box>
        </Box>
      </Box>
    </Box>
  )
}

export default VictoryPopup;