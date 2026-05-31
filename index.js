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
let answerHistory = [];
let currentHighlightedLayer = null;
let currentQuizType = null; 
let selectedQuizInitialData = null; 
let filteredQuestionsByDiff = []; 

// 検索用の変数
let searchMarkers = [];
let searchHighlightedLayer = null;

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

const selectCount15 = document.getElementById("select-count-15");
const selectCount30 = document.getElementById("select-count-30");
const selectCountAll = document.getElementById("select-count-all");

const quizTitle = document.getElementById("quiz-title");
const currentScoreSpan = document.getElementById("current-score");
const totalQuestionsSpan = document.getElementById("total-questions");
const resultDisplay = document.getElementById("result-display");
const submitBtn = document.getElementById("submit");
const reviewBtn = document.getElementById("review");

// 検索用のDOM要素
const searchInput = document.getElementById("search-input");
const searchSubmitBtn = document.getElementById("search-submit-btn");
const searchResultsList = document.getElementById("search-results-list");

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
  color: "#58b5eb",
  weight: 2,
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
  answerHistory = [];
  currentQuestions = [];
  currentQuizType = null;
  selectedQuizInitialData = null;
  filteredQuestionsByDiff = [];

  if (currentScoreSpan) currentScoreSpan.textContent = "0";
  if (totalQuestionsSpan) totalQuestionsSpan.textContent = "0";
  if (resultDisplay) resultDisplay.textContent = "";
  
  const feedbackEl = document.getElementById("feedback");
  if (feedbackEl) feedbackEl.textContent = "";
  
  const questionEl = document.getElementById("question");
  if (questionEl) questionEl.textContent = "";
  
  const answerEl = document.getElementById("answer");
  if (answerEl) {
    answerEl.innerHTML = '<option value="">選択してください</option>';
    answerEl.classList.remove("hidden");
  }
  
  // 表示状態の初期化（隠していたクイズ用要素をすべて元に戻す）
  if (submitBtn) {
    submitBtn.classList.remove("hidden");
    submitBtn.disabled = true;
  }
  if (reviewBtn) {
    reviewBtn.classList.remove("hidden");
    reviewBtn.disabled = true;
  }
  
  // 安全な方法（ID要素の親要素）でスコアエリアを再表示
  const currentScoreEl = document.getElementById("current-score");
  if (currentScoreEl && currentScoreEl.parentElement) {
    currentScoreEl.parentElement.classList.remove("hidden");
  }

  // 検索の描画をクリア
  clearSearchVisuals();
}

function showMainSelection() {
  resetQuizState();
  if (quizSelectionDiv) quizSelectionDiv.classList.remove("hidden");
  if (mainSelectionDiv) mainSelectionDiv.classList.remove("hidden");
  if (subSelectionDiv) subSelectionDiv.classList.add("hidden");
  if (difficultySelectionDiv) difficultySelectionDiv.classList.add("hidden");
  if (countSelectionDiv) countSelectionDiv.classList.add("hidden");

  // 検索窓のリセット
  if (searchInput) searchInput.value = "";
  if (searchResultsList) {
    searchResultsList.innerHTML = "";
    searchResultsList.classList.add("hidden");
  }
}

function showSubSelection() {
  if (mainSelectionDiv) mainSelectionDiv.classList.add("hidden");
  if (subSelectionDiv) subSelectionDiv.classList.remove("hidden");
  if (difficultySelectionDiv) difficultySelectionDiv.classList.add("hidden");
}

function showDifficultySelection(initialData) {
  selectedQuizInitialData = initialData;
  if (mainSelectionDiv) mainSelectionDiv.classList.add("hidden");
  if (subSelectionDiv) subSelectionDiv.classList.add("hidden");
  if (difficultySelectionDiv) difficultySelectionDiv.classList.remove("hidden");
  if (countSelectionDiv) countSelectionDiv.classList.add("hidden");
}

function applyDifficultyFilter(difficulty) {
  let allowedRanks = [];
  if (difficulty === 'beginner') allowedRanks = [1];
  else if (difficulty === 'intermediate') allowedRanks = [1, 2];
  else if (difficulty === 'advanced') allowedRanks = [2, 3];

  filteredQuestionsByDiff = selectedQuizInitialData.filter(f => {
    if (!f.properties || !f.properties.rank) return false;
    return allowedRanks.includes(Number(f.properties.rank));
  });

  if (filteredQuestionsByDiff.length === 0) {
    alert("該当する難易度の問題が見つかりませんでした。");
    return;
  }

  showCountSelection(filteredQuestionsByDiff);
}

