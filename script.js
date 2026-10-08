/* =========================================================
   ATCH AI STOCK DASHBOARD
   ========================================================= */


/* =========================================================
   GLOBAL
========================================================= */

let latestPrediction = null;
let marketData = [];
let priceChart = null;
let bollingerChart = null;


/* =========================================================
   DOM
========================================================= */

const $ = (id) => document.getElementById(id);


/* =========================================================
   FORMAT
========================================================= */

function number(value, digits = 2) {

    if (value === null || value === undefined || value === "") {
        return null;
    }

    const n = Number(value);

    if (!Number.isFinite(n)) {
        return null;
    }

    return n.toFixed(digits);
}


function percent(value, digits = 2) {

    if (value === null || value === undefined || value === "") {
        return null;
    }

    let n = Number(value);

    if (!Number.isFinite(n)) {
        return null;
    }

    /*
        데이터가 0.05 형태라면
        5%로 변환
    */

    if (Math.abs(n) < 1) {
        n = n * 100;
    }

    return n.toFixed(digits) + "%";
}


function dollar(value, digits = 4) {

    if (value === null || value === undefined || value === "") {
        return null;
    }

    const n = Number(value);

    if (!Number.isFinite(n)) {
        return null;
    }

    return "$" + n.toFixed(digits);
}


function formatVolume(value) {

    const n = Number(value);

    if (!Number.isFinite(n)) {
        return "-";
    }

    if (n >= 1000000000) {
        return (n / 1000000000).toFixed(2) + "B";
    }

    if (n >= 1000000) {
        return (n / 1000000).toFixed(2) + "M";
    }

    if (n >= 1000) {
        return (n / 1000).toFixed(2) + "K";
    }

    return n.toFixed(0);
}


/* =========================================================
   COLUMN FINDER
========================================================= */

function normalizeColumn(name) {

    return String(name)
        .toLowerCase()
        .replace(/[\s_\-\.]/g, "");
}


function findColumn(row, candidates) {

    if (!row) {
        return null;
    }

    const keys = Object.keys(row);

    for (const candidate of candidates) {

        const target = normalizeColumn(candidate);

        const exact = keys.find(
            key => normalizeColumn(key) === target
        );

        if (exact) {
            return exact;
        }
    }


    for (const candidate of candidates) {

        const target = normalizeColumn(candidate);

        const partial = keys.find(
            key => normalizeColumn(key).includes(target)
        );

        if (partial) {
            return partial;
        }
    }

    return null;
}


/* =========================================================
   VALUE FINDER
========================================================= */

function getValue(row, candidates) {

    const column = findColumn(row, candidates);

    if (!column) {
        return null;
    }

    const value = row[column];

    if (value === undefined || value === "") {
        return null;
    }

    const n = Number(value);

    if (!Number.isNaN(n)) {
        return n;
    }

    return value;
}


/* =========================================================
   LOAD JSON
========================================================= */

async function loadPrediction() {

    try {

        const response = await fetch(
            "./data/latest_prediction.json?t=" + Date.now()
        );

        if (!response.ok) {
            throw new Error("latest_prediction.json 로딩 실패");
        }

        latestPrediction = await response.json();

        console.log("Prediction:", latestPrediction);

        updatePrediction();

    } catch (error) {

        console.error(error);

        $("predictionDirection").textContent =
            "데이터 없음";

        $("aiReport").innerHTML =
            "<p>latest_prediction.json을 불러오지 못했습니다.</p>";
    }
}


/* =========================================================
   LOAD CSV
========================================================= */

async function loadCSV() {

    try {

        const response = await fetch(
            "./data/latest_data.csv?t=" + Date.now()
        );

        if (!response.ok) {
            throw new Error("latest_data.csv 로딩 실패");
        }

        const text = await response.text();

        marketData = parseCSV(text);

        console.log("CSV rows:", marketData.length);

        if (marketData.length > 0) {

            updateDashboardFromCSV();
            drawCharts();
            updateTechnicalIndicators();
            updateMarketEnvironment();
            generateAIAnalysis();
        }

    } catch (error) {

        console.error(error);

        $("updateStatus").textContent =
            "CSV 데이터를 불러오지 못했습니다.";

        $("aiReport").innerHTML +=
            "<p>시장 데이터 CSV를 불러오지 못했습니다.</p>";
    }
}


/* =========================================================
   CSV PARSER
========================================================= */

