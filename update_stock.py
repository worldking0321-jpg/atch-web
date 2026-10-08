import os
import json
import warnings
from datetime import datetime, timezone

import numpy as np
import pandas as pd
import yfinance as yf
import joblib

from tensorflow.keras.models import load_model

warnings.filterwarnings("ignore")


# =========================================================
# SETTINGS
# =========================================================

TICKER = "ATCH"

TICKERS = {
    "ATCH": "ATCH",
    "SPY": "SPY",
    "QQQ": "QQQ",
    "IWM": "IWM",
    "VIX": "^VIX",
    "TNX": "^TNX",
    "DXY": "DX-Y.NYB",
    "BTC": "BTC-USD"
}

LOOKBACK = 60

DATA_DIR = "data"
MODEL_DIR = "model"

os.makedirs(DATA_DIR, exist_ok=True)


# =========================================================
# MODEL FILE PATHS
# =========================================================

MODEL_PATH = os.path.join(
    MODEL_DIR,
    "atch_gru_model.keras"
)

FEATURE_SCALER_PATH = os.path.join(
    MODEL_DIR,
    "feature_scaler.pkl"
)

TARGET_SCALER_PATH = os.path.join(
    MODEL_DIR,
    "target_scaler.pkl"
)

FEATURE_COLUMNS_PATH = os.path.join(
    MODEL_DIR,
    "feature_columns.json"
)

CONFIG_PATH = os.path.join(
    MODEL_DIR,
    "model_config.json"
)


print("==========================================")
print("ATCH AI STOCK AUTO UPDATE")
print("==========================================")


# =========================================================
# LOAD MODEL
# =========================================================

print("\n[1] Loading model...")


model = load_model(
    MODEL_PATH
)


feature_scaler = joblib.load(
    FEATURE_SCALER_PATH
)


target_scaler = joblib.load(
    TARGET_SCALER_PATH
)


with open(
    FEATURE_COLUMNS_PATH,
    "r",
    encoding="utf-8"
) as f:

    feature_columns = json.load(f)


# feature_columns.json이
# {"feature_columns": [...]} 형태일 경우 대응

if isinstance(
    feature_columns,
    dict
):

    if "feature_columns" in feature_columns:

        feature_columns = (
            feature_columns["feature_columns"]
        )

    elif "features" in feature_columns:

        feature_columns = (
            feature_columns["features"]
        )


print(
    "Model loaded."
)

print(
    "Feature count:",
    len(feature_columns)
)


# =========================================================
# DOWNLOAD YAHOO FINANCE DATA
# =========================================================

print(
    "\n[2] Downloading Yahoo Finance data..."
)


downloaded = {}


for name, ticker in TICKERS.items():

    print(
        "Downloading:",
        name,
        ticker
    )

    df = yf.download(
        ticker,
        period="3y",
        interval="1d",
        auto_adjust=False,
        progress=False
    )


    if df is None or df.empty:

        print(
            "WARNING:",
            name,
            "download failed"
        )

        continue


    # yfinance 최신 버전에서
    # MultiIndex가 생기는 경우 처리

    if isinstance(
        df.columns,
        pd.MultiIndex
    ):

        df.columns = (
            df.columns
            .get_level_values(0)
        )


    df = df.copy()


    # timezone 제거

    df.index = pd.to_datetime(
        df.index
    )


    try:

        df.index = (
            df.index
            .tz_localize(None)
        )

    except:

        pass


    downloaded[name] = df


print(
    "\nDownloaded datasets:"
)


for key, df in downloaded.items():

    print(
        key,
        df.shape,
        df.index.min(),
        df.index.max()
    )


# =========================================================
# ATCH MASTER INDEX
# =========================================================

print(
    "\n[3] Creating ATCH trading-day master index..."
)


if "ATCH" not in downloaded:

    raise RuntimeError(
        "ATCH data could not be downloaded."
    )


atch = downloaded["ATCH"].copy()


# ATCH 실제 거래일만 사용

master_index = atch.index


data = pd.DataFrame(
    index=master_index
)


# =========================================================
# ADD SERIES FUNCTION
# =========================================================

def add_series(
    dataframe,
    source,
    column,
    new_name
):

    if source not in downloaded:

        return


    df = downloaded[source]


    if column not in df.columns:

        return


    series = df[column]


    # ATCH 거래일에 맞춰 정렬

    series = series.reindex(
        dataframe.index
    )


    # 시장 데이터가 빠진 날은
    # 이전 거래일 값 사용

    series = series.ffill()


    dataframe[new_name] = series


