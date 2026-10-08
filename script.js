// ============================================================
// ATCH Investor AI - Frontend
// ============================================================

let priceChart = null;


// ============================================================
// 숫자 포맷
// ============================================================

function formatPrice(value) {

    if (
        value === null ||
        value === undefined ||
        isNaN(value)
    ) {
        return "-";
    }

    return "$" + Number(value).toFixed(4);
}


function formatNumber(value, digits = 2) {

    if (
        value === null ||
        value === undefined ||
        isNaN(value)
    ) {
        return "-";
    }

    return Number(value).toFixed(digits);
}


// ============================================================
// 데이터 가져오기
// ============================================================

async function fetchJSON(file) {

    const cacheBuster =
        "?t=" + Date.now();

    const response =
        await fetch(
            file + cacheBuster,
            {
                cache: "no-store"
            }
        );

    if (!response.ok) {

        throw new Error(
            file +
            " 데이터를 불러오지 못했습니다."
        );
    }

    return response.json();
}


// ============================================================
// Prediction 데이터
// ============================================================

async function loadPrediction() {

    const data =
        await fetchJSON(
            "data/prediction.json"
        );


    // 현재 가격

    document.getElementById(
        "currentPrice"
    ).textContent =
        formatPrice(
            data.current_price
        );


    // 예상 가격

    document.getElementById(
        "predictedPrice"
    ).textContent =
        formatPrice(
            data.predicted_price
        );


    // 예상 변동률

    const change =
        Number(
            data.predicted_change_percent
        );


    const changeElement =
        document.getElementById(
            "predictionChange"
        );


    changeElement.textContent =
        `${change >= 0 ? "+" : ""}${change.toFixed(2)}% 예상`;


    // 방향

    document.getElementById(
        "direction"
    ).textContent =
        data.direction;


    // 최근 거래일

    document.getElementById(
        "marketDate"
    ).textContent =
        `기준일 ${data.last_market_date}`;


    // 업데이트 시간

    if (data.updated_at_utc) {

        const date =
            new Date(
                data.updated_at_utc
            );

        document.getElementById(
            "updatedTime"
        ).textContent =
            "업데이트 " +
            date.toLocaleString(
                "ko-KR"
            );
    }


    // ========================================================
    // 기술적 지표
    // ========================================================

    const technical =
        data.technical;


    document.getElementById(
        "rsi"
    ).textContent =
        formatNumber(
            technical.rsi
        );


    document.getElementById(
        "macd"
    ).textContent =
        formatNumber(
            technical.macd,
            5
        );


    document.getElementById(
        "macdSignal"
    ).textContent =
        "Signal " +
        formatNumber(
            technical.macd_signal,
            5
        );


    document.getElementById(
        "bbUpper"
    ).textContent =
        formatPrice(
            technical.bollinger_upper
        );


    document.getElementById(
        "bbMiddle"
    ).textContent =
        formatPrice(
            technical.bollinger_middle
        );


    document.getElementById(
        "bbLower"
    ).textContent =
        formatPrice(
            technical.bollinger_lower
        );


    document.getElementById(
        "atr"
    ).textContent =
        formatNumber(
            technical.atr_14,
            5
        );


    // ========================================================
    // 모델 성능
    // ========================================================

    const performance =
        data.performance;


    document.getElementById(
        "mae"
    ).textContent =
        formatNumber(
            performance.MAE,
            5
        );


    document.getElementById(
        "rmse"
    ).textContent =
        formatNumber(
            performance.RMSE,
            5
        );


    document.getElementById(
        "mape"
    ).textContent =
        formatNumber(
            performance.MAPE
        ) + "%";


    document.getElementById(
        "r2"
    ).textContent =
        formatNumber(
            performance.R2,
            3
        );


    document.getElementById(
        "directionAccuracy"
    ).textContent =
        formatNumber(
            performance.direction_accuracy
        ) + "%";


    document.getElementById(
        "featureCount"
    ).textContent =
        data.model.features;

}


// ============================================================
// 가격 차트
// ============================================================

async function loadChart() {

    const data =
        await fetchJSON(
            "data/chart_data.json"
        );


    const labels =
        data.map(
            item => item.date
        );


    const close =
        data.map(
            item => item.close
        );


    const sma20 =
        data.map(
            item => item.sma20
        );


    const bbUpper =
        data.map(
            item => item.bb_upper
        );


    const bbLower =
        data.map(
            item => item.bb_lower
        );


    const canvas =
        document.getElementById(
            "priceChart"
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
                            label: "ATCH",
                            data: close,

                            borderWidth: 2,

                            pointRadius: 0,

                            tension: 0.15
                        },


                        {
                            label: "SMA 20",
                            data: sma20,

                            borderWidth: 1.5,

                            pointRadius: 0,

                            tension: 0.15
                        },


                        {
                            label: "Bollinger Upper",
                            data: bbUpper,

                            borderWidth: 1,

                            borderDash: [
                                5,
                                5
                            ],

                            pointRadius: 0
                        },


                        {
                            label: "Bollinger Lower",
                            data: bbLower,

                            borderWidth: 1,

                            borderDash: [
                                5,
                                5
                            ],

                            pointRadius: 0
                        }

                    ]

                },

                options: {

                    responsive: true,

                    maintainAspectRatio: false,

                    interaction: {

                        intersect: false,

                        mode: "index"
                    },

                    plugins: {

                        legend: {

                            position: "bottom"
                        }

                    },

                    scales: {

                        x: {

                            ticks: {

                                maxTicksLimit: 8
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


// ============================================================
// SEC 공시
// ============================================================

async function loadNews() {

    const newsList =
        document.getElementById(
            "newsList"
        );


    try {

        const news =
            await fetchJSON(
                "data/news.json"
            );


        if (!news.length) {

            newsList.innerHTML = `
                <div class="card">
                    최신 SEC 공시가 없습니다.
                </div>
            `;

            return;
        }


        newsList.innerHTML =
            news.map(
                item => `

                <a
                    class="card news-item"
                    href="${item.url}"
                    target="_blank"
                    rel="noopener noreferrer"
                >

                    <div class="news-left">

                        <span class="news-type">
                            ${item.type}
                        </span>

                        <span class="news-title">
                            ${item.title}
                        </span>

                    </div>

                    <span class="news-date">
                        ${item.date}
                    </span>

                </a>

            `
            ).join("");


    } catch (error) {

        newsList.innerHTML = `

            <div class="card">

                SEC 공시 데이터를
                불러오지 못했습니다.

            </div>

        `;
    }

}


// ============================================================
// 전체 로딩
// ============================================================

async function loadAll() {

    try {

        await Promise.all([
            loadPrediction(),
            loadChart(),
            loadNews()
        ]);

    } catch (error) {

        console.error(
            error
        );

        alert(
            "데이터를 불러오는 중 오류가 발생했습니다."
        );
    }

}


// ============================================================
// 새로고침 버튼
// ============================================================

document
    .getElementById(
        "refreshButton"
    )
    .addEventListener(
        "click",
        async function() {

            this.disabled = true;

            this.textContent =
                "갱신 중...";


            try {

                await loadAll();

            } finally {

                this.disabled = false;

                this.textContent =
                    "↻ 새로고침";
            }

        }
    );


// ============================================================
// 시작
// ============================================================

loadAll();
