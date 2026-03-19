import { useState, useEffect, useRef } from 'react';
import {
  Box, Typography, TextField, IconButton,
  Select, MenuItem, FormControl, Tooltip,
} from '@mui/material';
import SwapHorizIcon    from '@mui/icons-material/SwapHoriz';
import ContentCopyIcon  from '@mui/icons-material/ContentCopy';
import CheckIcon        from '@mui/icons-material/Check';

const SOURCE_LANGS = [
  { code: 'auto',  label: '检测语言' },
  { code: 'zh',    label: '中文（简体）' },
  { code: 'zh-TW', label: '中文（繁体）' },
  { code: 'en',    label: '英语' },
  { code: 'ja',    label: '日语' },
  { code: 'ko',    label: '韩语' },
  { code: 'fr',    label: '法语' },
  { code: 'de',    label: '德语' },
  { code: 'es',    label: '西班牙语' },
  { code: 'ru',    label: '俄语' },
  { code: 'ar',    label: '阿拉伯语' },
];
const TARGET_LANGS = SOURCE_LANGS.filter(l => l.code !== 'auto');

/* pill-shaped Select style */
const selectSx = {
  borderRadius: '24px',
  bgcolor: '#ffffff',
  fontSize: '0.9rem',
  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#e5e5e5' },
  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#c8c8c8' },
  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#b0b0b0', borderWidth: 1 },
  '& .MuiSelect-select': { py: '10px', px: '18px' },
};

