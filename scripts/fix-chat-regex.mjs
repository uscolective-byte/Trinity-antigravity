import fs from 'node:fs';

const path = 'Trinity/public/assistant/chat.js.txt';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  'const imgMatches = text.match(//api/assistant/media/images/[0-9a-f-]{36}|https?:\\/\\/[^\\s"\'>]+\\.(png|jpe?g|webp|svg|gif)|data:image\\/[^;]+;base64,[^\\s"\'>]+/gi);',
  'const imgMatches = text.match(/\\/api\\/assistant\\/media\\/images\\/[0-9a-f-]{36}|https?:\\/\\/[^\\s"\'>]+\\.(png|jpe?g|webp|svg|gif)|data:image\\/[^;]+;base64,[^\\s"\'>]+/gi);'
);

content = content.replace(
  'const vidMatches = text.match(//api/assistant/media/video\\/[0-9a-f-]{36}|https?:\\/\\/[^\\s"\'>]+\\.(mp4|webm|mov)|data:video\\/[^;]+;base64,[^\\s"\'>]+/gi);',
  'const vidMatches = text.match(/\\/api\\/assistant\\/media\\/video\\/[0-9a-f-]{36}|https?:\\/\\/[^\\s"\'>]+\\.(mp4|webm|mov)|data:video\\/[^;]+;base64,[^\\s"\'>]+/gi);'
);

content = content.replace(
  'const audMatches = text.match(//api/assistant/media/audio\\/[0-9a-f-]{36}|https?:\\/\\/[^\\s"\'>]+\\.(mp3|wav|ogg)|data:audio\\/[^;]+;base64,[^\\s"\'>]+/gi);',
  'const audMatches = text.match(/\\/api\\/assistant\\/media\\/audio\\/[0-9a-f-]{36}|https?:\\/\\/[^\\s"\'>]+\\.(mp3|wav|ogg)|data:audio\\/[^;]+;base64,[^\\s"\'>]+/gi);'
);

fs.writeFileSync(path, content, 'utf8');
console.log('Regex patterns in chat.js.txt successfully fixed.');
