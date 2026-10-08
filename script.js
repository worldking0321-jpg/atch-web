// ==========================================
// ATCH AI STOCK PREDICTION DASHBOARD
// ==========================================

let priceChart = null;
let bollingerChart = null;


// ==========================================
// 데이터 가져오기
// ==========================================

async function loadData() {

    try {

        const timestamp = new Date().getTime();

        const predictionResponse =
            await fetch(`./data/latest_prediction.json?t=${timestamp}`);

        const csvResponse =
            await fetch(`./data/latest_data.csv?t=${timestamp}`);

        if (!predictionResponse.ok) {
            throw new Error("latest_prediction.json을 찾을 수 없습니다.");
        }

        if (!csvResponse.ok) {
            throw new Error("latest_data.csv를 찾을 수 없습니다.");
        }

        const predictionData =
            await predictionResponse.json();

        const csvText =
            await csvResponse.text();

        const data =
            parseCSV(csvText);


        updateDashboard(
            predictionData,
            data
        );

    }

    catch (error) {

        console.error(error);

        alert(
            "데이터를 불러오지 못했습니다.\n\n" +
            "GitHub 저장소의 data 폴더에\n" +
            "latest_prediction.json과 latest_data.csv가 있는지 확인해주세요."
        );

    }

}


// ==========================================
// CSV Parser
// ==========================================

function parseCSV(text) {

    const lines =
        text.trim().split(/\r?\n/);

    if (lines.length < 2) {
        return [];
    }

    const headers =
        lines[0]
            .split(",")
            .map(h => h.trim().replace(/^"|"$/g, ""));


    const rows = [];

    for (let i = 1; i < lines.length; i++) {

        const values =
            lines[i]
                .split(",")
                .map(v => v.trim().replace(/^"|"$/g, ""));

        if (values.length !== headers.length) {
            continue;
        }

        const row = {};

        headers.forEach((header, index) => {

            const value = values[index];

            const number =
                Number(value);

            row[header] =
                value !== "" && !isNaN(number)
                    ? number
                    : value;

        });

        rows.push(row);
    }

    return rows;
}


// ==========================================
// Dashboard 업데이트
// ==========================================

function updateDashboard(prediction, data) {

    // --------------------------------------
    // 현재 가격
    // --------------------------------------

    const currentPrice =
        Number(prediction.current_price);

    document.getElementById("currentPrice").textContent =
        formatPrice(currentPrice);


    // --------------------------------------
    // 기준일
    // --------------------------------------

    const baseDate =
        prediction.base_date ||
        prediction.date ||
        "-";

    document.getElementById("baseDate").textContent =
        `기준일 ${baseDate}`;


    // --------------------------------------
    // 방향
    // --------------------------------------

    const direction =
        prediction.direction || "-";

    const directionElement =
        document.getElementById("predictionDirection");

    directionElement.textContent =
        direction;


    directionElement.classList.remove(
        "up",
        "down"
    );


    if (
        direction.includes("상승") ||
        direction.includes("UP")
    ) {

        directionElement.classList.add("up");

    }

    else if (
        direction.includes("하락") ||
        direction.includes("DOWN")
    ) {

        directionElement.classList.add("down");

    }


    // --------------------------------------
    // 예상 수익률
    // --------------------------------------

    const predictedReturn =
        Number(prediction.predicted_return);

    document.getElementById("predictedReturn").textContent =
        formatPercent(predictedReturn);


    // --------------------------------------
    // 예상 가격
    // --------------------------------------

    const predictedPrice =
        Number(prediction.predicted_price);

    document.getElementById("predictedPrice").textContent =
        formatPrice(predictedPrice);


    // --------------------------------------
    // 예측 강도
    // --------------------------------------

    let confidence =
        prediction.confidence;

    if (confidence !== undefined) {

        confidence =
            Number(confidence);

        document.getElementById("confidence").textContent =
            `${confidence.toFixed(1)}%`;

    }

    else {

        document.getElementById("confidence").textContent =
            "-";

    }


    // --------------------------------------
    // 기술적 지표
    // --------------------------------------

    updateIndicators(data);


    // --------------------------------------
    // 차트
    // --------------------------------------

    createPriceChart(data);

    createBollingerChart(data);

}


// ==========================================
// 기술적 지표
// ==========================================