# =========================================================
# ATCH DATA
# =========================================================

add_series(
    data,
    "ATCH",
    "Close",
    "Close"
)


add_series(
    data,
    "ATCH",
    "Volume",
    "Volume"
)


# =========================================================
# MARKET DATA
# =========================================================

add_series(
    data,
    "SPY",
    "Close",
    "SPY_Close"
)


add_series(
    data,
    "QQQ",
    "Close",
    "QQQ_Close"
)


add_series(
    data,
    "IWM",
    "Close",
    "IWM_Close"
)


add_series(
    data,
    "VIX",
    "Close",
    "VIX"
)


add_series(
    data,
    "TNX",
    "Close",
    "TNX"
)


add_series(
    data,
    "DXY",
    "Close",
    "DXY"
)


add_series(
    data,
    "BTC",
    "Close",
    "BTC_Close"
)


# =========================================================
# FEATURE ENGINEERING
# =========================================================

print(
    "\n[4] Creating features..."
)


close = data["Close"]

volume = data["Volume"]


# =========================================================
# RETURN 1 / 2 / 3 / 5 / 10 / 20
# =========================================================

for p in [
    1,
    2,
    3,
    5,
    10,
    20
]:

    data[
        f"Return_{p}"
    ] = (
        close.pct_change(p)
    )


# =========================================================
# VOLUME CHANGE
# =========================================================

for p in [
    1,
    3,
    5,
    10,
    20
]:

    data[
        f"Volume_Change_{p}"
    ] = (
        volume.pct_change(p)
    )


# =========================================================
# MOVING AVERAGE
# =========================================================

for p in [
    5,
    10,
    20,
    50,
    100,
    200
]:

    ma = close.rolling(
        p
    ).mean()


    data[
        f"MA_{p}"
    ] = ma


    data[
        f"Price_MA_{p}"
    ] = (
        close / ma - 1
    )


# =========================================================
# EMA
# =========================================================

for p in [
    5,
    10,
    20,
    50
]:

    ema = close.ewm(
        span=p,
        adjust=False
    ).mean()


    data[
        f"EMA_{p}"
    ] = ema


    data[
        f"Price_EMA_{p}"
    ] = (
        close / ema - 1
    )


# =========================================================
# RSI
# =========================================================

def calculate_rsi(
    series,
    period=14
):

    delta = series.diff()


    gain = delta.clip(
        lower=0
    )


    loss = -delta.clip(
        upper=0
    )


    avg_gain = (
        gain
        .rolling(period)
        .mean()
    )


    avg_loss = (
        loss
        .rolling(period)
        .mean()
    )


    rs = (
        avg_gain /
        avg_loss.replace(
            0,
            np.nan
        )
    )


    return (
        100 -
        (
            100 /
            (1 + rs)
        )
    )


data["RSI"] = calculate_rsi(
    close,
    14
)


# =========================================================
# MACD
# =========================================================

ema12 = close.ewm(
    span=12,
    adjust=False
).mean()


ema26 = close.ewm(
    span=26,
    adjust=False
).mean()


macd = (
    ema12 -
    ema26
)


macd_signal = (
    macd
    .ewm(
        span=9,
        adjust=False
    )
    .mean()
)


data["MACD"] = macd


data["MACD_Signal"] = (
    macd_signal
)


data["MACD_Hist"] = (
    macd -
    macd_signal
)


# =========================================================
# BOLLINGER BANDS
# =========================================================

bb_middle = (
    close
    .rolling(20)
    .mean()
)


bb_std = (
    close
    .rolling(20)
    .std()
)


bb_upper = (
    bb_middle +
    2 * bb_std
)


bb_lower = (
    bb_middle -
    2 * bb_std
)


data["BB_Middle"] = (
    bb_middle
)


data["BB_Upper"] = (
    bb_upper
)


data["BB_Lower"] = (
    bb_lower
)


data["BB_Width"] = (
    (bb_upper - bb_lower)
    / bb_middle
)


data["BB_Position"] = (
    (close - bb_lower)
    /
    (bb_upper - bb_lower)
)


# =========================================================
# VOLATILITY
# =========================================================

for p in [
    5,
    10,
    20,
    30,
    60
]:

    data[
        f"Volatility_{p}"
    ] = (
        data["Return_1"]
        .rolling(p)
        .std()
    )


