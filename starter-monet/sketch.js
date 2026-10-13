// =====================================================================
//  《睡莲》— 起始文件
//  PART A（下面）是手势识别引擎，不要修改。
//  PART B 已经写好了大部分，只留下 5 个 ★ 标记的函数，
//  每一步让 Qwen 写其中一个，替换掉 ★ 标记之间的临时版本。
// =====================================================================


// ---------------------------------------------------------------------
//  PART A — 手势识别引擎（三个项目完全相同，不要修改）
// ---------------------------------------------------------------------
const MP_VERSION = "0.10.21";
// MediaPipe 的两个下载来源：先用国内镜像 npmmirror，失败再用 jsDelivr
const MP_URLS = [
  `https://registry.npmmirror.com/@mediapipe/tasks-vision/${MP_VERSION}/files`,
  `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}`,
];
// 手势模型：先找项目文件夹里的 gesture_recognizer.task，
// 没有的话再从 Google 下载（中国大陆通常无法访问 Google）
const MODEL_URLS = [
  "gesture_recognizer.task",
  "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task",
];

// 模型认识的 8 种手势（英文名是模型给出的名字，中文名用来显示）
const GESTURE_NAMES = {
  None: "无",
  Closed_Fist: "握拳 ✊",
  Open_Palm: "张开手掌 🖐",
  Pointing_Up: "食指向上 ☝️",
  Thumb_Down: "拇指向下 👎",
  Thumb_Up: "拇指向上 👍",
  Victory: "剪刀手 ✌️",
  ILoveYou: "我爱你 🤟",
};

let video;                 // 摄像头画面（p5 capture）
let recognizer = null;     // MediaPipe 手势识别模型
let hands = [];            // 每一帧：看到的所有手（0、1 或 2 只）。每只手是一个对象：
                           //   hand.gesture — 手势名，例如 "Open_Palm"（见上面的 GESTURE_NAMES）
                           //   hand.score   — 把握程度，0 到 1（1 = 非常确定）
                           //   hand.points  — 21 个点 {x, y}，画布像素坐标，已经镜像
                           //   hand.side    — "Left" 或 "Right"
let lastVideoTime = -1;
let started = false;
let showCamera = false;

async function loadGestureRecognizer() {
  setStatus("正在加载手势模型…");
  for (const base of MP_URLS) {
    let vision, fileset;
    try {
      vision = await import(`${base}/vision_bundle.mjs`);
      fileset = await vision.FilesetResolver.forVisionTasks(`${base}/wasm`);
    } catch (e) {
      continue; // 这个来源打不开，换下一个
    }
    for (const model of MODEL_URLS) {
      for (const delegate of ["GPU", "CPU"]) { // 有的电脑不能用 GPU，就退回 CPU
        try {
          recognizer = await vision.GestureRecognizer.createFromOptions(fileset, {
            baseOptions: { modelAssetPath: model, delegate },
            runningMode: "VIDEO",
            numHands: 2,
          });
          return; // 成功！
        } catch (e) {
          // 失败就试下一个
        }
      }
    }
  }
  setStatus("⚠️ 手势模型加载失败：请把 gesture_recognizer.task 放进项目文件夹（和 index.html 放在一起），然后刷新页面");
}

// 每一帧调用一次：向 MediaPipe 要最新的手势和关键点，
// 并把 0~1 的数值换算成镜像后的画布像素坐标。
let cameraOk = null;
function updateHands() {
  if (!recognizer || !video) return;

  // 摄像头没有画面时提示用户（没有授权，或者被别的软件占用）
  const ok = video.elt.readyState >= 2;
  if (ok !== cameraOk) {
    cameraOk = ok;
    setStatus(ok ? "把手伸到摄像头前，做一个手势 ✋"
                 : "正在等待摄像头…请点击「允许」，或点击地址栏里的摄像头图标，然后刷新页面");
  }
  if (!ok) return;

  if (video.elt.currentTime === lastVideoTime) return; // 还没有新的画面
  lastVideoTime = video.elt.currentTime;

  const result = recognizer.recognizeForVideo(video.elt, performance.now());
  const sides = result.handedness || result.handednesses || [];
  hands = result.landmarks.map((lm, i) => {
    const best = (result.gestures[i] && result.gestures[i][0]) || { categoryName: "None", score: 0 };
    return {
      gesture: best.categoryName || "None",
      score: best.score,
      side: sides[i] && sides[i][0] ? sides[i][0].categoryName : "",
      points: lm.map((p) => ({ x: (1 - p.x) * width, y: p.y * height, z: p.z })),
    };
  });
}