function showCountSelection(data) {
  if (difficultySelectionDiv) difficultySelectionDiv.classList.add("hidden");
  if (countSelectionDiv) countSelectionDiv.classList.remove("hidden");

  const count = data.length;
  if (totalQuestionsDisplay) totalQuestionsDisplay.textContent = count;

  if (selectCount15) selectCount15.disabled = count < 15;
  if (selectCount30) selectCount30.disabled = count < 30;
}

function displayResult() {
  const percentage = totalQuestions > 0 ? ((score / totalQuestions) * 100).toFixed(1) : 0;
  if (resultDisplay) resultDisplay.textContent = `正答率: ${percentage}%`;
  if (submitBtn) submitBtn.disabled = true;
  if (reviewBtn) reviewBtn.disabled = wrongAnswers.length === 0;
}

function loadInitialData() {
  fetch("street_ver2.geojson")
    .then((res) => res.json())
    .then((data) => {
      geojsonLayer = L.geoJSON(data, {
        style: defaultStreetStyle,
        onEachFeature: (feature, layer) => {
          if (feature.properties.rank && [1, 2, 3, 4].includes(Number(feature.properties.rank))) {
            streetQuestions.push(feature);
          }
          if (feature.properties.name) {
            layer.bindPopup(feature.properties.name);
          }
        },
      }).addTo(map);
    });

  fetch("intersection_pro.geojson")
    .then((res) => res.json())
    .then((data) => {
      crossQuestions = data.features.filter(
        (f) => f.properties && f.properties["交差点名"] && f.properties.rank
      );
    });
}

// --- クイズロジック ---

function startQuiz(questionsToUse, count) {
  clearSearchVisuals(); 
  
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

  if (quizSelectionDiv) quizSelectionDiv.classList.add("hidden");
  if (currentScoreSpan) currentScoreSpan.textContent = "0";
  if (totalQuestionsSpan) totalQuestionsSpan.textContent = totalQuestions;
  if (resultDisplay) resultDisplay.textContent = "";
  
  const feedbackEl = document.getElementById("feedback");
  if (feedbackEl) feedbackEl.textContent = "";
  
  if (submitBtn) submitBtn.disabled = false;
  if (reviewBtn) reviewBtn.disabled = true;

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

  const questionEl = document.getElementById("question");

  if (currentQuestions.length === 0) {
    if (questionEl) questionEl.textContent = "クイズ終了！";
    showResultsSummary(); // 結果一覧を表示する関数を呼ぶ
    return;
  }

  if (submitBtn) submitBtn.disabled = false;
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

  if (questionEl) questionEl.textContent = questionText;

  const allPool = currentQuizType === "street" ? streetQuestions : crossQuestions;
  const options = generateOptions(currentQuestion, allPool, currentQuizType);
  
  const select = document.getElementById("answer");
  if (select) {
    select.innerHTML = '<option value="">選択してください</option>';
    options.forEach((opt) => {
      const option = document.createElement("option");
      option.value = opt;
      option.textContent = opt;
      select.appendChild(option);
    });
  }
}

function showResultsSummary() {
  const modal = document.getElementById("results-modal");
  const list = document.getElementById("results-list");
  list.innerHTML = `
    <h2 class="results-header">
      結果発表: ${score} / ${totalQuestions} 問正解
    </h2>
  `;
  // 各問題の結果をリスト化
  answerHistory.forEach((record, index) => {
    const item = document.createElement("div");
    item.className = "result-item"; // CSSクラスを適用

    const leftDiv = document.createElement("div");
    
    if (record.isCorrect) {
      // 正解の場合
      leftDiv.innerHTML = `
        <div class="result-correct-title">〇 第${index + 1}問</div>
        <div class="result-correct-text">正解: <b>${record.correctAnswer}</b></div>
      `;
    } else {
      // 不正解の場合
      leftDiv.innerHTML = `
        <div class="result-wrong-title">× 第${index + 1}問</div>
        <div class="result-wrong-answer">あなたの回答: ${record.userAnswer}</div>
        <div class="result-wrong-correct">正解: ${record.correctAnswer}</div>
      `;
    }
    item.appendChild(leftDiv);

    // 不正解の時だけ「地図で確認」ボタンを右側に配置
    if (!record.isCorrect) {
      const rightDiv = document.createElement("div");
      const reviewBtn = document.createElement("button");
      reviewBtn.textContent = "地図で確認";
      reviewBtn.className = "review-map-btn"; // CSSクラスを適用
      
      reviewBtn.onclick = () => reviewSpecificQuestion(index);
      
      rightDiv.appendChild(reviewBtn);
      item.appendChild(rightDiv);
    }

    list.appendChild(item);
  });

  modal.classList.remove("hidden");
}