function parseCSV(text) {

    const lines = text
        .trim()
        .split(/\r?\n/);

    if (lines.length < 2) {
        return [];
    }


    const headers = parseCSVLine(lines[0]);

    const rows = [];


    for (let i = 1; i < lines.length; i++) {

        const values = parseCSVLine(lines[i]);

        if (values.length === 0) {
            continue;
        }

        const row = {};

        headers.forEach((header, index) => {

            row[header] =
                values[index] !== undefined
                    ? values[index]
                    : "";

        });

        rows.push(row);
    }


    return rows;
}


function parseCSVLine(line) {

    const result = [];

    let current = "";
    let insideQuotes = false;


    for (let i = 0; i < line.length; i++) {

        const char = line[i];


        if (char === '"') {

            if (
                insideQuotes &&
                line[i + 1] === '"'
            ) {
                current += '"';
                i++;
            } else {
                insideQuotes = !insideQuotes;
            }

        }

        else if (char === "," && !insideQuotes) {

            result.push(current);
            current = "";

        }

        else {

            current += char;
        }
    }


    result.push(current);

    return result;
}


/* =========================================================
   DATE
========================================================= */

function getDate(row) {

    return getValue(
        row,
        [
            "Date",
            "date",
            "Datetime",
            "Timestamp"
        ]
    );
}


/* =========================================================
   UPDATE PREDICTION
========================================================= */

function updatePrediction() {

    if (!latestPrediction) {
        return;
    }


    const currentPrice =
        Number(
            latestPrediction.current_price ??
            latestPrediction.currentPrice ??
            latestPrediction.price ??
            latestPrediction.close
        );


    const predictedPrice =
        Number(
            latestPrediction.predicted_price ??
            latestPrediction.predictedPrice
        );


    const predictedReturn =
        Number(
            latestPrediction.predicted_return ??
            latestPrediction.predictedReturn ??
            latestPrediction.next_return
        );


    const direction =
        latestPrediction.direction ??
        latestPrediction.prediction ??
        latestPrediction.signal ??
        "";


    const baseDate =
        latestPrediction.date ??
        latestPrediction.base_date ??
        latestPrediction.reference_date ??
        latestPrediction.prediction_date ??
        "";


    /* 현재 가격 */

    if (Number.isFinite(currentPrice)) {

        $("currentPrice").textContent =
            dollar(currentPrice, 4);
    }


    /* 예측 가격 */

    if (Number.isFinite(predictedPrice)) {

        $("predictedPrice").textContent =
            dollar(predictedPrice, 4);
    }


    /* 수익률 */

    if (Number.isFinite(predictedReturn)) {

        $("predictedReturn").textContent =
            (predictedReturn >= 0 ? "+" : "") +
            percent(predictedReturn);

        $("predictedReturn").style.color =
            predictedReturn >= 0
                ? "#167b4a"
                : "#d64545";
    }


    /* 방향 */

    let directionText = direction;


    if (!directionText) {

        if (
            Number.isFinite(predictedReturn)
        ) {

            if (predictedReturn > 0.005) {
                directionText = "상승 예상";
            }

            else if (predictedReturn < -0.005) {
                directionText = "하락 예상";
            }

            else {
                directionText = "보합 예상";
            }
        }
    }


    $("predictionDirection").textContent =
        directionText || "분석 완료";


    /* 기준일 */

    if (baseDate) {

        $("dataDate").textContent =
            "기준일 " + formatDate(baseDate);

        $("predictionDate").textContent =
            "기준일 " +
            formatDate(baseDate) +
            " 이후 다음 거래일 예측";
    }


    /* 예측 강도 */

    let strength =
        latestPrediction.prediction_strength ??
        latestPrediction.confidence ??
        latestPrediction.strength;


    if (strength === undefined) {

        if (Number.isFinite(predictedReturn)) {

            strength =
                Math.min(
                    Math.abs(predictedReturn) / 0.05,
                    1
                ) * 100;
        }
    }

    else {

        strength = Number(strength);

        if (strength <= 1) {
            strength *= 100;
        }
    }


    if (Number.isFinite(Number(strength))) {

        $("predictionStrength").textContent =
            Number(strength).toFixed(1) + "%";
    }
}


/* =========================================================
   CSV → DASHBOARD
========================================================= */

