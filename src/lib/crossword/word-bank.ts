// Curated French/English word bank used when the LLM is unavailable.
// Answers are single tokens without accents; clues never repeat the answer.

import { hashString, mulberry32 } from './random';

export interface BankEntry {
  /** French answer; also the English answer when `en` is absent. */
  word: string;
  /** English spelling when it differs from the French one. */
  en?: string;
  frClue: string;
  enClue: string;
}

export interface Theme {
  id: string;
  keywords: string[];
  entries: BankEntry[];
}

export interface BankWord {
  word: string;
  clue: string;
}

export interface WordBankOptions {
  theme: string;
  language: 'fr' | 'en';
  /** 1 = easy, 2 = medium, 3 = hard. */
  difficulty: number;
  wordCount: number;
  /** Longest answer that can fit the requested grid. */
  maxLength?: number;
  seed?: string;
}

const DIFFICULTY_LENGTHS: Record<number, { min: number; max: number }> = {
  1: { min: 3, max: 7 },
  2: { min: 4, max: 10 },
  3: { min: 5, max: 14 },
};

// Order matters: the first theme with a matching keyword wins, so narrower
// themes (African capitals, wildlife) must precede broader ones.
export const THEMES: readonly Theme[] = [
  {
    id: 'wildlife',
    keywords: [
      'animaux de la savane', 'animaux sauvages', 'animaux', 'savane', 'faune', 'safari',
      'wildlife', 'safari animals', 'savanna', 'african wildlife',
    ],
    entries: [
      { word: 'LION', frClue: 'Roi de la savane', enClue: 'King of the jungle' },
      { word: 'TIGRE', en: 'TIGER', frClue: 'Grand félin rayé d’Asie', enClue: 'Striped big cat of Asia' },
      { word: 'ELEPHANT', frClue: 'Géant gris aux grandes oreilles', enClue: 'Huge grey animal with a trunk' },
      { word: 'GIRAFE', en: 'GIRAFFE', frClue: 'Animal au très long cou', enClue: 'Tall animal with a long neck' },
      { word: 'ZEBRE', en: 'ZEBRA', frClue: 'Équidé noir et blanc', enClue: 'Striped African horse' },
      { word: 'HYENE', en: 'HYENA', frClue: 'Charognard au rire sinistre', enClue: 'Scavenger with a laughing call' },
      { word: 'JAGUAR', frClue: 'Félin tacheté d’Amérique du Sud', enClue: 'Spotted cat of the Amazon' },
      { word: 'GORILLE', en: 'GORILLA', frClue: 'Grand singe des forêts tropicales', enClue: 'Largest living primate' },
      { word: 'PANTHERE', en: 'PANTHER', frClue: 'Félin noir et furtif', enClue: 'Dark, stealthy big cat' },
      { word: 'BUFFLE', en: 'BUFFALO', frClue: 'Bovin massif des plaines africaines', enClue: 'Massive plains grazer of Africa' },
      { word: 'GAZELLE', frClue: 'Antilope rapide et gracieuse', enClue: 'Swift and graceful antelope' },
      { word: 'CROCODILE', frClue: 'Reptile à longues mâchoires des marais', enClue: 'Toothy reptile lurking in rivers' },
      { word: 'GUEPARD', en: 'CHEETAH', frClue: 'Félin le plus rapide du monde', enClue: 'Fastest land animal' },
      { word: 'AUTRUCHE', en: 'OSTRICH', frClue: 'Grand oiseau qui court vite', enClue: 'Tall flightless bird of Africa' },
      { word: 'FLAMANT', en: 'FLAMINGO', frClue: 'Oiseau rose sur une patte', enClue: 'Pink wader that stands on one leg' },
      { word: 'PINGOUIN', en: 'PENGUIN', frClue: 'Oiseau marin qui nage au pôle Sud', enClue: 'Antarctic bird that swims but cannot fly' },
      { word: 'LEMUR', frClue: 'Petit primate de Madagascar', enClue: 'Tree-dwelling primate of Madagascar' },
      { word: 'SERPENT', en: 'SNAKE', frClue: 'Reptile sans pattes', enClue: 'Legless slithering reptile' },
      { word: 'RENARD', en: 'FOX', frClue: 'Canidé rusé au pelage roux', enClue: 'Cunning red-furred canine' },
      { word: 'HIBOU', en: 'OWL', frClue: 'Rapace nocturne aux grands yeux', enClue: 'Night bird known for hooting' },
      { word: 'LOUP', en: 'WOLF', frClue: 'Canidé sauvage qui hurle', enClue: 'Wild canine that howls' },
      { word: 'VAUTOUR', en: 'VULTURE', frClue: 'Rapace qui se nourrit de charognes', enClue: 'Bird that feeds on carrion' },
      { word: 'CHACAL', en: 'JACKAL', frClue: 'Canidé opportuniste d’Afrique', enClue: 'Small wild canine of Africa' },
      { word: 'RHINOCEROS', frClue: 'Mammifère à corne sur le nez', enClue: 'Horned giant of the savanna' },
      { word: 'ANTILOPE', en: 'ANTELOPE', frClue: 'Herbivore rapide à longues cornes', enClue: 'Swift horned grazer' },
    ],
  },
  {
    id: 'african-capitals',
    keywords: [
      'villes africaines', 'capitales africaines', 'african cities', 'african capitals',
      'capitales d’afrique', 'afrique', 'africa',
    ],
    entries: [
      { word: 'DAKAR', frClue: 'Capitale du Sénégal', enClue: 'Capital of Senegal' },
      { word: 'LOME', frClue: 'Capitale du Togo', enClue: 'Capital of Togo' },
      { word: 'ACCRA', frClue: 'Capitale du Ghana', enClue: 'Capital of Ghana' },
      { word: 'RABAT', frClue: 'Capitale du Maroc', enClue: 'Capital of Morocco' },
      { word: 'TUNIS', frClue: 'Capitale fondée près de Carthage', enClue: 'Capital founded near ancient Carthage' },
      { word: 'CAIRE', en: 'CAIRO', frClue: 'Capitale de l’Égypte', enClue: 'Capital of Egypt' },
      { word: 'JUBA', frClue: 'Capitale du Soudan du Sud', enClue: 'Capital of South Sudan' },
      { word: 'LUANDA', frClue: 'Capitale de l’Angola', enClue: 'Capital of Angola' },
      { word: 'KIGALI', frClue: 'Capitale du Rwanda', enClue: 'Capital of Rwanda' },
      { word: 'MALABO', frClue: 'Capitale de la Guinée équatoriale', enClue: 'Capital of Equatorial Guinea' },
      { word: 'BANGUI', frClue: 'Capitale de la Centrafrique', enClue: 'Capital of the Central African Republic' },
      { word: 'HARARE', frClue: 'Capitale du Zimbabwe', enClue: 'Capital of Zimbabwe' },
      { word: 'DODOMA', frClue: 'Capitale de la Tanzanie', enClue: 'Capital of Tanzania' },
      { word: 'LUSAKA', frClue: 'Capitale de la Zambie', enClue: 'Capital of Zambia' },
      { word: 'MAPUTO', frClue: 'Capitale du Mozambique', enClue: 'Capital of Mozambique' },
      { word: 'NIAMEY', frClue: 'Capitale du Niger', enClue: 'Capital of Niger' },
      { word: 'ABIDJAN', frClue: 'Capitale économique de la Côte d’Ivoire', enClue: 'Economic capital of Ivory Coast' },
      { word: 'NAIROBI', frClue: 'Capitale du Kenya', enClue: 'Capital of Kenya' },
      { word: 'YAOUNDE', frClue: 'Capitale du Cameroun', enClue: 'Capital of Cameroon' },
      { word: 'KAMPALA', frClue: 'Capitale de l’Ouganda', enClue: 'Capital of Uganda' },
      { word: 'CONAKRY', frClue: 'Capitale de la Guinée', enClue: 'Capital of Guinea' },
      { word: 'GABORONE', frClue: 'Capitale du Botswana', enClue: 'Capital of Botswana' },
      { word: 'WINDHOEK', frClue: 'Capitale de la Namibie', enClue: 'Capital of Namibia' },
      { word: 'PRETORIA', frClue: 'Capitale administrative de l’Afrique du Sud', enClue: 'Administrative capital of South Africa' },
      { word: 'KHARTOUM', frClue: 'Capitale du Soudan', enClue: 'Capital of Sudan' },
      { word: 'ANTANANARIVO', frClue: 'Capitale de Madagascar', enClue: 'Capital of Madagascar' },
    ],
  },
  {
    id: 'world-capitals',
    keywords: [
      'capitales du monde', 'villes du monde', 'world capitals', 'capital cities',
      'capital city', 'capitales', 'capitale', 'villes',
    ],
    entries: [
      { word: 'PARIS', frClue: 'Capitale de la France', enClue: 'Capital of France' },
      { word: 'LONDRES', en: 'LONDON', frClue: 'Capitale du Royaume-Uni', enClue: 'Capital of the United Kingdom' },
      { word: 'BERLIN', frClue: 'Capitale de l’Allemagne', enClue: 'Capital of Germany' },
      { word: 'MADRID', frClue: 'Capitale de l’Espagne', enClue: 'Capital of Spain' },
      { word: 'ROME', frClue: 'Ville éternelle', enClue: 'The Eternal City' },
      { word: 'LISBONNE', en: 'LISBON', frClue: 'Capitale du Portugal', enClue: 'Capital of Portugal' },
      { word: 'ATHENES', en: 'ATHENS', frClue: 'Capitale de la Grèce', enClue: 'Capital of Greece' },
      { word: 'VIENNE', en: 'VIENNA', frClue: 'Capitale de l’Autriche', enClue: 'Capital of Austria' },
      { word: 'BERNE', en: 'BERN', frClue: 'Capitale de la Suisse', enClue: 'Capital of Switzerland' },
      { word: 'OSLO', frClue: 'Capitale de la Norvège', enClue: 'Capital of Norway' },
      { word: 'STOCKHOLM', frClue: 'Capitale de la Suède', enClue: 'Capital of Sweden' },
      { word: 'COPENHAGUE', en: 'COPENHAGEN', frClue: 'Capitale du Danemark', enClue: 'Capital of Denmark' },
      { word: 'HELSINKI', frClue: 'Capitale de la Finlande', enClue: 'Capital of Finland' },
      { word: 'DUBLIN', frClue: 'Capitale de l’Irlande', enClue: 'Capital of Ireland' },
      { word: 'AMSTERDAM', frClue: 'Capitale des Pays-Bas', enClue: 'Capital of the Netherlands' },
      { word: 'BRUXELLES', en: 'BRUSSELS', frClue: 'Capitale de la Belgique', enClue: 'Capital of Belgium' },
      { word: 'PRAGUE', frClue: 'Capitale de la Tchéquie', enClue: 'Capital of Czechia' },
      { word: 'VARSOVIE', en: 'WARSAW', frClue: 'Capitale de la Pologne', enClue: 'Capital of Poland' },
      { word: 'BUCAREST', en: 'BUCHAREST', frClue: 'Capitale de la Roumanie', enClue: 'Capital of Romania' },
      { word: 'OTTAWA', frClue: 'Capitale du Canada', enClue: 'Capital of Canada' },
      { word: 'WASHINGTON', frClue: 'Capitale des États-Unis', enClue: 'Capital of the United States' },
      { word: 'BRASILIA', frClue: 'Capitale du Brésil', enClue: 'Capital of Brazil' },
      { word: 'CANBERRA', frClue: 'Capitale de l’Australie', enClue: 'Capital of Australia' },
      { word: 'TOKYO', frClue: 'Capitale du Japon', enClue: 'Capital of Japan' },
      { word: 'PEKIN', en: 'BEIJING', frClue: 'Capitale de la Chine', enClue: 'Capital of China' },
      { word: 'MOSCOU', en: 'MOSCOW', frClue: 'Capitale de la Russie', enClue: 'Capital of Russia' },
      { word: 'HAVANE', en: 'HAVANA', frClue: 'Capitale de Cuba', enClue: 'Capital of Cuba' },
    ],
  },
  {
    id: 'inventions',
    keywords: ['inventions', 'invention', 'inventeurs', 'inventors', 'technologie', 'technology', 'découvertes', 'discoveries'],
    entries: [
      { word: 'ROUE', en: 'WHEEL', frClue: 'Grosse pièce ronde qui tourne', enClue: 'Round part that rolls' },
      { word: 'FEU', en: 'FIRE', frClue: 'Flamme maîtrisée par les premiers humains', enClue: 'Flame tamed by early humans' },
      { word: 'ECRITURE', en: 'WRITING', frClue: 'Système de signes gravés', enClue: 'System of written signs' },
      { word: 'PAPIER', en: 'PAPER', frClue: 'Feuille sur laquelle on écrit', enClue: 'Sheet made for writing' },
      { word: 'IMPRIMERIE', en: 'PRINTING', frClue: 'Technique mise au point par Gutenberg', enClue: 'Gutenberg’s great technique' },
      { word: 'TELEPHONE', frClue: 'Appareil pour parler à distance', enClue: 'Device for talking at a distance' },
      { word: 'AMPOULE', en: 'LIGHTBULB', frClue: 'Objet de verre qui éclaire', enClue: 'Glowing glass globe by Edison' },
      { word: 'RADIO', frClue: 'Boîte qui diffuse des ondes', enClue: 'Box that receives broadcast waves' },
      { word: 'TELEVISION', frClue: 'Écran qui montre des images animées', enClue: 'Screen showing moving pictures' },
      { word: 'ORDINATEUR', en: 'COMPUTER', frClue: 'Machine à traiter l’information', enClue: 'Machine that processes data' },
      { word: 'AVION', en: 'AIRPLANE', frClue: 'Appareil qui vole grâce à des ailes', enClue: 'Winged machine that flies' },
      { word: 'TRAIN', frClue: 'Véhicule qui roule sur des rails', enClue: 'Vehicle running on rails' },
      { word: 'BICYCLETTE', en: 'BICYCLE', frClue: 'Deux roues et des pédales', enClue: 'Two wheels moved by pedals' },
      { word: 'AUTOMOBILE', en: 'CAR', frClue: 'Véhicule à quatre roues et un moteur', enClue: 'Four-wheeled motor vehicle' },
      { word: 'MOTEUR', en: 'ENGINE', frClue: 'Pièce qui transforme l’énergie en mouvement', enClue: 'Part that turns energy into motion' },
      { word: 'BATTERIE', en: 'BATTERY', frClue: 'Réserve d’électricité portable', enClue: 'Portable store of electricity' },
      { word: 'VACCIN', en: 'VACCINE', frClue: 'Injection qui protège d’une maladie', enClue: 'Shot that protects against disease' },
      { word: 'PENICILLINE', en: 'PENICILLIN', frClue: 'Antibiotique découvert par Fleming', enClue: 'Antibiotic discovered by Fleming' },
      { word: 'ELECTRICITE', en: 'ELECTRICITY', frClue: 'Énergie qui allume les lampes', enClue: 'Energy that powers lights' },
      { word: 'TELESCOPE', frClue: 'Tube pour observer les étoiles', enClue: 'Tube for watching the stars' },
      { word: 'MICROSCOPE', frClue: 'Instrument pour voir le minuscule', enClue: 'Instrument for viewing tiny things' },
      { word: 'PARACHUTE', frClue: 'Drap qui ralentit une chute', enClue: 'Canopy that slows a fall' },
      { word: 'HELICE', en: 'PROPELLER', frClue: 'Aile tournante qui pousse un bateau', enClue: 'Spinning blade that drives a boat' },
      { word: 'SATELLITE', frClue: 'Engin qui tourne autour de la Terre', enClue: 'Craft orbiting Earth' },
      { word: 'INTERNET', frClue: 'Réseau mondial d’ordinateurs', enClue: 'Worldwide network of computers' },
      { word: 'ROBOT', frClue: 'Machine qui exécute des tâches', enClue: 'Machine that performs tasks' },
      { word: 'HORLOGE', en: 'CLOCK', frClue: 'Appareil qui indique l’heure', enClue: 'Device that shows the time' },
      { word: 'LUNETTES', en: 'GLASSES', frClue: 'Paire de verres pour mieux voir', enClue: 'Pair of lenses for seeing better' },
      { word: 'MARTEAU', en: 'HAMMER', frClue: 'Outil à tête pour frapper', enClue: 'Tool with a head for striking' },
      { word: 'AIGUILLE', en: 'NEEDLE', frClue: 'Petite tige pointue pour coudre', enClue: 'Thin pointed tool for sewing' },
    ],
  },
  {
    id: 'cuisine',
    keywords: ['cuisine du monde', 'cuisine', 'gastronomie', 'food', 'nourriture', 'recettes', 'recipes', 'world cuisine'],
    entries: [
      { word: 'PAIN', en: 'BREAD', frClue: 'Aliment de base cuit au four', enClue: 'Staple baked in an oven' },
      { word: 'FROMAGE', en: 'CHEESE', frClue: 'Produit laitier affiné', enClue: 'Aged dairy product' },
      { word: 'BEURRE', en: 'BUTTER', frClue: 'Matière grasse tartinable', enClue: 'Spreadable dairy fat' },
      { word: 'SEL', en: 'SALT', frClue: 'Assaisonnement blanc en grains', enClue: 'White seasoning in grains' },
      { word: 'POIVRE', en: 'PEPPER', frClue: 'Épice noire qui fait éternuer', enClue: 'Black spice that makes you sneeze' },
      { word: 'SUCRE', en: 'SUGAR', frClue: 'Douce poudre blanche', enClue: 'Sweet white powder' },
      { word: 'RIZ', en: 'RICE', frClue: 'Céréale de base en Asie', enClue: 'Staple grain of Asia' },
      { word: 'PIZZA', frClue: 'Galette italienne garnie', enClue: 'Topped Italian flatbread' },
      { word: 'SUSHI', frClue: 'Bouchée de riz et de poisson cru', enClue: 'Rice and raw fish bite' },
      { word: 'COUSCOUS', frClue: 'Semoule du Maghreb', enClue: 'North African semolina dish' },
      { word: 'TACOS', frClue: 'Galette mexicaine garnie', enClue: 'Filled Mexican flatbread' },
      { word: 'PASTA', frClue: 'Pâtes alimentaires d’Italie', enClue: 'Italian noodles' },
      { word: 'SOUPE', en: 'SOUP', frClue: 'Plat chaud liquide', enClue: 'Warm liquid dish' },
      { word: 'SALADE', en: 'SALAD', frClue: 'Mélange de crudités', enClue: 'Mix of raw vegetables' },
      { word: 'TOMATE', en: 'TOMATO', frClue: 'Fruit rouge de la ratatouille', enClue: 'Red fruit used in sauces' },
      { word: 'OIGNON', en: 'ONION', frClue: 'Bulbe qui fait pleurer', enClue: 'Bulb that makes you cry' },
      { word: 'POULET', en: 'CHICKEN', frClue: 'Volaille rôtie du dimanche', enClue: 'Roasted bird often served Sunday' },
      { word: 'POISSON', en: 'FISH', frClue: 'Animal des mers dans l’assiette', enClue: 'Sea creature served on a plate' },
      { word: 'GATEAU', en: 'CAKE', frClue: 'Dessert d’anniversaire', enClue: 'Birthday dessert' },
      { word: 'CHOCOLAT', en: 'CHOCOLATE', frClue: 'Douceur brune du cacao', enClue: 'Sweet brown treat from cocoa' },
      { word: 'CREPE', frClue: 'Fine galette bretonne', enClue: 'Thin pancake from Brittany' },
      { word: 'MIEL', en: 'HONEY', frClue: 'Doux produit des abeilles', enClue: 'Sweet product of bees' },
      { word: 'CAFE', en: 'COFFEE', frClue: 'Boisson noire du matin', enClue: 'Dark morning drink' },
      { word: 'THE', en: 'TEA', frClue: 'Boisson chaude des Anglais', enClue: 'Hot drink of England' },
      { word: 'JUS', en: 'JUICE', frClue: 'Boisson pressée de fruits', enClue: 'Drink squeezed from fruit' },
      { word: 'LAIT', en: 'MILK', frClue: 'Boisson blanche du petit-déjeuner', enClue: 'White drink at breakfast' },
      { word: 'FARINE', en: 'FLOUR', frClue: 'Poudre blanche pour la pâte', enClue: 'White powder used in dough' },
      { word: 'EPICE', en: 'SPICE', frClue: 'Aromate qui relève un plat', enClue: 'Aromatic flavour for food' },
      { word: 'FOUR', en: 'OVEN', frClue: 'Appareil qui cuit les plats', enClue: 'Appliance for baking' },
      { word: 'COUTEAU', en: 'KNIFE', frClue: 'Ustensile pour couper', enClue: 'Utensil for cutting' },
      { word: 'ASSIETTE', en: 'PLATE', frClue: 'Vaisselle ronde pour servir', enClue: 'Round dish for serving' },
      { word: 'VERRE', en: 'GLASS', frClue: 'Récipient pour boire', enClue: 'Vessel for drinking' },
    ],
  },
  {
    id: 'sports',
    keywords: ['sport olympique', 'jeux olympiques', 'sports', 'sport', 'olympique', 'olympics', 'athlétisme', 'athletics', 'football'],
    entries: [
      { word: 'FOOTBALL', frClue: 'Sport roi des stades', enClue: 'Sport played with a round ball and goals' },
      { word: 'TENNIS', frClue: 'Sport de raquette sur court', enClue: 'Racket sport played on a court' },
      { word: 'RUGBY', frClue: 'Sport de plaquages avec un ballon ovale', enClue: 'Sport with an oval ball and tackles' },
      { word: 'GOLF', frClue: 'Sport où l’on vise un trou', enClue: 'Sport of hitting a ball into holes' },
      { word: 'JUDO', frClue: 'Art martial japonais', enClue: 'Japanese martial art' },
      { word: 'KARATE', frClue: 'Art martial de coups', enClue: 'Martial art of strikes' },
      { word: 'BOXE', en: 'BOXING', frClue: 'Combat à coups de poings', enClue: 'Fighting with gloved punches' },
      { word: 'NATATION', en: 'SWIMMING', frClue: 'Sport dans le bassin', enClue: 'Sport practised in a pool' },
      { word: 'CYCLISME', en: 'CYCLING', frClue: 'Sport de la petite reine', enClue: 'Sport on two wheels' },
      { word: 'MARATHON', frClue: 'Course de 42 kilomètres', enClue: 'Race of 42 kilometres' },
      { word: 'SPRINT', frClue: 'Course très rapide', enClue: 'Short, very fast race' },
      { word: 'SKI', frClue: 'Sport de glisse sur neige', enClue: 'Sport on snow and slopes' },
      { word: 'SURF', frClue: 'Sport de glisse sur les vagues', enClue: 'Sport riding waves' },
      { word: 'AVIRON', en: 'ROWING', frClue: 'Sport avec des rames', enClue: 'Sport using oars' },
      { word: 'ESCALADE', en: 'CLIMBING', frClue: 'Sport de grimpe sur paroi', enClue: 'Sport of ascending walls' },
      { word: 'EQUITATION', en: 'RIDING', frClue: 'Sport à cheval', enClue: 'Sport on horseback' },
      { word: 'PLONGEON', en: 'DIVING', frClue: 'Saut acrobatique dans l’eau', enClue: 'Acrobatic jump into water' },
      { word: 'HANDBALL', frClue: 'Sport de balle à la main', enClue: 'Ball sport played with the hands' },
      { word: 'BASKET', frClue: 'Sport des paniers', enClue: 'Sport with a hoop and a ball' },
      { word: 'VOLLEY', frClue: 'Sport de filet sans contact', enClue: 'Net sport where the ball cannot touch the ground' },
      { word: 'HOCKEY', frClue: 'Sport à crosse sur glace', enClue: 'Ice sport played with a stick' },
      { word: 'PATINAGE', en: 'SKATING', frClue: 'Glisse sur glace avec des lames', enClue: 'Gliding on blades' },
      { word: 'MEDAILLE', en: 'MEDAL', frClue: 'Récompense métallique du vainqueur', enClue: 'Metal prize for a winner' },
      { word: 'ARBITRE', en: 'REFEREE', frClue: 'Personne qui siffle les fautes', enClue: 'Official who blows the whistle' },
      { word: 'STADE', en: 'STADIUM', frClue: 'Grande enceinte sportive', enClue: 'Large sports arena' },
      { word: 'EQUIPE', en: 'TEAM', frClue: 'Groupe de joueurs', enClue: 'Group of players' },
      { word: 'CHAMPION', frClue: 'Vainqueur d’une compétition', enClue: 'Winner of a competition' },
    ],
  },
  {
    id: 'ancient-history',
    keywords: [
      'histoire ancienne', 'antiquité', 'ancient history', 'antiquity', 'égypte antique',
      'grèce antique', 'rome antique', 'egypt', 'greece',
    ],
    entries: [
      { word: 'EGYPTE', en: 'EGYPT', frClue: 'Pays des pharaons', enClue: 'Land of the pharaohs' },
      { word: 'PHARAON', en: 'PHARAOH', frClue: 'Roi de l’Égypte ancienne', enClue: 'Ruler of ancient Egypt' },
      { word: 'PYRAMIDE', en: 'PYRAMID', frClue: 'Tombeau à quatre faces', enClue: 'Four-sided tomb of stone' },
      { word: 'SPHINX', frClue: 'Statue à corps de lion', enClue: 'Statue with a lion’s body' },
      { word: 'NIL', en: 'NILE', frClue: 'Fleuve qui traverse l’Égypte', enClue: 'River flowing through Egypt' },
      { word: 'MOMIE', en: 'MUMMY', frClue: 'Corps embaumé', enClue: 'Embalmed body' },
      { word: 'TEMPLE', frClue: 'Sanctuaire des dieux', enClue: 'Sanctuary of the gods' },
      { word: 'PAPYRUS', frClue: 'Ancien support d’écriture', enClue: 'Ancient writing material' },
      { word: 'HIEROGLYPHE', en: 'HIEROGLYPH', frClue: 'Écriture en signes gravés', enClue: 'Writing of carved signs' },
      { word: 'GRECE', en: 'GREECE', frClue: 'Pays des cités antiques', enClue: 'Land of ancient city-states' },
      { word: 'ROME', frClue: 'Ville des empereurs latins', enClue: 'City of the Latin emperors' },
      { word: 'ATHENES', en: 'ATHENS', frClue: 'Cité de la démocratie naissante', enClue: 'Birthplace of democracy' },
      { word: 'SPARTE', en: 'SPARTA', frClue: 'Cité des guerriers', enClue: 'City of warriors' },
      { word: 'CESAR', en: 'CAESAR', frClue: 'Général assassiné aux Ides de mars', enClue: 'General killed on the Ides of March' },
      { word: 'EMPIRE', frClue: 'Domaine d’un empereur', enClue: 'Realm of an emperor' },
      { word: 'SENAT', en: 'SENATE', frClue: 'Assemblée des notables romains', enClue: 'Assembly of Roman elders' },
      { word: 'LEGION', frClue: 'Unité de l’armée romaine', enClue: 'Unit of the Roman army' },
      { word: 'GLADIATEUR', en: 'GLADIATOR', frClue: 'Combattant de l’arène', enClue: 'Arena fighter' },
      { word: 'AMPHITHEATRE', en: 'AMPHITHEATER', frClue: 'Arène à gradins', enClue: 'Arena with tiers of seats' },
      { word: 'COLISEE', en: 'COLOSSEUM', frClue: 'Monument romain aux arches', enClue: 'Roman monument of arches' },
      { word: 'MYTHOLOGIE', en: 'MYTHOLOGY', frClue: 'Ensemble des légendes grecques', enClue: 'Body of Greek legends' },
      { word: 'ZEUS', frClue: 'Roi des dieux grecs', enClue: 'King of the Greek gods' },
      { word: 'ATHENA', frClue: 'Déesse de la sagesse', enClue: 'Goddess of wisdom' },
      { word: 'HERCULE', en: 'HERCULES', frClue: 'Héros aux douze travaux', enClue: 'Hero of the twelve labours' },
      { word: 'TROIE', en: 'TROY', frClue: 'Cité du cheval de bois', enClue: 'City of the wooden horse' },
      { word: 'ODYSSEE', en: 'ODYSSEY', frClue: 'Long voyage d’Ulysse', enClue: 'Ulysses’ long voyage' },
      { word: 'CITOYEN', en: 'CITIZEN', frClue: 'Habitant qui vote', enClue: 'Inhabitant with voting rights' },
    ],
  },
  {
    id: 'french-history',
    keywords: ['histoire de france', 'french history', 'revolution française', 'rois de france', 'france'],
    entries: [
      { word: 'GAULE', en: 'GAUL', frClue: 'Territoire conquis par César', enClue: 'Land conquered by Caesar' },
      { word: 'CLOVIS', frClue: 'Roi franc baptisé à Reims', enClue: 'Frankish king baptised at Reims' },
      { word: 'CAPET', frClue: 'Hugues qui fonda une dynastie', enClue: 'Hugh who founded a royal dynasty' },
      { word: 'CHARLEMAGNE', frClue: 'Empereur couronné en 800', enClue: 'Emperor crowned in 800' },
      { word: 'BASTILLE', frClue: 'Forteresse prise en 1789', enClue: 'Fortress stormed in 1789' },
      { word: 'REVOLUTION', frClue: 'Bouleversement de 1789', enClue: 'Upheaval of 1789' },
      { word: 'NAPOLEON', frClue: 'Empereur exilé à Sainte-Hélène', enClue: 'Emperor exiled to Saint Helena' },
      { word: 'VERSAILLES', frClue: 'Palais du Roi-Soleil', enClue: 'Palace of the Sun King' },
      { word: 'LOUVRE', frClue: 'Musée dans un ancien palais', enClue: 'Museum in a former palace' },
      { word: 'CHATEAU', en: 'CASTLE', frClue: 'Demeure fortifiée de la Loire', enClue: 'Fortified home by the Loire' },
      { word: 'CATHEDRALE', en: 'CATHEDRAL', frClue: 'Église de Notre-Dame', enClue: 'Church of Notre-Dame' },
      { word: 'CHEVALIER', en: 'KNIGHT', frClue: 'Guerrier à armure et épée', enClue: 'Armoured warrior on horseback' },
      { word: 'CROISADE', en: 'CRUSADE', frClue: 'Expédition des chevaliers en Terre sainte', enClue: 'Knightly expedition to the Holy Land' },
      { word: 'ROI', en: 'KING', frClue: 'Couronne et sceptre', enClue: 'Wears a crown and holds a sceptre' },
      { word: 'REINE', en: 'QUEEN', frClue: 'Épouse couronnée du monarque', enClue: 'Crowned wife of a monarch' },
      { word: 'EMPEREUR', en: 'EMPEROR', frClue: 'Titre de Napoléon', enClue: 'Napoleon’s title' },
      { word: 'REPUBLIQUE', en: 'REPUBLIC', frClue: 'Régime sans monarque', enClue: 'System without a monarch' },
      { word: 'MONARCHIE', en: 'MONARCHY', frClue: 'Régime d’un seul souverain', enClue: 'Rule by a single sovereign' },
      { word: 'LIBERTE', en: 'FREEDOM', frClue: 'Premier mot de la devise française', enClue: 'First word of the French motto' },
      { word: 'EGALITE', en: 'EQUALITY', frClue: 'Deuxième mot de la devise', enClue: 'Second word of the French motto' },
      { word: 'FRATERNITE', en: 'FRATERNITY', frClue: 'Troisième mot de la devise', enClue: 'Third word of the French motto' },
      { word: 'GUILLOTINE', frClue: 'Machine de la Terreur', enClue: 'Device of the Reign of Terror' },
      { word: 'DROITS', en: 'RIGHTS', frClue: 'Ce que déclare l’Homme en 1789', enClue: 'What man declared in 1789' },
      { word: 'NOBLESSE', en: 'NOBILITY', frClue: 'Classe des aristocrates', enClue: 'Aristocratic class' },
      { word: 'CLERGE', en: 'CLERGY', frClue: 'Ordre des prêtres', enClue: 'Order of priests' },
      { word: 'SACRE', frClue: 'Cérémonie du couronnement', enClue: 'Coronation ceremony' },
      { word: 'FRANCE', frClue: 'Pays des droits de l’homme', enClue: 'Land of human rights' },
      { word: 'LOI', en: 'LAW', frClue: 'Texte voté par le Parlement', enClue: 'Text voted by Parliament' },
    ],
  },
  {
    id: 'astronomy',
    keywords: [
      'astronomie', 'astronomy', 'espace', 'space', 'planètes', 'planets',
      'système solaire', 'solar system', 'étoiles', 'stars',
    ],
    entries: [
      { word: 'TERRE', en: 'EARTH', frClue: 'Troisième planète du système solaire', enClue: 'Third planet from the sun' },
      { word: 'LUNE', en: 'MOON', frClue: 'Satellite naturel de la Terre', enClue: 'Natural satellite of Earth' },
      { word: 'SOLEIL', en: 'SUN', frClue: 'Étoile de notre système', enClue: 'Star at the centre of our system' },
      { word: 'MARS', frClue: 'Planète rouge', enClue: 'The red planet' },
      { word: 'JUPITER', frClue: 'La plus grosse planète', enClue: 'Largest planet' },
      { word: 'SATURNE', en: 'SATURN', frClue: 'Planète aux anneaux', enClue: 'Planet with rings' },
      { word: 'URANUS', frClue: 'Planète géante glacée', enClue: 'Icy giant planet' },
      { word: 'NEPTUNE', frClue: 'Planète la plus lointaine', enClue: 'Farthest planet from the sun' },
      { word: 'MERCURE', en: 'MERCURY', frClue: 'Planète la plus proche du soleil', enClue: 'Closest planet to the sun' },
      { word: 'VENUS', frClue: 'Planète la plus chaude', enClue: 'Hottest planet' },
      { word: 'PLUTON', en: 'PLUTO', frClue: 'Ancienne neuvième planète', enClue: 'Former ninth planet' },
      { word: 'ETOILE', en: 'STAR', frClue: 'Astre qui brille la nuit', enClue: 'Bright point in the night sky' },
      { word: 'COMETE', en: 'COMET', frClue: 'Astre à longue chevelure', enClue: 'Celestial body with a tail' },
      { word: 'ASTEROIDE', en: 'ASTEROID', frClue: 'Rocher qui orbite entre Mars et Jupiter', enClue: 'Space rock orbiting the sun' },
      { word: 'GALAXIE', en: 'GALAXY', frClue: 'Île d’étoiles comme la Voie lactée', enClue: 'Vast system of stars' },
      { word: 'NEBULEUSE', en: 'NEBULA', frClue: 'Nuage de gaz dans l’espace', enClue: 'Cloud of gas and dust in space' },
      { word: 'FUSEE', en: 'ROCKET', frClue: 'Engin qui décolle vers l’espace', enClue: 'Vehicle that launches into space' },
      { word: 'ORBITE', en: 'ORBIT', frClue: 'Trajectoire autour d’un astre', enClue: 'Path around a planet' },
      { word: 'PLANETE', en: 'PLANET', frClue: 'Corps qui tourne autour d’une étoile', enClue: 'Body orbiting a star' },
      { word: 'GRAVITE', en: 'GRAVITY', frClue: 'Force qui attire les corps', enClue: 'Force that pulls objects together' },
      { word: 'ECLIPSE', frClue: 'Disparition passagère du soleil', enClue: 'When the sun briefly vanishes' },
      { word: 'ASTRONAUTE', en: 'ASTRONAUT', frClue: 'Voyageur de l’espace', enClue: 'Space traveller' },
      { word: 'TELESCOPE', frClue: 'Tube pour observer le ciel', enClue: 'Tube for observing the sky' },
      { word: 'METEORE', en: 'METEOR', frClue: 'Étoile filante', enClue: 'Shooting star' },
      { word: 'COSMOS', frClue: 'Univers dans son ensemble', enClue: 'The universe as a whole' },
      { word: 'SATELLITE', frClue: 'Engin qui tourne autour de la Terre', enClue: 'Craft orbiting Earth' },
    ],
  },
  {
    id: 'classical-music',
    keywords: ['musique classique', 'classical music', 'musique', 'music', 'compositeurs', 'composers', 'orchestre'],
    entries: [
      { word: 'MOZART', frClue: 'Compositeur de La Flûte enchantée', enClue: 'Composer of The Magic Flute' },
      { word: 'BEETHOVEN', frClue: 'Compositeur sourd de la Neuvième', enClue: 'Deaf composer of the Ninth' },
      { word: 'BACH', frClue: 'Maître du baroque et des fugues', enClue: 'Baroque master of the fugue' },
      { word: 'CHOPIN', frClue: 'Pianiste polonais des nocturnes', enClue: 'Polish nocturne composer' },
      { word: 'VIVALDI', frClue: 'Auteur des Quatre Saisons', enClue: 'Composer of The Four Seasons' },
      { word: 'HAYDN', frClue: 'Père de la symphonie classique', enClue: 'Father of the classical symphony' },
      { word: 'SCHUBERT', frClue: 'L’auteur de la Truite', enClue: 'Composer of the Trout Quintet' },
      { word: 'BRAHMS', frClue: 'Romantique allemand des danses hongroises', enClue: 'German romantic of the Hungarian Dances' },
      { word: 'LISZT', frClue: 'Pianiste hongrois virtuose', enClue: 'Virtuoso Hungarian pianist' },
      { word: 'VERDI', frClue: 'Compositeur d’Aïda', enClue: 'Composer of Aida' },
      { word: 'WAGNER', frClue: 'Compositeur de la Tétralogie', enClue: 'Composer of the Ring cycle' },
      { word: 'DEBUSSY', frClue: 'Compositeur de Clair de lune', enClue: 'Composer of Clair de lune' },
      { word: 'RAVEL', frClue: 'Auteur du Boléro', enClue: 'Composer of the Bolero' },
      { word: 'BERLIOZ', frClue: 'Compositeur de la Symphonie fantastique', enClue: 'Composer of the Fantastic Symphony' },
      { word: 'SYMPHONIE', en: 'SYMPHONY', frClue: 'Grande œuvre pour orchestre', enClue: 'Large work for orchestra' },
      { word: 'CONCERTO', frClue: 'Œuvre pour soliste et orchestre', enClue: 'Work for soloist and orchestra' },
      { word: 'SONATE', en: 'SONATA', frClue: 'Pièce en plusieurs mouvements', enClue: 'Multi-movement piece' },
      { word: 'OPERA', frClue: 'Œuvre chantée sur scène', enClue: 'Drama sung on stage' },
      { word: 'ORCHESTRE', en: 'ORCHESTRA', frClue: 'Ensemble de musiciens dirigé', enClue: 'Large group of musicians' },
      { word: 'PIANO', frClue: 'Instrument à marteaux et cordes', enClue: 'Instrument with keys, hammers and strings' },
      { word: 'VIOLON', en: 'VIOLIN', frClue: 'Instrument à quatre cordes et archet', enClue: 'String instrument played with a bow' },
      { word: 'VIOLONCELLE', en: 'CELLO', frClue: 'Grand instrument à quatre cordes tenu entre les jambes', enClue: 'Low string instrument held between the knees' },
      { word: 'FLUTE', frClue: 'Instrument à vent traversier', enClue: 'Woodwind instrument held sideways' },
      { word: 'CLARINETTE', en: 'CLARINET', frClue: 'Instrument à vent à anche', enClue: 'Single-reed woodwind' },
      { word: 'TROMPETTE', en: 'TRUMPET', frClue: 'Instrument de cuivre à pistons', enClue: 'Brass instrument with valves' },
      { word: 'HARPE', en: 'HARP', frClue: 'Instrument à cordes pincées et pédales', enClue: 'Plucked instrument with pedals' },
      { word: 'GUITARE', en: 'GUITAR', frClue: 'Instrument à six cordes', enClue: 'Six-stringed instrument' },
      { word: 'MELODIE', en: 'MELODY', frClue: 'Suite de notes agréables', enClue: 'Sequence of pleasing notes' },
      { word: 'CHORALE', en: 'CHOIR', frClue: 'Groupe de chanteurs', enClue: 'Group of singers' },
    ],
  },
  {
    id: 'literature',
    keywords: ['littérature', 'literature', 'livres', 'books', 'écrivains', 'writers', 'roman', 'novel', 'poésie'],
    entries: [
      { word: 'ROMAN', en: 'NOVEL', frClue: 'Long récit de fiction', enClue: 'Long work of fiction' },
      { word: 'POESIE', en: 'POETRY', frClue: 'Art des vers et des rimes', enClue: 'Art of verse and rhythm' },
      { word: 'THEATRE', en: 'THEATER', frClue: 'Art de la scène', enClue: 'Art of the stage' },
      { word: 'POETE', en: 'POET', frClue: 'Artisan des vers', enClue: 'Craftsman of verses' },
      { word: 'ECRIVAIN', en: 'WRITER', frClue: 'Auteur d’ouvrages', enClue: 'Author of books' },
      { word: 'LECTURE', en: 'READING', frClue: 'Activité des yeux sur un texte', enClue: 'Activity of the eyes on a text' },
      { word: 'BIBLIOTHEQUE', en: 'LIBRARY', frClue: 'Maison des livres rangés', enClue: 'Building full of shelved books' },
      { word: 'LIVRE', en: 'BOOK', frClue: 'Objet de pages reliées', enClue: 'Object of bound pages' },
      { word: 'PAGE', frClue: 'Feuille d’un ouvrage', enClue: 'One side of a leaf in a book' },
      { word: 'PLUME', en: 'PEN', frClue: 'Outil d’écriture d’autrefois', enClue: 'Old writing tool made from a feather' },
      { word: 'ENCRE', en: 'INK', frClue: 'Liquide noir du stylo', enClue: 'Dark liquid in a pen' },
      { word: 'CONTE', en: 'TALE', frClue: 'Récit court pour enfants', enClue: 'Short story for children' },
      { word: 'FABLE', frClue: 'Récit avec une morale', enClue: 'Story with a moral' },
      { word: 'LEGENDE', en: 'LEGEND', frClue: 'Récit mêlant histoire et merveilleux', enClue: 'Story mixing history and marvels' },
      { word: 'HEROS', en: 'HERO', frClue: 'Personnage principal d’une épopée', enClue: 'Main character of an epic' },
      { word: 'TRAGEDIE', en: 'TRAGEDY', frClue: 'Drame qui finit mal', enClue: 'Drama with a sad ending' },
      { word: 'COMEDIE', en: 'COMEDY', frClue: 'Pièce qui fait rire', enClue: 'Play that makes you laugh' },
      { word: 'RIME', en: 'RHYME', frClue: 'Écho sonore en fin de vers', enClue: 'Sound echo at the end of lines' },
      { word: 'PROSE', frClue: 'Écriture sans vers', enClue: 'Writing that is not verse' },
      { word: 'EDITEUR', en: 'PUBLISHER', frClue: 'Professionnel qui imprime et diffuse', enClue: 'Person who prints and sells books' },
      { word: 'LECTEUR', en: 'READER', frClue: 'Celui qui parcourt un ouvrage', enClue: 'Person who goes through a book' },
      { word: 'CHAPITRE', en: 'CHAPTER', frClue: 'Section d’un livre', enClue: 'Section of a book' },
      { word: 'TITRE', en: 'TITLE', frClue: 'Nom d’une œuvre', enClue: 'Name of a work' },
      { word: 'AUTEUR', en: 'AUTHOR', frClue: 'Créateur d’un texte', enClue: 'Creator of a written work' },
      { word: 'HISTOIRE', en: 'STORY', frClue: 'Suite d’événements racontés', enClue: 'Narrative of events' },
      { word: 'IMAGINAIRE', en: 'FICTION', frClue: 'Monde inventé par l’auteur', enClue: 'World invented by an author' },
    ],
  },
  {
    id: 'generic',
    keywords: ['général', 'general', 'culture générale', 'general knowledge', 'divers', 'quotidien', 'misc', 'everyday'],
    entries: [
      { word: 'MAISON', en: 'HOUSE', frClue: 'Lieu où l’on habite', enClue: 'Place where one lives' },
      { word: 'ARBRE', en: 'TREE', frClue: 'Grand végétal à tronc', enClue: 'Tall plant with a trunk' },
      { word: 'JARDIN', en: 'GARDEN', frClue: 'Espace planté près de la maison', enClue: 'Planted space beside a house' },
      { word: 'FLEUR', en: 'FLOWER', frClue: 'Pétales colorés', enClue: 'Colourful bloom' },
      { word: 'CHAT', en: 'CAT', frClue: 'Félin domestique qui miaule', enClue: 'Domestic feline that meows' },
      { word: 'CHIEN', en: 'DOG', frClue: 'Compagnon qui aboie', enClue: 'Pet that barks' },
      { word: 'OISEAU', en: 'BIRD', frClue: 'Animal qui chante et vole', enClue: 'Animal that sings and flies' },
      { word: 'PIERRE', en: 'STONE', frClue: 'Bloc dur du sol', enClue: 'Hard block from the ground' },
      { word: 'EAU', en: 'WATER', frClue: 'Liquide vital incolore', enClue: 'Colourless liquid of life' },
      { word: 'FEU', en: 'FIRE', frClue: 'Flamme qui réchauffe', enClue: 'Flame that warms' },
      { word: 'TABLE', frClue: 'Meuble à quatre pieds', enClue: 'Furniture with legs for eating' },
      { word: 'CHAISE', en: 'CHAIR', frClue: 'Siège pour s’asseoir', enClue: 'Seat with a back' },
      { word: 'PORTE', en: 'DOOR', frClue: 'Panneau qui s’ouvre', enClue: 'Panel you push to enter' },
      { word: 'FENETRE', en: 'WINDOW', frClue: 'Ouverture vitrée du mur', enClue: 'Glazed opening in a wall' },
      { word: 'TOIT', en: 'ROOF', frClue: 'Couverture de la maison', enClue: 'Covering on top of a house' },
      { word: 'MUR', en: 'WALL', frClue: 'Cloison de briques', enClue: 'Brick partition' },
      { word: 'LIVRE', en: 'BOOK', frClue: 'Pages reliées à lire', enClue: 'Bound pages to read' },
      { word: 'PAPIER', en: 'PAPER', frClue: 'Feuille pour écrire', enClue: 'Sheet for writing' },
      { word: 'CRAYON', en: 'PENCIL', frClue: 'Tige de bois qui écrit', enClue: 'Wooden stick that writes' },
      { word: 'ECRAN', en: 'SCREEN', frClue: 'Surface qui affiche des images', enClue: 'Surface that shows images' },
      { word: 'TELEPHONE', en: 'PHONE', frClue: 'Appareil qui sonne', enClue: 'Device that rings' },
      { word: 'MUSIQUE', en: 'MUSIC', frClue: 'Art des sons', enClue: 'Art of sounds' },
      { word: 'DANSE', en: 'DANCE', frClue: 'Mouvements du corps en rythme', enClue: 'Rhythmic body movements' },
      { word: 'CHANSON', en: 'SONG', frClue: 'Air que l’on chante', enClue: 'Tune with lyrics' },
      { word: 'FETE', en: 'PARTY', frClue: 'Réunion joyeuse', enClue: 'Joyful celebration' },
      { word: 'VACANCES', en: 'HOLIDAY', frClue: 'Jours sans travail', enClue: 'Days off work' },
      { word: 'VOYAGE', en: 'TRAVEL', frClue: 'Déplacement lointain', enClue: 'Trip to a distant place' },
      { word: 'ROUTE', en: 'ROAD', frClue: 'Voie pour les voitures', enClue: 'Way for cars' },
      { word: 'PONT', en: 'BRIDGE', frClue: 'Ouvrage pour franchir un fleuve', enClue: 'Structure crossing a river' },
      { word: 'VILLE', en: 'CITY', frClue: 'Grande agglomération', enClue: 'Large urban centre' },
      { word: 'VILLAGE', frClue: 'Petit groupe de maisons', enClue: 'Small cluster of houses' },
      { word: 'PAYS', en: 'COUNTRY', frClue: 'Territoire avec un drapeau', enClue: 'Land with its own flag' },
      { word: 'MER', en: 'SEA', frClue: 'Étendue d’eau salée', enClue: 'Body of salt water' },
      { word: 'MONTAGNE', en: 'MOUNTAIN', frClue: 'Relief très élevé', enClue: 'Very high landform' },
      { word: 'RIVIERE', en: 'RIVER', frClue: 'Cours d’eau qui coule', enClue: 'Flowing body of water' },
      { word: 'PLAGE', en: 'BEACH', frClue: 'Bord de mer sablonneux', enClue: 'Sandy shore by the sea' },
      { word: 'FORET', en: 'FOREST', frClue: 'Lieu couvert d’arbres', enClue: 'Land covered with trees' },
      { word: 'CIEL', en: 'SKY', frClue: 'Dôme bleu au-dessus de nous', enClue: 'Blue dome above us' },
      { word: 'NUAGE', en: 'CLOUD', frClue: 'Masse blanche dans le ciel', enClue: 'White mass in the sky' },
      { word: 'PLUIE', en: 'RAIN', frClue: 'Eau qui tombe des nuages', enClue: 'Water falling from clouds' },
      { word: 'SOLEIL', en: 'SUN', frClue: 'Astre qui éclaire le jour', enClue: 'Star that lights the day' },
      { word: 'LUNE', en: 'MOON', frClue: 'Astre de la nuit', enClue: 'Bright object of the night' },
      { word: 'ETOILE', en: 'STAR', frClue: 'Point brillant du ciel nocturne', enClue: 'Bright point in the night sky' },
      { word: 'NEIGE', en: 'SNOW', frClue: 'Flocons blancs de l’hiver', enClue: 'White winter flakes' },
      { word: 'VENT', en: 'WIND', frClue: 'Air en mouvement', enClue: 'Moving air' },
      { word: 'TEMPS', en: 'TIME', frClue: 'Ce que mesure l’horloge', enClue: 'What a clock measures' },
      { word: 'JOUR', en: 'DAY', frClue: 'Clarté entre deux nuits', enClue: 'Light between two nights' },
      { word: 'NUIT', en: 'NIGHT', frClue: 'Moment des étoiles', enClue: 'Time of the stars' },
      { word: 'MATIN', en: 'MORNING', frClue: 'Début de la journée', enClue: 'Start of the day' },
      { word: 'SOIR', en: 'EVENING', frClue: 'Fin de la journée', enClue: 'End of the day' },
      { word: 'ECOLE', en: 'SCHOOL', frClue: 'Lieu des cours', enClue: 'Place of lessons' },
      { word: 'CLASSE', en: 'CLASS', frClue: 'Groupe d’élèves', enClue: 'Group of pupils' },
      { word: 'PROFESSEUR', en: 'TEACHER', frClue: 'Celui qui enseigne', enClue: 'Person who teaches' },
      { word: 'ELEVE', en: 'PUPIL', frClue: 'Enfant à l’école', enClue: 'Child at school' },
      { word: 'AMITIE', en: 'FRIENDSHIP', frClue: 'Lien entre amis', enClue: 'Bond between companions' },
      { word: 'FAMILLE', en: 'FAMILY', frClue: 'Parents et enfants', enClue: 'Parents and children' },
      { word: 'ENFANT', en: 'CHILD', frClue: 'Jeune personne', enClue: 'Young person' },
      { word: 'ARGENT', en: 'MONEY', frClue: 'Pièces et billets', enClue: 'Coins and notes' },
      { word: 'TRAVAIL', en: 'WORK', frClue: 'Activité rémunérée', enClue: 'Paid activity' },
      { word: 'SANTE', en: 'HEALTH', frClue: 'Bon état du corps', enClue: 'Good condition of the body' },
      { word: 'SPORT', frClue: 'Activité physique', enClue: 'Physical activity' },
    ],
  },
];

