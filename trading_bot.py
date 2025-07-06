import requests
import pandas as pd
import time

class MovingAverageBot:
    def __init__(self, symbol, short_window=5, long_window=20, api_url="https://example.com/api"):
        self.symbol = symbol
        self.short_window = short_window
        self.long_window = long_window
        self.api_url = api_url
        self.history = []

    def fetch_price(self):
        # Placeholder for fetching current price from an API
        # This function would typically perform an HTTP request to a broker or data provider
        response = requests.get(f"{self.api_url}?symbol={self.symbol}")
        data = response.json()
        return float(data["price"])

    def compute_signals(self):
        series = pd.Series(self.history)
        short_ma = series.rolling(window=self.short_window).mean()
        long_ma = series.rolling(window=self.long_window).mean()
        if len(series) >= self.long_window:
            if short_ma.iloc[-1] > long_ma.iloc[-1]:
                return "BUY"
            elif short_ma.iloc[-1] < long_ma.iloc[-1]:
                return "SELL"
        return "HOLD"

    def run(self, iterations=10, delay=1):
        for _ in range(iterations):
            price = self.fetch_price()
            self.history.append(price)
            signal = self.compute_signals()
            print(f"{self.symbol} price: {price} signal: {signal}")
            time.sleep(delay)

if __name__ == "__main__":
    bot = MovingAverageBot("AAPL")
    bot.run()