# =========================================================
# ATCH / MARKET RATIO
# =========================================================

data[
    "ATCH_SPY_Ratio"
] = (
    close /
    data["SPY_Close"]
)


data[
    "ATCH_QQQ_Ratio"
] = (
    close /
    data["QQQ_Close"]
)


data[
    "ATCH_IWM_Ratio"
] = (
    close /
    data["IWM_Close"]
)


# =========================================================
# MARKET RETURNS
#
# IMPORTANT:
# 모델에서 실제 사용한 feature 이름
# SPY_Return_1
# SPY_Return_3
# SPY_Return_5
# 등을 그대로 생성
# =========================================================

for p in [
    1,
    3,
    5
]:

    data[
        f"SPY_Return_{p}"
    ] = (
        data["SPY_Close"]
        .pct_change(p)
    )


    data[
        f"QQQ_Return_{p}"
    ] = (
        data["QQQ_Close"]
        .pct_change(p)
    )


    data[
        f"IWM_Return_{p}"
    ] = (
        data["IWM_Close"]
        .pct_change(p)
    )


    data[
        f"BTC_Return_{p}"
    ] = (
        data["BTC_Close"]
        .pct_change(p)
    )


# =========================================================
# MACRO CHANGES
# =========================================================

data[
    "VIX_Change"
] = (
    data["VIX"]
    .pct_change()
)


data[
    "TNX_Change"
] = (
    data["TNX"]
    .pct_change()
)


data[
    "DXY_Change"
] = (
    data["DXY"]
    .pct_change()
)


# =========================================================
# RELATIVE RETURNS
#
# IMPORTANT:
# 실제 feature 이름에 맞춤
# =========================================================

data[
    "Relative_SPY_Return"
] = (
    data["Return_1"]
    -
    data["SPY_Return_1"]
)


data[
    "Relative_QQQ_Return"
] = (
    data["Return_1"]
    -
    data["QQQ_Return_1"]
)


data[
    "Relative_IWM_Return"
] = (
    data["Return_1"]
    -
    data["IWM_Return_1"]
)


# =========================================================
# TARGET
#
# 최신 데이터는 다음날 데이터가 없으므로
# 실제 예측에서는 Target을 사용하지 않음
# =========================================================

data[
    "Target_Return"
] = (
    close.shift(-1)
    /
    close
    -
    1
)


# =========================================================
# CLEAN DATA
# =========================================================

print(
    "\n[5] Cleaning data..."
)


data = data.replace(
    [
        np.inf,
        -np.inf
    ],
    np.nan
)


# 시장 데이터의 빈 부분 보완

data = data.ffill()


# =========================================================
# FEATURE CHECK
# =========================================================

missing_features = [
    col
    for col in feature_columns
    if col not in data.columns
]


if missing_features:

    print(
        "\n=========================================="
    )

    print(
        "ERROR: Missing model features"
    )

    print(
        "=========================================="
    )


    for col in missing_features:

        print(
            " -",
            col
        )


    raise RuntimeError(
        "Required model features are missing."
    )


print(
    "All model features found."
)


# =========================================================
# REMOVE ROWS WITH MISSING FEATURES
# =========================================================

feature_data = data.dropna(
    subset=feature_columns
)


print(
    "Final feature data:",
    feature_data.shape
)


print(
    "Feature count:",
    len(feature_columns)
)


# =========================================================
# CHECK LOOKBACK
# =========================================================

if len(feature_data) < LOOKBACK:

    raise RuntimeError(
        "Not enough data for "
        "60-day prediction."
    )


# =========================================================
# LAST 60 DAYS
# =========================================================

latest_features = (
    feature_data[
        feature_columns
    ]
    .tail(LOOKBACK)
)


# =========================================================
# SCALE
# =========================================================

print(
    "\n[6] Scaling input..."
)


X = (
    latest_features
    .values
    .astype(
        np.float32
    )
)


X_scaled = (
    feature_scaler
    .transform(X)
)


X_scaled = (
    X_scaled
    .reshape(
        1,
        LOOKBACK,
        len(feature_columns)
    )
)


# =========================================================
# GRU PREDICTION
# =========================================================

print(
    "\n[7] Running GRU prediction..."
)


prediction_scaled = (
    model.predict(
        X_scaled,
        verbose=0
    )
)


# =========================================================
# INVERSE SCALE
# =========================================================

predicted_return = (
    target_scaler
    .inverse_transform(
        prediction_scaled
    )[0][0]
)


