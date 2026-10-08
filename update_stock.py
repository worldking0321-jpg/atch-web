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
# LOAD MODEL FILES
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


print("\n[1] Loading model...")


model = load_model(MODEL_PATH)

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


if isinstance(feature_columns, dict):

    if "feature_columns" in feature_columns:
        feature_columns = feature_columns["feature_columns"]

    elif "features" in feature_columns:
        feature_columns = feature_columns["features"]


print("Model loaded.")
print("Feature count:", len(feature_columns))


# =========================================================
# DOWNLOAD DATA
# =========================================================

print("\n[2] Downloading Yahoo Finance data...")


downloaded = {}


for name, ticker in TICKERS.items():

    print("Downloading:", name, ticker)

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


    if isinstance(df.columns, pd.MultiIndex):

        try:
            df.columns = df.columns.get_level_values(0)

        except Exception:
            pass


    df = df.copy()

    df.index = pd.to_datetime(
        df.index
    ).tz_localize(None)


    downloaded[name] = df


print("\nDownloaded datasets:")

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

print("\n[3] Creating ATCH trading-day master index...")


if "ATCH" not in downloaded:

    raise RuntimeError(
        "ATCH data could not be downloaded."
    )


atch = downloaded["ATCH"].copy()

master_index = atch.index


# =========================================================
# BASIC DATAFRAME
# =========================================================

data = pd.DataFrame(
    index=master_index
)


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

    series = series.reindex(
        dataframe.index
    )

    series = series.ffill()

    dataframe[new_name] = series


# ATCH
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


# Market data
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

print("\n[4] Creating features...")


def pct_return(series, period=1):

    return series.pct_change(period)


def rsi(series, period=14):

    delta = series.diff()

    gain = delta.clip(lower=0)

    loss = -delta.clip(upper=0)

    avg_gain = gain.rolling(
        period
    ).mean()

    avg_loss = loss.rolling(
        period
    ).mean()

    rs = avg_gain / avg_loss.replace(
        0,
        np.nan
    )

    return 100 - (
        100 / (1 + rs)
    )


close = data["Close"]

volume = data["Volume"]


# ---------------------------------------------------------
# Returns
# ---------------------------------------------------------

for p in [1, 2, 3, 5, 10, 20]:

    data[f"Return_{p}"] = pct_return(
        close,
        p
    )


# ---------------------------------------------------------
# Volume changes
# ---------------------------------------------------------

for p in [1, 3, 5, 10, 20]:

    data[f"Volume_Change_{p}"] = (
        volume.pct_change(p)
    )


# ---------------------------------------------------------
# Moving averages
# ---------------------------------------------------------

for p in [5, 10, 20, 50, 100, 200]:

    ma = close.rolling(p).mean()

    data[f"MA_{p}"] = ma

    data[f"Price_MA_{p}"] = (
        close / ma - 1
    )


# ---------------------------------------------------------
# EMA
# ---------------------------------------------------------

for p in [5, 10, 20, 50]:

    ema = close.ewm(
        span=p,
        adjust=False
    ).mean()

    data[f"EMA_{p}"] = ema

    data[f"Price_EMA_{p}"] = (
        close / ema - 1
    )


# ---------------------------------------------------------
# RSI
# ---------------------------------------------------------

data["RSI"] = rsi(
    close,
    14
)


# ---------------------------------------------------------
# MACD
# ---------------------------------------------------------

ema12 = close.ewm(
    span=12,
    adjust=False
).mean()

ema26 = close.ewm(
    span=26,
    adjust=False
).mean()

macd = ema12 - ema26

macd_signal = macd.ewm(
    span=9,
    adjust=False
).mean()

data["MACD"] = macd

data["MACD_Signal"] = macd_signal

data["MACD_Hist"] = (
    macd - macd_signal
)


# ---------------------------------------------------------
# Bollinger Bands
# ---------------------------------------------------------

bb_middle = close.rolling(
    20
).mean()

bb_std = close.rolling(
    20
).std()

bb_upper = (
    bb_middle +
    2 * bb_std
)

bb_lower = (
    bb_middle -
    2 * bb_std
)

data["BB_Middle"] = bb_middle

data["BB_Upper"] = bb_upper

data["BB_Lower"] = bb_lower

data["BB_Width"] = (
    (bb_upper - bb_lower)
    / bb_middle
)

data["BB_Position"] = (
    (close - bb_lower)
    /
    (bb_upper - bb_lower)
)


# ---------------------------------------------------------
# Volatility
# ---------------------------------------------------------

for p in [5, 10, 20, 30, 60]:

    data[f"Volatility_{p}"] = (
        data["Return_1"]
        .rolling(p)
        .std()
    )


# ---------------------------------------------------------
# ATCH / Market ratios
# ---------------------------------------------------------

if "SPY_Close" in data:

    data["ATCH_SPY_Ratio"] = (
        close / data["SPY_Close"]
    )


if "QQQ_Close" in data:

    data["ATCH_QQQ_Ratio"] = (
        close / data["QQQ_Close"]
    )


if "IWM_Close" in data:

    data["ATCH_IWM_Ratio"] = (
        close / data["IWM_Close"]
    )