function updateIndicators(data) {

    if (!data || data.length === 0) {
        return;
    }

    const last =
        data[data.length - 1];


    // RSI
    setIndicator(
        "rsi",
        getValue(last, [
            "RSI",
            "Rsi",
            "rsi"
        ]),
        2
    );


    // MACD
    setIndicator(
        "macd",
        getValue(last, [
            "MACD",
            "Macd",
            "macd"
        ]),
        4
    );


    // Volume
    const volume =
        getValue(last, [
            "Volume",
            "volume"
        ]);

    if (volume !== null) {

        document.getElementById("volume").textContent =
            formatVolume(volume);

    }


    // Bollinger Position
    setIndicator(
        "bbPosition",
        getValue(last, [
            "BB_Position",
            "BB_Position",
            "bb_position",
            "Bollinger_Position"
        ]),
        2
    );


    // MA20
    setIndicator(
        "ma20",
        getValue(last, [
            "MA_20",
            "MA20",
            "ma20"
        ]),
        4
    );


    // MA50
    setIndicator(
        "ma50",
        getValue(last, [
            "MA_50",
            "MA50",
            "ma50"
        ]),
        4
    );


    // MA200
    setIndicator(
        "ma200",
        getValue(last, [
            "MA_200",
            "MA200",
            "ma200"
        ]),
        4
    );

}


// ==========================================
// 데이터 값 찾기
// ==========================================

function getValue(row, keys) {

    for (const key of keys) {

        if (
            row[key] !== undefined &&
            row[key] !== null &&
            row[key] !== ""
        ) {

            const number =
                Number(row[key]);

            if (!isNaN(number)) {
                return number;
            }

        }

    }

    return null;
}


// ==========================================
// Indicator 표시
// ==========================================

function setIndicator(
    elementId,
    value,
    decimals = 2
) {

    const element =
        document.getElementById(elementId);

    if (value === null) {

        element.textContent = "-";

        return;
    }

    element.textContent =
        Number(value).toFixed(decimals);
}


// ==========================================
// 가격 포맷
// ==========================================

function formatPrice(value) {

    if (
        value === null ||
        value === undefined ||
        isNaN(value)
    ) {

        return "-";

    }

    return `$${Number(value).toFixed(4)}`;
}


// ==========================================
// 퍼센트 포맷
// ==========================================

function formatPercent(value) {

    if (
        value === null ||
        value === undefined ||
        isNaN(value)
    ) {

        return "-";

    }

    const number =
        Number(value);

    const sign =
        number > 0
            ? "+"
            : "";

    return `${sign}${number.toFixed(2)}%`;
}


// ==========================================
// 거래량 포맷
// ==========================================

function formatVolume(value) {

    const number =
        Number(value);

    if (number >= 1000000000) {

        return `${(number / 1000000000).toFixed(2)}B`;

    }

    if (number >= 1000000) {

        return `${(number / 1000000).toFixed(2)}M`;

    }

    if (number >= 1000) {

        return `${(number / 1000).toFixed(2)}K`;

    }

    return number.toLocaleString();
}


// ==========================================
// 날짜 처리
// ==========================================

function getDate(row) {

    return (
        row.Date ||
        row.date ||
        row.Datetime ||
        row.datetime ||
        row.index ||
        ""
    );

}


// ==========================================
// 주가 차트
// ==========================================