// 在每只手的手腕旁边写出识别到的手势和把握程度（学习和调试用）
function drawGestureInfo() {
  push();
  textSize(16);
  textAlign(CENTER, TOP);
  for (const hand of hands) {
    const w = hand.points[0];
    const y = min(w.y + 14, height - 70); // 不要跑到画面外面
    const label = `${GESTURE_NAMES[hand.gesture] || hand.gesture}  ${round(hand.score * 100)}%`;
    noStroke();
    fill(0, 120);
    rect(w.x - textWidth(label) / 2 - 8, y, textWidth(label) + 16, 26, 6);
    fill(255);
    text(label, w.x, y + 4);
  }
  pop();
}

function drawCamera() {
  push();
  translate(width, 0);
  scale(-1, 1); // 镜像，像照镜子一样
  tint(255, 70);
  image(video, 0, 0, width, height);
  pop();
}

function setStatus(msg) {
  select("#status").html(msg);
}


// ---------------------------------------------------------------------
//  PART B — 作品：《睡莲》（致敬克劳德·莫奈）
// ---------------------------------------------------------------------

// 莫奈喜欢在一天里不同的时间画同一个地方。每个时间有 4 种水的颜色：深、中、浅、高光
const TIMES = [
  { name: "清晨", pal: ["#3d4f7a", "#7a8fb8", "#c9b7d6", "#f4d9c6"], chord: [60, 64, 67, 71] },
  { name: "正午", pal: ["#1f5e5b", "#3f8f7f", "#8cc3a6", "#e8f0c8"], chord: [62, 66, 69, 74] },
  { name: "日落", pal: ["#4b2d55", "#b0536b", "#e89a6b", "#f7d38a"], chord: [57, 60, 64, 67] },
  { name: "夜晚", pal: ["#0e1a33", "#1e3557", "#3e5c7a", "#9fb3c8"], chord: [55, 58, 62, 65] },
];
const MAX_PADS = 15;

let pond;             // 池塘图层：颜色点一层层叠上去
let timeIndex = 0;    // 现在是一天里的哪个时间
let ripples = [];     // 涟漪：{x, y, radius, alpha}
let pads = [];        // 睡莲叶：{x, y, size, angle, flower}
let lastGesture = {};
let showInfo = true;

// 声音
let drop, dropEnv;    // 水滴声
let bloom, bloomEnv;  // 开花的叮声
let chordVoices = []; // 换时间时的和弦：4 个振荡器 + 包络

function setup() {
  createCanvas(windowWidth, windowHeight);
  pond = createGraphics(windowWidth, windowHeight);
  pond.background(TIMES[0].pal[1]);
  select("#start").mouseClicked(startExperience);
}

function startExperience() {
  userStartAudio();

  video = createCapture(VIDEO);
  video.size(640, 480);
  video.hide();

  drop = new p5.Oscillator("sine");
  drop.amp(0);
  drop.start();
  dropEnv = new p5.Envelope();
  dropEnv.setADSR(0.001, 0.15, 0, 0.05);
  dropEnv.setRange(0.4, 0);

  bloom = new p5.Oscillator("triangle");
  bloom.amp(0);
  bloom.start();
  bloomEnv = new p5.Envelope();
  bloomEnv.setADSR(0.005, 0.8, 0, 0.2);
  bloomEnv.setRange(0.25, 0);

  for (let i = 0; i < 4; i++) {
    const osc = new p5.Oscillator("sine");
    osc.amp(0);
    osc.start();
    const env = new p5.Envelope();
    env.setADSR(0.6, 1.0, 0.3, 1.5); // 慢慢出来，慢慢消失
    env.setRange(0.08, 0);
    chordVoices.push({ osc, env });
  }

  select("#intro").hide();
  started = true;
  loadGestureRecognizer();
}

