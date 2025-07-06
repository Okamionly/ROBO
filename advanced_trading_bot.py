import requests
import pandas as pd
import numpy as np
import time
import logging
from sklearn.linear_model import LogisticRegression
import ta

class AdvancedTradingBot:
    """Trading bot with multiple indicators and a simple ML model."""

    def __init__(self, symbol, api_url="https://example.com/api", short_window=5, long_window=20, rsi_window=14):
        self.symbol = symbol
        self.api_url = api_url
        self.short_window = short_window
        self.long_window = long_window
        self.rsi_window = rsi_window
        self.history = []
        self.model = LogisticRegression()
        self.trained = False
        logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")

    def fetch_price(self):
        """Fetch the latest price from an API."""
        response = requests.get(f"{self.api_url}?symbol={self.symbol}")
        data = response.json()
        return float(data["price"])

    def compute_indicators(self, prices):
        df = pd.DataFrame({"price": prices})
        df["short_ma"] = df["price"].rolling(window=self.short_window).mean()
        df["long_ma"] = df["price"].rolling(window=self.long_window).mean()
        df["rsi"] = ta.momentum.rsi(df["price"], window=self.rsi_window)
        df["macd"] = ta.trend.macd(df["price"])
        df.fillna(method="bfill", inplace=True)
        df.fillna(method="ffill", inplace=True)
        return df

    def train_model(self, df):
        if len(df) <= self.long_window:
            return
        df["target"] = (df["price"].shift(-1) > df["price"]).astype(int)
        X = df[["short_ma", "long_ma", "rsi", "macd"]][:-1]
        y = df["target"][:-1]
        if len(np.unique(y)) > 1:
            self.model.fit(X, y)
            self.trained = True

    def predict_signal(self, row):
        if not self.trained:
            return "HOLD"
        X = row[["short_ma", "long_ma", "rsi", "macd"]].values.reshape(1, -1)
        pred = self.model.predict(X)[0]
        return "BUY" if pred == 1 else "SELL"

    def send_alert(self, message):
        logging.info("ALERT: %s", message)

    def run(self, iterations=10, delay=1):
        for _ in range(iterations):
            price = self.fetch_price()
            self.history.append(price)
            df = self.compute_indicators(self.history)
            self.train_model(df)
            signal = self.predict_signal(df.iloc[-1])
            print(f"{self.symbol} price: {price} signal: {signal}")
            if signal != "HOLD":
                self.send_alert(signal)
            time.sleep(delay)

if __name__ == "__main__":
    bot = AdvancedTradingBot("AAPL")
    bot.run()