function updateDashboardFromCSV() {

    if (!marketData.length) {
        return;
    }


    const last =
        marketData[marketData.length - 1];


    /* 날짜 */

    const date =
        getDate(last);

    if (date) {

        $("latestDataDate").textContent =
            formatDate(date);

        $("dataDate").textContent =
            "기준일 " + formatDate(date);
    }


    $("updateStatus").textContent =
        "최신 CSV 데이터 정상 연결";


    $("pageUpdated").textContent =
        new Date().toLocaleString("ko-KR");
}


/* =========================================================
   TECHNICAL INDICATORS
========================================================= */

function updateTechnicalIndicators() {

    if (!marketData.length) {
        return;
    }


    const last =
        marketData[marketData.length - 1];


    /* RSI */

    const rsi =
        getValue(
            last,
            [
                "RSI",
                "RSI_14"
            ]
        );


    if (rsi !== null) {

        $("rsiValue").textContent =
            number(rsi, 2);

        if (rsi >= 70) {

            $("rsiStatus").textContent =
                "과매수";

        }

        else if (rsi <= 30) {

            $("rsiStatus").textContent =
                "과매도";

        }

        else {

            $("rsiStatus").textContent =
                "중립";
        }
    }


    /* MACD */

    const macd =
        getValue(
            last,
            [
                "MACD",
                "MACD_Value"
            ]
        );


    if (macd !== null) {

        $("macdValue").textContent =
            number(macd, 4);

        $("macdStatus").textContent =
            macd >= 0
                ? "상승 모멘텀"
                : "하락 모멘텀";
    }


    /* MA20 */

    const ma20 =
        getValue(
            last,
            [
                "MA_20",
                "MA20",
                "SMA_20"
            ]
        );


    if (ma20 !== null) {

        $("ma20Value").textContent =
            dollar(ma20);

        const close =
            getClose(last);

        $("ma20Status").textContent =
            close !== null
                ? close > ma20
                    ? "주가 상회"
                    : "주가 하회"
                : "-";
    }


    /* MA50 */

    const ma50 =
        getValue(
            last,
            [
                "MA_50",
                "MA50",
                "SMA_50"
            ]
        );


    if (ma50 !== null) {

        $("ma50Value").textContent =
            dollar(ma50);

        const close =
            getClose(last);

        $("ma50Status").textContent =
            close !== null
                ? close > ma50
                    ? "주가 상회"
                    : "주가 하회"
                : "-";
    }


    /* MA200 */

    const ma200 =
        getValue(
            last,
            [
                "MA_200",
                "MA200",
                "SMA_200"
            ]
        );


    if (ma200 !== null) {

        $("ma200Value").textContent =
            dollar(ma200);

        const close =
            getClose(last);

        $("ma200Status").textContent =
            close !== null
                ? close > ma200
                    ? "주가 상회"
                    : "주가 하회"
                : "-";
    }


    /* Volume */

    const volume =
        getValue(
            last,
            [
                "Volume",
                "volume",
                "ATCH_Volume"
            ]
        );


    if (volume !== null) {

        $("volumeValue").textContent =
            formatVolume(volume);

        $("volumeStatus").textContent =
            "최근 거래량";
    }
}


/* =========================================================
   CLOSE
========================================================= */

function getClose(row) {

    return getValue(
        row,
        [
            "Close",
            "ATCH_Close",
            "Adj Close",
            "Price"
        ]
    );
}


/* =========================================================
   MARKET ENVIRONMENT
========================================================= */

function updateMarketEnvironment() {

    if (!marketData.length) {
        return;
    }


    const last =
        marketData[marketData.length - 1];


    updateMarketValue(
        "spyValue",
        last,
        [
            "SPY_Return",
            "SPY Return",
            "SPY_Change",
            "SPY"
        ]
    );


    updateMarketValue(
        "qqqValue",
        last,
        [
            "QQQ_Return",
            "QQQ Return",
            "QQQ_Change",
            "QQQ"
        ]
    );


    updateMarketValue(
        "iwmValue",
        last,
        [
            "IWM_Return",
            "IWM Return",
            "IWM_Change",
            "IWM"
        ]
    );


    updateMarketValue(
        "vixValue",
        last,
        [
            "VIX",
            "^VIX",
            "VIX_Change",
            "VIX Change"
        ]
    );


    updateMarketValue(
        "btcValue",
        last,
        [
            "BTC_Return",
            "BTC Return",
            "BTC_Change",
            "BTC"
        ]
    );


    updateMarketValue(
        "dxyValue",
        last,
        [
            "DXY_Change",
            "DXY Change",
            "DXY"
        ]
    );
}