const GENERIC_ID = 'generic';

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function containsKeyword(haystack: string, keyword: string): boolean {
  const needle = normalizeText(keyword);
  if (!needle) return false;
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^| )${escaped}( |$)`).test(haystack);
}

function lettersOnly(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '');
}

function answerFor(entry: BankEntry, language: 'fr' | 'en'): string {
  return language === 'en' ? entry.en ?? entry.word : entry.word;
}

function clueFor(entry: BankEntry, language: 'fr' | 'en'): string {
  return language === 'en' ? entry.enClue : entry.frClue;
}

function shuffle<T>(items: readonly T[], rand: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Returns the theme id whose keyword matches, or null when nothing matches. */
export function matchTheme(theme: string): string | null {
  const normalized = normalizeText(theme);
  if (!normalized) return null;
  for (const candidate of THEMES) {
    if (candidate.keywords.some((keyword) => containsKeyword(normalized, keyword))) {
      return candidate.id;
    }
  }
  return null;
}

/**
 * Deterministic selection from the curated bank. Tries the theme within the
 * difficulty length range first, then relaxes the range, then tops up from the
 * generic pool so a puzzle can still be generated for unusual themes.
 */
export function getFallbackWords(options: WordBankOptions): BankWord[] {
  const language = options.language;
  const themeId = matchTheme(options.theme);
  const theme = themeId ? THEMES.find((candidate) => candidate.id === themeId) : undefined;
  const generic = THEMES.find((candidate) => candidate.id === GENERIC_ID)!;
  const range = DIFFICULTY_LENGTHS[options.difficulty] ?? DIFFICULTY_LENGTHS[1];
  const maxLength = options.maxLength ?? Number.POSITIVE_INFINITY;
  const seed = options.seed ?? `${themeId ?? GENERIC_ID}|${language}|${options.wordCount}`;
  const rand = mulberry32(hashString(seed));

  const picked: BankWord[] = [];
  const seen = new Set<string>();

  const take = (entries: readonly BankEntry[], min: number, max: number) => {
    for (const entry of shuffle(entries, rand)) {
      if (picked.length >= options.wordCount) return;
      const answer = answerFor(entry, language);
      const letters = lettersOnly(answer);
      if (letters.length < 3 || letters.length > maxLength) continue;
      if (letters.length < min || letters.length > max) continue;
      if (seen.has(letters)) continue;
      seen.add(letters);
      picked.push({ word: answer, clue: clueFor(entry, language) });
    }
  };

  if (theme) take(theme.entries, range.min, range.max);
  if (theme && picked.length < options.wordCount) take(theme.entries, 3, Number.POSITIVE_INFINITY);
  if (picked.length < options.wordCount) take(generic.entries, range.min, range.max);
  if (picked.length < options.wordCount) take(generic.entries, 3, Number.POSITIVE_INFINITY);

  return picked;
}
