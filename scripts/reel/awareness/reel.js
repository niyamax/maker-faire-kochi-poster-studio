import {outline} from './studio-type.js';

const {data,assets} = globalThis.awarenessReel;
const canvas = document.querySelector('canvas');
let ctx = canvas.getContext('2d');
const button = document.querySelector('button');
const slider = document.querySelector('input');
const W = canvas.width;
const H = canvas.height;
const duration = Number(slider.max);
const pullBack = {start:1.85, end:3.24};
const photoCollapse = {start:16.50, end:17.23};
const dateFold = {start:photoCollapse.end, end:17.99};
const crease = {left:974, right:918};
const red = '#ED1C24';
const white = '#FFFFFF';
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const images = Object.fromEntries(Object.entries(assets).map(([name, src]) => [name, Object.assign(new Image(), {src})]));
const parts = Object.values(images);

for (const composition of [data.date, data.month, data.programme]) {
  for (const shape of composition.shapes) shape.geometry = new Path2D(shape.path);
}
for (const detail of data.details) detail.geometry = new Path2D(detail.d);

const definition = {source:'hall', headline:'A SHOW-AND-TELL\nFOR THINGS\nPEOPLE MAKE', x:.53, y:.75};
const imageFrame = {x:76, y:250, w:928, h:932};
const definitionCollapse = {start:4.43, end:4.99};
const programmeFold = {start:definitionCollapse.end, end:5.54};
const definitionCrease = {left:932, right:876};
const names = ['prototype', 'maker', 'ask'];
const apertures = [
  {row:0, risesRight:true, start:5.82, open:6.76, close:8.58, end:9.36},
  {row:1, risesRight:false, start:9.36, open:10.3, close:12.12, end:12.90},
  {row:2, risesRight:true, start:12.90, open:13.84, close:Infinity, end:Infinity},
];
const rowTops = [626, 806, 985];
const titleX = 540;
const photoLeft = 93;
const photoRight = 987;
const photoTop = 474;
const photoBottom = 1490;

const lerp = (from, to, progress) => from + (to - from) * progress;
function ease(progress) {
  const t = Math.min(1, Math.max(0, progress));
  return t * t * (3 - 2 * t);
}

function drawType(composition, elapsed, color, poses, onlyRow) {
  const frames = composition.frames;
  // Keep the previous cut’s speed for the continuous Studio Flow lettering.
  const frame = (elapsed * (2 / 3) * data.fps) % frames.length;
  const index = Math.floor(frame);
  const current = frames[index];
  const next = frames[(index + 1) % frames.length];
  const weight = frame - index;
  for (const [i, shape] of composition.shapes.entries()) {
    if (onlyRow !== undefined && shape.row !== onlyRow) continue;
    const pose = poses[shape.row];
    if (pose.opacity === 0) continue;
    ctx.save();
    ctx.globalAlpha *= pose.opacity ?? 1;
    ctx.transform(1, pose.shear, 0, 1, 0, pose.y - titleX * pose.shear);
    ctx.transform(...current[i].map((value, j) => lerp(value, next[i][j], weight)));
    ctx.fillStyle = color;
    ctx.fill(shape.geometry);
    ctx.restore();
  }
}

function progress(time, start, end) {
  return ease((time - start) / (end - start));
}

function cover(image, box, focusX, focusY) {
  const scale = Math.max(box.w / image.naturalWidth, box.h / image.naturalHeight);
  const cropWidth = box.w / scale;
  const cropHeight = box.h / scale;
  const x = (image.naturalWidth - cropWidth) * focusX;
  const y = (image.naturalHeight - cropHeight) * focusY;
  ctx.drawImage(image, x, y, cropWidth, cropHeight, box.x, box.y, box.w, box.h);
}

function photoClip(box) {
  ctx.beginPath();
  ctx.rect(box.x, box.y, box.w, box.h);
  ctx.clip();
}

function drawOutlines(outlines, color) {
  ctx.fillStyle = color;
  for (const {geometry,matrix} of outlines) {
    ctx.save();
    ctx.transform(...matrix);
    ctx.fill(geometry);
    ctx.restore();
  }
}