function updateMarketValue(
    elementId,
    row,
    candidates
) {

    const value =
        getValue(row, candidates);


    if (value === null) {

        $(elementId).textContent =
            "데이터 없음";

        return;
    }


    /*
        Return / Change 계열은 %로 표시
    */

    const candidateText =
        candidates.join(" ").toLowerCase();


    if (
        candidateText.includes("return") ||
        candidateText.includes("change")
    ) {

        $(elementId).textContent =
            percent(value);

    } else {

        /*
            VIX, 가격 등의 일반 숫자
        */

        $(elementId).textContent =
            number(value, 2);
    }
}


/* =========================================================
   AI SCORE
========================================================= */

function calculateAIScore() {

    let score = 50;


    /* AI prediction */

    if (latestPrediction) {

        const predictedReturn =
            Number(
                latestPrediction.predicted_return ??
                latestPrediction.predictedReturn ??
                latestPrediction.next_return
            );


        if (Number.isFinite(predictedReturn)) {

            score +=
                Math.max(
                    -20,
                    Math.min(
                        20,
                        predictedReturn * 200
                    )
                );
        }
    }


    /* Technical indicators */

    if (marketData.length) {

        const last =
            marketData[marketData.length - 1];


        const close =
            getClose(last);


        const ma20 =
            getValue(
                last,
                ["MA_20", "MA20"]
            );


        const ma50 =
            getValue(
                last,
                ["MA_50", "MA50"]
            );


        const rsi =
            getValue(
                last,
                ["RSI", "RSI_14"]
            );


        if (
            close !== null &&
            ma20 !== null
        ) {

            if (close > ma20) {
                score += 8;
            } else {
                score -= 8;
            }
        }


        if (
            close !== null &&
            ma50 !== null
        ) {

            if (close > ma50) {
                score += 7;
            } else {
                score -= 7;
            }
        }


        if (rsi !== null) {

            if (rsi >= 40 && rsi <= 65) {

                score += 5;

            }

            else if (
                rsi > 75 ||
                rsi < 25
            ) {

                score -= 5;
            }
        }
    }


    score =
        Math.max(
            0,
            Math.min(
                100,
                score
            )
        );


    return Math.round(score);
}


/* =========================================================
   AI ANALYSIS
========================================================= */

function generateAIAnalysis() {

    if (!marketData.length) {
        return;
    }


    const last =
        marketData[marketData.length - 1];


    const close =
        getClose(last);


    const rsi =
        getValue(
            last,
            ["RSI", "RSI_14"]
        );


    const macd =
        getValue(
            last,
            ["MACD"]
        );


    const ma20 =
        getValue(
            last,
            ["MA_20", "MA20"]
        );


    const ma50 =
        getValue(
            last,
            ["MA_50", "MA50"]
        );


    let predictedReturn = null;


    if (latestPrediction) {

        predictedReturn =
            Number(
                latestPrediction.predicted_return ??
                latestPrediction.predictedReturn ??
                latestPrediction.next_return
            );
    }


    const score =
        calculateAIScore();


    $("aiScore").textContent =
        score;


    if (score >= 70) {

        $("scoreDescription").textContent =
            "기술적 지표와 AI 예측이 비교적 긍정적인 방향입니다.";

    }

    else if (score >= 50) {

        $("scoreDescription").textContent =
            "긍정·부정 신호가 혼재하는 중립 구간입니다.";

    }

    else {

        $("scoreDescription").textContent =
            "현재 데이터에서 부정적인 신호가 상대적으로 많습니다.";
    }


    let report = "";


    /* AI prediction */

    if (Number.isFinite(predictedReturn)) {

        const direction =
            predictedReturn > 0.005
                ? "상승"
                : predictedReturn < -0.005
                    ? "하락"
                    : "보합";


        report += `
            <p>
                <span class="report-highlight">
                    AI 예측:
                </span>
                다음 거래일 주가 수익률은
                약
                <strong>
                    ${predictedReturn >= 0 ? "+" : ""}
                    ${percent(predictedReturn)}
                </strong>
                로 예측되며,
                방향은
                <strong>${direction}</strong>
                으로 나타났습니다.
            </p>
        `;
    }


    /* RSI */

    if (rsi !== null) {

        let status;

        if (rsi >= 70) {
            status = "과매수 영역";
        }

        else if (rsi <= 30) {
            status = "과매도 영역";
        }

        else {
            status = "중립 영역";
        }


        report += `
            <p>
                RSI는
                <strong>${number(rsi, 2)}</strong>
                로 현재
                ${status}
                에 해당합니다.
            </p>
        `;
    }


    /* Moving Average */

    if (
        close !== null &&
        ma20 !== null
    ) {

        report += `
            <p>
                현재 주가는 MA20
                <strong>${dollar(ma20)}</strong>
                대비
                <strong>
                    ${close > ma20 ? "높은 위치" : "낮은 위치"}
                </strong>
                에 있습니다.
            </p>
        `;
    }


    if (
        close !== null &&
        ma50 !== null
    ) {

        report += `
            <p>
                MA50은
                <strong>${dollar(ma50)}</strong>
                이며 현재 주가는
                ${close > ma50 ? "MA50 위" : "MA50 아래"}
                에 위치합니다.
            </p>
        `;
    }


    /* MACD */

    if (macd !== null) {

        report += `
            <p>
                MACD 값은
                <strong>${number(macd, 4)}</strong>
                로
                ${macd >= 0
                    ? "양(+)의 모멘텀"
                    : "음(-)의 모멘텀"
                }
                을 나타냅니다.
            </p>
        `;
    }


    /* Score */

    report += `
        <p>
            현재 종합 분석 점수는
            <strong>${score}/100</strong>
            입니다.
            이 점수는 학습된 GRU 모델의 확률값이 아니라
            AI 예측값과 기술적 지표를 화면에서 종합하기 위한
            <strong>참고용 분석 점수</strong>입니다.
        </p>
    `;


    if (!report) {

        report =
            "<p>현재 데이터를 충분히 불러오지 못했습니다.</p>";
    }


    $("aiReport").innerHTML =
        report;


    updateSignals(
        predictedReturn,
        rsi,
        close,
        ma20,
        ma50,
        macd
    );
}