function draw() {
  // 1. 手势：刚刚开始的那一刻触发一次
  if (started) {
    updateHands();
    for (const hand of hands) {
      const g = hand.score >= 0.6 ? hand.gesture : "None";
      if (g === "None") continue;
      if (g !== lastGesture[hand.side]) onGesture(g, hand);
      lastGesture[hand.side] = g;
    }
    if (hands.length === 0) lastGesture = {};
  }

  // 2. 每一帧在池塘上点 250 个颜色点。靠近涟漪的点会亮一些
  const pal = TIMES[timeIndex].pal;
  for (let i = 0; i < 250; i++) {
    const x = random(width);
    const y = random(height);
    let c = waterColor(x, y, pal);
    for (const r of ripples) {
      const d = dist(x, (y - r.y) / 0.7 + r.y, r.x, r.y); // 涟漪是扁的椭圆
      if (abs(d - r.radius) < 8) c = lerpColor(c, color(255), 0.4 * r.alpha / 255);
    }
    dab(pond, x, y, c);
  }

  // 3. 画出池塘、涟漪、睡莲
  image(pond, 0, 0);
  if (started && showCamera) drawCamera();
  for (const r of ripples) drawRipple(r);
  ripples = ripples.filter((r) => r.alpha > 0);
  for (const p of pads) {
    p.x += sin(frameCount * 0.01 + p.angle) * 0.15; // 睡莲叶在水上轻轻漂
    drawLily(p);
  }

  // 4. 左上角写现在的时间；光标和手势信息
  noStroke();
  fill(255, 230);
  textSize(22);
  textAlign(LEFT, TOP);
  text("莫奈的池塘 · " + TIMES[timeIndex].name, 20, 16);
  if (started) {
    for (const hand of hands) {
      fill(255, 200);
      circle(hand.points[8].x, hand.points[8].y, 10);
    }
    if (showInfo) drawGestureInfo();
  }
}

// ★★★★★★ 第 1 步 开始：把这里的 dab 函数整个换成 Qwen 写的版本 ★★★★★★
function dab(g, x, y, col) {
  // 临时版本：一个小方块
  g.noStroke();
  g.fill(col);
  g.rect(x, y, 4, 4);
}
// ★★★★★★ 第 1 步 结束 ★★★★★★

// ★★★★★★ 第 2 步 开始：把这里的 waterColor 函数整个换成 Qwen 写的版本 ★★★★★★
function waterColor(x, y, pal) {
  // 临时版本：整个池塘只有一种颜色
  return color(pal[1]);
}
// ★★★★★★ 第 2 步 结束 ★★★★★★

// ★★★★★★ 第 3 步 开始：把这里的 drawRipple 函数整个换成 Qwen 写的版本 ★★★★★★
function drawRipple(r) {
  // 临时版本：一个普通的圆圈
  noFill();
  stroke(255, r.alpha);
  circle(r.x, r.y, r.radius * 2);
  r.radius += 2;
  r.alpha -= 3;
}
// ★★★★★★ 第 3 步 结束 ★★★★★★

// ★★★★★★ 第 4 步 开始：把这里的 drawLily 函数整个换成 Qwen 写的版本 ★★★★★★
function drawLily(p) {
  // 临时版本：一个绿色的圆
  noStroke();
  fill(60, 120, 70);
  circle(p.x, p.y, p.size * 0.5);
}
// ★★★★★★ 第 4 步 结束 ★★★★★★

// ★★★★★★ 第 5 步 开始：把这里的 onGesture 函数整个换成 Qwen 写的版本 ★★★★★★
function onGesture(g, hand) {
  // 临时版本：还没有手势动作
}
// ★★★★★★ 第 5 步 结束 ★★★★★★

// ---------- 下面这些已经写好了，不需要改 ----------

function playDrop() {
  if (!drop) return;
  const f = random(700, 1100);
  drop.freq(f);
  drop.freq(f * 0.4, 0.12); // 音高快速下降，像水滴
  dropEnv.play(drop);
}

function playBloom() {
  if (!bloom) return;
  bloom.freq(midiToFreq(random([72, 76, 79, 84])));
  bloomEnv.play(bloom);
}

function playTimeChord(i) {
  if (chordVoices.length === 0) return;
  TIMES[i].chord.forEach((m, k) => {
    chordVoices[k].osc.freq(midiToFreq(m));
    chordVoices[k].env.play(chordVoices[k].osc);
  });
}

function keyPressed() {
  if (key === "c" || key === "C") { pads = []; ripples = []; }
  if (key === "s" || key === "S") saveCanvas("my-water-lilies", "png");
  if (key === "v" || key === "V") showCamera = !showCamera;
  if (key === "i" || key === "I") showInfo = !showInfo;
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  pond = createGraphics(windowWidth, windowHeight);
  pond.background(TIMES[timeIndex].pal[1]);
}
