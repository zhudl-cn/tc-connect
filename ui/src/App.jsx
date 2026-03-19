import { useState, useEffect, useRef } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import {
  Box, Drawer, Typography, TextField, IconButton,
  Avatar, Button, Tooltip, Dialog, DialogTitle,
  DialogContent, DialogActions, List, ListItemButton,
  ListItemText, Divider, InputAdornment,
  Menu, MenuItem, CircularProgress,
} from '@mui/material';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import ArrowUpwardIcon        from '@mui/icons-material/ArrowUpward';
import AddIcon                from '@mui/icons-material/Add';
import EditOutlinedIcon       from '@mui/icons-material/EditOutlined';
import KeyboardArrowDownIcon  from '@mui/icons-material/KeyboardArrowDown';
import StopIcon               from '@mui/icons-material/Stop';
import DeleteOutlineIcon      from '@mui/icons-material/DeleteOutline';
import TuneIcon               from '@mui/icons-material/Tune';
import CloseIcon              from '@mui/icons-material/Close';
import SearchIcon             from '@mui/icons-material/Search';
import ViewSidebarOutlinedIcon from '@mui/icons-material/ViewSidebarOutlined';
import ContentCopyIcon        from '@mui/icons-material/ContentCopy';
import CheckIcon              from '@mui/icons-material/Check';
import TranslateIcon          from '@mui/icons-material/Translate';
import ChatBubbleOutlineIcon  from '@mui/icons-material/ChatBubbleOutline';

import TranslatePage from './TranslatePage';

/* ─── Theme ──────────────────────────────────────────────── */
const theme = createTheme({
  palette: {
    mode: 'light',
    background: { default: '#ffffff', paper: '#f9f9f9' },
    text: { primary: '#0d0d0d', secondary: '#6b6b6b' },
  },
  typography: {
    fontFamily: '"Söhne","Inter",ui-sans-serif,system-ui,-apple-system,sans-serif',
  },
  components: {
    MuiButton:     { styleOverrides: { root: { textTransform: 'none' } } },
    MuiIconButton: { styleOverrides: { root: { color: '#6b6b6b' } } },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          boxShadow: 'none',
          borderRight: 'none',
        },
      },
    },
  },
});

const DRAWER_W = 260;
const MAX_W    = 720;


