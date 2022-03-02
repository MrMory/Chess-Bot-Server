import { Box, FormControl, InputLabel, Select, MenuItem, Typography, Button } from "@mui/material";
import { useCallback } from "react";
import { Socket } from "socket.io-client";
import { DefaultEventsMap } from "socket.io/dist/typed-events";
import { ConnectedBot } from "../../types";
import Countdown from "../countdown";

interface PlayerBarProps {
  color: 'WHITE' | 'BLACK',
  selected: string,
  onChange: any,
  list: ConnectedBot[] | undefined,
  time: number,
  isCounting: boolean,
  socket: React.MutableRefObject<Socket<DefaultEventsMap, DefaultEventsMap> | undefined>,
}

const PlayerBar = (props: PlayerBarProps) => {
  const { color, selected, onChange, list, time, isCounting, socket } = props;

  const handleWin = useCallback(() => {
    socket.current?.emit("EARLY_WIN", color);
  }, [selected, socket])

  return(
    <Box sx={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px'}}>
      <FormControl size="small" sx={{minWidth: '150px', textAlign: 'left'}}>
        <Box sx={{display: 'flex', alignItems: 'center', gap: '10px'}}>
          <InputLabel id="demo-simple-select-label">Black</InputLabel>
          <Select
            labelId="demo-simple-select-label"
            id="demo-simple-select"
            value={selected}
            label="Black"
            onChange={onChange}
          >
            <MenuItem key='black-player' value={`player`}>Player</MenuItem>
            {list?.map((bot) => (
              <MenuItem key={`black-${bot.customBotId}`} value={bot.customBotId}>{bot.customBotId}</MenuItem>
            ))}
          </Select>
          <Typography variant="h6" component="div">{list?.find(bot => bot.customBotId === selected)?.elo}</Typography>
        </Box>
      </FormControl>
      <Box sx={{display: 'flex', alignItems: 'center', gap: '10px'}}>
        <Button variant='outlined' onClick={handleWin}>WIN</Button>
        <Typography variant="h6" component="div"><Countdown time={time} isCounting={isCounting} socket={socket} color={color}/></Typography>
      </Box>
    </Box>
  )
}

export default PlayerBar;