function titleOutlines(words, time, center, width, height, energy) {
  const box = {x:(W - width) / 2,y:center - height / 2,w:width,h:height};
  return outline(words, box, time, energy);
}

function drawAcrossPhoto(outlines, box, opacity) {
  if (opacity === 0) return;
  enterGroup(opacity, 0, () => {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    ctx.rect(box.x, box.y, box.w, box.h);
    ctx.clip('evenodd');
    drawOutlines(outlines, red);
    ctx.restore();

    ctx.save();
    photoClip(box);
    drawOutlines(outlines, white);
    ctx.restore();
  });
}

function shadePhoto(stage, strength) {
  if (strength <= 0) return;
  const shade = ctx.createLinearGradient(0, stage.y, 0, stage.y + stage.h);
  shade.addColorStop(0, 'rgba(0,0,0,.08)');
  shade.addColorStop(.25, 'rgba(0,0,0,.34)');
  shade.addColorStop(.63, 'rgba(0,0,0,.47)');
  shade.addColorStop(1, 'rgba(0,0,0,.10)');
  ctx.save();
  ctx.globalAlpha = strength;
  ctx.fillStyle = shade;
  ctx.fillRect(stage.x, stage.y, stage.w, stage.h);
  ctx.restore();
}

function pullBackFromPhoto(time) {
  const amount = progress(time, pullBack.start, pullBack.end);
  const stage = {
    x:imageFrame.x * amount,
    y:imageFrame.y * amount,
    w:lerp(W, imageFrame.w, amount),
    h:lerp(H, imageFrame.h, amount),
  };
  const {x,y} = definition;
  const color = progress(amount, .08, 1);
  const question = 1 - progress(time, 2.08, 2.37);
  const answer = progress(time, 2.32, 2.57);
  const settle = progress(time, 2.38, 3.22);
  const photoAnchor = stage.y + stage.h * 921 / H;
  const scale = lerp(1, .52, amount);
  const stretch = Math.sin(Math.PI * amount);

  cover(images.monochromeHall, stage, x, y);
  if (color > 0) {
    ctx.save();
    ctx.globalAlpha = color;
    cover(images.hall, stage, x, y);
    ctx.restore();
  }
  shadePhoto(stage, Math.max(question, answer * (1 - settle) * .70));

  if (question > 0) {
    const width = 926 * scale * (1 - .13 * stretch);
    const height = 885 * scale * (1 + .20 * stretch);
    const outlines = titleOutlines('WHAT IS A\nMAKER\nFAIRE?', time, photoAnchor,
      width, height, .96 + .36 * stretch);
    ctx.save();
    photoClip(stage);
    enterGroup(question, 0, () => drawOutlines(outlines, white));
    ctx.restore();
  }

  if (answer > 0) {
    const position = lerp(photoAnchor, 1401, settle);
    const size = lerp(scale, 1, settle);
    const width = 932 * size * (1 - .18 * stretch);
    const height = 352 * size * (1 + .30 * stretch);
    const outlines = titleOutlines(definition.headline, time, position,
      width, height, .63 + .42 * stretch);
    drawAcrossPhoto(outlines, stage, answer);
  }
}

function drawDefinition(time) {
  const fold = progress(time, definitionCollapse.start, definitionCollapse.end);
  if (fold >= 1) return;
  const {x,y,w,h} = imageFrame;
  const right = x + w;
  const bottom = y + h;
  ctx.save();
  drawPolygon([
    [x,lerp(y,definitionCrease.left,fold)],
    [right,lerp(y,definitionCrease.right,fold)],
    [right,lerp(bottom,definitionCrease.right,fold)],
    [x,lerp(bottom,definitionCrease.left,fold)]
  ]);
  ctx.clip();
  cover(images[definition.source], imageFrame, definition.x, definition.y);
  ctx.restore();

  const hinge = (definitionCrease.left + definitionCrease.right) / 2;
  const titleFold = progress(time,4.65,definitionCollapse.end);
  const slope = (definitionCrease.right - definitionCrease.left) / w;
  const travel = (bottom - hinge) * fold;
  const type = titleOutlines(definition.headline, time, 1401-travel, 932, 352, .63);
  ctx.save();
  ctx.transform(1,slope * titleFold,0,1-titleFold,
    0,(hinge-slope * W/2) * titleFold);
  drawOutlines(type,red);
  ctx.restore();
}