/* ─── Markdown components ────────────────────────────────── */
const mdComponents = {
  p: ({ children }) => (
    <Typography component="p" sx={{ m: 0, mb: 1.5, lineHeight: 1.75, fontSize: '0.95rem', '&:last-child': { mb: 0 } }}>
      {children}
    </Typography>
  ),
  pre: ({ children }) => (
    <Box sx={{ my: 2, borderRadius: '12px', overflow: 'hidden', bgcolor: '#1e1e1e' }}>
      <Box component="pre" sx={{ m: 0, p: '16px 20px', overflowX: 'auto', fontFamily: '"SFMono-Regular",Consolas,"Liberation Mono",Menlo,monospace', fontSize: '0.875rem', lineHeight: 1.65, color: '#d4d4d4' }}>
        {children}
      </Box>
    </Box>
  ),
  code: ({ className, children, ...props }) => {
    if (className) {
      // fenced block (inside <pre>)
      return <code className={className} style={{ fontFamily: 'inherit', color: '#d4d4d4' }} {...props}>{children}</code>;
    }
    // inline code
    return (
      <Box component="code" sx={{ bgcolor: 'rgba(0,0,0,0.07)', px: 0.7, py: 0.15, borderRadius: '5px', fontFamily: '"SFMono-Regular",Consolas,monospace', fontSize: '0.875em' }} {...props}>
        {children}
      </Box>
    );
  },
  h1: ({ children }) => <Typography variant="h5"      fontWeight={700} sx={{ mt: 2.5, mb: 1 }}>{children}</Typography>,
  h2: ({ children }) => <Typography variant="h6"      fontWeight={700} sx={{ mt: 2,   mb: 0.8 }}>{children}</Typography>,
  h3: ({ children }) => <Typography variant="subtitle1" fontWeight={700} sx={{ mt: 1.5, mb: 0.5 }}>{children}</Typography>,
  ul: ({ children }) => <Box component="ul" sx={{ pl: 3, my: 0.5 }}>{children}</Box>,
  ol: ({ children }) => <Box component="ol" sx={{ pl: 3, my: 0.5 }}>{children}</Box>,
  li: ({ children }) => <Box component="li" sx={{ mb: 0.4, lineHeight: 1.75, fontSize: '0.95rem' }}>{children}</Box>,
  blockquote: ({ children }) => (
    <Box sx={{ borderLeft: '3px solid #d9d9d9', pl: 2, my: 1.5, color: 'text.secondary' }}>{children}</Box>
  ),
  a: ({ href, children }) => (
    <Box component="a" href={href} target="_blank" rel="noreferrer" sx={{ color: '#0d0d0d', textDecorationColor: '#b4b4b4', '&:hover': { textDecorationColor: '#0d0d0d' } }}>
      {children}
    </Box>
  ),
  table: ({ children }) => (
    <Box sx={{ overflowX: 'auto', my: 2 }}>
      <Box component="table" sx={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.9rem' }}>{children}</Box>
    </Box>
  ),
  th: ({ children }) => <Box component="th" sx={{ border: '1px solid #e5e5e5', px: 2, py: 1, textAlign: 'left', fontWeight: 600, bgcolor: '#f9f9f9' }}>{children}</Box>,
  td: ({ children }) => <Box component="td" sx={{ border: '1px solid #e5e5e5', px: 2, py: 1 }}>{children}</Box>,
};

/* ─── App ────────────────────────────────────────────────── */
export default function App() {
  const [messages,    setMessages]    = useState([]);
  const [input,       setInput]       = useState('');
  const [sysInst,     setSysInst]     = useState(() => localStorage.getItem('sysInst') || '始终使用中文并以 Markdown 格式回复');
  const [connected,   setConnected]   = useState(false);
  const [sidebar,     setSidebar]     = useState(true);
  const [generating,  setGenerating]  = useState(false);
  const [settingsDlg, setSettingsDlg] = useState(false);
  const [history,     setHistory]     = useState(() => {
    try { return JSON.parse(localStorage.getItem('history') || '[]'); } catch { return []; }
  });
  const [copied,      setCopied]      = useState(null);
  const [mode,        setMode]        = useState('chat'); // 'chat' | 'translate'
  const [models,      setModels]      = useState([]);
  const [modelAnchor, setModelAnchor] = useState(null);
  const [selectedModel, setSelectedModel] = useState('');
  const [searchOpen,  setSearchOpen]  = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const ws           = useRef(null);
  const endRef       = useRef(null);
  const inputRef     = useRef(null);
  const fileInputRef = useRef(null);
  const msgHandlerRef = useRef(null);

  /* set up chat handler whenever we're in chat mode */
  useEffect(() => {
    if (mode === 'chat') {
      msgHandlerRef.current = (data) => {
        let evt;
        try { evt = JSON.parse(data); } catch {
          // plain-text fallback
          setMessages(p => [...p, { role: 'assistant', text: data }]);
          setGenerating(false);
          return;
        }
        if (evt.type === 'chunk') {
          setMessages(p => {
            const last = p[p.length - 1];
            if (last?.role === 'assistant' && last.streaming) {
              return [...p.slice(0, -1), { ...last, text: last.text + evt.content }];
            }
            return [...p, { role: 'assistant', text: evt.content, streaming: true }];
          });
        } else if (evt.type === 'done') {
          setMessages(p => {
            const last = p[p.length - 1];
            if (last?.streaming) {
              return [...p.slice(0, -1), { role: 'assistant', text: last.text }];
            }
            return p;
          });
          setGenerating(false);
        } else if (evt.type === 'text') {
          setMessages(p => [...p, { role: 'assistant', text: evt.content }]);
          setGenerating(false);
        } else if (evt.type === 'error') {
          setMessages(p => [...p, { role: 'assistant', text: `⚠️ ${evt.content}` }]);
          setGenerating(false);
        }
      };
    }
  }, [mode]);

  /* fetch model list from backend */
  useEffect(() => {
    const base = location.port === '5173' ? 'http://localhost:8080' : '';
    fetch(`${base}/api/models`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setModels(data);
          setSelectedModel(data[0]);
        }
      })
      .catch(() => {}); // backend may not be running yet
  }, []);

  /* persist history to localStorage whenever it changes */
  useEffect(() => { localStorage.setItem('history', JSON.stringify(history)); }, [history]);

  useEffect(() => { wsConnect(); return () => ws.current?.close(); }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, generating]);

  function getOrCreateSessionId() {
    let id = localStorage.getItem('session_id');
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem('session_id', id);
    }
    return id;
  }

  function wsConnect() {
    const proto     = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const sessionId = getOrCreateSessionId();
    const url       = location.port === '5173'
      ? `ws://localhost:8080/ws?session_id=${sessionId}`
      : `${proto}//${location.host}/ws?session_id=${sessionId}`;
    ws.current  = new WebSocket(url);
    ws.current.onopen    = ()  => setConnected(true);
    ws.current.onmessage = (e) => { if (msgHandlerRef.current) msgHandlerRef.current(e.data); };
    ws.current.onclose   = ()  => { setConnected(false); setTimeout(wsConnect, 3000); };
  }

  function newChat() {
    if (messages.length) {
      const title = messages.find(m => m.role === 'user')?.text?.slice(0, 30) || '新对话';
      setHistory(h => [{ id: Date.now(), title }, ...h]);
    }
    setMessages([]);
    setMode('chat');
  }

  function send(override) {
    const text = (override !== undefined ? override : input).trim();
    if (!text) return;
    const payload = JSON.stringify({ system_instruction: sysInst, user_prompt: text, model: selectedModel });
    setMessages(p => [...p, { role: 'user', text }]);
    setInput('');
    setGenerating(true);
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(payload);
    } else {
      setMessages(p => [...p, { role: 'assistant', text: '⚠️ 未连接到后端，请检查服务是否运行。' }]);
      setGenerating(false);
    }
  }

  function onKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  }

  function copyMsg(text, idx) {
    navigator.clipboard.writeText(text);
    setCopied(idx);
    setTimeout(() => setCopied(null), 2000);
  }

  async function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const base = location.port === '5173' ? 'http://localhost:8080' : '';
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch(`${base}/api/upload`, { method: 'POST', body: formData });
      const data = await res.json();
      const attachment = `\n\n[文件: ${data.name}]\n\`\`\`\n${data.content}\n\`\`\``;
      setInput(prev => prev + attachment);
    } catch {
      setInput(prev => prev + '\n\n[附件上传失败]');
    }
    e.target.value = '';
  }

  const displayedHistory = searchQuery
    ? history.filter(h => h.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : history;

  const isEmpty = messages.length === 0 && !generating;

  /* ── Input box ─────────────────────────────────────────── */
  const chatInput = (
    <Box sx={{ width: '100%', maxWidth: MAX_W, mx: 'auto', position: 'relative' }}>
      <TextField
        inputRef={inputRef}
        fullWidth
        multiline
        maxRows={8}
        placeholder="给 Copilot CLI 发消息"
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={onKey}
        variant="outlined"
        InputProps={{
          startAdornment: (
            <InputAdornment position="start" sx={{ alignSelf: 'flex-end', mb: '7px' }}>
              <Tooltip title="上传文件">
                <IconButton size="small" onClick={() => fileInputRef.current?.click()}><AddIcon /></IconButton>
              </Tooltip>
            </InputAdornment>
          ),
        }}
        sx={{
          '& .MuiOutlinedInput-root': {
            bgcolor: '#ffffff',
            borderRadius: '28px',
            py: '7px',
            pr: '56px',
            alignItems: 'flex-end',
            boxShadow: '0 0 0 1px #e5e5e5, 0 2px 6px rgba(0,0,0,0.06)',
            '& fieldset': { border: 'none' },
            '&:hover':        { boxShadow: '0 0 0 1px #d0d0d0, 0 2px 6px rgba(0,0,0,0.08)' },
            '&.Mui-focused':  { boxShadow: '0 0 0 1px #c0c0c0, 0 2px 8px rgba(0,0,0,0.1)' },
          },
          '& .MuiInputBase-input': { py: '4px', lineHeight: 1.65, fontSize: '0.95rem' },
        }}
      />
      <Box sx={{ position: 'absolute', right: 8, bottom: 7 }}>
        {generating ? (
          <Tooltip title="停止生成">
            <IconButton size="small" onClick={() => {
              if (ws.current?.readyState === WebSocket.OPEN) {
                ws.current.send(JSON.stringify({ __cmd: 'stop' }));
              }
              setGenerating(false);
            }} sx={{ bgcolor: '#0d0d0d', color: '#fff', '&:hover': { bgcolor: '#444' }, width: 34, height: 34 }}>
              <StopIcon sx={{ fontSize: 17 }} />
            </IconButton>
          </Tooltip>
        ) : (
          <Tooltip title="发送 (Enter)">
            <span>
              <IconButton
                size="small"
                disabled={!input.trim()}
                onClick={() => send()}
                sx={{
                  bgcolor: input.trim() ? '#0d0d0d' : '#e5e5e5',
                  color:   input.trim() ? '#fff'    : '#a4a4a4',
                  '&:hover': { bgcolor: input.trim() ? '#333' : '#e5e5e5' },
                  '&.Mui-disabled': { bgcolor: '#e5e5e5', color: '#a4a4a4' },
                  width: 34, height: 34,
                  transition: 'all 0.15s',
                }}
              >
                <ArrowUpwardIcon sx={{ fontSize: 17 }} />
              </IconButton>
            </span>
          </Tooltip>
        )}
      </Box>
    </Box>
  );

  /* ── Sidebar ───────────────────────────────────────────── */
  const sidebarContent = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: '#f9f9f9' }}>

      {/* Logo row */}
      <Box sx={{ px: 1.5, pt: 1.5, pb: 0.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, pl: 0.5 }}>
          <Avatar sx={{ width: 26, height: 26, bgcolor: '#000', fontSize: '0.72rem', fontWeight: 700 }}>C</Avatar>
          <Typography fontWeight={700} fontSize="0.92rem" color="text.primary">Copilot CLI</Typography>
        </Box>
        <Box sx={{ display: 'flex' }}>
          <Tooltip title="新建聊天">
            <IconButton size="small" onClick={newChat}><EditOutlinedIcon sx={{ fontSize: 19 }} /></IconButton>
          </Tooltip>
          <Tooltip title="收起侧边栏">
            <IconButton size="small" onClick={() => setSidebar(false)}><ViewSidebarOutlinedIcon sx={{ fontSize: 19 }} /></IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Nav buttons */}
      <Box sx={{ px: 1, pb: 0.5 }}>
        <List dense disablePadding>
          <ListItemButton
            onClick={() => setMode('chat')}
            sx={{
              borderRadius: 2, mb: 0.2,
              bgcolor: mode === 'chat' ? 'rgba(0,0,0,0.07)' : 'transparent',
              '&:hover': { bgcolor: mode === 'chat' ? 'rgba(0,0,0,0.09)' : 'rgba(0,0,0,0.05)' },
            }}
          >
            <Box sx={{ minWidth: 32, display: 'flex', alignItems: 'center' }}>
              <ChatBubbleOutlineIcon sx={{ fontSize: 17, color: '#6b6b6b' }} />
            </Box>
            <ListItemText primary="聊天" primaryTypographyProps={{ fontSize: '0.875rem', fontWeight: mode === 'chat' ? 600 : 400 }} />
          </ListItemButton>

          <ListItemButton
            onClick={() => setMode('translate')}
            sx={{
              borderRadius: 2, mb: 0.2,
              bgcolor: mode === 'translate' ? 'rgba(0,0,0,0.07)' : 'transparent',
              '&:hover': { bgcolor: mode === 'translate' ? 'rgba(0,0,0,0.09)' : 'rgba(0,0,0,0.05)' },
            }}
          >
            <Box sx={{ minWidth: 32, display: 'flex', alignItems: 'center' }}>
              <TranslateIcon sx={{ fontSize: 17, color: '#6b6b6b' }} />
            </Box>
            <ListItemText primary="翻译" primaryTypographyProps={{ fontSize: '0.875rem', fontWeight: mode === 'translate' ? 600 : 400 }} />
          </ListItemButton>

          <ListItemButton onClick={() => { setSearchOpen(s => !s); setSearchQuery(''); }}
            sx={{ borderRadius: 2, mb: 0.2, bgcolor: searchOpen ? 'rgba(0,0,0,0.07)' : 'transparent', '&:hover': { bgcolor: 'rgba(0,0,0,0.05)' } }}>
            <Box sx={{ minWidth: 32, display: 'flex', alignItems: 'center' }}>
              <SearchIcon sx={{ fontSize: 17, color: '#6b6b6b' }} />
            </Box>
            <ListItemText primary="搜索聊天" primaryTypographyProps={{ fontSize: '0.875rem', fontWeight: searchOpen ? 600 : 400 }} />
          </ListItemButton>
        </List>
      </Box>

      <Divider sx={{ mx: 2, borderColor: 'rgba(0,0,0,0.06)' }} />

      {/* History */}
      <Box sx={{ flex: 1, overflowY: 'auto', px: 1, pt: 0.5 }}>
        {/* Search input */}
        {searchOpen && (
          <Box sx={{ px: 0.5, pb: 1, pt: 0.5 }}>
            <TextField
              fullWidth autoFocus size="small" placeholder="搜索对话..."
              value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 15, color: 'text.secondary' }} /></InputAdornment> }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, fontSize: '0.8rem', bgcolor: '#fff' } }}
            />
          </Box>
        )}
        {displayedHistory.length > 0 && (
          <Typography variant="overline" sx={{ px: 1.5, color: 'text.secondary', fontWeight: 600, fontSize: '0.68rem', display: 'block', mt: 1, mb: 0.3 }}>
            {searchQuery ? '搜索结果' : '今天'}
          </Typography>
        )}
        <List dense disablePadding>
          {displayedHistory.map(h => (
            <ListItemButton key={h.id} sx={{ borderRadius: 2, mb: 0.2, '&:hover .del': { opacity: 1 } }}>
              <ListItemText
                primary={h.title}
                primaryTypographyProps={{ noWrap: true, fontSize: '0.875rem', color: 'text.primary' }}
              />
              <IconButton className="del" size="small"
                sx={{ opacity: 0, transition: 'opacity 0.15s', flexShrink: 0 }}
                onClick={e => { e.stopPropagation(); setHistory(p => p.filter(c => c.id !== h.id)); }}>
                <DeleteOutlineIcon sx={{ fontSize: 15 }} />
              </IconButton>
            </ListItemButton>
          ))}
        </List>
        {!displayedHistory.length && (
          <Typography variant="body2" sx={{ textAlign: 'center', py: 5, color: 'text.secondary', opacity: 0.35, fontSize: '0.82rem' }}>
            {searchQuery ? '没有匹配的对话' : '暂无聊天记录'}
          </Typography>
        )}
      </Box>

      {/* User row */}
      <Box sx={{ p: 1.5, borderTop: '1px solid rgba(0,0,0,0.06)' }}>
        <ListItemButton onClick={() => setSettingsDlg(true)} sx={{ borderRadius: 2, py: 0.8 }}>
          <Avatar sx={{ width: 28, height: 28, mr: 1.5, bgcolor: '#e5e5e5', color: '#000', fontSize: '0.75rem', fontWeight: 600 }}>U</Avatar>
          <Typography variant="body2" fontWeight={500} sx={{ flex: 1, fontSize: '0.875rem' }}>User</Typography>
          <Tooltip title={connected ? '已连接' : '未连接'}>
            <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: connected ? '#22c55e' : '#ef4444', flexShrink: 0 }} />
          </Tooltip>
        </ListItemButton>
      </Box>
    </Box>
  );

  /* ── Settings dialog ───────────────────────────────────── */
  const settingsDialog = (
    <Dialog open={settingsDlg} onClose={() => setSettingsDlg(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 600 }}>
          <TuneIcon fontSize="small" /> 自定义设置
        </Box>
        <IconButton onClick={() => setSettingsDlg(false)} size="small"><CloseIcon fontSize="small" /></IconButton>
      </DialogTitle>
      <DialogContent>
        <Typography variant="caption" color="text.secondary" sx={{ mb: 1.5, display: 'block', lineHeight: 1.6 }}>
          系统指令 (System Instruction) — 每次发送时以 JSON 格式附加在消息前。
        </Typography>
        <TextField
          fullWidth multiline minRows={4} maxRows={10} value={sysInst}
          onChange={e => setSysInst(e.target.value)} variant="outlined"
          sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, fontFamily: 'monospace', fontSize: '0.875rem' } }}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button onClick={() => setSettingsDlg(false)} sx={{ color: 'text.secondary', borderRadius: 2 }}>取消</Button>
        <Button onClick={() => { localStorage.setItem('sysInst', sysInst); setSettingsDlg(false); }} variant="contained"
          sx={{ bgcolor: '#0d0d0d', '&:hover': { bgcolor: '#333' }, borderRadius: 2, px: 3, fontWeight: 600 }}>
          保存
        </Button>
      </DialogActions>
    </Dialog>
  );

  /* ═══════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════ */
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileUpload} />
      {settingsDialog}

      <Box sx={{ display: 'flex', height: '100vh', width: '100%', overflow: 'hidden' }}>

        {/* Sidebar */}
        <Drawer variant="persistent" open={sidebar}
          sx={{ width: sidebar ? DRAWER_W : 0, flexShrink: 0, transition: 'width 0.2s', '& .MuiDrawer-paper': { width: DRAWER_W, boxSizing: 'border-box' } }}>
          {sidebarContent}
        </Drawer>

        {/* Main */}
        <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', height: '100%', bgcolor: '#ffffff', overflow: 'hidden', minWidth: 0 }}>

          {/* Top bar */}
          <Box sx={{ height: 52, display: 'flex', alignItems: 'center', px: 2, justifyContent: 'space-between', flexShrink: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              {!sidebar && (
                <>
                  <Tooltip title="展开侧边栏">
                    <IconButton size="small" onClick={() => setSidebar(true)}><ViewSidebarOutlinedIcon sx={{ fontSize: 19 }} /></IconButton>
                  </Tooltip>
                  <Tooltip title="新建聊天">
                    <IconButton size="small" onClick={newChat}><EditOutlinedIcon sx={{ fontSize: 19 }} /></IconButton>
                  </Tooltip>
                </>
              )}
              <Button
                endIcon={models.length === 0
                  ? <CircularProgress size={14} thickness={5} sx={{ color: 'text.secondary' }} />
                  : <KeyboardArrowDownIcon />}
                onClick={e => models.length > 0 && setModelAnchor(e.currentTarget)}
                sx={{ color: 'text.primary', fontSize: '1rem', fontWeight: 700, borderRadius: 2, px: 1.5, '&:hover': { bgcolor: 'rgba(0,0,0,0.04)' } }}
              >
                {selectedModel || 'Copilot CLI'}
              </Button>
              <Menu
                anchorEl={modelAnchor}
                open={Boolean(modelAnchor)}
                onClose={() => setModelAnchor(null)}
                slotProps={{ paper: { sx: { borderRadius: 2, minWidth: 200, boxShadow: '0 4px 20px rgba(0,0,0,0.12)' } } }}
              >
                {models.map(m => (
                  <MenuItem
                    key={m}
                    selected={m === selectedModel}
                    onClick={() => { setSelectedModel(m); setModelAnchor(null); }}
                    sx={{ fontSize: '0.9rem', borderRadius: 1, mx: 0.5, '&.Mui-selected': { fontWeight: 600, bgcolor: 'rgba(0,0,0,0.06)' } }}
                  >
                    {m}
                  </MenuItem>
                ))}
              </Menu>
            </Box>
            <Tooltip title="设置">
              <IconButton onClick={() => setSettingsDlg(true)} size="small"><TuneIcon sx={{ fontSize: 19 }} /></IconButton>
            </Tooltip>
          </Box>

          {/* Content area */}
          {mode === 'translate' ? (
            <TranslatePage
              ws={ws}
              onRegisterHandler={(handler) => { msgHandlerRef.current = handler; }}
              selectedModel={selectedModel}
            />
          ) : isEmpty ? (

            /* ── Empty state ── */
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', px: 2, pb: 10 }}>
              <Typography sx={{ fontWeight: 700, fontSize: '1.65rem', letterSpacing: '-0.02em', mb: 4, color: 'text.primary' }}>
                有什么可以帮忙的？
              </Typography>

              {chatInput}

            </Box>

          ) : (

            /* ── Chat view ── */
            <>
              <Box sx={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
                <Box sx={{ maxWidth: MAX_W, mx: 'auto', py: 6, px: 2, display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {messages.map((msg, i) => (
                    <Box key={i}>
                      {msg.role === 'user' ? (
                        /* User bubble */
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                          <Box sx={{ bgcolor: '#f4f4f4', px: 2.5, py: 1.5, borderRadius: '20px', borderBottomRightRadius: '6px', maxWidth: '80%' }}>
                            <Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.65, fontSize: '0.95rem' }}>
                              {msg.text}
                            </Typography>
                          </Box>
                        </Box>
                      ) : (
                        /* Assistant message */
                        <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', '&:hover .copy-btn': { opacity: 1 } }}>
                          <Avatar sx={{ bgcolor: '#000', color: '#fff', width: 30, height: 30, fontSize: '0.72rem', fontWeight: 700, flexShrink: 0, mt: 0.3 }}>C</Avatar>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                              {msg.text}
                            </ReactMarkdown>
                            <Box sx={{ mt: 1 }}>
                              <Tooltip title={copied === i ? '已复制' : '复制'}>
                                <IconButton
                                  className="copy-btn"
                                  size="small"
                                  onClick={() => copyMsg(msg.text, i)}
                                  sx={{ opacity: 0, transition: 'opacity 0.15s', p: 0.6, '&:hover': { bgcolor: 'rgba(0,0,0,0.05)' } }}
                                >
                                  {copied === i
                                    ? <CheckIcon sx={{ fontSize: 15, color: '#22c55e' }} />
                                    : <ContentCopyIcon sx={{ fontSize: 15 }} />}
                                </IconButton>
                              </Tooltip>
                            </Box>
                          </Box>
                        </Box>
                      )}
                    </Box>
                  ))}

                  {/* Generating dots — only while waiting for first chunk */}
                  {generating && messages[messages.length - 1]?.role !== 'assistant' && (
                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                      <Avatar sx={{ bgcolor: '#000', color: '#fff', width: 30, height: 30, fontSize: '0.72rem', fontWeight: 700, flexShrink: 0 }}>C</Avatar>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, py: 0.8 }}>
                        {[0, 1, 2].map(i => (
                          <Box key={i} sx={{
                            width: 6, height: 6, bgcolor: '#b4b4b4', borderRadius: '50%',
                            '@keyframes bounce': {
                              '0%,80%,100%': { transform: 'scale(0.6)', opacity: 0.3 },
                              '40%':          { transform: 'scale(1)',   opacity: 1 },
                            },
                            animation: `bounce 1.4s infinite ${i * 0.16}s`,
                          }} />
                        ))}
                      </Box>
                    </Box>
                  )}
                  <div ref={endRef} />
                </Box>
              </Box>

              {/* Bottom input */}
              <Box sx={{ flexShrink: 0, pb: 3, pt: 1, px: 2, bgcolor: '#ffffff' }}>
                {chatInput}
              </Box>
            </>
          )}

          {/* Disclaimer — only in chat mode */}
          {mode !== 'translate' && (
            <Typography variant="caption" sx={{ textAlign: 'center', pb: isEmpty ? 0 : 1.5, flexShrink: 0, color: 'text.secondary', fontSize: '0.72rem', lineHeight: 1 }}>
              Copilot CLI 可能会出错，请核查重要信息。
            </Typography>
          )}
        </Box>
      </Box>
    </ThemeProvider>
  );
}