predicted_return = float(
    predicted_return
)


# =========================================================
# CURRENT PRICE
# =========================================================

latest_row = (
    feature_data.iloc[-1]
)


current_price = float(
    latest_row["Close"]
)


# =========================================================
# PREDICTED PRICE
# =========================================================

predicted_price = (
    current_price *
    (
        1 +
        predicted_return
    )
)


# =========================================================
# DIRECTION
# =========================================================

if predicted_return > 0.005:

    direction = "상승 예상"

elif predicted_return < -0.005:

    direction = "하락 예상"

else:

    direction = "보합 예상"


# =========================================================
# PREDICTION STRENGTH
#
# 주의:
# 실제 확률이 아니라
# 예측 수익률의 절대값을 이용한
# 화면 표시용 강도
# =========================================================

prediction_strength = min(
    abs(predicted_return) / 0.05,
    1
) * 100


# =========================================================
# LATEST DATE
# =========================================================

latest_date = (
    feature_data.index[-1]
)


latest_date_string = (
    latest_date.strftime(
        "%Y-%m-%d"
    )
)


# =========================================================
# PREDICTION JSON
# =========================================================

prediction_data = {

    "ticker":
        TICKER,

    "company":
        "Atlas Clear Holdings",

    "reference_date":
        latest_date_string,

    "date":
        latest_date_string,

    "current_price":
        round(
            current_price,
            6
        ),

    "predicted_return":
        round(
            predicted_return,
            8
        ),

    "predicted_price":
        round(
            predicted_price,
            6
        ),

    "direction":
        direction,

    "prediction_strength":
        round(
            prediction_strength,
            2
        ),

    "model":
        "GRU",

    "lookback":
        LOOKBACK,

    "feature_count":
        len(feature_columns),

    "scaler":
        "StandardScaler",

    "updated_at":
        datetime.now(
            timezone.utc
        ).isoformat()
}


# =========================================================
# SAVE JSON
# =========================================================

prediction_path = os.path.join(
    DATA_DIR,
    "latest_prediction.json"
)


with open(
    prediction_path,
    "w",
    encoding="utf-8"
) as f:

    json.dump(
        prediction_data,
        f,
        ensure_ascii=False,
        indent=2
    )


# =========================================================
# SAVE LATEST DATA CSV
# =========================================================

print(
    "\n[8] Saving latest_data.csv..."
)


# 최근 250 거래일만 저장
# 웹사이트 차트에 충분

latest_output = (
    feature_data
    .tail(250)
    .copy()
)


latest_output.insert(
    0,
    "Date",
    latest_output.index.strftime(
        "%Y-%m-%d"
    )
)


latest_output.to_csv(
    os.path.join(
        DATA_DIR,
        "latest_data.csv"
    ),
    index=False
)


# =========================================================
# PREDICTION HISTORY
# =========================================================

print(
    "\n[9] Updating prediction history..."
)


history_path = os.path.join(
    DATA_DIR,
    "prediction_history.csv"
)


new_history = pd.DataFrame(
    [
        {

            "reference_date":
                latest_date_string,

            "current_price":
                current_price,

            "predicted_return":
                predicted_return,

            "predicted_price":
                predicted_price,

            "direction":
                direction,

            "prediction_strength":
                prediction_strength,

            "model":
                "GRU"

        }
    ]
)


if os.path.exists(
    history_path
):

    history = pd.read_csv(
        history_path
    )


    history = pd.concat(
        [
            history,
            new_history
        ],
        ignore_index=True
    )


else:

    history = new_history


# 같은 날짜가 여러 번 들어가는 것 방지

history = (
    history
    .drop_duplicates(
        subset=[
            "reference_date"
        ],
        keep="last"
    )
)


history = (
    history
    .sort_values(
        "reference_date"
    )
)


history.to_csv(
    history_path,
    index=False
)


# =========================================================
# FINAL OUTPUT
# =========================================================

print(
    "\n=========================================="
)

print(
    "UPDATE COMPLETE"
)

print(
    "=========================================="
)

print(
    "Reference date:",
    latest_date_string
)

print(
    "Current price:",
    current_price
)

print(
    "Predicted return:",
    predicted_return
)

print(
    "Predicted price:",
    predicted_price
)

print(
    "Direction:",
    direction
)

print(
    "Prediction strength:",
    prediction_strength
)

print(
    "Feature count:",
    len(feature_columns)
)

print(
    "=========================================="
)
