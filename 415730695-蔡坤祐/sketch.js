// =========================================================================
// 📌 Google 試算表題庫連線設定
// 請依照以下步驟發布您的 Google 試算表：
// 1. 在 Google 試算表點選「檔案」>「共用」>「發布到網路」
// 2. 格式選擇「逗號分隔值 (.csv)」並點擊「發布」
// 3. 將產生的 CSV 連結複製並貼在下方的 GOOGLE_SHEET_CSV_URL 引號中：
// （若留空，程式會自動使用同層目錄的 questions.csv 或內建題庫）
// =========================================================================
const GOOGLE_SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSMZxV_TaEF_2TDl1vCicHUPImAUfoRW5qW1aXcLioRUM39qTkK6FhbavlVxbA1oie0vv1Yqla4NCG4/pub?output=csv"; 

// =========================================================================
// 系統核心設定
// =========================================================================
const FONT_FAMILY = 'Noto Sans TC';
const QUIZ_COUNT = 5; // 每次測驗隨機抽取的題目數量

// 預設內建題庫（確保任何環境下開啟都 100% 有畫面，絕不白屏）
const DEFAULT_QUESTIONS = [
  {
    question: "在 p5.js 中，哪一個函式在程式一啟動時只會執行一次？",
    options: ["draw()", "setup()", "preload()", "createCanvas()"],
    answer: 1,
    explanation: "setup() 函式會在程式啟動時執行且僅執行一次，常用於初始化畫布與變數。"
  },
  {
    question: "想要在 p5.js 畫布中繪製一個正圓應該使用哪個函式？",
    options: ["rect()", "circle()", "triangle()", "line()"],
    answer: 1,
    explanation: "circle() 可直接繪製正圓，ellipse() 則可用於繪製橢圓。"
  },
  {
    question: "JavaScript 中宣告一個不能被重新賦值的常數關鍵字是什麼？",
    options: ["var", "let", "const", "static"],
    answer: 2,
    explanation: "const 用來宣告常數（不可被重新賦值），let 則可用於可變變數。"
  },
  {
    question: "在網頁技術中負責定義內容結構與骨架的是哪一個？",
    options: ["HTML", "CSS", "JavaScript", "SQL"],
    answer: 0,
    explanation: "HTML 負責內容骨架，CSS 負責外觀樣式，JavaScript 負責動態行為。"
  },
  {
    question: "若陣列為 arr = [10, 20, 30]，在 JavaScript 中 arr[2] 的值是多少？",
    options: ["10", "20", "30", "undefined"],
    answer: 2,
    explanation: "JavaScript 陣列索引由 0 開始，arr[0]=10、arr[1]=20、arr[2]=30。"
  }
];

let allQuestions = [...DEFAULT_QUESTIONS];
let quizQuestions = []; // 每次隨機抽出的 5 題
let dataStatus = 'loading'; // 'loading', 'sheet_success', 'local_success', 'default'
let statusMessage = '正在連線題庫...';

// 遊戲狀態: 'START', 'QUIZ', 'RESULT'
let gameState = 'START';
let currentQuestionIndex = 0;
let score = 0;
let selectedOption = -1;
let isAnswered = false;
let lastActionTime = 0;

// 互動按鈕座標快取
let optionButtons = [];
let nextBtn = { x: 0, y: 0, w: 0, h: 0 };
let restartBtn = { x: 0, y: 0, w: 0, h: 0 };
let startBtn = { x: 0, y: 0, w: 0, h: 0 };