function drawPolygon(corners) {
  ctx.beginPath();
  ctx.moveTo(...corners[0]);
  for (const point of corners.slice(1)) ctx.lineTo(...point);
  ctx.closePath();
}

function drawProgramme(time) {
  const entry = progress(time, programmeFold.start, programmeFold.end);
  ctx.fillStyle = white;
  ctx.fillRect(0, 0, W, H);

  const neutral = rowTops.map(() => ({shear:0, y:(1 - entry) * 95}));
  const active = apertures.find(aperture => time >= aperture.start && time < aperture.end);
  if (!active) {
    drawType(data.programme, time, red, neutral);
    return;
  }

  const opening = progress(time, active.start, active.open);
  const closing = time > active.close ? progress(time, active.close, active.end) : 0;
  const reveal = opening - closing;
  const row = active.row;
  const lean = active.risesRight ? -1 : 1;
  const fold = row === 2 ? progress(time, photoCollapse.start, photoCollapse.end) : 0;
  const creaseTravel = (crease.left + crease.right - photoTop * 2 - 56) / 2;

  const poses = rowTops.map((top, i) => {
    if (i === row) {
      return {shear:lean * .063 * reveal, y:(313 - top) * reveal + creaseTravel * fold};
    }
    const destination = i < row ? -185 - (row-i-1) * 250 : 1515 + (i-row-1) * 250;
    return {shear:lean * .024 * reveal, y:(destination - top) * reveal};
  });

  const labelFold = row === 2 ? progress(time, 16.95, photoCollapse.end) : 0;
  if (labelFold < 1) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 205, W, 1295);
    ctx.clip();
    if (labelFold > 0) {
      const slope = (crease.right - crease.left) / (photoRight - photoLeft);
      const hinge = (crease.left + crease.right) / 2;
      ctx.transform(1, slope * labelFold, 0, 1 - labelFold,
        0, (hinge - slope * W / 2) * labelFold);
    }
    drawType(data.programme, time, red, poses, labelFold > 0 ? row : undefined);
    ctx.restore();
  }

  if (fold === 1) return;
  const seam = rowTops[row] + 174;
  const high = lerp(seam, photoTop, reveal);
  const low = lerp(seam, photoTop + 56, reveal);
  const deep = lerp(seam, photoBottom, reveal);
  const shallow = lerp(seam, photoBottom - 26, reveal);
  const corners = active.risesRight
    ? [[photoLeft,lerp(low,crease.left,fold)],[photoRight,lerp(high,crease.right,fold)],
       [photoRight,lerp(deep,crease.right,fold)],[photoLeft,lerp(shallow,crease.left,fold)]]
    : [[photoLeft,high],[photoRight,low],[photoRight,shallow],[photoLeft,deep]];
  ctx.save();
  drawPolygon(corners);
  ctx.clip();
  const image = images[names[row]];
  ctx.drawImage(image, photoLeft, Math.min(photoTop, seam),
    photoRight-photoLeft, photoBottom-Math.min(photoTop, seam));
  ctx.restore();
}

const dateLayer = new OffscreenCanvas(W, H);
const dateLayerContext = dateLayer.getContext('2d');

function enterGroup(amount, distance, draw) {
  if (amount === 0) return;
  if (amount === 1) {
    draw();
    return;
  }

  // Composite overlapping Studio glyph paths before fading the group.
  const page = ctx;
  ctx = dateLayerContext;
  ctx.clearRect(0, 0, W, H);
  ctx.save();
  ctx.translate(0, (1 - amount) * distance);
  draw();
  ctx.restore();
  ctx = page;

  ctx.save();
  ctx.globalAlpha = amount;
  ctx.drawImage(dateLayer, 0, 0);
  ctx.restore();
}