function reviewSpecificQuestion(index) {
  const record = answerHistory[index];
  // 1. ホーム画面には戻さず、モーダル（結果一覧）だけを一時的に隠す
  document.getElementById("results-modal").classList.add("hidden");

  // 2. 地図上の以前のハイライトやピンを消去して初期化
  clearSearchVisuals();
  if (currentHighlightedLayer) {
    geojsonLayer.resetStyle(currentHighlightedLayer);
    currentHighlightedLayer = null;
  }
  map.eachLayer((layer) => {
    if (layer.options && layer.options.isQuizMarker) {
      map.removeLayer(layer);
    }
  });

  // 3. 画面上のテキストを「復習モード」に書き換える
  const questionEl = document.getElementById("question");
  if (questionEl) {
    questionEl.innerHTML = `
      <div class="review-mode-user">あなたの回答: ${record.userAnswer}</div>
      <div class="review-mode-correct"><b>正解: ${record.correctAnswer}</b></div>
    `;
  }

  // クイズ用の回答セレクトボックスと送信ボタンを隠す
  const answerEl = document.getElementById("answer");
  if (answerEl) answerEl.classList.add("hidden");
  if (submitBtn) submitBtn.classList.add("hidden");

  // 4. 「結果一覧に戻る」ボタンを動的に追加（ユーザーが迷子にならないため）
  let backBtn = document.getElementById("back-to-results-btn");
  if (!backBtn) {
    backBtn = document.createElement("button");
    backBtn.id = "back-to-results-btn";
    backBtn.textContent = "結果一覧に戻る";
    backBtn.className = "back-to-results-btn"; // CSSクラスを適用
    
    backBtn.addEventListener("click", () => {
      document.getElementById("results-modal").classList.remove("hidden");
      backBtn.style.display = "none";
    });
    
    if (questionEl && questionEl.parentElement) {
      questionEl.parentElement.appendChild(backBtn);
    }
  }
  backBtn.style.display = "inline-block";

  // 5. 地図に正解の場所を描画（検索機能と同じロジックを流用）
  const type = record.type;
  const feature = record.feature;

  if (type === "street") {
    setStreetLayerStyle(streetQuizBaseStyle);
    geojsonLayer.eachLayer((layer) => {
      if (layer.feature === feature) {
        searchHighlightedLayer = layer;
        layer.setStyle({ color: "orange", weight: 6, interactive: true });
        map.fitBounds(layer.getBounds(), { maxZoom: 16 });
        layer.bindPopup(`<b>${record.correctAnswer}</b>`).openPopup();
        // 道路上の交差点も表示する
        showIntersectionsOnStreet(record.correctAnswer);
      }
    });
  } else {
    // 交差点の場合
    setStreetLayerStyle(defaultStreetStyle);
    const coords = feature.geometry.coordinates;
    const props = feature.properties || {};
    const s1 = props.Street1 || props.street1 || "不明";
    const s2 = props.street2 || props.street2 || "不明";
    
    const marker = L.marker([coords[1], coords[0]]).addTo(map)
      .bindPopup(`<b>${record.correctAnswer}</b><br><small>交差: ${s1} × ${s2}</small>`)
      .openPopup();
      
    searchMarkers.push(marker);
    map.setView([coords[1], coords[0]], 16);
  }
}

function closeResultsModal() {
  document.getElementById("results-modal").classList.add("hidden");
  showMainSelection(); // メイン画面へ戻る
}

