const map = L.map("map").setView([35.68, 139.76], 13);
L.tileLayer("https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png", {
  attribution: '<a href= "https://maps.gsi.go.jp/development/ichiran.html">地理院タイル</a>',
}).addTo(map);

let geojsonLayer = null;
let streetQuestions = [];
let crossQuestions = [];
let currentQuestions = [];
let score = 0;
let totalQuestions = 0; 
let wrongAnswers = [];
let currentHighlightedLayer = null;
let currentQuizType = null; 
let selectedQuizInitialData = null; 
let filteredQuestionsByDiff = []; 

// DOM要素
const quizSelectionDiv = document.getElementById("quiz-selection");
const mainSelectionDiv = document.getElementById("main-selection");
const subSelectionDiv = document.getElementById("sub-quiz-selection");
const difficultySelectionDiv = document.getElementById("difficulty-selection"); 
const countSelectionDiv = document.getElementById("question-count-selection");
const totalQuestionsDisplay = document.getElementById("total-questions-display");

const selectStreetBtn = document.getElementById("select-street");
const selectCrossBtn = document.getElementById("select-cross");
const selectCrossNameBtn = document.getElementById("select-cross-name");
const selectCrossStreetBtn = document.getElementById("select-cross-street");

const selectDiffBeginner = document.getElementById("select-diff-beginner"); 
const selectDiffIntermediate = document.getElementById("select-diff-intermediate"); 
const selectDiffAdvanced = document.getElementById("select-diff-advanced"); 

const backToMainFromSubBtn = document.getElementById("back-to-main-from-sub");
const backToMainFromQuizBtn = document.getElementById("back-to-main-from-quiz");
const backToPrevFromDiffBtn = document.getElementById("back-to-prev-from-diff"); 
const backToSubFromCountBtn = document.getElementById("back-to-sub-from-count");

// ★変数名をIDと一致させるように修正
const selectCount15 = document.getElementById("select-count-15");
const selectCount30 = document.getElementById("select-count-30");
const selectCountAll = document.getElementById("select-count-all");

const quizTitle = document.getElementById("quiz-title");
const currentScoreSpan = document.getElementById("current-score");
const totalQuestionsSpan = document.getElementById("total-questions");
const resultDisplay = document.getElementById("result-display");
const submitBtn = document.getElementById("submit");
const reviewBtn = document.getElementById("review");

// --- ヘルパー関数 ---

function getStreetName(feature) {
  return feature.properties.name;
}

function getCrossName(feature) {
  return feature.properties["交差点名"];
}

const defaultStreetStyle = {
  color: "#6ed5b1",
  weight: 2,
  opacity: 0.8,
  interactive: true,
};

const streetQuizBaseStyle = {
  color: "blue",
  weight: 3,
  opacity: 1,
  interactive: false,
};

function setStreetLayerStyle(style) {
  if (geojsonLayer) {
    geojsonLayer.eachLayer((layer) => {
      layer.setStyle(style);
      layer.options.interactive = style.interactive;
    });
    geojsonLayer.bringToBack();
  }
}

function resetQuizState() {
  score = 0;
  totalQuestions = 0;
  wrongAnswers = [];
  currentQuestions = [];
  currentQuizType = null;
  selectedQuizInitialData = null;
  filteredQuestionsByDiff = [];

  currentScoreSpan.textContent = "0";
  totalQuestionsSpan.textContent = "0";
  resultDisplay.textContent = "";
  document.getElementById("feedback").textContent = "";
  document.getElementById("question").textContent = "";
  document.getElementById("answer").innerHTML = '<option value="">選択してください</option>';
  submitBtn.disabled = true;
  reviewBtn.disabled = true;
}

function showMainSelection() {
  resetQuizState();
  quizSelectionDiv.classList.remove("hidden");
  mainSelectionDiv.classList.remove("hidden");
  subSelectionDiv.classList.add("hidden");
  difficultySelectionDiv.classList.add("hidden");
  countSelectionDiv.classList.add("hidden");
}

function showSubSelection() {
  mainSelectionDiv.classList.add("hidden");
  subSelectionDiv.classList.remove("hidden");
  difficultySelectionDiv.classList.add("hidden");
}

function showDifficultySelection(initialData) {
  selectedQuizInitialData = initialData;
  mainSelectionDiv.classList.add("hidden");
  subSelectionDiv.classList.add("hidden");
  difficultySelectionDiv.classList.remove("hidden");
  countSelectionDiv.classList.add("hidden");
}