function drawDates(time) {
  drawType(data.date, 0, white, [{shear:0,y:0}]);
  enterGroup(progress(time, 17.94, 18.54), -30, () => {
    const logo = images.logo;
    const width = 468;
    ctx.drawImage(logo, (W - width) / 2, 439, width, width * logo.naturalHeight / logo.naturalWidth);
  });
  enterGroup(progress(time, 18.05, 18.65), 30, () => {
    drawType(data.month, 0, white, [{shear:0,y:0}]);
  });
  enterGroup(progress(time, 18.34, 19.14), 26, () => {
    for (const detail of data.details) {
      ctx.save();
      ctx.transform(...detail.matrix);
      ctx.fillStyle = white;
      ctx.fill(detail.geometry);
      ctx.restore();
    }
  });
}

function openFold(opening, startLeft, startRight, line) {
  const left = lerp(startLeft,0,opening);
  const right = lerp(startRight,W,opening);
  const leftHinge = lerp(line.left,line.left+6,opening);
  const rightHinge = lerp(line.right,line.right-6,opening);
  return [
    [left,lerp(leftHinge-2,0,opening)],
    [right,lerp(rightHinge-2,0,opening)],
    [right,lerp(rightHinge+2,H,opening)],
    [left,lerp(leftHinge+2,H,opening)],
  ];
}

function unfoldProgramme(time) {
  const opening = progress(time,programmeFold.start,programmeFold.end);
  const corners = openFold(opening,imageFrame.x,imageFrame.x+imageFrame.w,definitionCrease);
  ctx.save();
  drawPolygon(corners);
  ctx.clip();
  drawProgramme(time);
  ctx.restore();
  if (opening < 1) {
    // Red ink on the two folding edges ties the closing caption to the prompts.
    ctx.save();
    ctx.strokeStyle = red;
    ctx.globalAlpha = 1 - opening;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(...corners[0]);
    ctx.lineTo(...corners[1]);
    ctx.moveTo(...corners[3]);
    ctx.lineTo(...corners[2]);
    ctx.stroke();
    ctx.restore();
  }
}

function unfoldDateCard(time) {
  const opening = progress(time,dateFold.start,dateFold.end);
  ctx.save();
  drawPolygon(openFold(opening,photoLeft,photoRight,crease));
  ctx.clip();
  ctx.fillStyle = red;
  ctx.fillRect(0,0,W,H);
  drawDates(time);
  ctx.restore();
}

function paint(time) {
  ctx.fillStyle = white;
  ctx.fillRect(0, 0, W, H);
  if (time < pullBack.end) {
    pullBackFromPhoto(time);
  } else if (time < definitionCollapse.end) {
    drawDefinition(time);
  } else if (time < programmeFold.end) {
    unfoldProgramme(time);
  } else if (time < dateFold.end) {
    drawProgramme(time);
  }

  if (time >= dateFold.start) unfoldDateCard(time);
  slider.value = time;
}

let playing = false;
let seconds = reducedMotion ? duration : 0;
let previous = null;
function label() {
  button.textContent = playing ? 'Pause' : seconds === duration ? 'Replay' : 'Play';
}
function tick(now) {
  if (playing) {
    if (previous !== null) seconds = Math.min(duration, seconds + (now - previous) / 1000);
    paint(seconds);
    if (seconds === duration) {
      playing = false;
      label();
    }
  }
  previous = now;
  requestAnimationFrame(tick);
}

button.onclick = () => {
  if (seconds === duration) seconds = 0;
  playing = !playing;
  previous = null;
  label();
};

slider.oninput = () => {
  playing = false;
  seconds = Number(slider.value);
  paint(seconds);
  label();
};

Promise.all(parts.map(image => image.decode())).then(() => {
  button.disabled = false;
  slider.disabled = false;
  paint(reducedMotion ? duration : .70);
  slider.value = seconds;
  label();
  requestAnimationFrame(tick);
});
