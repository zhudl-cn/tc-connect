import { useState, useEffect, useRef } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import {
  Box,
  Drawer,
  Typography,
  TextField,
  IconButton,
  Avatar,
  Button,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  InputAdornment
} from '@mui/material';

import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import AddIcon from '@mui/icons-material/Add';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import StopIcon from '@mui/icons-material/Stop';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import TuneIcon from '@mui/icons-material/Tune';
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import ViewSidebarOutlinedIcon from '@mui/icons-material/ViewSidebarOutlined';

/* ═══════════════════════════════════════════════════════
   ChatGPT-exact Light Theme
   ═══════════════════════════════════════════════════════ */
const theme = createTheme({
  palette: {
    mode: 'light',
    background: {
      default: '#ffffff',
      paper:   '#f9f9f9',
    },
    text: {
      primary:   '#0d0d0d',
      secondary: '#6b6b6b',
    },
  },
  typography: {
    fontFamily: '"Söhne", "Inter", "Helvetica Neue", "Arial", sans-serif',
  },
  components: {
    MuiButton:      { styleOverrides: { root: { textTransform: 'none' } } },
    MuiIconButton:  { styleOverrides: { root: { color: '#6b6b6b' } } },
  },
});

const DRAWER_W = 260;

export default function App() {
  const [messages,    setMessages]    = useState([]);
  const [input,       setInput]       = useState('');
  const [sysInst,     setSysInst]     = useState('始终使用中文并以 Markdown 格式回复');
  const [connected,   setConnected]   = useState(false);
  const [sidebar,     setSidebar]     = useState(true);
  const [generating,  setGenerating]  = useState(false);
  const [settingsDlg, setSettingsDlg] = useState(false);
  const [history,     setHistory]     = useState([]);

  const ws        = useRef(null);
  const endRef    = useRef(null);
  const inputRef  = useRef(null);

  /* ── WebSocket ─────────────────────────────────────── */
  useEffect(() => { wsConnect(); return () => ws.current?.close(); }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const wsConnect = () => {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url   = location.port === '5173' ? 'ws://localhost:8080/ws' : `${proto}//${location.host}/ws`;
    ws.current  = new WebSocket(url);
    ws.current.onopen    = ()  => setConnected(true);
    ws.current.onmessage = (e) => { setMessages(p => [...p, { role: 'assistant', text: e.data }]); setGenerating(false); };
    ws.current.onclose   = ()  => { setConnected(false); setTimeout(wsConnect, 3000); };
  };

  /* ── Actions ───────────────────────────────────────── */
  const newChat = () => {
    if (messages.length) {
      const title = messages.find(m => m.role === 'user')?.text?.slice(0, 28) || 'New conversation';
      setHistory(h => [{ id: Date.now(), title }, ...h]);
    }
    setMessages([]);
  };

  const send = (override) => {
    const text = (override || input).trim();
    if (!text) return;
    const payload = JSON.stringify({ system_instruction: sysInst, user_prompt: text }, null, 2);
    setMessages(p => [...p, { role: 'user', text }]);
    setInput('');
    setGenerating(true);
    if (ws.current?.readyState === WebSocket.OPEN) ws.current.send(payload);
    else { setMessages(p => [...p, { role: 'assistant', text: '⚠️ Disconnected...' }]); setGenerating(false); }
  };

  const onKey = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } };

  const isEmpty = messages.length === 0 && !generating;

  /* ── Sidebar Content ───────────────────────────────── */
  const sidebarContent = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: '#f9f9f9' }}>

      {/* Top row: logo + new-chat */}
      <Box sx={{ px: 1.5, pt: 1.5, pb: 0.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Avatar sx={{ width: 28, height: 28, bgcolor: '#000', fontSize: '0.75rem', fontWeight: 700 }}>C</Avatar>
        </Box>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Tooltip title="New chat">
            <IconButton size="small" onClick={newChat}><EditOutlinedIcon sx={{ fontSize: 20 }} /></IconButton>
          </Tooltip>
          <Tooltip title="Close sidebar">
            <IconButton size="small" onClick={() => setSidebar(false)}><ViewSidebarOutlinedIcon sx={{ fontSize: 20 }} /></IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Menu items */}
      <List dense sx={{ px: 1 }}>
        <ListItemButton onClick={newChat} sx={{ borderRadius: 2, mb: 0.3 }}>
          <ListItemIcon sx={{ minWidth: 32 }}><EditOutlinedIcon sx={{ fontSize: 18 }} /></ListItemIcon>
          <ListItemText primary="新聊天" primaryTypographyProps={{ fontSize: '0.9rem' }} />
        </ListItemButton>
        <ListItemButton sx={{ borderRadius: 2, mb: 0.3 }}>
          <ListItemIcon sx={{ minWidth: 32 }}><SearchIcon sx={{ fontSize: 18 }} /></ListItemIcon>
          <ListItemText primary="搜索聊天" primaryTypographyProps={{ fontSize: '0.9rem' }} />
        </ListItemButton>
      </List>

      <Divider sx={{ mx: 2, borderColor: 'rgba(0,0,0,0.06)' }} />

      {/* Chat history */}
      <Box sx={{ flex: 1, overflowY: 'auto', px: 1, pt: 1 }}>
        {history.length > 0 && (
          <Typography variant="overline" sx={{ px: 1.5, color: 'text.secondary', fontWeight: 600, fontSize: '0.7rem' }}>
            Today
          </Typography>
        )}
        <List dense disablePadding>
          {history.map(h => (
            <ListItemButton key={h.id} sx={{ borderRadius: 2, mb: 0.3, '&:hover .del': { opacity: 1 } }}>
              <ListItemText primary={h.title} primaryTypographyProps={{ noWrap: true, fontSize: '0.88rem', color: 'text.primary' }} />
              <IconButton className="del" size="small" sx={{ opacity: 0, transition: 'opacity 0.15s' }}
                onClick={(e) => { e.stopPropagation(); setHistory(p => p.filter(c => c.id !== h.id)); }}>
                <DeleteOutlineIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </ListItemButton>
          ))}
        </List>
        {!history.length && (
          <Typography variant="body2" sx={{ textAlign: 'center', py: 4, color: 'text.secondary', opacity: 0.4, fontSize: '0.85rem' }}>
            暂无聊天记录
          </Typography>
        )}
      </Box>

      {/* Bottom */}
      <Box sx={{ p: 1.5, borderTop: '1px solid rgba(0,0,0,0.06)' }}>
        <ListItemButton onClick={() => setSettingsDlg(true)} sx={{ borderRadius: 2, py: 1 }}>
          <Avatar sx={{ width: 28, height: 28, mr: 1.5, bgcolor: '#e5e5e5', color: '#000', fontSize: '0.8rem', fontWeight: 600 }}>U</Avatar>
          <Typography variant="body2" fontWeight={500} sx={{ flex: 1 }}>User</Typography>
          <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: connected ? '#22c55e' : '#ef4444' }} />
        </ListItemButton>
      </Box>
    </Box>
  );

  /* ── Settings Dialog ───────────────────────────────── */
  const settingsDialog = (
    <Dialog open={settingsDlg} onClose={() => setSettingsDlg(false)} maxWidth="sm" fullWidth
      PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><TuneIcon fontSize="small" /> Settings</Box>
        <IconButton onClick={() => setSettingsDlg(false)} size="small"><CloseIcon fontSize="small" /></IconButton>
      </DialogTitle>
      <DialogContent>
        <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
          System Instruction — prepended as JSON to every prompt.
        </Typography>
        <TextField fullWidth multiline minRows={4} maxRows={10} value={sysInst}
          onChange={e => setSysInst(e.target.value)} variant="outlined"
          sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, fontFamily: 'monospace', fontSize: '0.9rem' } }} />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={() => setSettingsDlg(false)} variant="contained"
          sx={{ bgcolor: '#0d0d0d', '&:hover': { bgcolor: '#333' }, borderRadius: 2, px: 3, fontWeight: 600 }}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );

  /* ── The ChatGPT-style input box (reused) ──────────── */
  const chatInput = (
    <Box sx={{ maxWidth: '100%', width: '100%', position: 'relative' }}>
      <TextField
        inputRef={inputRef}
        fullWidth
        multiline
        maxRows={8}
        placeholder="提问题，尽管问"
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={onKey}
        variant="outlined"
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <IconButton size="small" sx={{ color: '#6b6b6b' }}><AddIcon /></IconButton>
            </InputAdornment>
          ),
        }}
        sx={{
          '& .MuiOutlinedInput-root': {
            bgcolor: '#ffffff',
            borderRadius: '26px',
            py: '4px',
            pr: '50px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
            '& fieldset': { borderColor: '#e5e5e5' },
            '&:hover fieldset': { borderColor: '#d4d4d4' },
            '&.Mui-focused fieldset': { borderColor: '#c4c4c4', borderWidth: 1 },
          }
        }}
      />
      <Box sx={{ position: 'absolute', right: 10, bottom: 10 }}>
        {generating ? (
          <IconButton size="small" sx={{ bgcolor: '#0d0d0d', color: '#fff', '&:hover': { bgcolor: '#333' }, width: 32, height: 32 }}>
            <StopIcon sx={{ fontSize: 18 }} />
          </IconButton>
        ) : (
          <IconButton
            size="small"
            disabled={!input.trim()}
            onClick={() => send()}
            sx={{
              bgcolor: input.trim() ? '#0d0d0d' : '#e5e5e5',
              color:   input.trim() ? '#fff'    : '#b4b4b4',
              '&:hover': { bgcolor: input.trim() ? '#333' : '#e5e5e5' },
              width: 32, height: 32,
              transition: 'all 0.2s',
            }}
          >
            <ArrowUpwardIcon sx={{ fontSize: 18 }} />
          </IconButton>
        )}
      </Box>
    </Box>
  );

  /* ═══════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════ */
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {settingsDialog}

      <Box sx={{ display: 'flex', height: '100vh', width: '100%', overflow: 'hidden' }}>

        {/* Sidebar */}
        <Drawer variant="persistent" open={sidebar}
          sx={{ width: DRAWER_W, flexShrink: 0, '& .MuiDrawer-paper': { width: DRAWER_W, borderRight: 'none' } }}>
          {sidebarContent}
        </Drawer>

        {/* Main */}
        <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', height: '100%', bgcolor: '#ffffff' }}>

          {/* ── Top Bar ── */}
          <Box sx={{ height: 48, display: 'flex', alignItems: 'center', px: 2, justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              {!sidebar && (
                <>
                  <IconButton size="small" onClick={() => setSidebar(true)} sx={{ mr: 0.5 }}>
                    <ViewSidebarOutlinedIcon sx={{ fontSize: 20 }} />
                  </IconButton>
                  <IconButton size="small" onClick={newChat} sx={{ mr: 1.5 }}>
                    <EditOutlinedIcon sx={{ fontSize: 20 }} />
                  </IconButton>
                </>
              )}
              <Button endIcon={<KeyboardArrowDownIcon />}
                sx={{ color: 'text.primary', fontSize: '1rem', fontWeight: 600, borderRadius: 2, '&:hover': { bgcolor: 'rgba(0,0,0,0.04)' } }}>
                Copilot CLI
              </Button>
            </Box>
            <Tooltip title="Settings">
              <IconButton onClick={() => setSettingsDlg(true)} size="small"><TuneIcon sx={{ fontSize: 20 }} /></IconButton>
            </Tooltip>
          </Box>

          {/* ── Content ── */}
          {isEmpty ? (
            /* Empty state: title + input centered vertically */
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', px: 2, pb: 16 }}>
              <Typography variant="h5" fontWeight={700} sx={{ mb: 4, color: 'text.primary', letterSpacing: '-0.02em' }}>
                有什么可以帮忙的？
              </Typography>
              {chatInput}
            </Box>
          ) : (
            /* Chat view */
            <>
              <Box sx={{ flex: 1, overflowY: 'auto' }}>
                <Box sx={{ maxWidth: '100%', py: 4, px: { xs: 2, md: 4, lg: 8 }, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {messages.map((msg, i) => (
                    <Box key={i} sx={{ display: 'flex', flexDirection: msg.role === 'user' ? 'row-reverse' : 'row', gap: 2 }}>
                      <Avatar sx={{
                        bgcolor: msg.role === 'user' ? '#e5e5e5' : '#000',
                        color:   msg.role === 'user' ? '#000'    : '#fff',
                        width: 32, height: 32, fontSize: '0.8rem', fontWeight: 600, flexShrink: 0,
                      }}>
                        {msg.role === 'user' ? 'U' : 'C'}
                      </Avatar>
                      <Box sx={{ maxWidth: 'calc(100% - 50px)', display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                        {msg.role === 'user' ? (
                          <Box sx={{ bgcolor: '#f4f4f4', px: 2.5, py: 1.5, borderRadius: '20px', borderBottomRightRadius: 6 }}>
                            <Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.6, fontSize: '0.95rem' }}>{msg.text}</Typography>
                          </Box>
                        ) : (
                          <Box sx={{ py: 0.5 }}>
                            <Typography component="pre" sx={{ m: 0, whiteSpace: 'pre-wrap', fontFamily: 'inherit', lineHeight: 1.7, fontSize: '0.95rem' }}>
                              {msg.text}
                            </Typography>
                          </Box>
                        )}
                      </Box>
                    </Box>
                  ))}
                  {generating && (
                    <Box sx={{ display: 'flex', gap: 2 }}>
                      <Avatar sx={{ bgcolor: '#000', color: '#fff', width: 32, height: 32, fontSize: '0.8rem', fontWeight: 600 }}>C</Avatar>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, py: 1 }}>
                        {[0, 1, 2].map(i => (
                          <Box key={i} sx={{
                            width: 7, height: 7, bgcolor: '#b4b4b4', borderRadius: '50%',
                            '@keyframes bounce': {
                              '0%,80%,100%': { transform: 'scale(0.6)', opacity: 0.3 },
                              '40%':         { transform: 'scale(1)',   opacity: 1 },
                            },
                            animation: `bounce 1.4s infinite ${i * 0.16}s`,
                          }} />
                        ))}
                      </Box>
                    </Box>
                  )}
                  <div ref={endRef} style={{ height: 60 }} />
                </Box>
              </Box>

              {/* Bottom input (sticky when chatting) */}
              <Box sx={{ pb: 3, pt: 1, px: 2, display: 'flex', justifyContent: 'center', bgcolor: '#ffffff' }}>
                {chatInput}
              </Box>
            </>
          )}

          {/* Disclaimer */}
          <Typography variant="caption" sx={{ textAlign: 'center', pb: 1.5, color: 'text.secondary', fontSize: '0.73rem' }}>
            Copilot CLI 可能会出错。请核查重要信息。
          </Typography>

        </Box>
      </Box>
    </ThemeProvider>
  );
}
