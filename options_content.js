/*
 * options_content.js — Contenu pédagogique du Labo Options : leçons, quiz et glossaire.
 * Les CTA des leçons pointent vers des stratégies du catalogue (options_engine.js).
 */
(function (root) {
  "use strict";

  // cta : { preset: clé de stratégie } | { example: true } | { tab: 'grecques'|'quiz' }
  const LESSONS = [
    {
      id: "bases",
      title: "Qu'est-ce qu'une option ?",
      minutes: 4,
      figure: ["long-call", "long-put"],
      body: `
<p>Une option est un contrat qui donne à son acheteur le <strong>droit</strong>, mais pas l'obligation, d'acheter ou de vendre un actif (le <em>sous-jacent</em>) à un prix fixé à l'avance, le <strong>strike</strong> (prix d'exercice), jusqu'à une date donnée, l'<strong>échéance</strong>.</p>
<ul>
  <li>Un <strong>call</strong> donne le droit d'<em>acheter</em> au strike.</li>
  <li>Un <strong>put</strong> donne le droit de <em>vendre</em> au strike.</li>
</ul>
<p>L'acheteur paie une <strong>prime</strong> au vendeur. Le vendeur (on dit aussi « émetteur ») encaisse cette prime et prend en échange l'obligation correspondante : livrer les actions pour un call, les acheter pour un put, si l'acheteur exerce.</p>
<p>Sur les actions américaines, un contrat standard porte sur <strong>100 actions</strong>. Une prime cotée 10,83 $ coûte donc environ 1 083 $ par contrat. C'est exactement le « Net debit » de 1 082,50 $ de l'exemple AAPL : 10,825 $ × 100.</p>
<p>Les options sur actions US sont de style <strong>américain</strong> (exercice possible à tout moment avant l'échéance). Beaucoup d'options sur indices, comme le SPX, sont de style <strong>européen</strong> (exercice uniquement à l'échéance).</p>
<div class="callout"><strong>Lire un nom d'option.</strong> « AAPL 305C 4 sept. » = call sur Apple, strike 305 $, échéance le 4 septembre. Le symbole officiel OCC s'écrit <code>AAPL  260904C00305000</code> : ticker, date AAMMJJ, C ou P, strike × 1000.</div>`,
      keyPoints: [
        "Acheteur d'option : risque limité à la prime payée.",
        "Vendeur d'option : gain limité à la prime, risque potentiellement élevé.",
        "1 contrat = 100 actions : multipliez la prime par 100.",
      ],
      cta: [
        { label: "Essayer un achat de call", preset: "long-call" },
        { label: "Essayer un achat de put", preset: "long-put" },
      ],
    },
    {
      id: "payoff",
      title: "Call et put : les 4 positions de base",
      minutes: 5,
      figure: ["long-call", "short-call", "long-put", "short-put"],
      body: `
<p>À l'échéance, une option ne vaut plus que sa <strong>valeur intrinsèque</strong> :</p>
<ul>
  <li>Call : <code>max(S − K, 0)</code></li>
  <li>Put : <code>max(K − S, 0)</code></li>
</ul>
<p>où <code>S</code> est le cours du sous-jacent et <code>K</code> le strike. Le profit de l'acheteur est cette valeur moins la prime payée. Le vendeur a exactement le profil inverse : c'est un jeu à somme nulle, frais mis à part.</p>
<div class="table-scroll"><table class="data">
  <thead><tr><th>Position</th><th>Vision</th><th>Gain max</th><th>Perte max</th><th>Point mort</th></tr></thead>
  <tbody>
    <tr><td>Achat de call</td><td>Haussière</td><td>Illimité</td><td>Prime</td><td>K + prime</td></tr>
    <tr><td>Achat de put</td><td>Baissière</td><td>(K − prime) × 100</td><td>Prime</td><td>K − prime</td></tr>
    <tr><td>Vente de call</td><td>Neutre à baissière</td><td>Prime</td><td>Illimitée</td><td>K + prime</td></tr>
    <tr><td>Vente de put</td><td>Neutre à haussière</td><td>Prime</td><td>(K − prime) × 100</td><td>K − prime</td></tr>
  </tbody>
</table></div>
<p>Le graphique en « crosse de hockey » vient de là : plat d'un côté du strike (l'option expire sans valeur), puis une pente de 100 $ par dollar de mouvement de l'autre côté.</p>`,
      keyPoints: [
        "Point mort d'un call acheté : strike + prime.",
        "Point mort d'un put acheté : strike − prime.",
        "Vendre une option, c'est prendre le profil exactement opposé à l'acheteur.",
      ],
      cta: [
        { label: "Vente de put", preset: "short-put" },
        { label: "Vente de call", preset: "short-call" },
      ],
    },
    {
      id: "valeur",
      title: "Prime = valeur intrinsèque + valeur temps",
      minutes: 4,
      body: `
<p>La prime d'une option se décompose en deux parties :</p>
<ul>
  <li><strong>Valeur intrinsèque</strong> : ce que rapporterait l'exercice immédiat. Elle ne peut pas être négative.</li>
  <li><strong>Valeur temps</strong> : tout le reste. Elle rémunère la possibilité que le cours bouge d'ici l'échéance. Elle dépend du temps restant, de la volatilité et des taux, et elle fond jusqu'à zéro à l'échéance.</li>
</ul>
<p>On classe les options selon leur position par rapport au cours, la <em>moneyness</em> :</p>
<ul>
  <li><strong>Dans la monnaie (ITM)</strong> : valeur intrinsèque positive. Call si S &gt; K, put si S &lt; K.</li>
  <li><strong>À la monnaie (ATM)</strong> : strike proche du cours. C'est là que la valeur temps est la plus forte.</li>
  <li><strong>Hors de la monnaie (OTM)</strong> : valeur intrinsèque nulle, la prime n'est que de la valeur temps.</li>
</ul>
<div class="callout"><strong>Exemple AAPL.</strong> Cours 306,38 $, call strike 305 $ à 10,825 $. Valeur intrinsèque : 306,38 − 305 = 1,38 $. Valeur temps : 10,825 − 1,38 = 9,445 $. Près de 90 % de la prime est donc de la valeur temps, qui disparaîtra d'ici l'échéance si le cours ne bouge pas.</div>`,
      keyPoints: [
        "À l'échéance, la valeur temps vaut zéro.",
        "Une option OTM n'a que de la valeur temps.",
        "La valeur temps est maximale à la monnaie.",
      ],
      cta: [{ label: "Ouvrir le Labo Grecques", tab: "grecques" }],
    },
    {
      id: "graphique",
      title: "Lire un graphique de profit et perte",
      minutes: 6,
      body: `
<p>Le simulateur reprend la mise en page des outils comme OptionStrat. Avec l'exemple AAPL (call 305 à 32 jours), voici comment lire chaque élément :</p>
<dl class="defs">
  <dt>Débit net</dt><dd>Ce que vous payez à l'ouverture : 1 082,50 $. Si vous encaissez de l'argent (vente d'options), on parle de <em>crédit net</em>.</dd>
  <dt>Perte max</dt><dd>La pire perte à l'échéance. Pour un call acheté : la prime, si AAPL termine sous 305 $.</dd>
  <dt>Gain max</dt><dd>Illimité pour un call acheté : chaque dollar au-dessus du point mort rapporte 100 $.</dd>
  <dt>Probabilité de profit</dt><dd>La probabilité, d'après le modèle et la volatilité implicite, que le cours termine dans la zone de profit à l'échéance. Ici 35 %. Ce n'est pas une prévision : c'est ce que les prix d'options « impliquent ».</dd>
  <dt>Point mort</dt><dd>305 + 10,825 = 315,83 $, soit +3,1 % au-dessus du cours actuel.</dd>
</dl>
<p>Sur le graphique :</p>
<ul>
  <li>La <strong>courbe colorée</strong> montre le P/L à la date choisie, verte en gain, rouge en perte.</li>
  <li>La <strong>ligne pointillée</strong> montre le P/L à l'échéance, la « crosse de hockey ».</li>
  <li>La <strong>cloche bleue</strong> montre où le cours a le plus de chances de se trouver à l'échéance.</li>
  <li>Le curseur <strong>Date</strong> avance dans le temps : regardez la courbe colorée rejoindre la ligne pointillée à mesure que la valeur temps fond.</li>
  <li>Le curseur <strong>VI</strong> simule une hausse ou une baisse de la volatilité implicite (×1 = niveau actuel).</li>
  <li>La vue <strong>Tableau</strong> donne le P/L par prix et par date.</li>
</ul>`,
      keyPoints: [
        "Débit = vous payez ; crédit = vous encaissez.",
        "La probabilité de profit découle de la volatilité implicite.",
        "Avant l'échéance, la courbe est arrondie à cause de la valeur temps.",
      ],
      cta: [{ label: "Ouvrir l'exemple AAPL", example: true }],
    },
    {
      id: "volatilite",
      title: "La volatilité implicite (VI)",
      minutes: 5,
      figure: ["long-straddle", "short-strangle"],
      body: `
<p>La <strong>volatilité implicite</strong> est la volatilité annualisée que le marché intègre dans le prix d'une option. On la calcule à l'envers : on cherche la volatilité qui, dans Black-Scholes, redonne la prime observée. Le simulateur le fait quand vous saisissez une prime à la main.</p>
<p>Elle donne un <strong>mouvement attendu</strong> d'un écart-type (environ 68 % des cas) :</p>
<p class="formula">mouvement ≈ S × VI × √(jours / 365)</p>
<p>Pour AAPL à 306,38 $, VI 26,4 % et 32 jours : 306,38 × 0,264 × √(32/365) ≈ <strong>±24 $</strong>, soit environ ±7,8 %.</p>
<ul>
  <li>VI élevée : options chères, situation plutôt favorable aux vendeurs.</li>
  <li>VI basse : options bon marché, situation plutôt favorable aux acheteurs.</li>
  <li><strong>IV crush</strong> : après un événement attendu (résultats trimestriels, décision de la Fed), la VI s'effondre. Un acheteur de call peut alors perdre de l'argent même si l'action monte un peu.</li>
</ul>
<div class="callout"><strong>À essayer.</strong> Chargez un straddle, laissez la date sur aujourd'hui et passez le curseur VI de ×1 à ×0,5 : vous voyez l'effet d'un IV crush sur une position longue en volatilité.</div>`,
      keyPoints: [
        "La VI se déduit du prix des options, ce n'est pas une prévision.",
        "Mouvement attendu ≈ S × VI × √(jours/365).",
        "Une baisse de VI pénalise les acheteurs d'options.",
      ],
      cta: [
        { label: "Long straddle", preset: "long-straddle" },
        { label: "Exemple AAPL", example: true },
      ],
    },
    {
      id: "grecques",
      title: "Les Grecques",
      minutes: 6,
      body: `
<p>Les Grecques mesurent la sensibilité du prix d'une option à chaque paramètre. Le simulateur les additionne pour toute la position.</p>
<dl class="defs">
  <dt>Delta (Δ)</dt><dd>Variation du prix de l'option pour +1 $ du sous-jacent. Entre 0 et 1 pour un call, entre −1 et 0 pour un put, environ 0,50 à la monnaie. Le delta d'une position s'exprime en « équivalent actions » : un delta de +55 se comporte comme 55 actions.</dd>
  <dt>Gamma (Γ)</dt><dd>Variation du delta pour +1 $. Maximal à la monnaie, il augmente fortement à l'approche de l'échéance.</dd>
  <dt>Theta (Θ)</dt><dd>Variation de valeur par jour qui passe, toutes choses égales par ailleurs. Négatif pour l'acheteur, positif pour le vendeur. L'érosion s'accélère près de l'échéance.</dd>
  <dt>Vega (ν)</dt><dd>Variation de valeur pour +1 point de volatilité implicite. Plus forte sur les échéances longues.</dd>
  <dt>Rho (ρ)</dt><dd>Variation pour +1 point de taux d'intérêt. Secondaire sur les échéances courtes.</dd>
</dl>
<p>Règle simple : acheter des options, c'est être <strong>long gamma et long vega</strong> mais payer le theta. Vendre des options, c'est l'inverse.</p>`,
      keyPoints: [
        "Delta ≈ équivalent en actions de la position.",
        "Theta négatif = le temps joue contre vous.",
        "Gamma et theta s'intensifient près de l'échéance.",
      ],
      cta: [{ label: "Explorer dans le Labo Grecques", tab: "grecques" }],
    },
    {
      id: "spreads",
      title: "Spreads verticaux : débit et crédit",
      minutes: 6,
      figure: ["bull-call-spread", "bear-put-spread", "bull-put-spread", "bear-call-spread"],
      body: `
<p>Un spread vertical combine l'achat et la vente de deux options du même type et de même échéance, avec des strikes différents. Le risque et le gain sont connus dès l'ouverture.</p>
<ul>
  <li><strong>Spreads à débit</strong> (bull call, bear put) : vous payez. Gain max = largeur entre strikes × 100 − débit. Perte max = débit.</li>
  <li><strong>Spreads à crédit</strong> (bull put, bear call) : vous encaissez. Gain max = crédit. Perte max = largeur × 100 − crédit.</li>
</ul>
<div class="callout"><strong>Exemple chiffré.</strong> Bull call spread 100/105 payé 2,00 $. Perte max : 200 $. Gain max : (105 − 100) × 100 − 200 = 300 $. Point mort : 100 + 2 = 102 $.</div>
<p>Par rapport à une option seule, le spread coûte moins cher et il est moins sensible au theta et à la VI, puisque l'option vendue compense en partie l'option achetée. En contrepartie, le gain est plafonné.</p>`,
      keyPoints: [
        "Largeur × 100 = gain max + perte max.",
        "Débit : gain si le cours va vers le strike vendu. Crédit : gain si le cours reste du bon côté du strike vendu.",
        "Risque défini : idéal pour débuter.",
      ],
      cta: [
        { label: "Bull call spread", preset: "bull-call-spread" },
        { label: "Bull put spread", preset: "bull-put-spread" },
        { label: "Bear put spread", preset: "bear-put-spread" },
      ],
    },
    {
      id: "neutres",
      title: "Stratégies neutres et de volatilité",
      minutes: 6,
      figure: ["long-straddle", "iron-condor", "long-call-butterfly", "call-calendar"],
      body: `
<p>Toutes les stratégies ne parient pas sur une direction. Certaines parient sur l'<strong>amplitude</strong> du mouvement.</p>
<ul>
  <li><strong>Straddle et strangle achetés</strong> : vous gagnez si le cours bouge plus que ce que la prime anticipe, dans un sens ou dans l'autre.</li>
  <li><strong>Straddle et strangle vendus</strong> : vous gagnez si le cours reste calme, mais le risque est illimité.</li>
  <li><strong>Iron condor</strong> : un strangle vendu protégé par des ailes achetées. Crédit encaissé, risque défini, gain si le cours reste entre les deux strikes vendus.</li>
  <li><strong>Papillon (butterfly)</strong> : petit débit, gain maximal si le cours termine pile au strike central.</li>
  <li><strong>Calendaire</strong> : vente d'une option proche, achat de la même option plus lointaine. L'option courte perd sa valeur temps plus vite que la longue.</li>
</ul>
<p>Comparez les probabilités de profit : un iron condor affiche souvent 60 à 70 %, mais avec un gain max inférieur à la perte max. Probabilité élevée et rendement faible vont ensemble.</p>`,
      keyPoints: [
        "Long straddle = pari sur un grand mouvement.",
        "Iron condor = pari sur un range, risque défini.",
        "Une probabilité de profit élevée s'accompagne d'un ratio gain/risque faible.",
      ],
      cta: [
        { label: "Iron condor", preset: "iron-condor" },
        { label: "Papillon", preset: "long-call-butterfly" },
        { label: "Calendaire", preset: "call-calendar" },
      ],
    },
    {
      id: "actions",
      title: "Options et actions : couvrir, générer un revenu",
      minutes: 5,
      figure: ["covered-call", "protective-put", "collar"],
      body: `
<p>Les options se combinent avec des actions que vous détenez déjà :</p>
<ul>
  <li><strong>Covered call</strong> : 100 actions + 1 call vendu. La prime est un revenu, mais vous renoncez à la hausse au-delà du strike.</li>
  <li><strong>Protective put</strong> : 100 actions + 1 put acheté. C'est une assurance : la perte est plafonnée sous le strike.</li>
  <li><strong>Collar</strong> : actions + put acheté + call vendu. La prime du call finance tout ou partie du put.</li>
</ul>
<p>La <strong>parité call-put</strong> relie calls et puts de même strike et même échéance :</p>
<p class="formula">C − P = S − K × e<sup>−rT</sup></p>
<p>Conséquence : un covered call a le même profil qu'une vente de put de même strike. Comparez les deux graphiques dans le simulateur.</p>`,
      keyPoints: [
        "Covered call = revenu + gain plafonné.",
        "Protective put = assurance contre la baisse.",
        "Covered call et vente de put au même strike ont le même profil.",
      ],
      cta: [
        { label: "Covered call", preset: "covered-call" },
        { label: "Protective put", preset: "protective-put" },
        { label: "Collar", preset: "collar" },
      ],
    },
    {
      id: "risque",
      title: "Gestion du risque et pièges courants",
      minutes: 5,
      body: `
<ul>
  <li><strong>Taille de position</strong> : limitez la perte max de chaque trade à une petite fraction du capital, par exemple 1 à 2 %.</li>
  <li><strong>Risque défini d'abord</strong> : commencez par les achats d'options et les spreads. Évitez les ventes nues tant que vous ne maîtrisez pas l'assignation et la marge.</li>
  <li><strong>Liquidité</strong> : regardez l'écart bid/ask, le volume et l'open interest. Un écart de 0,30 $ coûte 30 $ par contrat à chaque aller-retour.</li>
  <li><strong>Assignation anticipée</strong> : une option américaine vendue et dans la monnaie peut être exercée à tout moment, surtout un call la veille d'un dividende.</li>
  <li><strong>Événements</strong> : résultats et annonces macro gonflent la VI avant, puis la font chuter après (IV crush).</li>
  <li><strong>Plan de sortie</strong> : fixez à l'avance une prise de profit (par exemple 50 % du gain max sur une vente), un seuil de perte et une date limite.</li>
</ul>
<div class="callout"><strong>Limites du modèle.</strong> Le simulateur utilise Black-Scholes avec une volatilité constante, sans dividendes ni frais. Les prix réels incluent un écart bid/ask et un « smile » de volatilité. C'est un outil pour apprendre, pas un conseil d'investissement.</div>`,
      keyPoints: [
        "Connaître sa perte max avant d'entrer.",
        "Vérifier la liquidité de l'option.",
        "Avoir un plan de sortie écrit.",
      ],
      cta: [{ label: "Tester mes connaissances", tab: "quiz" }],
    },
  ];

  const GLOSSARY = [
    ["Sous-jacent", "L'actif sur lequel porte l'option : action, ETF, indice, matière première."],
    ["Call", "Option d'achat : droit d'acheter le sous-jacent au strike jusqu'à l'échéance."],
    ["Put", "Option de vente : droit de vendre le sous-jacent au strike jusqu'à l'échéance."],
    ["Strike (prix d'exercice)", "Prix auquel l'option permet d'acheter (call) ou de vendre (put) le sous-jacent."],
    ["Échéance (expiration)", "Date après laquelle l'option cesse d'exister."],
    ["Prime", "Prix de l'option, payé par l'acheteur au vendeur. Cotée par action, multipliée par 100 par contrat."],
    ["Multiplicateur", "Nombre d'actions par contrat, 100 pour les options sur actions US."],
    ["Valeur intrinsèque", "Gain d'un exercice immédiat : max(S − K, 0) pour un call, max(K − S, 0) pour un put."],
    ["Valeur temps", "Prime moins valeur intrinsèque. Elle disparaît à l'échéance."],
    ["ITM / ATM / OTM", "Dans, à ou hors de la monnaie, selon la position du strike par rapport au cours."],
    ["Exercice", "Utilisation du droit conféré par l'option par son acheteur."],
    ["Assignation", "Obligation, pour le vendeur, d'honorer l'option quand l'acheteur l'exerce."],
    ["Style américain / européen", "Américain : exercice possible à tout moment. Européen : exercice seulement à l'échéance."],
    ["Débit net", "Somme payée à l'ouverture d'une position."],
    ["Crédit net", "Somme encaissée à l'ouverture d'une position."],
    ["Point mort (breakeven)", "Cours du sous-jacent pour lequel le P/L à l'échéance est nul."],
    ["Probabilité de profit", "Probabilité, selon le modèle et la VI, de terminer dans la zone de profit à l'échéance."],
    ["Volatilité implicite (VI)", "Volatilité annualisée déduite du prix des options."],
    ["Volatilité historique", "Volatilité réellement observée sur les cours passés."],
    ["IV crush", "Chute brutale de la VI après un événement attendu, comme une publication de résultats."],
    ["Mouvement attendu", "Amplitude d'un écart-type d'ici l'échéance : S × VI × √(jours/365)."],
    ["Delta", "Variation du prix de l'option pour +1 $ du sous-jacent."],
    ["Gamma", "Variation du delta pour +1 $ du sous-jacent."],
    ["Theta", "Variation de valeur de l'option par jour qui passe."],
    ["Vega", "Variation de valeur pour +1 point de volatilité implicite."],
    ["Rho", "Variation de valeur pour +1 point de taux d'intérêt."],
    ["Spread vertical", "Achat et vente d'options de même type et même échéance, à des strikes différents."],
    ["Calendaire", "Options de même strike sur deux échéances différentes."],
    ["Straddle", "Call et put au même strike et à la même échéance."],
    ["Strangle", "Call et put hors de la monnaie, de strikes différents, même échéance."],
    ["Iron condor", "Bull put spread + bear call spread : crédit, gain si le cours reste dans un range."],
    ["Butterfly (papillon)", "Trois strikes : achat, double vente, achat. Gain maximal au strike central."],
    ["Covered call", "Détention de 100 actions et vente d'un call."],
    ["Protective put", "Détention de 100 actions et achat d'un put en protection."],
    ["Collar (tunnel)", "Actions + put acheté + call vendu."],
    ["Bid / Ask", "Meilleur prix acheteur / meilleur prix vendeur. L'écart entre les deux est un coût."],
    ["Open interest", "Nombre de contrats ouverts sur une option donnée, indicateur de liquidité."],
    ["Black-Scholes", "Modèle de valorisation des options européennes, utilisé ici pour les prix théoriques."],
    ["Parité call-put", "Relation C − P = S − K·e^(−rT) entre calls et puts de même strike et échéance."],
    ["Symbole OCC", "Identifiant normalisé d'une option : ticker, date AAMMJJ, C/P, strike × 1000."],
    ["LEAPS", "Options à échéance longue, généralement plus d'un an."],
    ["Weekly", "Option à échéance hebdomadaire, le plus souvent le vendredi."],
  ];

  // ---------- Quiz ----------
  const QUIZ = [
    {
      q: "Un call donne à son acheteur :",
      options: [
        "Le droit d'acheter le sous-jacent au strike",
        "L'obligation d'acheter le sous-jacent au strike",
        "Le droit de vendre le sous-jacent au strike",
        "L'obligation de vendre le sous-jacent au strike",
      ],
      answer: 0,
      explain: "L'acheteur d'une option a toujours un droit, jamais une obligation. Le call est le droit d'acheter.",
    },
    {
      q: "Quelle est la perte maximale de l'acheteur d'un put ?",
      options: ["La prime payée", "Illimitée", "Le strike × 100", "Le strike moins la prime"],
      answer: 0,
      explain: "Au pire, le put expire sans valeur et l'acheteur perd la prime payée.",
    },
    {
      q: "Quel est le risque du vendeur d'un call non couvert ?",
      options: ["Illimité", "Limité à la prime", "Limité au strike", "Nul"],
      answer: 0,
      explain: "Si l'action monte sans limite, le vendeur doit livrer des actions qu'il faut racheter de plus en plus cher.",
    },
    {
      q: "L'action vaut 110 $. Un call de strike 100 $ est :",
      options: ["Dans la monnaie (ITM)", "À la monnaie (ATM)", "Hors de la monnaie (OTM)", "Expiré"],
      answer: 0,
      explain: "Pour un call, S > K signifie ITM. Sa valeur intrinsèque est de 10 $.",
    },
    {
      q: "À l'échéance, la valeur temps d'une option est :",
      options: ["Nulle", "Égale à la prime initiale", "Égale au strike", "Maximale"],
      answer: 0,
      explain: "À l'échéance, il ne reste que la valeur intrinsèque.",
    },
    {
      q: "Le theta d'une option achetée est en général :",
      options: ["Négatif", "Positif", "Toujours nul", "Égal au delta"],
      answer: 0,
      explain: "L'acheteur perd de la valeur temps chaque jour : son theta est négatif.",
    },
    {
      q: "Le delta d'un call à la monnaie est environ de :",
      options: ["0,50", "0", "1", "−0,50"],
      answer: 0,
      explain: "À la monnaie, un call a environ une chance sur deux de finir dans la monnaie et un delta proche de 0,50.",
    },
    {
      q: "Si la volatilité implicite augmente, toutes choses égales, le prix d'un put :",
      options: ["Augmente", "Baisse", "Ne change pas", "Devient nul"],
      answer: 0,
      explain: "Calls et puts ont un vega positif : plus de volatilité, c'est plus de valeur temps.",
    },
    {
      q: "Un long straddle est rentable si :",
      options: [
        "Le cours fait un grand mouvement, dans un sens ou dans l'autre",
        "Le cours reste parfaitement stable",
        "Seulement si le cours monte",
        "Seulement si la VI baisse",
      ],
      answer: 0,
      explain: "Le straddle acheté combine un call et un put : il faut que le mouvement dépasse le coût des deux primes.",
    },
    {
      q: "Un iron condor est gagnant si le sous-jacent :",
      options: [
        "Reste entre les deux strikes vendus",
        "Monte fortement",
        "Baisse fortement",
        "Fait un grand mouvement dans n'importe quel sens",
      ],
      answer: 0,
      explain: "L'iron condor est une vente de volatilité à risque défini : il gagne dans un range.",
    },
    {
      q: "Un covered call consiste à :",
      options: [
        "Détenir 100 actions et vendre un call",
        "Acheter un call et un put",
        "Vendre un put sans détenir de liquidités",
        "Détenir 100 actions et acheter un call",
      ],
      answer: 0,
      explain: "La prime du call vendu est un revenu. La contrepartie : le gain est plafonné au strike.",
    },
    {
      q: "Le gamma est le plus élevé pour une option :",
      options: [
        "À la monnaie, proche de l'échéance",
        "Très hors de la monnaie, échéance lointaine",
        "Très dans la monnaie, échéance lointaine",
        "Il est identique pour toutes les options",
      ],
      answer: 0,
      explain: "Près de l'échéance, le delta d'une option ATM bascule vite entre 0 et 1 : le gamma explose.",
    },
    {
      q: "Un contrat d'option standard sur actions US porte sur :",
      options: ["100 actions", "1 action", "10 actions", "1 000 actions"],
      answer: 0,
      explain: "C'est pourquoi une prime cotée 2,50 $ coûte 250 $ par contrat.",
    },
    {
      q: "Que désigne l'« IV crush » ?",
      options: [
        "La chute de la volatilité implicite après un événement",
        "La hausse de la volatilité avant une échéance",
        "L'exercice anticipé d'un put",
        "Une erreur de cotation",
      ],
      answer: 0,
      explain: "Après des résultats, l'incertitude disparaît et la VI s'effondre, ce qui fait baisser la valeur temps.",
    },
    {
      q: "Un bull put spread est :",
      options: [
        "Une stratégie haussière à crédit",
        "Une stratégie baissière à débit",
        "Une stratégie haussière à débit",
        "Une stratégie neutre à risque illimité",
      ],
      answer: 0,
      explain: "On vend un put et on achète un put plus bas : on encaisse un crédit et on gagne si le cours reste au-dessus du strike vendu.",
    },
    {
      q: "Le vega mesure la variation du prix de l'option pour :",
      options: [
        "+1 point de volatilité implicite",
        "+1 $ du sous-jacent",
        "Un jour qui passe",
        "+1 point de taux d'intérêt",
      ],
      answer: 0,
      explain: "Delta : sous-jacent. Theta : temps. Vega : volatilité. Rho : taux.",
    },
    {
      q: "Action à 100 $, VI 30 %, 30 jours. Le mouvement attendu d'un écart-type vaut environ :",
      options: ["± 8,60 $", "± 30 $", "± 2,50 $", "± 0,30 $"],
      answer: 0,
      explain: "100 × 0,30 × √(30/365) ≈ 8,60 $.",
    },
    {
      q: "Le vendeur d'un put assigné doit :",
      options: [
        "Acheter les actions au strike",
        "Vendre les actions au strike",
        "Rembourser la prime",
        "Rien, l'option expire",
      ],
      answer: 0,
      explain: "Le put donne à l'acheteur le droit de vendre : le vendeur assigné achète donc les actions au strike.",
    },
    {
      q: "La parité call-put s'écrit :",
      options: ["C − P = S − K·e^(−rT)", "C + P = S + K", "C = P", "C × P = S × K"],
      answer: 0,
      explain: "Un call acheté et un put vendu au même strike reproduisent une position à terme sur l'action.",
    },
    {
      q: "Quel profil a le même graphique qu'un covered call ?",
      options: [
        "Une vente de put de même strike",
        "Un achat de call de même strike",
        "Un long straddle",
        "Un achat de put de même strike",
      ],
      answer: 0,
      explain: "Par la parité call-put : actions − call = cash − put. Les deux profils sont identiques à l'échéance.",
    },
    {
      q: "Pour une option, un écart bid/ask large signifie surtout :",
      options: [
        "Un coût de transaction élevé",
        "Une volatilité implicite basse",
        "Une échéance proche",
        "Un gain garanti",
      ],
      answer: 0,
      explain: "On achète à l'ask et on revend au bid : l'écart est payé à chaque aller-retour.",
    },
  ];

  // Questions générées avec des nombres aléatoires
  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }
  function f2(x) {
    return x.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function f0(x) {
    return x.toLocaleString("fr-FR", { maximumFractionDigits: 0 });
  }
  const QUIZ_GENERATORS = [
    function longCallBreakeven() {
      const K = pick([50, 80, 100, 120, 150, 200, 250, 300]);
      const p = +(K * pick([0.02, 0.03, 0.04, 0.05, 0.06])).toFixed(2);
      return {
        q: `Vous achetez un call de strike ${f0(K)} $ pour une prime de ${f2(p)} $. Quel est le point mort à l'échéance ?`,
        options: [`${f2(K + p)} $`, `${f2(K - p)} $`, `${f2(K)} $`, `${f2(K + 2 * p)} $`],
        answer: 0,
        explain: `Point mort d'un call acheté = strike + prime = ${f0(K)} + ${f2(p)} = ${f2(K + p)} $.`,
      };
    },
    function longPutBreakeven() {
      const K = pick([40, 60, 90, 110, 140, 180, 220]);
      const p = +(K * pick([0.02, 0.03, 0.04, 0.05])).toFixed(2);
      return {
        q: `Vous achetez un put de strike ${f0(K)} $ pour ${f2(p)} $. Sous quel cours gagnez-vous de l'argent à l'échéance ?`,
        options: [`${f2(K - p)} $`, `${f2(K + p)} $`, `${f2(K)} $`, `${f2(p)} $`],
        answer: 0,
        explain: `Point mort d'un put acheté = strike − prime = ${f0(K)} − ${f2(p)} = ${f2(K - p)} $.`,
      };
    },
    function bullCallMax() {
      const K1 = pick([50, 100, 150, 200]);
      const w = pick([5, 10]);
      const d = +(w * pick([0.3, 0.4, 0.45, 0.55])).toFixed(2);
      const max = (w - d) * 100;
      return {
        q: `Bull call spread ${f0(K1)}/${f0(K1 + w)} payé ${f2(d)} $ (débit). Quel est le gain maximal par contrat ?`,
        options: [`${f0(max)} $`, `${f0(w * 100)} $`, `${f0(d * 100)} $`, "Illimité"],
        answer: 0,
        explain: `Gain max = largeur × 100 − débit = ${f0(w * 100)} − ${f0(d * 100)} = ${f0(max)} $.`,
      };
    },
    function shortPutMaxLoss() {
      const K = pick([30, 45, 60, 75, 100]);
      const p = +(K * pick([0.02, 0.03, 0.04])).toFixed(2);
      const loss = (K - p) * 100;
      return {
        q: `Vous vendez un put de strike ${f0(K)} $ et encaissez ${f2(p)} $. Quelle est votre perte maximale par contrat ?`,
        options: [`${f0(loss)} $`, "Illimitée", `${f0(p * 100)} $`, `${f0(K * 100)} $`],
        answer: 0,
        explain: `Le pire cas est une action à 0 $ : (${f0(K)} − ${f2(p)}) × 100 = ${f0(loss)} $.`,
      };
    },
    function contractCost() {
      const p = pick([0.85, 1.4, 2.35, 3.1, 4.75, 6.2]);
      const n = pick([1, 2, 3, 5]);
      return {
        q: `Une option cote ${f2(p)} $. Combien coûtent ${n} contrat${n > 1 ? "s" : ""}, hors frais ?`,
        options: [`${f0(p * 100 * n)} $`, `${f2(p * n)} $`, `${f0(p * 10 * n)} $`, `${f0(p * 1000 * n)} $`],
        answer: 0,
        explain: `Prime × 100 actions × ${n} = ${f0(p * 100 * n)} $.`,
      };
    },
  ];

  root.OptionsContent = { LESSONS, GLOSSARY, QUIZ, QUIZ_GENERATORS };
})(typeof globalThis !== "undefined" ? globalThis : this);