/* =========================================================
   SIGNALS
========================================================= */

function updateSignals(
    predictedReturn,
    rsi,
    close,
    ma20,
    ma50,
    macd
) {


    /* 방향 */

    if (Number.isFinite(predictedReturn)) {

        if (predictedReturn > 0.005) {

            $("signalDirectionValue").textContent =
                "긍정";

            $("signalDirectionText").textContent =
                "AI가 다음 거래일 상승을 예상합니다.";

        }

        else if (predictedReturn < -0.005) {

            $("signalDirectionValue").textContent =
                "주의";

            $("signalDirectionText").textContent =
                "AI가 다음 거래일 하락을 예상합니다.";

        }

        else {

            $("signalDirectionValue").textContent =
                "중립";

            $("signalDirectionText").textContent =
                "AI 예측 수익률이 제한적입니다.";
        }
    }


    /* 추세 */

    if (
        close !== null &&
        ma20 !== null &&
        ma50 !== null
    ) {

        if (
            close > ma20 &&
            close > ma50
        ) {

            $("signalTrendValue").textContent =
                "상승";

            $("signalTrendText").textContent =
                "주가가 주요 이동평균 위에 있습니다.";

        }

        else if (
            close < ma20 &&
            close < ma50
        ) {

            $("signalTrendValue").textContent =
                "하락";

            $("signalTrendText").textContent =
                "주가가 주요 이동평균 아래에 있습니다.";

        }

        else {

            $("signalTrendValue").textContent =
                "혼조";

            $("signalTrendText").textContent =
                "이동평균 기준 방향성이 혼재되어 있습니다.";
        }
    }


    /* 모멘텀 */

    if (macd !== null) {

        $("signalMomentumValue").textContent =
            macd >= 0
                ? "긍정"
                : "부정";

        $("signalMomentumText").textContent =
            macd >= 0
                ? "MACD가 양수 영역입니다."
                : "MACD가 음수 영역입니다.";
    }


    /* Risk */

    if (rsi !== null) {

        if (
            rsi > 70 ||
            rsi < 30
        ) {

            $("signalRiskValue").textContent =
                "높음";

            $("signalRiskText").textContent =
                "RSI가 극단적인 영역에 위치합니다.";

        }

        else {

            $("signalRiskValue").textContent =
                "보통";

            $("signalRiskText").textContent =
                "RSI가 일반적인 범위에 있습니다.";
        }
    }
}


/* =========================================================
   CHARTS
========================================================= */