function createPriceChart(data) {

    const canvas =
        document.getElementById("priceChart");

    if (!canvas) {
        return;
    }


    const labels =
        data.map(row => getDate(row));


    const prices =
        data.map(row =>
            getValue(row, [
                "Close",
                "close"
            ])
        );


    if (priceChart) {
        priceChart.destroy();
    }


    const ctx =
        canvas.getContext("2d");


    priceChart =
        new Chart(ctx, {

            type: "line",

            data: {

                labels: labels,

                datasets: [

                    {
                        label: "ATCH Close",

                        data: prices,

                        borderWidth: 2,

                        pointRadius: 0,

                        tension: 0.15,

                        fill: false
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

        });

}


// ==========================================
// Bollinger Bands 차트
// ==========================================

function createBollingerChart(data) {

    const canvas =
        document.getElementById("bollingerChart");

    if (!canvas) {
        return;
    }


    const labels =
        data.map(row => getDate(row));


    const close =
        data.map(row =>
            getValue(row, [
                "Close",
                "close"
            ])
        );


    const middle =
        data.map(row =>
            getValue(row, [
                "BB_Middle",
                "BB_Mid",
                "Bollinger_Middle",
                "BB_Middle_20"
            ])
        );


    const upper =
        data.map(row =>
            getValue(row, [
                "BB_Upper",
                "Bollinger_Upper"
            ])
        );


    const lower =
        data.map(row =>
            getValue(row, [
                "BB_Lower",
                "Bollinger_Lower"
            ])
        );


    if (bollingerChart) {
        bollingerChart.destroy();
    }


    const ctx =
        canvas.getContext("2d");


    bollingerChart =
        new Chart(ctx, {

            type: "line",

            data: {

                labels: labels,

                datasets: [

                    {
                        label: "Close",

                        data: close,

                        borderWidth: 2,

                        pointRadius: 0,

                        tension: 0.15
                    },

                    {
                        label: "BB Middle",

                        data: middle,

                        borderWidth: 1.5,

                        pointRadius: 0,

                        tension: 0.15
                    },

                    {
                        label: "BB Upper",

                        data: upper,

                        borderWidth: 1,

                        pointRadius: 0,

                        tension: 0.15
                    },

                    {
                        label: "BB Lower",

                        data: lower,

                        borderWidth: 1,

                        pointRadius: 0,

                        tension: 0.15
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

        });

}


// ==========================================
// 새로고침 버튼
// ==========================================

document
    .getElementById("refreshBtn")
    .addEventListener(
        "click",
        async function () {

            const button =
                this;

            button.disabled = true;

            button.textContent =
                "↻ 불러오는 중...";


            await loadData();


            button.disabled = false;

            button.textContent =
                "↻ 최신 데이터";

        }
    );


// ==========================================
// 페이지 처음 실행
// ==========================================

document.addEventListener(
    "DOMContentLoaded",
    loadData
);
// ==========================================
// ATCH AI STOCK ANALYSIS
// ==========================================

let priceChart = null;
let bollingerChart = null;


// ==========================================
// 데이터 불러오기
// ==========================================

async function loadData() {

    try {

        const timestamp = Date.now();

        const predictionResponse =
            await fetch(
                `./data/latest_prediction.json?t=${timestamp}`
            );

        const csvResponse =
            await fetch(
                `./data/latest_data.csv?t=${timestamp}`
            );


        if (!predictionResponse.ok) {
            throw new Error(
                "latest_prediction.json 파일을 찾을 수 없습니다."
            );
        }


        if (!csvResponse.ok) {
            throw new Error(
                "latest_data.csv 파일을 찾을 수 없습니다."
            );
        }


        const prediction =
            await predictionResponse.json();


        const csvText =
            await csvResponse.text();


        const data =
            parseCSV(csvText);


        updateDashboard(
            prediction,
            data
        );


        document.getElementById(
            "updateStatus"
        ).textContent =
            `데이터 로드 완료 · ${new Date().toLocaleTimeString("ko-KR")}`;


    }

    catch (error) {

        console.error(error);

        document.getElementById(
            "updateStatus"
        ).textContent =
            "데이터 로드 실패";

        alert(
            "데이터를 불러오지 못했습니다.\n\n" +
            "GitHub의 data 폴더에\n" +
            "latest_prediction.json / latest_data.csv가 있는지 확인해주세요."
        );

    }

}


// ==========================================
// CSV Parser
// ==========================================

function parseCSV(text) {

    const lines =
        text.trim().split(/\r?\n/);


    if (lines.length < 2) {
        return [];
    }


    const headers =
        lines[0]
            .split(",")
            .map(
                h =>
                    h
                        .trim()
                        .replace(/^"|"$/g, "")
            );


    const rows = [];


    for (
        let i = 1;
        i < lines.length;
        i++
    ) {

        const values =
            lines[i]
                .split(",")
                .map(
                    v =>
                        v
                            .trim()
                            .replace(/^"|"$/g, "")
                );


        if (
            values.length !==
            headers.length
        ) {
            continue;
        }


        const row = {};


        headers.forEach(
            (header, index) => {

                const value =
                    values[index];


                const number =
                    Number(value);


                row[header] =
                    value !== "" &&
                    !isNaN(number)
                        ? number
                        : value;

            }
        );


        rows.push(row);

    }


    return rows;
}


// ==========================================
// Dashboard
// ==========================================

function updateDashboard(
    prediction,
    data
) {

    if (!data || data.length === 0) {
        return;
    }


    // ======================================
    // 기본 주가
    // ======================================

    const currentPrice =
        Number(
            prediction.current_price
        );


    document.getElementById(
        "currentPrice"
    ).textContent =
        formatPrice(currentPrice);


    const date =
        prediction.base_date ||
        prediction.date ||
        getDate(data[data.length - 1]);


    document.getElementById(
        "baseDate"
    ).textContent =
        `기준일 ${date}`;


    // ======================================
    // AI Prediction
    // ======================================

    const direction =
        prediction.direction || "-";


    const directionElement =
        document.getElementById(
            "predictionDirection"
        );


    directionElement.textContent =
        direction;


    directionElement.classList.remove(
        "up",
        "down"
    );


    if (
        direction.includes("상승") ||
        direction.includes("UP")
    ) {

        directionElement.classList.add(
            "up"
        );

    }

    else if (
        direction.includes("하락") ||
        direction.includes("DOWN")
    ) {

        directionElement.classList.add(
            "down"
        );

    }


    const predictedReturn =
        Number(
            prediction.predicted_return
        );


    const predictedPrice =
        Number(
            prediction.predicted_price
        );


    document.getElementById(
        "predictedReturn"
    ).textContent =
        formatPercent(
            predictedReturn
        );


    document.getElementById(
        "predictedPrice"
    ).textContent =
        formatPrice(
            predictedPrice
        );


    let confidence =
        prediction.confidence;


    if (
        confidence !== undefined &&
        confidence !== null
    ) {

        confidence =
            Number(confidence);


        document.getElementById(
            "confidence"
        ).textContent =
            `${confidence.toFixed(1)}%`;

    }

    else {

        document.getElementById(
            "confidence"
        ).textContent =
            "-";

    }


    // ======================================
    // 기술적 지표
    // ======================================

    updateIndicators(data);


    // ======================================
    // 시장 데이터
    // ======================================

    updateMarket(data);


    // ======================================
    // AI Score
    // ======================================

    calculateAIScore(
        prediction,
        data
    );


    // ======================================
    // AI Report
    // ======================================

    createAIReport(
        prediction,
        data
    );


    // ======================================
    // Charts
    // ======================================

    createPriceChart(data);

    createBollingerChart(data);

}


// ==========================================
// AI SCORE
// ==========================================

function calculateAIScore(
    prediction,
    data
) {

    const last =
        data[data.length - 1];


    const rsi =
        getValue(
            last,
            [
                "RSI",
                "Rsi",
                "rsi"
            ]
        );


    const ma20 =
        getValue(
            last,
            [
                "MA_20",
                "MA20",
                "ma20"
            ]
        );


    const ma50 =
        getValue(
            last,
            [
                "MA_50",
                "MA50",
                "ma50"
            ]
        );


    const close =
        getValue(
            last,
            [
                "Close",
                "close"
            ]
        );


    const predictedReturn =
        Number(
            prediction.predicted_return
        );


    let score = 50;


    // AI 방향성
    if (
        predictedReturn > 0
    ) {

        score += 15;

    }

    else if (
        predictedReturn < 0
    ) {

        score -= 15;

    }


    // RSI
    if (
        rsi !== null
    ) {

        if (
            rsi >= 40 &&
            rsi <= 65
        ) {

            score += 8;

        }

        else if (
            rsi > 70
        ) {

            score -= 8;

        }

        else if (
            rsi < 30
        ) {

            score += 3;

        }

    }


    // MA20
    if (
        close !== null &&
        ma20 !== null
    ) {

        if (close > ma20) {

            score += 8;

        }

        else {

            score -= 8;

        }

    }


    // MA50
    if (
        close !== null &&
        ma50 !== null
    ) {

        if (close > ma50) {

            score += 7;

        }

        else {

            score -= 7;

        }

    }


    score =
        Math.max(
            0,
            Math.min(
                100,
                Math.round(score)
            )
        );


    document.getElementById(
        "aiScore"
    ).textContent =
        score;


    document.getElementById(
        "scoreBar"
    ).style.width =
        `${score}%`;


    let grade;
    let description;


    if (score >= 70) {

        grade = "긍정적";

        description =
            "AI 예측과 기술적 지표가 비교적 긍정적인 방향을 보이고 있습니다.";

    }

    else if (score >= 55) {

        grade = "중립 이상";

        description =
            "일부 긍정적인 요소가 있으나 방향성이 강하지 않습니다.";

    }

    else if (score >= 45) {

        grade = "중립";

        description =
            "긍정적 요소와 부정적 요소가 혼재하고 있습니다.";

    }

    else {

        grade = "주의";

        description =
            "AI 예측 또는 기술적 지표에서 약세 신호가 나타나고 있습니다.";

    }


    document.getElementById(
        "aiGrade"
    ).textContent =
        grade;


    document.getElementById(
        "scoreDescription"
    ).textContent =
        description;


    // ======================================
    // Signal
    // ======================================

    document.getElementById(
        "signalAI"
    ).textContent =
        predictedReturn > 0
            ? "상승 예상"
            : "하락 예상";


    if (
        rsi === null
    ) {

        document.getElementById(
            "signalRSI"
        ).textContent =
            "-";

    }

    else if (
        rsi >= 70
    ) {

        document.getElementById(
            "signalRSI"
        ).textContent =
            "과매수";

    }

    else if (
        rsi <= 30
    ) {

        document.getElementById(
            "signalRSI"
        ).textContent =
            "과매도";

    }

    else {

        document.getElementById(
            "signalRSI"
        ).textContent =
            "중립";

    }


    // MA signal

    if (
        close !== null &&
        ma20 !== null &&
        ma50 !== null
    ) {

        if (
            close > ma20 &&
            close > ma50
        ) {

            document.getElementById(
                "signalMA"
            ).textContent =
                "상승 추세";

        }

        else if (
            close < ma20 &&
            close < ma50
        ) {

            document.getElementById(
                "signalMA"
            ).textContent =
                "하락 추세";

        }

        else {

            document.getElementById(
                "signalMA"
            ).textContent =
                "혼조";

        }

    }


    // Volume

    const volume =
        getValue(
            last,
            [
                "Volume",
                "volume"
            ]
        );


    document.getElementById(
        "signalVolume"
    ).textContent =
        volume !== null
            ? formatVolume(volume)
            : "-";

}


// ==========================================
// AI REPORT
// ==========================================

function createAIReport(
    prediction,
    data
) {

    const last =
        data[data.length - 1];


    const rsi =
        getValue(
            last,
            [
                "RSI",
                "Rsi",
                "rsi"
            ]
        );


    const ma20 =
        getValue(
            last,
            [
                "MA_20",
                "MA20"
            ]
        );


    const close =
        getValue(
            last,
            [
                "Close",
                "close"
            ]
        );


    const predictedReturn =
        Number(
            prediction.predicted_return
        );


    let text = "";


    // AI 방향
    if (
        predictedReturn > 0
    ) {

        text +=
            `AI 모델은 다음 거래일 ATCH 주가가 `
            + `${formatPercent(predictedReturn)} 정도 상승할 가능성을 `
            + `예측하고 있습니다. `;

    }

    else {

        text +=
            `AI 모델은 다음 거래일 ATCH 주가가 `
            + `${formatPercent(predictedReturn)} 정도 하락할 가능성을 `
            + `예측하고 있습니다. `;

    }


    // RSI
    if (rsi !== null) {

        if (rsi >= 70) {

            text +=
                `RSI는 ${rsi.toFixed(1)}로 과매수 구간에 위치하여 `
                + `단기적인 가격 부담 가능성을 보여줍니다. `;

        }

        else if (rsi <= 30) {

            text +=
                `RSI는 ${rsi.toFixed(1)}로 과매도 구간에 위치하여 `
                + `단기 반등 가능성을 살펴볼 필요가 있습니다. `;

        }

        else {

            text +=
                `RSI는 ${rsi.toFixed(1)}로 극단적인 과매수·과매도 `
                + `구간에는 해당하지 않습니다. `;

        }

    }


    // MA
    if (
        close !== null &&
        ma20 !== null
    ) {

        if (
            close > ma20
        ) {

            text +=
                `현재 주가는 20일 이동평균선 위에 있어 `
                + `단기 추세는 상대적으로 긍정적인 모습을 보입니다. `;

        }

        else {

            text +=
                `현재 주가는 20일 이동평균선 아래에 있어 `
                + `단기 추세는 상대적으로 약한 모습을 보입니다. `;

        }

    }


    text +=
        `다만 현재 모델의 최종 테스트 정확도는 57.46%이며 `
        + `F1 점수는 0%이므로, AI 예측만으로 투자 결정을 내리는 것은 `
        + `적절하지 않습니다. 본 분석은 공개 데이터를 이용한 `
        + `교육 및 연구 목적의 예측 시스템입니다.`;


    document.getElementById(
        "aiReport"
    ).textContent =
        text;

}


// ==========================================
// 기술적 지표
// ==========================================

function updateIndicators(data) {

    const last =
        data[data.length - 1];


    const rsi =
        getValue(
            last,
            [
                "RSI",
                "Rsi",
                "rsi"
            ]
        );


    const macd =
        getValue(
            last,
            [
                "MACD",
                "Macd",
                "macd"
            ]
        );


    const volume =
        getValue(
            last,
            [
                "Volume",
                "volume"
            ]
        );


    const bb =
        getValue(
            last,
            [
                "BB_Position",
                "bb_position",
                "Bollinger_Position"
            ]
        );


    const ma20 =
        getValue(
            last,
            [
                "MA_20",
                "MA20",
                "ma20"
            ]
        );


    const ma50 =
        getValue(
            last,
            [
                "MA_50",
                "MA50",
                "ma50"
            ]
        );


    const ma200 =
        getValue(
            last,
            [
                "MA_200",
                "MA200",
                "ma200"
            ]
        );


    setText(
        "rsi",
        rsi !== null
            ? rsi.toFixed(2)
            : "-"
    );


    setText(
        "macd",
        macd !== null
            ? macd.toFixed(4)
            : "-"
    );


    setText(
        "volume",
        volume !== null
            ? formatVolume(volume)
            : "-"
    );


    setText(
        "bbPosition",
        bb !== null
            ? bb.toFixed(3)
            : "-"
    );


    setText(
        "ma20",
        ma20 !== null
            ? formatPrice(ma20)
            : "-"
    );


    setText(
        "ma50",
        ma50 !== null
            ? formatPrice(ma50)
            : "-"
    );


    setText(
        "ma200",
        ma200 !== null
            ? formatPrice(ma200)
            : "-"
    );

}


// ==========================================
// 시장 데이터
// ==========================================

function updateMarket(data) {

    const last =
        data[data.length - 1];


    const spy =
        getValue(
            last,
            [
                "SPY",
                "SPY_Close"
            ]
        );


    const qqq =
        getValue(
            last,
            [
                "QQQ",
                "QQQ_Close"
            ]
        );


    const iwm =
        getValue(
            last,
            [
                "IWM",
                "IWM_Close"
            ]
        );


    const vix =
        getValue(
            last,
            [
                "VIX",
                "^VIX",
                "VIX_Close"
            ]
        );


    const btc =
        getValue(
            last,
            [
                "BTC",
                "BTC-USD",
                "BTC_Close"
            ]
        );


    const dxy =
        getValue(
            last,
            [
                "DXY",
                "DXY_Close"
            ]
        );


    setText(
        "spy",
        spy !== null
            ? formatPrice(spy)
            : "-"
    );


    setText(
        "qqq",
        qqq !== null
            ? formatPrice(qqq)
            : "-"
    );


    setText(
        "iwm",
        iwm !== null
            ? formatPrice(iwm)
            : "-"
    );


    setText(
        "vix",
        vix !== null
            ? vix.toFixed(2)
            : "-"
    );


    setText(
        "btc",
        btc !== null
            ? formatPrice(btc)
            : "-"
    );


    setText(
        "dxy",
        dxy !== null
            ? dxy.toFixed(2)
            : "-"
    );

}


// ==========================================
// 주가 차트
// ==========================================

function createPriceChart(data) {

    const canvas =
        document.getElementById(
            "priceChart"
        );


    const labels =
        data.map(
            row => getDate(row)
        );


    const prices =
        data.map(
            row =>
                getValue(
                    row,
                    [
                        "Close",
                        "close"
                    ]
                )
        );


    if (priceChart) {
        priceChart.destroy();
    }


    priceChart =
        new Chart(
            canvas,
            {

                type: "line",

                data: {

                    labels: labels,

                    datasets: [

                        {
                            label: "ATCH Close",

                            data: prices,

                            borderWidth: 2,

                            pointRadius: 0,

                            tension: 0.15,

                            fill: false
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


// ==========================================
// Bollinger Chart
// ==========================================

function createBollingerChart(data) {

    const canvas =
        document.getElementById(
            "bollingerChart"
        );


    const labels =
        data.map(
            row => getDate(row)
        );


    const close =
        data.map(
            row =>
                getValue(
                    row,
                    [
                        "Close",
                        "close"
                    ]
                )
        );


    const middle =
        data.map(
            row =>
                getValue(
                    row,
                    [
                        "BB_Middle",
                        "BB_Mid",
                        "Bollinger_Middle"
                    ]
                )
        );


    const upper =
        data.map(
            row =>
                getValue(
                    row,
                    [
                        "BB_Upper",
                        "Bollinger_Upper"
                    ]
                )
        );


    const lower =
        data.map(
            row =>
                getValue(
                    row,
                    [
                        "BB_Lower",
                        "Bollinger_Lower"
                    ]
                )
        );


    if (bollingerChart) {
        bollingerChart.destroy();
    }


    bollingerChart =
        new Chart(
            canvas,
            {

                type: "line",

                data: {

                    labels: labels,

                    datasets: [

                        {
                            label: "Close",

                            data: close,

                            borderWidth: 2,

                            pointRadius: 0,

                            tension: 0.15
                        },

                        {
                            label: "BB Middle",

                            data: middle,

                            borderWidth: 1.5,

                            pointRadius: 0,

                            tension: 0.15
                        },

                        {
                            label: "BB Upper",

                            data: upper,

                            borderWidth: 1,

                            pointRadius: 0,

                            tension: 0.15
                        },

                        {
                            label: "BB Lower",

                            data: lower,

                            borderWidth: 1,

                            pointRadius: 0,

                            tension: 0.15
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


// ==========================================
// Utility
// ==========================================

function getValue(
    row,
    keys
) {

    for (
        const key of keys
    ) {

        if (
            row[key] !== undefined &&
            row[key] !== null &&
            row[key] !== ""
        ) {

            const number =
                Number(row[key]);


            if (!isNaN(number)) {
                return number;
            }

        }

    }


    return null;
}


function getDate(row) {

    return (
        row.Date ||
        row.date ||
        row.Datetime ||
        row.datetime ||
        row.index ||
        ""
    );

}


function setText(
    id,
    value
) {

    const element =
        document.getElementById(id);


    if (element) {
        element.textContent =
            value;
    }

}


function formatPrice(value) {

    if (
        value === null ||
        value === undefined ||
        isNaN(value)
    ) {
        return "-";
    }


    return `$${Number(value).toFixed(4)}`;

}


function formatPercent(value) {

    if (
        value === null ||
        value === undefined ||
        isNaN(value)
    ) {
        return "-";
    }


    const number =
        Number(value);


    const sign =
        number > 0
            ? "+"
            : "";


    return `${sign}${number.toFixed(2)}%`;

}


function formatVolume(value) {

    const number =
        Number(value);


    if (
        number >= 1000000000
    ) {

        return (
            number / 1000000000
        ).toFixed(2) + "B";

    }


    if (
        number >= 1000000
    ) {

        return (
            number / 1000000
        ).toFixed(2) + "M";

    }


    if (
        number >= 1000
    ) {

        return (
            number / 1000
        ).toFixed(2) + "K";

    }


    return number.toLocaleString();

}


// ==========================================
// Refresh
// ==========================================

document
    .getElementById("refreshBtn")
    .addEventListener(
        "click",
        async function () {

            const button =
                this;


            button.disabled = true;

            button.textContent =
                "↻ 분석 중...";


            await loadData();


            button.disabled = false;

            button.textContent =
                "↻ 최신 데이터";

        }
    );


// ==========================================
// 초기 실행
// ==========================================

document.addEventListener(
    "DOMContentLoaded",
    loadData
);
