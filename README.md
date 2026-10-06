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

## Labo Options (apprendre les options)

`options_lab.html` est une application autonome, en français, pour apprendre
les options en manipulant des positions comme sur OptionStrat. Ouvrez le
fichier dans un navigateur, sans installation ni serveur.

- **Simulateur** : 19 stratégies prêtes à l'emploi (long call, spreads,
  straddle, iron condor, butterfly, calendaire, covered call, collar…),
  jambes modifiables, strikes à faire glisser, échéances réelles (weeklies,
  mensuelles, LEAPS). Il affiche débit ou crédit net, perte et gain max,
  probabilité de profit, points morts, Grecques de la position, graphique P/L
  (date choisie, échéance, distribution de probabilité) et tableau P/L par prix
  et par date. Le bouton « Exemple AAPL » recharge la position de référence
  (call 305 à 32 jours, débit 1 082,50 $, point mort 315,83 $, 35 % de chances).
- **Cours** : 10 leçons courtes, de la définition d'une option à la gestion
  du risque, plus un glossaire avec recherche.
- **Labo Grecques** : une option, tous ses paramètres, et les courbes de prix,
  delta, gamma, theta et vega selon le temps restant.
- **Quiz** : séries de 10 questions, dont certaines générées avec des
  chiffres aléatoires.

Les calculs (`options_engine.js`) utilisent Black-Scholes sans dividendes, avec
une volatilité constante. Saisir une prime réelle sur une jambe recalcule sa
volatilité implicite. Les contenus pédagogiques sont dans `options_content.js`,
l'interface dans `options_lab.js`. Pour lancer les tests du moteur :

```bash
npm test
```