// ★難易度フィルタリングの修正
function applyDifficultyFilter(difficulty) {
  let allowedRanks = [];
  // 指示通りのランク設定に変更
  if (difficulty === 'beginner') allowedRanks = [1];
  else if (difficulty === 'intermediate') allowedRanks = [1, 2];
  else if (difficulty === 'advanced') allowedRanks = [2, 3];

  filteredQuestionsByDiff = selectedQuizInitialData.filter(f => {
    if (!f.properties || !f.properties.rank) return false;
    // ★Number() で確実に数値として比較する
    return allowedRanks.includes(Number(f.properties.rank));
  });

  if (filteredQuestionsByDiff.length === 0) {
    alert("該当する難易度の問題が見つかりませんでした。(ランクを確認してください)");
    return;
  }

  showCountSelection(filteredQuestionsByDiff);
}

function showCountSelection(data) {
  difficultySelectionDiv.classList.add("hidden");
  countSelectionDiv.classList.remove("hidden");

  const count = data.length;
  totalQuestionsDisplay.textContent = count;

  // ボタンの有効/無効化
  selectCount15.disabled = count < 15;
  selectCount30.disabled = count < 30;
}

function displayResult() {
  const percentage = totalQuestions > 0 ? ((score / totalQuestions) * 100).toFixed(1) : 0;
  resultDisplay.textContent = `正答率: ${percentage}%`;
  submitBtn.disabled = true;
  reviewBtn.disabled = wrongAnswers.length === 0;
}

function loadInitialData() {
  fetch("street_ver2.geojson")
    .then((res) => res.json())
    .then((data) => {
      geojsonLayer = L.geoJSON(data, {
        style: defaultStreetStyle,
        onEachFeature: (feature, layer) => {
          // rankが1〜4のものを取り込み
          if (feature.properties.rank && [1, 2, 3, 4].includes(Number(feature.properties.rank))) {
            streetQuestions.push(feature);
          }
          if (feature.properties.name) {
            layer.bindPopup(feature.properties.name);
          }
        },
      }).addTo(map);
      selectStreetBtn.textContent = `通り名クイズ (対象:${streetQuestions.length}件)`;
    });

  fetch("intersection_pro.geojson")
    .then((res) => res.json())
    .then((data) => {
      crossQuestions = data.features.filter(
        (f) => f.properties && f.properties["交差点名"] && f.properties.rank
      );
      selectCrossBtn.textContent = `交差点クイズ (対象:${crossQuestions.length}件)`;
    });
}

// --- クイズロジック ---

function startQuiz(questionsToUse, count) {
  if (currentQuizType === "street") {
    setStreetLayerStyle(streetQuizBaseStyle);
  } else {
    setStreetLayerStyle(defaultStreetStyle);
  }

  score = 0;
  wrongAnswers = [];
  const questionCount = count === "all" ? questionsToUse.length : count;
  totalQuestions = questionCount;

  let shuffled = [...questionsToUse];
  shuffleArray(shuffled);
  currentQuestions = shuffled.slice(0, questionCount);

  quizSelectionDiv.classList.add("hidden");
  currentScoreSpan.textContent = "0";
  totalQuestionsSpan.textContent = totalQuestions;
  resultDisplay.textContent = "";
  document.getElementById("feedback").textContent = "";
  submitBtn.disabled = false;
  reviewBtn.disabled = true;

  nextQuestion();
}

