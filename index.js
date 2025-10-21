const map = L.map("map").setView([35.68, 139.76], 13);
L.tileLayer("https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png", {
  attribution: "地理院タイル",
}).addTo(map);

let geojsonLayer = null;
let streetQuestions = [];
let crossQuestions = [];
let currentQuestions = [];
let score = 0;
let totalQuestions = 0; // 全問題数
let wrongAnswers = [];
let currentHighlightedLayer = null;
let currentQuizType = null; // 'street', 'cross_name', 'cross_street' のいずれか
let selectedQuizInitialData = null; // 選択されたクイズの全データ (streetQuestions または crossQuestions)

// DOM要素
const quizSelectionDiv = document.getElementById("quiz-selection");
const mainSelectionDiv = document.getElementById("main-selection");
const subSelectionDiv = document.getElementById("sub-quiz-selection");
const countSelectionDiv = document.getElementById("question-count-selection");
const totalQuestionsDisplay = document.getElementById(
  "total-questions-display"
);

const selectStreetBtn = document.getElementById("select-street");
const selectCrossBtn = document.getElementById("select-cross");
const selectCrossNameBtn = document.getElementById("select-cross-name");
const selectCrossStreetBtn = document.getElementById("select-cross-street");
const backToMainFromSubBtn = document.getElementById("back-to-main-from-sub");
const backToMainFromQuizBtn = document.getElementById("back-to-main-from-quiz");
const backToSubFromCountBtn = document.getElementById("back-to-sub-from-count");

const selectCount30 = document.getElementById("select-count-30");
const selectCount50 = document.getElementById("select-count-50");
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

function getStreetIntersectionName(feature) {
  return feature.properties["交差点名"];
}

const defaultStreetStyle = {
  color: "#87ceeb", // スカイブルー
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

  // UIリセット
  currentScoreSpan.textContent = "0";
  totalQuestionsSpan.textContent = "0";
  resultDisplay.textContent = "";
  document.getElementById("feedback").textContent = "";
  document.getElementById("question").textContent = "";
  document.getElementById("answer").innerHTML =
    '<option value="">選択してください</option>';
  submitBtn.disabled = true;
  reviewBtn.disabled = true;
}

function showMainSelection() {
  resetQuizState();
  quizSelectionDiv.classList.remove("hidden");
  mainSelectionDiv.classList.remove("hidden");
  subSelectionDiv.classList.add("hidden");
  countSelectionDiv.classList.add("hidden");
}

function showSubSelection() {
  mainSelectionDiv.classList.add("hidden");
  subSelectionDiv.classList.remove("hidden");
}

function showCountSelection(initialData) {
  selectedQuizInitialData = initialData;

  mainSelectionDiv.classList.add("hidden");
  subSelectionDiv.classList.add("hidden");
  countSelectionDiv.classList.remove("hidden");

  const count = initialData.length;
  totalQuestionsDisplay.textContent = count;

  // 問題数が足りない場合のボタン無効化
  selectCount30.disabled = count < 30;
  selectCount50.disabled = count < 50;
}

function displayResult() {
  const percentage =
    totalQuestions > 0 ? ((score / totalQuestions) * 100).toFixed(1) : 0;
  resultDisplay.textContent = `正答率: ${percentage}%`;
  submitBtn.disabled = true;
  reviewBtn.disabled = wrongAnswers.length === 0;
}

function loadInitialData() {
  // GeoJSON読み込み（通り名: street.geojson）
  fetch("street.geojson")
    .then((res) => res.json())
    .then((data) => {
      geojsonLayer = L.geoJSON(data, {
        style: defaultStreetStyle,
        onEachFeature: (feature, layer) => {
          if (
            feature.properties.rank &&
            [1, 2].includes(feature.properties.rank)
          ) {
            streetQuestions.push(feature);
          }
          if (feature.properties.name) {
            layer.bindPopup(feature.properties.name);
          }
          layer.on("click", () => {
            if (currentQuizType && currentQuizType !== "street") {
              layer.openPopup();
            }
          });
        },
      }).addTo(map);
      geojsonLayer.bringToBack();
      selectStreetBtn.textContent = `通り名クイズ (全${streetQuestions.length}問)`;
    })
    .catch((error) => {
      console.error("Error loading street.geojson:", error);
      selectStreetBtn.disabled = true;
      selectStreetBtn.textContent = "通り名クイズ (ファイルが見つかりません)";
    });

  // GeoJSON読み込み（交差点: intersection_pro.geojson）
  fetch("intersection_pro.geojson")
    .then((res) => res.json())
    .then((data) => {
      crossQuestions = data.features.filter(
        (f) =>
          f.properties &&
          f.properties["交差点名"] &&
          f.properties.Street1 &&
          f.properties.street2
      );
      selectCrossBtn.textContent = `交差点クイズ (全${crossQuestions.length}問)`;
    })
    .catch((error) => {
      console.error("Error loading intersection_pro.geojson:", error);
      selectCrossBtn.disabled = true;
      selectCrossBtn.textContent = "交差点クイズ (ファイルが見つかりません)";
    });
}

