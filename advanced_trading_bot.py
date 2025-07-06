import time
import random
from statistics import mean

try:
    import MetaTrader5 as mt5
except Exception as e:
    mt5 = None
    print(f"MetaTrader5 module not available: {e}")


class AdvancedTradingBot:
    """Advanced trading bot using historical data from MetaTrader5."""

    def __init__(self, symbol="EURUSD", timeframe=mt5.TIMEFRAME_M1 if mt5 else None, volume=0.1):
        self.symbol = symbol
        self.timeframe = timeframe
        self.volume = volume

    def connect(self):
        if mt5 is None:
            raise RuntimeError("MetaTrader5 package is not installed.")
        if not mt5.initialize():
            raise ConnectionError(f"Failed to initialize MT5: {mt5.last_error()}")

    def disconnect(self):
        if mt5:
            mt5.shutdown()

    def fetch_price(self, bars=10):
        """Fetch recent closing prices using copy_rates_from_pos."""
        rates = mt5.copy_rates_from_pos(self.symbol, self.timeframe, 0, bars)
        if rates is None or len(rates) == 0:
            raise RuntimeError(f"Failed to fetch rates: {mt5.last_error()}")
        return [r.close for r in rates]

    def generate_signal(self, closes):
        if len(closes) < 2:
            return "HOLD"
        if closes[-1] > mean(closes[:-1]):
            return random.choice(["BUY", "HOLD"])
        else:
            return random.choice(["SELL", "HOLD"])

    def place_order(self, signal):
        tick = mt5.symbol_info_tick(self.symbol)
        if tick is None:
            raise RuntimeError(f"Failed to fetch tick: {mt5.last_error()}")
        price = tick.ask if signal == "BUY" else tick.bid
        order_type = mt5.ORDER_TYPE_BUY if signal == "BUY" else mt5.ORDER_TYPE_SELL
        request = {
            "action": mt5.TRADE_ACTION_DEAL,
            "symbol": self.symbol,
            "volume": self.volume,
            "type": order_type,
            "price": price,
            "deviation": 20,
            "magic": 234001,
            "comment": "ROBO advanced order",
            "type_time": mt5.ORDER_TIME_GTC,
            "type_filling": mt5.ORDER_FILLING_FOK,
        }
        result = mt5.order_send(request)
        if result is None or result.retcode != mt5.TRADE_RETCODE_DONE:
            raise RuntimeError(f"Order failed: {result}")
        print(f"Order placed: {result}")

    def run(self, iterations=10, delay=60):
        self.connect()
        try:
            for _ in range(iterations):
                closes = self.fetch_price()
                signal = self.generate_signal(closes)
                if signal in ("BUY", "SELL"):
                    try:
                        self.place_order(signal)
                    except Exception as e:
                        print(f"Order error: {e}")
                time.sleep(delay)
        finally:
            self.disconnect()
