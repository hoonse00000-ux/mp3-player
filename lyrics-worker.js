// AI 가사 받아쓰기 워커 (Whisper · transformers.js, 기기 안에서 실행)
const LIB = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3';
let T = null, asr = null, loaded = '';

// 노래 없는 부분에서 Whisper가 자주 지어내는 문장
const JUNK = /시청해\s*주셔서|구독(과|,)?\s*좋아요|좋아요(와|,)?\s*구독|MBC\s*뉴스|KBS|SBS|자막\s*(제공|제작)|한글\s*자막|다음\s*영상에서|thank(s| you) for watching|please subscribe|字幕|ご視聴ありがとう/i;

const LANG_TOK = { korean: '<|ko|>', japanese: '<|ja|>', english: '<|en|>', chinese: '<|zh|>' };
// 노래 언어 알아내기: Whisper가 첫 토큰으로 어떤 언어를 고르는지 확인 (소리가 가장 큰 30초 구간 사용)
async function detectLanguage(audio) {
  const SR = 16000, WIN = 30 * SR, end = Math.min(audio.length, 180 * SR);
  let best = 0, bestE = -1;
  for (let off = 0; off < end; off += WIN) {
    let e2 = 0; const stop = Math.min(audio.length, off + WIN);
    for (let i = off; i < stop; i += 8) e2 += audio[i] * audio[i];
    if (e2 > bestE) { bestE = e2; best = off; }
  }
  const win = audio.subarray(best, Math.min(audio.length, best + WIN));
  const { input_features } = await asr.processor(win);
  const ids = asr.tokenizer.model.tokens_to_ids;
  const sot = ids.get('<|startoftranscript|>');
  const dec = new T.Tensor('int64', BigInt64Array.from([BigInt(sot)]), [1, 1]);
  const out = await asr.model({ input_features, decoder_input_ids: dec });
  const L = out.logits, V = L.dims[L.dims.length - 1], base = L.data.length - V;
  let lang = null, v = -Infinity;
  for (const [k, t] of Object.entries(LANG_TOK)) { const id = ids.get(t); if (id == null) continue; const x = L.data[base + id]; if (x > v) { v = x; lang = k; } }
  return lang;
}

self.onmessage = async e => {
  const { audio, model, hint } = e.data;
  let { language } = e.data;
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
    if (!language || language === 'auto') {
      try { language = await detectLanguage(audio); } catch (err) { language = null; }
      if (!language) language = hint || 'korean';      // 알아내지 못하면 제목 글자로 추측, 그래도 모르면 한국어
      postMessage({ type: 'lang', lang: language });
    }
    postMessage({ type: 'asr', p: 0, partial: '' });
    const SR = 16000, WIN = 30 * SR, STEP = 25 * SR, lines = [];   // 5초씩 겹쳐 들어서 구간 경계에서 가사가 잘리지 않게
    // 곡 전체 소리 크기 기준 (조용한 노래 부분을 건너뛰지 않도록 곡에 맞춰 판단)
    let tot = 0; for (let i = 0; i < audio.length; i += 16) tot += audio[i] * audio[i];
    const songRms = Math.sqrt(tot / Math.max(1, audio.length / 16));
    let lastEnd = -1;
    let partial = '';
    for (let off = 0; off < audio.length; off += STEP) {
      const part = audio.subarray(off, Math.min(audio.length, off + WIN));
      // 거의 소리가 없는 부분은 건너뛰기
      let e2 = 0; for (let i = 0; i < part.length; i += 4) e2 += part[i] * part[i];
      if (Math.sqrt(e2 / (part.length / 4)) > songRms * 0.12 && part.length > SR * 0.8) {
        const opts = { task: 'transcribe', return_timestamps: true, no_repeat_ngram_size: 0 };
        opts.language = language;          // 언어를 꼭 지정 (지정하지 않으면 영어로 처리됨)
        const out = await asr(part, opts);
        const chunks = out.chunks && out.chunks.length ? out.chunks : [{ timestamp: [0, part.length / SR], text: out.text || '' }];
        for (const c of chunks) {
          const text = (c.text || '').trim();
          if (!text || JUNK.test(text) || /^[\s.,!?♪~\-]*$/.test(text)) continue;
          const t = off / SR + (c.timestamp && c.timestamp[0] != null ? c.timestamp[0] : 0);
          const tEnd = off / SR + (c.timestamp && c.timestamp[1] != null ? c.timestamp[1] : (c.timestamp ? c.timestamp[0] + 2 : 2));
          // 앞 구간과 겹치는 5초 안에서, 이미 적은 줄이 끝난 시간보다 앞쪽이면 건너뜀 (경계에서 잘린 줄은 살림)
          if (off > 0 && tEnd <= lastEnd + 0.3) continue;
          const prev = lines[lines.length - 1];
          // 겹치는 구간 때문에 같은 줄이 두 번 잡힌 경우만 제거 (후렴처럼 반복되는 가사는 그대로 둠)
          if (prev && prev.text === text && t - prev.t < 1.5) continue;
          if (prev && t < prev.t + 0.2) continue;
          lines.push({ t: Math.max(0, +t.toFixed(2)), text });
          lastEnd = Math.max(lastEnd, tEnd);
          partial += text + '\n';
        }
      }
      postMessage({ type: 'asr', p: Math.min(1, (off + STEP) / audio.length), partial });
      if (off + WIN >= audio.length) break;
    }
    postMessage({ type: 'done', lines });
  } catch (err) {
    postMessage({ type: 'error', message: (err && err.message) || String(err) });
  }
};