// --- クイズロジック関数 ---

function startQuiz(initialQuestions, count) {
  // スタイル設定
  if (currentQuizType === "cross_name" || currentQuizType === "cross_street") {
    setStreetLayerStyle(defaultStreetStyle);
  } else if (currentQuizType === "street") {
    setStreetLayerStyle(streetQuizBaseStyle);
  }

  score = 0;
  wrongAnswers = [];

  const questionCount = count === "all" ? initialQuestions.length : count;
  totalQuestions = questionCount;

  // 問題のシャッフルとカット
  let shuffledQuestions = [...initialQuestions];
  shuffleArray(shuffledQuestions);
  currentQuestions = shuffledQuestions.slice(0, questionCount);

  // UIリセット＆更新
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
  // マップ上のハイライトやマーカーをリセット
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
    displayResult(); // 正答率を表示
    return;
  }

  currentQuestion = currentQuestions.pop();
  let questionText;

  // 問題文の生成とマップ描画
  if (currentQuizType === "street") {
    questionText = `第${
      totalQuestions - currentQuestions.length
    }問：この通りはどこ？`;
    // 通り名クイズ: ハイライト
    geojsonLayer.eachLayer((layer) => {
      if (layer.feature === currentQuestion) {
        currentHighlightedLayer = layer;
        layer.setStyle({ color: "red", weight: 6, interactive: false });
        map.fitBounds(layer.getBounds(), { maxZoom: 16 });
      }
    });
  } else if (currentQuizType === "cross_name") {
    questionText = `第${
      totalQuestions - currentQuestions.length
    }問：この交差点はどこ？`;
    // 交差点名クイズ (位置): マーカー表示
    const coords = currentQuestion.geometry.coordinates;
    const marker = L.marker([coords[1], coords[0]], {
      isQuizMarker: true,
    }).addTo(map);
    map.setView([coords[1], coords[0]], 16);
  } else if (currentQuizType === "cross_street") {
    // 通り名から交差点名クイズ: マーカーは表示せず、中心にズームのみ
    const s1 = currentQuestion.properties.Street1;
    const s2 = currentQuestion.properties.street2;
    questionText = `第${
      totalQuestions - currentQuestions.length
    }問：「${s1}」と「${s2}」の交差点名は？`;
    const coords = currentQuestion.geometry.coordinates;
    map.setView([coords[1], coords[0]], 16);
  }

  document.getElementById("question").textContent = questionText;

  // 選択肢の生成
  const allFeatures =
    currentQuizType === "street" ? streetQuestions : crossQuestions;
  const options = generateOptions(
    currentQuestion,
    allFeatures,
    currentQuizType
  );
  const select = document.getElementById("answer");
  select.innerHTML = '<option value="">選択してください</option>';
  options.forEach((opt) => {
    const option = document.createElement("option");
    option.value = opt;
    option.textContent = opt;
    select.appendChild(option);
  });
  select.value = "";
}

// 回答チェック
submitBtn.addEventListener("click", () => {
  const answer = document.getElementById("answer").value;
  if (!answer) return;

  let getCorrectName;
  if (currentQuizType === "street") {
    getCorrectName = getStreetName;
  } else if (currentQuizType === "cross_name") {
    getCorrectName = getCrossName;
  } else if (currentQuizType === "cross_street") {
    getCorrectName = getStreetIntersectionName;
  }

  const correct = getCorrectName(currentQuestion);

  if (answer === correct) {
    score++;
    document.getElementById("feedback").textContent = "正解！";
  } else {
    wrongAnswers.push({
      feature: currentQuestion,
      type: currentQuizType,
    });
    document.getElementById(
      "feedback"
    ).textContent = `不正解！正解は ${correct}`;
  }

  currentScoreSpan.textContent = score;

  // 次の問題へ
  setTimeout(nextQuestion, 500); // 0.5秒のディレイ
});

