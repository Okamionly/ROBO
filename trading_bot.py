import time
import random

try:
    import MetaTrader5 as mt5
except Exception as e:
    mt5 = None
    print(f"MetaTrader5 module not available: {e}")


class TradingBot:
    """Basic trading bot using MetaTrader5."""

    def __init__(self, symbol="EURUSD", volume=0.1):
        self.symbol = symbol
        self.volume = volume

    def connect(self):
        """Initialize connection to MetaTrader 5 terminal."""
        if mt5 is None:
            raise RuntimeError("MetaTrader5 package is not installed.")
        if not mt5.initialize():
            raise ConnectionError(f"Failed to initialize MT5: {mt5.last_error()}")

    def disconnect(self):
        if mt5:
            mt5.shutdown()

    def fetch_price(self):
        """Fetch the latest tick data for the configured symbol."""
        tick = mt5.symbol_info_tick(self.symbol)
        if tick is None:
            raise RuntimeError(f"Failed to fetch tick: {mt5.last_error()}")
        return tick.bid, tick.ask

    def generate_signal(self, price):
        """Dummy signal generator."""
        return random.choice(["BUY", "SELL", "HOLD"])

    def place_order(self, signal):
        """Send a market order using mt5.order_send."""
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
            "magic": 234000,
            "comment": "ROBO order",
            "type_time": mt5.ORDER_TIME_GTC,
            "type_filling": mt5.ORDER_FILLING_FOK,
        }
        result = mt5.order_send(request)
        if result is None or result.retcode != mt5.TRADE_RETCODE_DONE:
            raise RuntimeError(f"Order failed: {result}")
        print(f"Order placed: {result}")

    def run(self, iterations=10, delay=1):
        """Run the trading loop."""
        self.connect()
        try:
            for _ in range(iterations):
                bid, ask = self.fetch_price()
                price = (bid + ask) / 2
                signal = self.generate_signal(price)
                if signal in ("BUY", "SELL"):
                    try:
                        self.place_order(signal)
                    except Exception as e:
                        print(f"Order error: {e}")
                time.sleep(delay)
        finally:
            self.disconnect()
