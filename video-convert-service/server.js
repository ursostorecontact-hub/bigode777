const express = require('express');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
app.use(express.json({ limit: '80mb' }));

const SECRET = process.env.CONVERT_SECRET;
const TMP_DIR = '/tmp/video-convert';
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

app.post('/convert-video', (req, res) => {
  const { video_base64, secret } = req.body || {};
  if (!SECRET || secret !== SECRET) return res.status(401).json({ error: 'unauthorized' });
  if (!video_base64) return res.status(400).json({ error: 'video_base64 required' });

  const id = crypto.randomUUID();
  const inputPath = path.join(TMP_DIR, `${id}_in`);
  const outputPath = path.join(TMP_DIR, `${id}_out.mp4`);

  try {
    fs.writeFileSync(inputPath, Buffer.from(video_base64, 'base64'));
  } catch {
    return res.status(400).json({ error: 'invalid base64' });
  }

  // Remonta o vídeo num MP4 limpo: só a primeira trilha de vídeo e a primeira de
  // áudio (descarta trilhas extras de metadados que celulares tipo iPhone
  // costumam incluir, e que podem estar confundindo o processamento do WhatsApp).
  // +faststart deixa o vídeo pronto pra tocar assim que abre, sem precisar
  // baixar o arquivo inteiro primeiro.
  const cmd = `ffmpeg -y -i "${inputPath}" -map 0:v:0 -map 0:a:0? -c:v libx264 -profile:v baseline -level 3.0 -pix_fmt yuv420p -c:a aac -movflags +faststart "${outputPath}"`;

  exec(cmd, { timeout: 90000, maxBuffer: 1024 * 1024 * 10 }, (err, _stdout, stderr) => {
    fs.unlink(inputPath, () => {});
    if (err) {
      console.error('ffmpeg error:', stderr?.slice(-500));
      return res.status(500).json({ error: 'conversion failed', details: stderr?.slice(-300) });
    }
    try {
      const outBuffer = fs.readFileSync(outputPath);
      fs.unlink(outputPath, () => {});
      res.json({ video_base64: outBuffer.toString('base64') });
    } catch {
      res.status(500).json({ error: 'failed to read converted output' });
    }
  });
});

app.get('/health', (_req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 8765;
app.listen(PORT, () => console.log(`Video convert service running on port ${PORT}`));