# ---------------------------------------------------------
# Market returns
# ---------------------------------------------------------

if "SPY_Close" in data:

    data["SPY_Return"] = (
        data["SPY_Close"].pct_change()
    )


if "QQQ_Close" in data:

    data["QQQ_Return"] = (
        data["QQQ_Close"].pct_change()
    )


if "IWM_Close" in data:

    data["IWM_Return"] = (
        data["IWM_Close"].pct_change()
    )


if "BTC_Close" in data:

    data["BTC_Return"] = (
        data["BTC_Close"].pct_change()
    )


# ---------------------------------------------------------
# Macro changes
# ---------------------------------------------------------

if "VIX" in data:

    data["VIX_Change"] = (
        data["VIX"].pct_change()
    )


if "TNX" in data:

    data["TNX_Change"] = (
        data["TNX"].pct_change()
    )


if "DXY" in data:

    data["DXY_Change"] = (
        data["DXY"].pct_change()
    )


# ---------------------------------------------------------
# Relative returns
# ---------------------------------------------------------

if "SPY_Return" in data:

    data["Relative_Return_SPY"] = (
        data["Return_1"]
        - data["SPY_Return"]
    )


if "QQQ_Return" in data:

    data["Relative_Return_QQQ"] = (
        data["Return_1"]
        - data["QQQ_Return"]
    )


if "IWM_Return" in data:

    data["Relative_Return_IWM"] = (
        data["Return_1"]
        - data["IWM_Return"]
    )


# =========================================================
# TARGET
# =========================================================

data["Target_Return"] = (
    close.shift(-1) / close - 1
)


# =========================================================
# CLEAN DATA
# =========================================================

print("\n[5] Cleaning data...")


feature_data = data.copy()


feature_data = feature_data.replace(
    [np.inf, -np.inf],
    np.nan
)


feature_data = feature_data.ffill()


feature_data = feature_data.dropna(
    subset=feature_columns
)


print(
    "Feature dataframe:",
    feature_data.shape
)


# =========================================================
# CHECK FEATURES
# =========================================================

missing_features = [
    col
    for col in feature_columns
    if col not in feature_data.columns
]


if missing_features:

    print(
        "\nMissing features:"
    )

    for col in missing_features:
        print(
            " -",
            col
        )

    raise RuntimeError(
        "Required model features are missing."
    )


# =========================================================
# LATEST 60 DAYS
# =========================================================

if len(feature_data) < LOOKBACK:

    raise RuntimeError(
        "Not enough data for 60-day prediction."
    )


latest_features = feature_data[
    feature_columns
].tail(LOOKBACK)


# =========================================================
# SCALE
# =========================================================

print("\n[6] Scaling input...")


X = latest_features.values.astype(
    np.float32
)


X_scaled = feature_scaler.transform(
    X
)


X_scaled = X_scaled.reshape(
    1,
    LOOKBACK,
    len(feature_columns)
)


# =========================================================
# MODEL PREDICTION
# =========================================================

print("\n[7] Running GRU prediction...")


prediction_scaled = model.predict(
    X_scaled,
    verbose=0
)


predicted_return = (
    target_scaler.inverse_transform(
        prediction_scaled
    )[0][0]
)


# =========================================================
# LATEST PRICE
# =========================================================

latest_row = feature_data.iloc[-1]


current_price = float(
    latest_row["Close"]
)


predicted_price = (
    current_price *
    (1 + predicted_return)
)


if predicted_return > 0.005:

    direction = "상승 예상"

elif predicted_return < -0.005:

    direction = "하락 예상"

else:

    direction = "보합 예상"


prediction_strength = min(
    abs(predicted_return) / 0.05,
    1
)


prediction_strength *= 100


# =========================================================
# DATES
# =========================================================

latest_date = feature_data.index[-1]

latest_date_string = (
    latest_date.strftime(
        "%Y-%m-%d"
    )
)


# =========================================================
# SAVE PREDICTION JSON
# =========================================================

print("\n[8] Saving prediction...")


prediction_data = {

    "ticker": TICKER,

    "company": "Atlas Clear Holdings",

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
            float(predicted_return),
            8
        ),

    "predicted_price":
        round(
            float(predicted_price),
            6
        ),

    "direction":
        direction,

    "prediction_strength":
        round(
            float(prediction_strength),
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


with open(
    os.path.join(
        DATA_DIR,
        "latest_prediction.json"
    ),
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
# SAVE LATEST DATA
# =========================================================

print("\n[9] Saving latest_data.csv...")


# 최근 250개만 웹사이트에서 사용
latest_output = feature_data.tail(
    250
).copy()


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

history_path = os.path.join(
    DATA_DIR,
    "prediction_history.csv"
)


new_history = pd.DataFrame(
    [{
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
    }]
)


if os.path.exists(history_path):

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


history = history.drop_duplicates(
    subset=["reference_date"],
    keep="last"
)


history = history.sort_values(
    "reference_date"
)


history.to_csv(
    history_path,
    index=False
)


# =========================================================
# SUMMARY
# =========================================================

print("\n==========================================")
print("UPDATE COMPLETE")
print("==========================================")

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
    "Features:",
    len(feature_columns)
)

print(
    "==========================================")
