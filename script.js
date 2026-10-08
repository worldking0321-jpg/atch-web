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