function drawCharts() {

    if (!marketData.length) {
        return;
    }


    /*
        최근 120개 데이터만 표시
    */

    const data =
        marketData.slice(-120);


    const labels =
        data.map(row => {

            const date =
                getDate(row);

            return formatDate(date);
        });


    const prices =
        data.map(row =>
            getClose(row)
        );


    drawPriceChart(
        labels,
        prices
    );


    drawBollingerChart(
        labels,
        data
    );
}


/* =========================================================
   PRICE CHART
========================================================= */

function drawPriceChart(
    labels,
    prices
) {

    const ctx =
        $("priceChart").getContext("2d");


    if (priceChart) {
        priceChart.destroy();
    }


    priceChart =
        new Chart(
            ctx,
            {
                type: "line",

                data: {

                    labels: labels,

                    datasets: [
                        {
                            label: "ATCH 주가",

                            data: prices,

                            borderWidth: 2,

                            pointRadius: 0,

                            tension: 0.25
                        }
                    ]
                },

                options: {

                    responsive: true,

                    maintainAspectRatio: false,

                    interaction: {
                        mode: "index",
                        intersect: false
                    },

                    plugins: {

                        legend: {
                            display: true
                        }
                    },

                    scales: {

                        x: {
                            ticks: {
                                maxTicksLimit: 10
                            }
                        },

                        y: {
                            beginAtZero: false
                        }
                    }
                }
            }
        );
}


/* =========================================================
   BOLLINGER CHART
========================================================= */

function drawBollingerChart(
    labels,
    data
) {

    const middle = [];

    const upper = [];

    const lower = [];

    const prices = [];


    for (const row of data) {

        prices.push(
            getClose(row)
        );


        middle.push(
            getValue(
                row,
                [
                    "BB_Middle",
                    "BB_Mid",
                    "Bollinger_Middle"
                ]
            )
        );


        upper.push(
            getValue(
                row,
                [
                    "BB_Upper",
                    "Bollinger_Upper"
                ]
            )
        );


        lower.push(
            getValue(
                row,
                [
                    "BB_Lower",
                    "Bollinger_Lower"
                ]
            )
        );
    }


    const ctx =
        $("bollingerChart").getContext("2d");


    if (bollingerChart) {
        bollingerChart.destroy();
    }


    bollingerChart =
        new Chart(
            ctx,
            {
                type: "line",

                data: {

                    labels: labels,

                    datasets: [

                        {
                            label: "주가",

                            data: prices,

                            borderWidth: 2,

                            pointRadius: 0,

                            tension: 0.25
                        },

                        {
                            label: "BB Middle",

                            data: middle,

                            borderWidth: 1,

                            pointRadius: 0,

                            tension: 0.2
                        },

                        {
                            label: "BB Upper",

                            data: upper,

                            borderWidth: 1,

                            pointRadius: 0,

                            tension: 0.2
                        },

                        {
                            label: "BB Lower",

                            data: lower,

                            borderWidth: 1,

                            pointRadius: 0,

                            tension: 0.2
                        }
                    ]
                },

                options: {

                    responsive: true,

                    maintainAspectRatio: false,

                    interaction: {
                        mode: "index",
                        intersect: false
                    },

                    plugins: {

                        legend: {
                            display: true
                        }
                    },

                    scales: {

                        x: {
                            ticks: {
                                maxTicksLimit: 10
                            }
                        },

                        y: {
                            beginAtZero: false
                        }
                    }
                }
            }
        );
}


/* =========================================================
   DATE FORMAT
========================================================= */

function formatDate(value) {

    if (!value) {
        return "-";
    }


    const text =
        String(value);


    /*
        YYYY-MM-DD 형태
    */

    if (
        /^\d{4}-\d{2}-\d{2}/.test(text)
    ) {

        return text.substring(
            0,
            10
        );
    }


    const date =
        new Date(value);


    if (Number.isNaN(date.getTime())) {
        return text;
    }


    return date.toLocaleDateString(
        "ko-KR"
    );
}


/* =========================================================
   REFRESH
========================================================= */

async function refreshDashboard() {

    $("updateStatus").textContent =
        "최신 데이터를 불러오는 중...";


    await loadPrediction();

    await loadCSV();


    $("updateStatus").textContent =
        "데이터 업데이트 완료";
}


/* =========================================================
   BUTTON
========================================================= */

$("refreshBtn").addEventListener(
    "click",
    refreshDashboard
);


/* =========================================================
   START
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        refreshDashboard();

    }
);