// 間違えた問題を復習
reviewBtn.addEventListener("click", () => {
  if (wrongAnswers.length === 0) {
    alert("間違えた問題はありません");
    return;
  }

  const reviewSet = wrongAnswers.map((wa) => wa.feature);
  const reviewType = wrongAnswers[0].type;

  // 復習用のスコアをリセット
  score = 0;
  wrongAnswers = []; // 復習中に間違えた問題は次回復習に回す
  currentQuizType = reviewType;

  let reviewTitleText;
  if (reviewType === "street") {
    reviewTitleText = "通り名クイズ（復習）";
  } else if (reviewType === "cross_name") {
    reviewTitleText = "交差点名クイズ (位置から交差点名)（復習）";
  } else if (reviewType === "cross_street") {
    reviewTitleText = "交差点名クイズ (通り名から交差点名)（復習）";
  }
  quizTitle.textContent = reviewTitleText;

  // 復習モード開始
  startQuiz(reviewSet, "all");
});

// 選択肢シャッフル
function generateOptions(correctFeature, allFeatures, type) {
  let getName;
  if (type === "street") {
    getName = getStreetName;
  } else if (type === "cross_name") {
    getName = getCrossName;
  } else if (type === "cross_street") {
    getName = getStreetIntersectionName;
  }

  const correctName = getName(correctFeature);
  const names = [correctName];

  // 選択肢を生成（最大4つ）
  while (names.length < 4) {
    const randomIndex = Math.floor(Math.random() * allFeatures.length);
    const randomFeature = allFeatures[randomIndex];
    const randomName = getName(randomFeature);

    if (randomName && !names.includes(randomName)) {
      names.push(randomName);
    }
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

// --- イベントリスナー（選択画面） ---

// メイン選択 -> 通り名クイズ
selectStreetBtn.addEventListener("click", () => {
  if (streetQuestions.length === 0) return;
  currentQuizType = "street";
  quizTitle.textContent = "通り名クイズ";
  showCountSelection(streetQuestions);
  document.getElementById("back-to-sub-from-count").classList.add("hidden"); // 通り名クイズはサブメニューがないため非表示
});

// メイン選択 -> 交差点クイズ (サブ選択へ移行)
selectCrossBtn.addEventListener("click", () => {
  if (crossQuestions.length === 0) return;
  showSubSelection();
});

// サブ選択 -> 交差点名から位置を当てる
selectCrossNameBtn.addEventListener("click", () => {
  currentQuizType = "cross_name";
  quizTitle.textContent = "交差点名クイズ (交差点名から位置)";
  showCountSelection(crossQuestions);
  document.getElementById("back-to-sub-from-count").classList.remove("hidden"); // サブメニューに戻るボタンを表示
});

// サブ選択 -> 通り名から交差点名を当てる
selectCrossStreetBtn.addEventListener("click", () => {
  currentQuizType = "cross_street";
  quizTitle.textContent = "交差点名クイズ (通り名から交差点名)";
  showCountSelection(crossQuestions);
  document.getElementById("back-to-sub-from-count").classList.remove("hidden"); // サブメニューに戻るボタンを表示
});

// メインメニューに戻る
backToMainFromSubBtn.addEventListener("click", showMainSelection);
backToMainFromQuizBtn.addEventListener("click", showMainSelection);

// 問題数選択から戻る
backToSubFromCountBtn.addEventListener("click", () => {
  if (currentQuizType === "street") {
    // 通り名クイズの場合はメインに戻る
    showMainSelection();
  } else {
    // 交差点クイズの場合はサブメニューに戻る
    countSelectionDiv.classList.add("hidden");
    subSelectionDiv.classList.remove("hidden");
  }
});

// 問題数選択 -> クイズ開始
selectCount30.addEventListener("click", () =>
  startQuiz(selectedQuizInitialData, 30)
);
selectCount50.addEventListener("click", () =>
  startQuiz(selectedQuizInitialData, 50)
);
selectCountAll.addEventListener("click", () =>
  startQuiz(selectedQuizInitialData, "all")
);

// データの読み込み
loadInitialData();