if (submitBtn) {
  submitBtn.addEventListener("click", () => {
    const answerEl = document.getElementById("answer");
    if (!answerEl || !answerEl.value) return;
    submitBtn.disabled = true;
    const answer = answerEl.value;
    const correct = currentQuizType === "street" ? getStreetName(currentQuestion) : getCrossName(currentQuestion);
    
    // 正解かどうかの判定
    const isCorrect = (answer === correct);

    // ★全回答履歴として保存
    const record = {
      feature: currentQuestion,
      type: currentQuizType,
      userAnswer: answer,
      correctAnswer: correct,
      isCorrect: isCorrect
    };
    answerHistory.push(record);

    // 結果表示用要素を取得
    const overlay = document.getElementById("quiz-result-overlay");
    const resultText = document.getElementById("quiz-result-text");
    const correctText = document.getElementById("quiz-correct-answer");

    if (isCorrect) {
      score++;
      resultText.textContent = "〇 正解！";
      resultText.style.color = "red";
      correctText.textContent = ""; 
    } else {
      wrongAnswers.push(record); // 復習モード用に不正解だけ別枠でも保存
      resultText.textContent = "× 不正解…";
      resultText.style.color = "blue";
      correctText.textContent = `正解: ${correct}`;
    }

    overlay.classList.remove("hidden");
    if (currentScoreSpan) currentScoreSpan.textContent = score;

    setTimeout(() => {
      overlay.classList.add("hidden");
      nextQuestion();
    }, 1500);
  });
}

if (reviewBtn) {
  reviewBtn.addEventListener("click", () => {
    const reviewSet = wrongAnswers.map((wa) => wa.feature);
    const type = wrongAnswers[0].type;
    currentQuizType = type;
    if (quizTitle) quizTitle.textContent += " (復習)";
    startQuiz(reviewSet, "all");
  });
}

