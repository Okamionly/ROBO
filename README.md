# ROBO

This repository contains a minimal example of an automated trading bot using a simple moving average strategy.

## Usage

1. Install dependencies:
   ```bash
   pip install requests pandas
   ```
2. Run the bot:
   ```bash
   python trading_bot.py
   ```

The bot fetches pricing data from a placeholder API and prints BUY/SELL/HOLD signals based on short and long moving averages. Replace `https://example.com/api` in `trading_bot.py` with a real data provider.