export default function TranslatePage({ ws, onRegisterHandler, selectedModel }) {
  const [sourceLang, setSourceLang] = useState('auto');
  const [targetLang, setTargetLang] = useState('zh');
  const [sourceText, setSourceText] = useState('');
  const [targetText, setTargetText] = useState('');
  const [translating, setTranslating] = useState(false);
  const [copied,      setCopied]      = useState(false);
  const debounceRef = useRef(null);

  /* refs to avoid stale closure inside debounced call */
  const srcLangRef     = useRef(sourceLang);
  const tgtLangRef     = useRef(targetLang);
  const srcTextRef     = useRef(sourceText);
  const translatingRef = useRef(translating);
  srcLangRef.current     = sourceLang;
  tgtLangRef.current     = targetLang;
  srcTextRef.current     = sourceText;
  translatingRef.current = translating;

  /* register this page's WS handler while mounted */
  useEffect(() => {
    onRegisterHandler((data) => {
      let evt;
      try { evt = JSON.parse(data); } catch {
        setTargetText(data);
        setTranslating(false);
        return;
      }
      if (evt.type === 'chunk') {
        setTargetText(p => p + evt.content);
      } else if (evt.type === 'done') {
        setTranslating(false);
      } else if (evt.type === 'text') {
        setTargetText(evt.content);
        setTranslating(false);
      } else if (evt.type === 'error') {
        setTargetText(`⚠️ ${evt.content}`);
        setTranslating(false);
      }
    });
    return () => onRegisterHandler(null);
  }, [onRegisterHandler]);

  /* auto-translate with debounce */
  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (!sourceText.trim()) { setTargetText(''); setTranslating(false); return; }
    debounceRef.current = setTimeout(doTranslate, 900);
    return () => clearTimeout(debounceRef.current);
  }, [sourceText, sourceLang, targetLang]);

  function doTranslate(customInstruction) {
    const text = srcTextRef.current.trim();
    if (!text) return;
    // Cancel any in-progress translation before starting a new one
    if (translatingRef.current && ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ __cmd: 'stop' }));
    }
    const srcCode  = srcLangRef.current;
    const tgtCode  = tgtLangRef.current;
    const tgtLabel = TARGET_LANGS.find(l => l.code === tgtCode)?.label || tgtCode;
    const srcLabel = SOURCE_LANGS.find(l => l.code === srcCode)?.label || srcCode;

    const prompt = customInstruction
      ? `目标语言：${tgtLabel}\n指令：${customInstruction}\n原文：\n${text}\n\n只返回翻译结果。`
      : `请将以下文本${srcCode === 'auto' ? '' : `从${srcLabel}`}翻译为${tgtLabel}，只返回翻译结果，不添加任何解释：\n\n${text}`;

    setTranslating(true);
    setTargetText('');
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ user_prompt: prompt, model: selectedModel || '' }));
    } else {
      setTargetText('⚠️ 未连接到后端，请检查服务是否运行。');
      setTranslating(false);
    }
  }

  function swapLanguages() {
    if (sourceLang === 'auto') return;
    setSourceLang(targetLang);
    setTargetLang(sourceLang);
    setSourceText(targetText);
    setTargetText('');
  }

  function copyResult() {
    if (!targetText) return;
    navigator.clipboard.writeText(targetText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Box sx={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', px: 3, pt: 8, pb: 6 }}>

      {/* Title */}
      <Typography sx={{ fontWeight: 700, fontSize: '2rem', letterSpacing: '-0.02em', mb: 5, color: 'text.primary' }}>
        使用 Copilot 翻译
      </Typography>

      <Box sx={{ width: '100%', maxWidth: 900 }}>

        {/* Language selector row */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1.5 }}>
          <FormControl sx={{ flex: 1 }}>
            <Select value={sourceLang} onChange={e => setSourceLang(e.target.value)} sx={selectSx}>
              {SOURCE_LANGS.map(l => (
                <MenuItem key={l.code} value={l.code} sx={{ fontSize: '0.9rem' }}>{l.label}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <Tooltip title={sourceLang === 'auto' ? '请先选择源语言' : '互换语言'}>
            <span>
              <IconButton onClick={swapLanguages} disabled={sourceLang === 'auto'}
                sx={{ '&:hover': { bgcolor: 'rgba(0,0,0,0.05)', color: '#0d0d0d' }, '&.Mui-disabled': { opacity: 0.3 } }}>
                <SwapHorizIcon />
              </IconButton>
            </span>
          </Tooltip>

          <FormControl sx={{ flex: 1 }}>
            <Select value={targetLang} onChange={e => setTargetLang(e.target.value)} sx={selectSx}>
              {TARGET_LANGS.map(l => (
                <MenuItem key={l.code} value={l.code} sx={{ fontSize: '0.9rem' }}>{l.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        {/* Text panels */}
        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>

          {/* Left — input */}
          <Box sx={{
            flex: 1, bgcolor: '#ffffff', border: '1px solid #e5e5e5',
            borderRadius: '16px', p: 2.5, minHeight: 230,
            maxHeight: '70vh', overflowY: 'auto',
          }}>
            <TextField
              multiline fullWidth minRows={8}
              placeholder="输入或粘贴文本以进行翻译"
              value={sourceText}
              onChange={e => setSourceText(e.target.value)}
              variant="standard"
              InputProps={{ disableUnderline: true }}
              sx={{
                '& .MuiInputBase-root': { fontSize: '0.95rem', lineHeight: 1.75, alignItems: 'flex-start', color: 'text.primary' },
                '& textarea::placeholder': { color: '#c0c0c0', opacity: 1 },
              }}
            />
          </Box>

          {/* Right — output */}
          <Box sx={{
            flex: 1, bgcolor: '#f4f4f4', borderRadius: '16px',
            p: 2.5, minHeight: 230,
            maxHeight: '70vh', overflowY: 'auto',
          }}>
            {translating ? (
              <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', pt: 0.5, mb: 1 }}>
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
            ) : (
              <Typography sx={{
                fontSize: '0.95rem', lineHeight: 1.75,
                color: targetText ? 'text.primary' : 'transparent',
                whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                mb: 1,
              }}>
                {targetText || ' '}
              </Typography>
            )}

            {/* Copy */}
            <Box sx={{ mt: 1 }}>
              <Tooltip title={copied ? '已复制' : '复制'}>
                <span>
                  <IconButton size="small" onClick={copyResult}
                    disabled={!targetText || translating}
                    sx={{ color: '#6b6b6b', '&:hover': { bgcolor: 'rgba(0,0,0,0.06)' }, '&.Mui-disabled': { opacity: 0.25 } }}>
                    {copied
                      ? <CheckIcon sx={{ fontSize: 18, color: '#22c55e' }} />
                      : <ContentCopyIcon sx={{ fontSize: 18 }} />}
                  </IconButton>
                </span>
              </Tooltip>
            </Box>
          </Box>
        </Box>


      </Box>
    </Box>
  );
}