function setup() {
  let canvas = createCanvas(windowWidth, windowHeight);
  canvas.parent('quiz-container');

  textFont(FONT_FAMILY);

  // Google Fonts 字型載入就緒監聽
  if (document.fonts) {
    document.fonts.ready.then(() => {
      textFont(FONT_FAMILY);
    });
  }

  // 先以預設題庫抽題，保證畫面第一秒立刻呈現
  resetQuiz();

  // 讀取題庫（優先連線 Google 試算表，失敗則讀取本機 CSV 或預設）
  loadQuizDatabase();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

// ==========================================
// 題庫載入邏輯 (Google 試算表 -> 本地 CSV -> 預設題庫)
// ==========================================
function loadQuizDatabase() {
  // 1. 若有設定 Google 試算表網址，優先連線 Google 試算表
  if (GOOGLE_SHEET_CSV_URL && GOOGLE_SHEET_CSV_URL.trim() !== '') {
    // 加上時間戳防止瀏覽器快取舊資料，老師一改試算表立刻同步
    let cacheBusterUrl = GOOGLE_SHEET_CSV_URL.trim() + 
      (GOOGLE_SHEET_CSV_URL.includes('?') ? '&' : '?') + 'nocache=' + Date.now();

    statusMessage = '正在連線 Google 試算表...';
    loadTable(cacheBusterUrl, 'csv', 'header',
      (table) => {
        let loaded = parseTableToQuestions(table);
        if (loaded.length > 0) {
          allQuestions = loaded;
          dataStatus = 'sheet_success';
          statusMessage = `已連線 Google 試算表（共 ${allQuestions.length} 題，即時同步）`;
          console.log('Google 試算表題庫連線成功！共', allQuestions.length, '題');
          if (gameState === 'START') pickRandomQuestions();
        } else {
          tryLoadLocalCsv();
        }
      },
      (err) => {
        console.warn('Google 試算表連線失敗，改嘗試讀取本地 CSV：', err);
        tryLoadLocalCsv();
      }
    );
  } else {
    // 2. 未設定 Google 試算表網址，讀取本地 CSV
    tryLoadLocalCsv();
  }
}

// 嘗試載入本地 CSV
function tryLoadLocalCsv() {
  statusMessage = '讀取本地題庫中...';
  loadTable('questions.csv', 'csv', 'header',
    (table) => {
      let loaded = parseTableToQuestions(table);
      if (loaded.length > 0) {
        allQuestions = loaded;
        dataStatus = 'local_success';
        statusMessage = `已載入 questions.csv（共 ${allQuestions.length} 題）`;
        if (gameState === 'START') pickRandomQuestions();
      } else {
        fallbackToDefault();
      }
    },
    () => {
      // 嘗試單數 question.csv
      loadTable('question.csv', 'csv', 'header',
        (table) => {
          let loaded = parseTableToQuestions(table);
          if (loaded.length > 0) {
            allQuestions = loaded;
            dataStatus = 'local_success';
            statusMessage = `已載入 question.csv（共 ${allQuestions.length} 題）`;
            if (gameState === 'START') pickRandomQuestions();
          } else {
            fallbackToDefault();
          }
        },
        () => {
          fallbackToDefault();
        }
      );
    }
  );
}

function fallbackToDefault() {
  dataStatus = 'default';
  statusMessage = '使用內建題庫（請設定 Google 試算表或本地 CSV）';
}

// 解析表格物件為題目結構
function parseTableToQuestions(table) {
  let result = [];
  if (!table || table.getRowCount() === 0) return result;

  for (let r = 0; r < table.getRowCount(); r++) {
    let row = table.getRow(r);
    let qText = row.getString('question');
    let opA = row.getString('optionA');
    let opB = row.getString('optionB');
    let opC = row.getString('optionC');
    let opD = row.getString('optionD');
    let ansRaw = row.getString('answer');
    let exp = row.getString('explanation') || '';

    if (qText && opA && opB && opC && opD) {
      result.push({
        question: qText.trim(),
        options: [opA.trim(), opB.trim(), opC.trim(), opD.trim()],
        answer: parseAnswerIndex(ansRaw),
        explanation: exp.trim()
      });
    }
  }
  return result;
}

// 解析答案（相容 A/B/C/D 與 0/1/2/3 格式）
function parseAnswerIndex(val) {
  if (!val) return 0;
  let str = String(val).trim().toUpperCase();
  if (str === 'A' || str === '0') return 0;
  if (str === 'B' || str === '1') return 1;
  if (str === 'C' || str === '2') return 2;
  if (str === 'D' || str === '3') return 3;
  let num = parseInt(str, 10);
  return isNaN(num) ? 0 : num;
}

// Fisher-Yates 隨機抽取 5 題
function pickRandomQuestions() {
  if (allQuestions.length === 0) return;

  let pool = [...allQuestions];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  let count = Math.min(QUIZ_COUNT, pool.length);
  quizQuestions = pool.slice(0, count);
}

function resetQuiz() {
  gameState = 'START';
  currentQuestionIndex = 0;
  score = 0;
  selectedOption = -1;
  isAnswered = false;
  pickRandomQuestions();
}

function startQuiz() {
  gameState = 'QUIZ';
  currentQuestionIndex = 0;
  score = 0;
  selectedOption = -1;
  isAnswered = false;
  lastActionTime = millis();
  pickRandomQuestions();
}

function draw() {
  background(15, 23, 42); // 深藍灰底色

  let isMobile = width < 640;
  let isLandscapeShort = height < 520 && width >= 540;

  let isHoveringInteractive = false;

  if (gameState === 'START') {
    isHoveringInteractive = drawStartScreen(isMobile, isLandscapeShort);
  } else if (gameState === 'QUIZ') {
    isHoveringInteractive = drawQuizScreen(isMobile, isLandscapeShort);
  } else if (gameState === 'RESULT') {
    isHoveringInteractive = drawResultScreen(isMobile, isLandscapeShort);
  }

  cursor(isHoveringInteractive ? HAND : ARROW);
}

// ==========================================
// 1. 開始畫面繪製
// ==========================================
function drawStartScreen(isMobile, isLandscapeShort) {
  let cardW = min(width * 0.92, 640);
  let cardH = isLandscapeShort ? min(height * 0.92, 340) : min(height * 0.88, 510);
  let cardX = (width - cardW) / 2;
  let cardY = (height - cardH) / 2;

  fill(30, 41, 59);
  stroke(51, 65, 85);
  strokeWeight(1.5);
  rect(cardX, cardY, cardW, cardH, isMobile ? 14 : 20);

  noStroke();
  textAlign(CENTER, CENTER);
  textFont(FONT_FAMILY);

  let targetCount = Math.min(QUIZ_COUNT, allQuestions.length);

  // 狀態指示燈顏色
  let statusColor = color(148, 163, 184);
  if (dataStatus === 'sheet_success') statusColor = color(52, 211, 153); // 亮綠色
  else if (dataStatus === 'local_success') statusColor = color(56, 189, 248); // 天藍色

  if (isLandscapeShort) {
    fill(56, 189, 248);
    textSize(24);
    textStyle(BOLD);
    text("💡 互動知識測驗", width / 2, cardY + 32);

    fill(statusColor);
    textSize(12);
    textStyle(NORMAL);
    text(`🌐 題庫：${statusMessage}`, width / 2, cardY + 60);

    fill(203, 213, 225);
    textSize(13);
    text(`題庫共 ${allQuestions.length} 題 • 每次隨機抽 ${targetCount} 題 • 支援鍵盤快速鍵`, width / 2, cardY + 84);

    let btnW = min(cardW * 0.5, 200);
    let btnH = 42;
    startBtn = { x: (width - btnW) / 2, y: cardY + cardH - 58, w: btnW, h: btnH };
  } else {
    let titleY = cardY + (isMobile ? 44 : 62);
    fill(56, 189, 248);
    textSize(isMobile ? 26 : 38);
    textStyle(BOLD);
    text("💡 互動知識測驗", width / 2, titleY);

    fill(203, 213, 225);
    textSize(isMobile ? 14 : 16);
    textStyle(NORMAL);
    text("測試你的程式與網頁基礎觀念！", width / 2, titleY + (isMobile ? 32 : 40));

    // 規則卡片
    let boxW = cardW * 0.86;
    let boxH = isMobile ? 120 : 130;
    let boxY = titleY + (isMobile ? 60 : 70);
    fill(15, 23, 42, 190);
    rect((width - boxW) / 2, boxY, boxW, boxH, 10);

    fill(148, 163, 184);
    textSize(isMobile ? 12 : 14);
    textAlign(LEFT, CENTER);
    let boxPadding = (width - boxW) / 2 + (isMobile ? 16 : 24);
    let lineSpacing = isMobile ? 26 : 29;
    let lineStartY = boxY + (isMobile ? 20 : 24);

    text(`• 題庫數量：共 ${allQuestions.length} 題，每次隨機抽 ${targetCount} 題`, boxPadding, lineStartY);
    text("• 每題作答後即時顯示正確解答與說明", boxPadding, lineStartY + lineSpacing);
    text("• 支援觸控點選或鍵盤快速鍵（1~4 / A~D）", boxPadding, lineStartY + lineSpacing * 2);

    // 顯示連線狀態
    fill(statusColor);
    textSize(isMobile ? 11 : 12);
    text(`• 雲端同步：${statusMessage}`, boxPadding, lineStartY + lineSpacing * 3);

    // 開始按鈕
    let btnW = min(cardW * 0.65, 220);
    let btnH = isMobile ? 48 : 52;
    startBtn = { x: (width - btnW) / 2, y: cardY + cardH - (isMobile ? 60 : 70), w: btnW, h: btnH };
  }

  let hover = isMouseInside(startBtn.x, startBtn.y, startBtn.w, startBtn.h);
  fill(hover ? color(14, 165, 233) : color(2, 132, 199));
  rect(startBtn.x, startBtn.y, startBtn.w, startBtn.h, startBtn.h / 2);

  fill(255);
  textAlign(CENTER, CENTER);
  textSize(isMobile ? 17 : 19);
  textStyle(BOLD);
  text("開始測驗 🚀", width / 2, startBtn.y + startBtn.h / 2);

  return hover;
}

// ==========================================
// 2. 題目測驗畫面繪製 (隨機抽題)
// ==========================================
function drawQuizScreen(isMobile, isLandscapeShort) {
  if (quizQuestions.length === 0) return false;
  let q = quizQuestions[currentQuestionIndex];
  let isHovering = false;

  let cardW = min(width * 0.94, 760);
  let cardX = (width - cardW) / 2;

  textFont(FONT_FAMILY);

  // 頂部進度條
  let topY = isLandscapeShort ? 12 : (isMobile ? 18 : 26);
  noStroke();
  fill(148, 163, 184);
  textSize(isMobile ? 13 : 15);
  textStyle(NORMAL);
  textAlign(LEFT, CENTER);
  text(`第 ${currentQuestionIndex + 1} / ${quizQuestions.length} 題`, cardX, topY);

  textAlign(RIGHT, CENTER);
  fill(56, 189, 248);
  textStyle(BOLD);
  text(`得分：${score} / ${currentQuestionIndex + (isAnswered ? 1 : 0)}`, cardX + cardW, topY);

  let barH = isLandscapeShort ? 5 : 7;
  let barY = topY + 14;
  fill(30, 41, 59);
  rect(cardX, barY, cardW, barH, barH / 2);

  let progressWidth = map(currentQuestionIndex + 1, 0, quizQuestions.length, 0, cardW);
  fill(14, 165, 233);
  rect(cardX, barY, progressWidth, barH, barH / 2);

  // 題目卡片
  let qCardY = barY + (isLandscapeShort ? 12 : (isMobile ? 14 : 20));
  let qCardH = isLandscapeShort ? 58 : (isMobile ? 74 : 84);

  fill(30, 41, 59);
  stroke(51, 65, 85);
  strokeWeight(1.5);
  rect(cardX, qCardY, cardW, qCardH, 12);

  noStroke();
  fill(248, 250, 252);
  textSize(isLandscapeShort ? 15 : (isMobile ? 15 : 18));
  textStyle(BOLD);
  textAlign(LEFT, CENTER);
  let displayQuestion = `${currentQuestionIndex + 1}. ${q.question}`;
  text(displayQuestion, cardX + 16, qCardY + 10, cardW - 32, qCardH - 20);

  // 選項按鈕排版 (橫向矮螢幕 2x2 Grid，其餘 1x4 垂直排)
  optionButtons = [];
  const optionLetters = ["A", "B", "C", "D"];
  let startOptionsY = qCardY + qCardH + (isLandscapeShort ? 10 : (isMobile ? 12 : 16));

  if (isLandscapeShort) {
    const gridGapX = 12;
    const gridGapY = 8;
    const btnW = (cardW - gridGapX) / 2;
    const btnH = 40;

    for (let i = 0; i < 4; i++) {
      let col = i % 2;
      let row = Math.floor(i / 2);
      let btnX = cardX + col * (btnW + gridGapX);
      let btnY = startOptionsY + row * (btnH + gridGapY);

      optionButtons.push({ x: btnX, y: btnY, w: btnW, h: btnH, index: i });
      let hover = renderOptionButton(q, i, btnX, btnY, btnW, btnH, optionLetters[i], true);
      if (hover) isHovering = true;
    }
  } else {
    const btnH = isMobile ? 48 : 52;
    const btnGap = isMobile ? 9 : 12;

    for (let i = 0; i < 4; i++) {
      let btnX = cardX;
      let btnY = startOptionsY + i * (btnH + btnGap);
      let btnW = cardW;

      optionButtons.push({ x: btnX, y: btnY, w: btnW, h: btnH, index: i });
      let hover = renderOptionButton(q, i, btnX, btnY, btnW, btnH, optionLetters[i], false);
      if (hover) isHovering = true;
    }
  }

  // 底部回饋與按鈕區域
  let bottomStartY = 0;
  if (isLandscapeShort) {
    bottomStartY = startOptionsY + 40 * 2 + 8 + 8;
  } else {
    let btnH = isMobile ? 48 : 52;
    let btnGap = isMobile ? 9 : 12;
    bottomStartY = startOptionsY + 4 * (btnH + btnGap) + 6;
  }

  let isLast = currentQuestionIndex === quizQuestions.length - 1;
  let btnText = isLast ? "查看結果 ➔" : "下一題 ➔";

  if (isAnswered) {
    let isCorrect = (selectedOption === q.answer);

    if (isLandscapeShort) {
      let nextW = 160;
      let nextH = 38;
      nextBtn = { x: cardX + cardW - nextW, y: bottomStartY, w: nextW, h: nextH };

      fill(isCorrect ? color(110, 231, 183) : color(252, 165, 165));
      textSize(14);
      textAlign(LEFT, CENTER);
      textStyle(BOLD);
      text(isCorrect ? "✔ 答對了！" : "✘ 答錯囉！", cardX, bottomStartY + nextH / 2);

      fill(148, 163, 184);
      textStyle(NORMAL);
      textSize(12);
      text(q.explanation || "", cardX + 90, bottomStartY, cardW - nextW - 100, nextH);
    } else {
      if (isMobile) {
        fill(isCorrect ? color(110, 231, 183) : color(252, 165, 165));
        textSize(15);
        textAlign(CENTER, TOP);
        textStyle(BOLD);
        text(isCorrect ? "🎉 答對了！" : "💡 答錯囉！", width / 2, bottomStartY);

        fill(148, 163, 184);
        textStyle(NORMAL);
        textSize(13);
        text(q.explanation || "", cardX + 10, bottomStartY + 24, cardW - 20, 38);

        let nextH = 46;
        nextBtn = { x: cardX, y: bottomStartY + 68, w: cardW, h: nextH };
      } else {
        fill(isCorrect ? color(110, 231, 183) : color(252, 165, 165));
        textSize(15);
        textAlign(LEFT, CENTER);
        textStyle(BOLD);
        text(isCorrect ? "🎉 答對了！" : "💡 答錯囉！", cardX, bottomStartY + 20);

        fill(148, 163, 184);
        textStyle(NORMAL);
        textSize(13);
        text(q.explanation || "", cardX + 90, bottomStartY + 2, cardW - 280, 42);

        let nextW = 180;
        let nextH = 46;
        nextBtn = { x: cardX + cardW - nextW, y: bottomStartY, w: nextW, h: nextH };
      }
    }

    let hoverNext = isMouseInside(nextBtn.x, nextBtn.y, nextBtn.w, nextBtn.h);
    if (hoverNext) isHovering = true;

    fill(hoverNext ? color(14, 165, 233) : color(2, 132, 199));
    noStroke();
    rect(nextBtn.x, nextBtn.y, nextBtn.w, nextBtn.h, nextBtn.h / 2);

    fill(255);
    textSize(isLandscapeShort || isMobile ? 15 : 16);
    textStyle(BOLD);
    textAlign(CENTER, CENTER);
    text(btnText, nextBtn.x + nextBtn.w / 2, nextBtn.y + nextBtn.h / 2);
  } else {
    if (!isLandscapeShort) {
      fill(100, 116, 139);
      textSize(isMobile ? 12 : 13);
      textStyle(NORMAL);
      textAlign(CENTER, CENTER);
      text("請點選上方選項或按鍵盤 1~4 / A~D 作答", width / 2, bottomStartY + (isMobile ? 16 : 24));
    }
  }

  return isHovering;
}

function renderOptionButton(q, i, btnX, btnY, btnW, btnH, letter, isCompact) {
  let hover = !isAnswered && isMouseInside(btnX, btnY, btnW, btnH);

  let bgColor = color(30, 41, 59);
  let borderColor = color(51, 65, 85);
  let badgeColor = color(51, 65, 85);
  let textColor = color(226, 232, 240);
  let statusText = "";

  if (!isAnswered) {
    if (hover) {
      bgColor = color(51, 65, 85);
      borderColor = color(56, 189, 248);
      badgeColor = color(14, 165, 233);
    }
  } else {
    if (i === q.answer) {
      bgColor = color(16, 185, 129, 36);
      borderColor = color(16, 185, 129);
      badgeColor = color(16, 185, 129);
      textColor = color(110, 231, 183);
      statusText = "✔ 正確";
    } else if (i === selectedOption) {
      bgColor = color(239, 68, 68, 36);
      borderColor = color(239, 68, 68);
      badgeColor = color(239, 68, 68);
      textColor = color(252, 165, 165);
      statusText = "✘ 你的選擇";
    } else {
      bgColor = color(24, 32, 47, 140);
      borderColor = color(40, 50, 68);
      textColor = color(100, 116, 139);
    }
  }

  stroke(borderColor);
  strokeWeight(1.5);
  fill(bgColor);
  rect(btnX, btnY, btnW, btnH, 10);

  let badgeSize = isCompact ? 26 : 30;
  let badgePad = isCompact ? 7 : 10;
  noStroke();
  fill(badgeColor);
  rect(btnX + badgePad, btnY + (btnH - badgeSize) / 2, badgeSize, badgeSize, 6);

  fill(255);
  textSize(isCompact ? 13 : 14);
  textStyle(BOLD);
  textAlign(CENTER, CENTER);
  text(letter, btnX + badgePad + badgeSize / 2, btnY + btnH / 2);

  fill(textColor);
  textSize(isCompact ? 14 : 15);
  textStyle(NORMAL);
  textAlign(LEFT, CENTER);
  let textLeft = btnX + badgePad + badgeSize + 10;
  let textMaxW = isCompact ? (btnW - textLeft + btnX - 60) : (btnW - textLeft + btnX - (statusText !== "" ? 85 : 20));
  text(q.options[i], textLeft, btnY + btnH / 2, textMaxW);

  if (statusText !== "") {
    textAlign(RIGHT, CENTER);
    textSize(isCompact ? 12 : 13);
    textStyle(BOLD);
    text(statusText, btnX + btnW - 12, btnY + btnH / 2);
  }

  return hover;
}

// ==========================================
// 3. 結算結果畫面繪製
// ==========================================
function drawResultScreen(isMobile, isLandscapeShort) {
  let cardW = min(width * 0.92, 580);
  let cardH = isLandscapeShort ? min(height * 0.9, 330) : min(height * 0.84, 460);
  let cardX = (width - cardW) / 2;
  let cardY = (height - cardH) / 2;

  fill(30, 41, 59);
  stroke(51, 65, 85);
  strokeWeight(1.5);
  rect(cardX, cardY, cardW, cardH, isMobile ? 16 : 20);

  noStroke();
  textAlign(CENTER, CENTER);
  textFont(FONT_FAMILY);

  let totalQuestions = quizQuestions.length;
  let totalScore = totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : 0;
  let badgeColor = totalScore >= 80 ? color(16, 185, 129) : (totalScore >= 60 ? color(234, 179, 8) : color(239, 68, 68));

  let comment = "";
  if (totalScore === 100) comment = "🌟 滿分！太出色了，全部正確！";
  else if (totalScore >= 80) comment = "👏 優秀！觀念相當紮實！";
  else if (totalScore >= 60) comment = "👍 及格！還有一些進步空間，繼續加油！";
  else comment = "💪 別氣餒！再測驗一次一定能拿高分！";

  if (isLandscapeShort) {
    fill(248, 250, 252);
    textSize(22);
    textStyle(BOLD);
    text("測驗結束！", width / 2, cardY + 32);

    fill(badgeColor);
    textSize(50);
    textStyle(BOLD);
    text(`${totalScore}`, width / 2 - 80, cardY + 95);

    fill(148, 163, 184);
    textSize(13);
    textStyle(NORMAL);
    text("滿分 100 分", width / 2 - 80, cardY + 130);

    fill(15, 23, 42);
    rect(width / 2 + 10, cardY + 65, cardW * 0.44, 75, 10);

    fill(226, 232, 240);
    textSize(15);
    textAlign(CENTER, CENTER);
    text(`答對：${score} / ${totalQuestions} 題`, width / 2 + 10 + cardW * 0.22, cardY + 90);

    fill(badgeColor);
    textSize(13);
    textStyle(BOLD);
    text(comment, width / 2 + 10 + cardW * 0.22, cardY + 115);

    let btnW = min(cardW * 0.5, 200);
    let btnH = 42;
    restartBtn = { x: (width - btnW) / 2, y: cardY + cardH - 58, w: btnW, h: btnH };
  } else {
    let titleY = cardY + (isMobile ? 40 : 55);
    fill(248, 250, 252);
    textSize(isMobile ? 26 : 32);
    textStyle(BOLD);
    text("測驗結束！", width / 2, titleY);

    let scoreY = titleY + (isMobile ? 65 : 85);
    fill(badgeColor);
    textSize(isMobile ? 58 : 72);
    textStyle(BOLD);
    text(`${totalScore}`, width / 2, scoreY);

    fill(148, 163, 184);
    textSize(isMobile ? 14 : 16);
    textStyle(NORMAL);
    text("滿分 100 分", width / 2, scoreY + (isMobile ? 44 : 52));

    let statW = cardW * 0.82;
    let statH = isMobile ? 68 : 76;
    let statY = scoreY + (isMobile ? 70 : 85);
    fill(15, 23, 42);
    rect((width - statW) / 2, statY, statW, statH, 12);

    fill(226, 232, 240);
    textSize(16);
    textAlign(CENTER, CENTER);
    text(`答對題數：${score} / ${totalQuestions} 題`, width / 2, statY + (isMobile ? 22 : 25));

    fill(badgeColor);
    textSize(13);
    textStyle(BOLD);
    text(comment, width / 2, statY + (isMobile ? 48 : 52));

    let btnW = min(cardW * 0.65, 200);
    let btnH = isMobile ? 48 : 50;
    restartBtn = { x: (width - btnW) / 2, y: cardY + cardH - (isMobile ? 65 : 75), w: btnW, h: btnH };
  }

  let hover = isMouseInside(restartBtn.x, restartBtn.y, restartBtn.w, restartBtn.h);
  fill(hover ? color(14, 165, 233) : color(2, 132, 199));
  rect(restartBtn.x, restartBtn.y, restartBtn.w, restartBtn.h, restartBtn.h / 2);

  fill(255);
  textSize(isMobile ? 16 : 18);
  textStyle(BOLD);
  textAlign(CENTER, CENTER);
  text("重新抽題測驗 🔄", width / 2, restartBtn.y + restartBtn.h / 2);

  return hover;
}

// ==========================================
// 互動判斷與事件處理
// ==========================================
function isMouseInside(x, y, w, h) {
  return mouseX >= x && mouseX <= x + w && mouseY >= y && mouseY <= y + h;
}

function mousePressed() {
  if (millis() - lastActionTime < 100) return;

  if (gameState === 'START') {
    if (isMouseInside(startBtn.x, startBtn.y, startBtn.w, startBtn.h)) {
      startQuiz();
    }
  } else if (gameState === 'QUIZ') {
    if (!isAnswered) {
      for (let btn of optionButtons) {
        if (isMouseInside(btn.x, btn.y, btn.w, btn.h)) {
          handleSelectOption(btn.index);
          break;
        }
      }
    } else {
      if (isMouseInside(nextBtn.x, nextBtn.y, nextBtn.w, nextBtn.h)) {
        goToNextQuestion();
      }
    }
  } else if (gameState === 'RESULT') {
    if (isMouseInside(restartBtn.x, restartBtn.y, restartBtn.w, restartBtn.h)) {
      // 重新測驗時若連線 Google 試算表，再次檢查有無新題目
      if (GOOGLE_SHEET_CSV_URL && GOOGLE_SHEET_CSV_URL.trim() !== '') {
        loadQuizDatabase();
      }
      startQuiz();
    }
  }
}

function handleSelectOption(index) {
  if (isAnswered) return;

  selectedOption = index;
  isAnswered = true;
  lastActionTime = millis();

  if (selectedOption === quizQuestions[currentQuestionIndex].answer) {
    score++;
  }
}

function goToNextQuestion() {
  lastActionTime = millis();
  if (currentQuestionIndex < quizQuestions.length - 1) {
    currentQuestionIndex++;
    selectedOption = -1;
    isAnswered = false;
  } else {
    gameState = 'RESULT';
  }
}

function keyPressed() {
  if (gameState === 'START') {
    if (keyCode === ENTER || key === ' ') {
      startQuiz();
    }
  } else if (gameState === 'QUIZ') {
    if (!isAnswered) {
      if (key === '1' || key === 'a' || key === 'A') handleSelectOption(0);
      else if (key === '2' || key === 'b' || key === 'B') handleSelectOption(1);
      else if (key === '3' || key === 'c' || key === 'C') handleSelectOption(2);
      else if (key === '4' || key === 'd' || key === 'D') handleSelectOption(3);
    } else {
      if (keyCode === ENTER || key === ' ') {
        goToNextQuestion();
      }
    }
  } else if (gameState === 'RESULT') {
    if (keyCode === ENTER || key === ' ') {
      if (GOOGLE_SHEET_CSV_URL && GOOGLE_SHEET_CSV_URL.trim() !== '') {
        loadQuizDatabase();
      }
      startQuiz();
    }
  }
}