// --- 距離計算関数（ハバーシン公式） ---
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // 地球の半径（メートル）
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// --- 修正版：距離ベースで選択肢を生成する関数 ---
function generateOptions(correctFeature, allFeatures, type) {
  const getName = type === "street" ? getStreetName : getCrossName;
  const correctName = getName(correctFeature);
  
  // 基準となる座標を取得（GeoJSONの座標は [経度, 緯度] の順）
  const cCoords = correctFeature.geometry.coordinates;
  const cLon = cCoords[0];
  const cLat = cCoords[1];

  // 全データから距離を計算してリスト化
  let featuresWithDist = allFeatures.map(f => {
    const coords = f.geometry.coordinates;
    return {
      name: getName(f),
      dist: getDistance(cLat, cLon, coords[1], coords[0])
    };
  });

  // 1. 自分自身（距離0）を除外
  // 2. 距離が近い順に並び替え
  featuresWithDist = featuresWithDist
    .filter(item => item.name !== correctName && item.name)
    .sort((a, b) => a.dist - b.dist);

  // 3. 近い上位7件からランダムに3つ選ぶことで、程よい難易度を作る
  const candidates = featuresWithDist.slice(0, 7);
  const names = [correctName];

  while (names.length < 4 && candidates.length > 0) {
    const randomIndex = Math.floor(Math.random() * candidates.length);
    const selected = candidates.splice(randomIndex, 1)[0];
    names.push(selected.name);
  }

  // もし候補が足りない場合は残りの全データから補完
  if (names.length < 4) {
    allFeatures.forEach(f => {
      const name = getName(f);
      if (name && !names.includes(name) && names.length < 4) {
        names.push(name);
      }
    });
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

// 自由検索ロジック
function performSearch() {
  const query = searchInput.value.trim();
  searchResultsList.innerHTML = "";
  if (!query) {
    searchResultsList.classList.add("hidden");
    return;
  }

  const results = [];

  // 道路データの検索
  streetQuestions.forEach((f) => {
    const name = getStreetName(f);
    if (name && name.includes(query)) {
      const relatedCross = crossQuestions
        .filter(c => {
          const props = c.properties || {};
          // Street1 または street2 のどちらか（大文字小文字問わず）をチェック
          const s1 = (props.Street1 || props.street1 || "").toString();
          const s2 = (props.Street2 || props.street2 || "").toString();
          return s1.includes(name) || s2.includes(name);
        })
        .map(c => c.properties["交差点名"])
        .slice(0, 3); // 3つまで抽出
      
      results.push({ type: "street", name: name, feature: f, crossings: relatedCross });
    }
  });

  // 交差点データの検索
  crossQuestions.forEach((f) => {
    const name = getCrossName(f);
    if (name && name.includes(query)) {
      results.push({ type: "cross", name: name, feature: f });
    }
  });

  if (results.length === 0) {
    searchResultsList.innerHTML = '<div class="search-item" style="color: #888; cursor: default;">該当なし</div>';
    searchResultsList.classList.remove("hidden");
    return;
  }

  // 検索結果のリスト生成
  results.forEach((res) => {
    const div = document.createElement("div");
    div.className = "search-item";
    // ★概要欄に交差点名を表示するHTMLを作成
    let html = `<div>[${res.type === "street" ? "道路" : "交差点"}] <b>${res.name}</b></div>`;
    if (res.crossings && res.crossings.length > 0) {
      html += `<div style="font-size: 0.8em; color: #555;">主要交差点: ${res.crossings.join(", ")}</div>`;
    }
    div.innerHTML = html;
    div.addEventListener("click", (e) => showSearchResultOnMap(res, e));
    searchResultsList.appendChild(div);
  });

  searchResultsList.classList.remove("hidden");
}

/**
 * 指定した道路名（部分一致）を含む交差点を抽出し、地図上にマーカーを表示する関数。
 * @param {string} streetName - 検索する道路名（部分一致で判定）。
 * @returns {void} - この関数は値を返さず、該当交差点のマーカーを地図上に描画する。
 */
function showIntersectionsOnStreet(streetName) {
  // すでに表示されている検索用マーカーをクリア
  searchMarkers.forEach(m => map.removeLayer(m));
  searchMarkers = [];

  // 交差点データの中から、その道路名を含むものを抽出
  const foundIntersections = crossQuestions.filter(cross => {
    const props = cross.properties || {};
    // s1, s2の取得で、大文字小文字の違いや揺らぎに対応
    const s1 = (props.Street1 || props.Street1 || "").toString();
    const s2 = (props.street2 || props.street2 || "").toString();
    
    // 両方の通り名をチェック
    return s1.includes(streetName) || s2.includes(streetName);
  });

  foundIntersections.forEach(cross => {
    const coords = cross.geometry.coordinates; // [lon, lat]
    const props = cross.properties || {};
    const s1 = props.Street1 || props.street1 || "不明";
    const s2 = props.street2 || props.street2 || "不明";
    
    const marker = L.marker([coords[1], coords[0]], {
      icon: L.divIcon({
        className: 'cross-icon',
        html: '<div style="font-size: 20px;">📌</div>',
        iconSize: [20, 20],
        iconAnchor: [10, 20]
      })
    }).addTo(map)
      .bindPopup(`<h2>${cross.properties["交差点名"]}</h2><br>交差道路: ${cross.properties.Street1 || ""} × ${cross.properties.street2 || ""}`);
    
    searchMarkers.push(marker);
  });
}

// ★検索結果を地図上に表示する（完全遮断＆最優先非表示化）
function showSearchResultOnMap(res, e) {
  // 1. 他の要素へのイベント干渉を完全にブロックする
  if (e) {
    e.stopPropagation();
    e.preventDefault();
  }

  // 2. 何よりもまず最優先でオーバーレイを閉じてマップを見せる
  if (quizSelectionDiv) {
    quizSelectionDiv.classList.add("hidden");
  }

  // 3. その他の初期化処理と描画
  resetQuizState();
  clearSearchVisuals();
  
  if (quizTitle) quizTitle.textContent = res.name;

  // 交差点情報を取得・表示するロジックを追加
  const questionEl = document.getElementById("question");
  if (questionEl) {
    if (res.type === "street") {
      // 道路に関連する交差点を取得
      const relatedCross = crossQuestions
        .filter(c => {
          const props = c.properties || {};
          const s1 = (props.Street1 || props.street1 || "").toString();
          const s2 = (props.Street2 || props.street2 || "").toString();
          return s1.includes(res.name) || s2.includes(res.name);
        })
        .map(c => c.properties["交差点名"]);
      
      const crossText = relatedCross.length > 0 
        ? `<br><small>主要交差点: ${relatedCross.slice(0, 5).join(", ")}${relatedCross.length > 5 ? "..." : ""}</small>` 
        : "";
      
      questionEl.innerHTML = `<b>${res.name}</b> の情報です。${crossText}`;
    } else {
      questionEl.textContent = `交差点「${res.name}」の情報を示しています。`;
    }
  }
  

  
  // クイズ用の不要なUIを確実に隠す
  const answerEl = document.getElementById("answer");
  if (answerEl) answerEl.classList.add("hidden");
  if (submitBtn) submitBtn.classList.add("hidden");
  if (reviewBtn) reviewBtn.classList.add("hidden");

  // スコア表示のpタグ(親要素)を確実に非表示
  const currentScoreEl = document.getElementById("current-score");
  if (currentScoreEl && currentScoreEl.parentElement) {
    currentScoreEl.parentElement.classList.add("hidden");
  }

  if (res.type === "street") {
    setStreetLayerStyle(streetQuizBaseStyle);
    if (geojsonLayer) {
      geojsonLayer.eachLayer((layer) => {
        if (layer.feature === res.feature) {
          searchHighlightedLayer = layer;
          layer.setStyle({ color: "orange", weight: 6, interactive: true });
          map.fitBounds(layer.getBounds(), { maxZoom: 16 });
          layer.bindPopup(res.name).openPopup();
          showIntersectionsOnStreet(res.name);
        }
      });
    }
  } else {
    setStreetLayerStyle(defaultStreetStyle);
    if (res.feature && res.feature.geometry && res.feature.geometry.coordinates) {
      const coords = res.feature.geometry.coordinates;
      const props = res.feature.properties || {};
      const s1 = props.Street1 || props.street1 || "不明";
      const s2 = props.street2 || props.street2 || "不明";
      const marker = L.marker([coords[1], coords[0]]).addTo(map)
        .bindPopup(`<b>${res.name}</b><br><small>交差: ${s1} × ${s2}</small>`)
        .openPopup();
      
      searchMarkers.push(marker);
      map.setView([coords[1], coords[0]], 16);
    }
  }
}

// 検索の描画（ハイライトやピン）を消すヘルパー
function clearSearchVisuals() {
  if (searchHighlightedLayer && geojsonLayer) {
    geojsonLayer.resetStyle(searchHighlightedLayer);
    searchHighlightedLayer = null;
  }
  searchMarkers.forEach((m) => map.removeLayer(m));
  searchMarkers = [];
}

// --- イベントリスナー ---

if (selectStreetBtn) {
  selectStreetBtn.addEventListener("click", () => {
    currentQuizType = "street";
    if (quizTitle) quizTitle.textContent = "通り名クイズ";
    showDifficultySelection(streetQuestions);
  });
}

if (selectCrossBtn) selectCrossBtn.addEventListener("click", showSubSelection);

if (selectCrossNameBtn) {
  selectCrossNameBtn.addEventListener("click", () => {
    currentQuizType = "cross_name";
    if (quizTitle) quizTitle.textContent = "交差点クイズ (位置から名称)";
    showDifficultySelection(crossQuestions);
  });
}

if (selectCrossStreetBtn) {
  selectCrossStreetBtn.addEventListener("click", () => {
    currentQuizType = "cross_street";
    if (quizTitle) quizTitle.textContent = "交差点クイズ (交差する通りから名称)";
    showDifficultySelection(crossQuestions);
  });
}

if (selectDiffBeginner) selectDiffBeginner.addEventListener("click", () => applyDifficultyFilter('beginner'));
if (selectDiffIntermediate) selectDiffIntermediate.addEventListener("click", () => applyDifficultyFilter('intermediate'));
if (selectDiffAdvanced) selectDiffAdvanced.addEventListener("click", () => applyDifficultyFilter('advanced'));

if (backToPrevFromDiffBtn) {
  backToPrevFromDiffBtn.addEventListener("click", () => {
    if (currentQuizType === "street") showMainSelection();
    else showSubSelection();
  });
}

if (backToSubFromCountBtn) {
  backToSubFromCountBtn.addEventListener("click", () => {
    if (countSelectionDiv) countSelectionDiv.classList.add("hidden");
    if (difficultySelectionDiv) difficultySelectionDiv.classList.remove("hidden");
  });
}

if (backToMainFromSubBtn) backToMainFromSubBtn.addEventListener("click", showMainSelection);
if (backToMainFromQuizBtn) backToMainFromQuizBtn.addEventListener("click", showMainSelection);

if (selectCount15) selectCount15.addEventListener("click", () => startQuiz(filteredQuestionsByDiff, 15));
if (selectCount30) selectCount30.addEventListener("click", () => startQuiz(filteredQuestionsByDiff, 30));
if (selectCountAll) selectCountAll.addEventListener("click", () => startQuiz(filteredQuestionsByDiff, "all"));

// 検索用のイベントリスナー
if (searchSubmitBtn) searchSubmitBtn.addEventListener("click", performSearch);
if (searchInput) {
  searchInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") performSearch();
  });
}

loadInitialData();