function nextQuestion() {
  if (currentHighlightedLayer) {
    geojsonLayer.resetStyle(currentHighlightedLayer);
    currentHighlightedLayer = null;
  }
  map.eachLayer((layer) => {
    if (layer.options && layer.options.isQuizMarker) {
      map.removeLayer(layer);
    }
  });

  if (currentQuestions.length === 0) {
    document.getElementById("question").textContent = "クイズ終了！";
    displayResult();
    return;
  }

  currentQuestion = currentQuestions.pop();
  let questionText = `第${totalQuestions - currentQuestions.length}問：`;

  if (currentQuizType === "street") {
    questionText += "この通りはどこ？";
    geojsonLayer.eachLayer((layer) => {
      if (layer.feature === currentQuestion) {
        currentHighlightedLayer = layer;
        layer.setStyle({ color: "red", weight: 6, interactive: false });
        map.fitBounds(layer.getBounds(), { maxZoom: 16 });
      }
    });
  } else if (currentQuizType === "cross_name") {
    questionText += "この交差点はどこ？";
    const coords = currentQuestion.geometry.coordinates;
    L.marker([coords[1], coords[0]], { isQuizMarker: true }).addTo(map);
    map.setView([coords[1], coords[0]], 16);
  } else if (currentQuizType === "cross_street") {
    const s1 = currentQuestion.properties.Street1;
    const s2 = currentQuestion.properties.street2;
    questionText += `「${s1}」と「${s2}」の交差点名は？`;
    const coords = currentQuestion.geometry.coordinates;
    map.setView([coords[1], coords[0]], 16);
  }

  document.getElementById("question").textContent = questionText;

  const allPool = currentQuizType === "street" ? streetQuestions : crossQuestions;
  const options = generateOptions(currentQuestion, allPool, currentQuizType);
  
  const select = document.getElementById("answer");
  select.innerHTML = '<option value="">選択してください</option>';
  options.forEach((opt) => {
    const option = document.createElement("option");
    option.value = opt;
    option.textContent = opt;
    select.appendChild(option);
  });
}

submitBtn.addEventListener("click", () => {
  const answer = document.getElementById("answer").value;
  if (!answer) return;

  const correct = currentQuizType === "street" ? getStreetName(currentQuestion) : getCrossName(currentQuestion);

  if (answer === correct) {
    score++;
    document.getElementById("feedback").textContent = "正解！";
  } else {
    wrongAnswers.push({ feature: currentQuestion, type: currentQuizType });
    document.getElementById("feedback").textContent = `不正解！正解は ${correct}`;
  }

  currentScoreSpan.textContent = score;
  setTimeout(nextQuestion, 600);
});

reviewBtn.addEventListener("click", () => {
  const reviewSet = wrongAnswers.map((wa) => wa.feature);
  const type = wrongAnswers[0].type;
  currentQuizType = type;
  quizTitle.textContent += " (復習)";
  startQuiz(reviewSet, "all");
});

function generateOptions(correctFeature, allFeatures, type) {
  const getName = type === "street" ? getStreetName : getCrossName;
  const correctName = getName(correctFeature);
  const names = [correctName];

  while (names.length < 4) {
    const randomName = getName(allFeatures[Math.floor(Math.random() * allFeatures.length)]);
    if (randomName && !names.includes(randomName)) names.push(randomName);
  }
  shuffleArray(names);
  return names;
}

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

// --- イベントリスナー ---

selectStreetBtn.addEventListener("click", () => {
  currentQuizType = "street";
  quizTitle.textContent = "通り名クイズ";
  showDifficultySelection(streetQuestions);
});

selectCrossBtn.addEventListener("click", showSubSelection);

selectCrossNameBtn.addEventListener("click", () => {
  currentQuizType = "cross_name";
  quizTitle.textContent = "交差点クイズ (位置から名称)";
  showDifficultySelection(crossQuestions);
});

selectCrossStreetBtn.addEventListener("click", () => {
  currentQuizType = "cross_street";
  quizTitle.textContent = "交差点クイズ (交差する通りから名称)";
  showDifficultySelection(crossQuestions);
});

selectDiffBeginner.addEventListener("click", () => applyDifficultyFilter('beginner'));
selectDiffIntermediate.addEventListener("click", () => applyDifficultyFilter('intermediate'));
selectDiffAdvanced.addEventListener("click", () => applyDifficultyFilter('advanced'));

backToPrevFromDiffBtn.addEventListener("click", () => {
  if (currentQuizType === "street") showMainSelection();
  else showSubSelection();
});

backToSubFromCountBtn.addEventListener("click", () => {
  countSelectionDiv.classList.add("hidden");
  difficultySelectionDiv.classList.remove("hidden");
});

backToMainFromSubBtn.addEventListener("click", showMainSelection);
backToMainFromQuizBtn.addEventListener("click", showMainSelection);

// ★IDと引数を修正
selectCount15.addEventListener("click", () => startQuiz(filteredQuestionsByDiff, 15));
selectCount30.addEventListener("click", () => startQuiz(filteredQuestionsByDiff, 30));
selectCountAll.addEventListener("click", () => startQuiz(filteredQuestionsByDiff, "all"));

loadInitialData();