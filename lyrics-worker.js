// AI 가사 받아쓰기 워커 (Whisper · transformers.js, 기기 안에서 실행)
const LIB = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3';
let T = null, asr = null, loaded = '';

// 노래 없는 부분에서 Whisper가 자주 지어내는 문장
const JUNK = /시청해\s*주셔서|구독(과|,)?\s*좋아요|좋아요(와|,)?\s*구독|MBC\s*뉴스|KBS|SBS|자막\s*(제공|제작)|한글\s*자막|다음\s*영상에서|thank(s| you) for watching|subscribe|字幕|ご視聴|by\s+[A-Za-z]+\s*$/i;

self.onmessage = async e => {
  const { audio, model, language } = e.data;
  try {
    if (!T) {
      T = await import(LIB);
      T.env.allowLocalModels = false;
    }
    if (!asr || loaded !== model) {
      const files = {};
      asr = await T.pipeline('automatic-speech-recognition', model, {
        device: 'wasm',
        dtype: 'q8',             // 작게 줄인 모델 (메모리 절약)
        progress_callback: d => {
          if (d.status === 'progress' && d.total) {
            files[d.file] = [d.loaded, d.total];
            let a = 0, b = 0; for (const [l, t] of Object.values(files)) { a += l; b += t; }
            postMessage({ type: 'load', p: b ? a / b : 0 });
          } else if (d.status === 'ready') postMessage({ type: 'load', p: 1 });
        }
      });
      loaded = model;
    }
    postMessage({ type: 'asr', p: 0, partial: '' });
    const SR = 16000, WIN = 30 * SR, lines = [];
    let partial = '';
    for (let off = 0; off < audio.length; off += WIN) {
      const part = audio.subarray(off, Math.min(audio.length, off + WIN));
      // 거의 소리가 없는 부분은 건너뛰기
      let e2 = 0; for (let i = 0; i < part.length; i += 4) e2 += part[i] * part[i];
      if (Math.sqrt(e2 / (part.length / 4)) > 0.003 && part.length > SR) {
        const opts = { task: 'transcribe', return_timestamps: true };
        if (language) opts.language = language;
        const out = await asr(part, opts);
        const chunks = out.chunks && out.chunks.length ? out.chunks : [{ timestamp: [0, part.length / SR], text: out.text || '' }];
        for (const c of chunks) {
          const text = (c.text || '').trim();
          if (!text || JUNK.test(text) || /^[\s.,!?♪~\-]*$/.test(text)) continue;
          const t = off / SR + (c.timestamp && c.timestamp[0] != null ? c.timestamp[0] : 0);
          const prev = lines[lines.length - 1];
          if (prev && prev.text === text) continue;            // 같은 줄 반복 제거
          lines.push({ t: Math.max(0, +t.toFixed(2)), text });
          partial += text + '\n';
        }
      }
      postMessage({ type: 'asr', p: Math.min(1, (off + WIN) / audio.length), partial });
    }
    postMessage({ type: 'done', lines });
  } catch (err) {
    postMessage({ type: 'error', message: (err && err.message) || String(err) });
  }
};
