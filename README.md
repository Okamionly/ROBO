# ROBO

Simple trading bots built using the `MetaTrader5` Python package.

## Installation

The bots require the [MetaTrader 5](https://www.metatrader5.com/) terminal and
its accompanying Python package. On Windows, install the package via pip:

```bash
pip install MetaTrader5
```

Download and install the MetaTrader 5 terminal, then enable automated trading
via **Tools > Options > Expert Advisors > Allow automated trading**.

## Configuration

Ensure the terminal is logged in to your trading account. The bots connect
using `mt5.initialize()` which by default searches for a running terminal.
If necessary, pass the path to the terminal executable in `mt5.initialize()`.

## Running the bots

Two example bots are provided:

- `trading_bot.py` – fetches the latest tick and places market orders based on
  simple signals.
- `advanced_trading_bot.py` – pulls recent historical data and makes decisions
  using a basic strategy.

Both bots will attempt to place orders when a signal is `BUY` or `SELL`.
Failed connections or order submissions raise exceptions so you can add your
own handling logic.
