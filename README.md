# ROBO

This repository contains a minimal example of an automated trading bot using a simple moving average strategy.

## Usage

1. Install dependencies for the simple bot:
   ```bash
   pip install requests pandas
   ```
2. Run the simple moving average bot:
   ```bash
   python trading_bot.py
   ```

### Advanced Bot

An extended example using additional technical indicators and a simple
machine learning model is provided in `advanced_trading_bot.py`.

1. Install extra dependencies:
   ```bash
   pip install requests pandas ta scikit-learn
   ```
2. Run the advanced bot:
   ```bash
   python advanced_trading_bot.py
   ```

Both example bots fetch pricing data from a placeholder API. Replace
`https://example.com/api` in the scripts with a real data provider when
running against live markets.
