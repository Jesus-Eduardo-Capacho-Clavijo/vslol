import { getChampionInfo, getPatchVersion } from './champions.js';

// Icono oficial verificado de League of Legends alojado en el propio CDN de Discord
// (Garantiza que nunca aparezca el icono gris de interrogación)
const LEAGUE_LOGO_URL = 'https://cdn.discordapp.com/app-icons/1402418696126992445/7c99428541032ac02ec6981d88b78fb7.png';

// Nombres de los rangos oficiales de League of Legends en español
const TIER_NAMES_ES = {
  'IRON': 'Hierro',
  'BRONZE': 'Bronce',
  'SILVER': 'Plata',
  'GOLD': 'Oro',
  'PLATINUM': 'Platino',
  'EMERALD': 'Esmeralda',
  'DIAMOND': 'Diamante',
  'MASTER': 'Master',
  'GRANDMASTER': 'Gran Master',
  'CHALLENGER': 'Challenger',
};

export function formatRankedTier(rankedData) {
  if (!rankedData) return '';
  const queues = rankedData.queues || [];
  const solo = queues.find(q => q.queueType === 'RANKED_SOLO_5x5') || rankedData.queueMap?.RANKED_SOLO_5x5;
  const flex = queues.find(q => q.queueType === 'RANKED_FLEX_SR') || rankedData.queueMap?.RANKED_FLEX_SR;
  const target = (solo && solo.tier && solo.tier !== 'NONE' && solo.tier !== '') ? solo : flex;

  if (!target || !target.tier || target.tier === 'NONE' || target.tier === '') {
    return 'Unranked';
  }

  const rawTier = (target.tier || '').toUpperCase();
  const tierName = TIER_NAMES_ES[rawTier] || (rawTier.charAt(0) + rawTier.slice(1).toLowerCase());
  const division = target.division && target.division !== 'NA' ? ` ${target.division}` : '';
  const lp = typeof target.leaguePoints === 'number' && target.leaguePoints >= 0 ? ` ${target.leaguePoints} LP` : '';

  if (['MASTER', 'GRANDMASTER', 'CHALLENGER'].includes(rawTier)) {
    return `${tierName}${lp}`.trim();
  }

  return `${tierName}${division}${lp}`.trim();
}

export const QUEUE_NAMES = {
  // Clasificatorias
  420: 'Ranked SoloQ',
  440: 'Ranked Flex 5v5',

  // Normales
  400: 'Normal Reclutamiento',
  430: 'Normal Oculta',
  490: 'Partida Rápida',

  // Modos especiales y rotativos
  450: 'ARAM',
  2400: 'ARAM Caos',
  1700: 'Arena',
  1710: 'Arena',
  900: 'ARURF',
  1900: 'URF',
  1020: 'Uno para Todos',
  1300: 'Nexus Blitz',
  1400: 'Libro de Hechizos',
  1810: 'Enjambre',
  1820: 'Enjambre',
  1830: 'Enjambre',
  1840: 'Enjambre',
  2300: 'Pelea',

  // Personalizada y Práctica
  0: 'Personalizada',

  // Bots y Tutorial
  830: 'Co-op vs IA',
  840: 'Co-op vs IA',
  850: 'Co-op vs IA',
  870: 'Co-op vs IA',
  880: 'Co-op vs IA',
  890: 'Co-op vs IA',
  2000: 'Tutorial',
  2010: 'Tutorial',
  2020: 'Tutorial',
};

export const RAW_MODE_NAMES = {
  'CLASSIC': 'Grieta del Invocador',
  'ARAM': 'ARAM',
  'CHERRY': 'Arena',
  'PRACTICETOOL': 'Herramienta de Práctica',
  'URF': 'URF',
  'ARURF': 'ARURF',
  'ONEFORALL': 'Uno para Todos',
  'NEXUSBLITZ': 'Nexus Blitz',
  'ULTBOOK': 'Libro de Hechizos',
  'SWIFTPLAY': 'Partida Rápida',
  'STRAWBERRY': 'Enjambre',
  'TUTORIAL': 'Tutorial',
  'MAYHEM': 'ARAM Caos',
  'ARAM_MAYHEM': 'ARAM Caos',
};

export function resolveGameModeName(queueId, rawGameMode, isCustom = false) {
  const cleanRaw = (rawGameMode || '').toUpperCase().trim();

  // 1. Herramienta de práctica
  if (cleanRaw === 'PRACTICETOOL' || cleanRaw.includes('PRACTICE')) {
    return 'Herramienta de Práctica';
  }

  // 2. ARAM Caos (Queue 2400 o mención en el modo)
  if (queueId === 2400 || cleanRaw.includes('MAYHEM') || cleanRaw.includes('CAOS')) {
    return 'ARAM Caos';
  }

  // 3. Modos conocidos por queueId
  if (typeof queueId === 'number' && QUEUE_NAMES[queueId]) {
    if (queueId === 0) {
      return isCustom && cleanRaw === 'PRACTICETOOL' ? 'Herramienta de Práctica' : 'Personalizada';
    }
    return QUEUE_NAMES[queueId];
  }

  // 4. Personalizada por flag
  if (isCustom) {
    return cleanRaw === 'PRACTICETOOL' ? 'Herramienta de Práctica' : 'Personalizada';
  }

  // 5. Mapeo por modo crudo
  if (cleanRaw && RAW_MODE_NAMES[cleanRaw]) {
    return RAW_MODE_NAMES[cleanRaw];
  }

  return rawGameMode || 'Partida';
}

export function buildInGamePresence(liveData, config, rankText = '', skinName = '', gameModeName = '') {
  const champ = getChampionInfo(liveData.championName);
  const patch = getPatchVersion();

  // 1. Extraer el número de skin de forma precisa
  let skinNum = 0;
  if (typeof liveData.skinNum === 'number' && liveData.skinNum >= 0) {
    skinNum = liveData.skinNum;
  } else if (typeof liveData.skinId === 'number' && liveData.skinId > 0) {
    skinNum = liveData.skinId >= 1000 ? (liveData.skinId % 1000) : liveData.skinId;
  }

  // 2. Construir Details (primera línea de texto superior)
  // Formato: Campeón • Elo División y LP (sin paréntesis)
  // Ej: "Caitlyn • Master 120 LP" o "Morgana • Master 120 LP"
  let details = champ.name;
  if (rankText && rankText !== 'Unranked') {
    details += ` • ${rankText}`;
  }

  // 3. Construir State (segunda línea de texto)
  // Formato: KDA en tiempo real, CS por decenas y modo de juego
  // Ej: "0/0/0 • 0 CS • Ranked SoloQ" o "0/0/0 • Arena"
  const rawCs = Number(liveData.cs) || 0;
  const displayCs = Math.floor(rawCs / 10) * 10;
  let stateText = `${liveData.kills}/${liveData.deaths}/${liveData.assists}`;
  if (liveData.isDead) {
    stateText += ' (Muerto)';
  }

  const isArena = gameModeName === 'Arena';
  if (!isArena && config.showCs !== false) {
    stateText += ` • ${displayCs} CS`;
  }

  if (gameModeName) {
    stateText += ` • ${gameModeName}`;
  }

  // 4. Determinar imagen principal (Large Image):
  // Splash Art oficial en alta resolución de la Skin activa (ej: MissFortune_31.jpg)
  let largeImage = `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${champ.key}_${skinNum}.jpg`;

  if (config.imageStyle === 'ddragon-tile') {
    largeImage = `https://ddragon.leagueoflegends.com/cdn/img/champion/tiles/${champ.key}_${skinNum}.jpg`;
  }

  // 5. Large Text (tooltip sobre la imagen)
  // Solo el nombre de la skin y el nivel actual del campeón (sin KDA ni CS)
  const displaySkinName = skinName || champ.name;
  let largeText = displaySkinName;
  if (liveData.level) {
    largeText += ` • Nivel ${liveData.level}`;
  }

  // 6. Small Text (tooltip sobre el logo de League of Legends)
  const smallText = gameModeName ? `Modo: ${gameModeName}` : 'League of Legends';

  // 7. Botones interactivos en Discord (máximo 2)
  const buttons = [];
  if (config.showButtons) {
    buttons.push({
      label: 'Ver en Invade.lol',
      url: 'https://invade.lol'
    });
  }

  return {
    details,
    state: stateText,
    timestamps: {
      start: Math.floor(liveData.gameStartTime / 1000)
    },
    assets: {
      large_image: largeImage,
      large_text: largeText,
      small_image: LEAGUE_LOGO_URL,
      small_text: smallText
    },
    buttons: buttons.length > 0 ? buttons : undefined
  };
}

export function buildLcuPresence(phase, summoner, config, rankText = '', gameModeName = '') {
  const summonerName = summoner?.gameName ? `${summoner.gameName}#${summoner.tagLine}` : (summoner?.displayName || 'Invocador');
  const iconId = summoner?.profileIconId || 29;
  const profileIconUrl = `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/profile-icons/${iconId}.jpg`;

  let details = summonerName;
  if (rankText && rankText !== 'Unranked') {
    details += ` • ${rankText}`;
  }

  let stateText = 'En el Cliente';

  switch (phase) {
    case 'Lobby':
      stateText = gameModeName ? `En Sala • ${gameModeName}` : 'En Sala (Lobby)';
      break;
    case 'Matchmaking':
      stateText = gameModeName ? `Buscando Partida • ${gameModeName}` : 'Buscando Partida...';
      break;
    case 'ReadyCheck':
      stateText = gameModeName ? `¡Partida Encontrada! • ${gameModeName}` : '¡Partida Encontrada!';
      break;
    case 'ChampSelect':
      stateText = gameModeName ? `Selección de Campeón • ${gameModeName}` : 'En Selección de Campeón';
      break;
    case 'GameStart':
      stateText = gameModeName ? `Iniciando Partida • ${gameModeName}` : 'Iniciando Partida...';
      break;
    case 'EndOfGame':
    case 'WaitingForStats':
    case 'PreEndOfGame':
      stateText = 'Estadísticas Post-Partida';
      break;
    default:
      stateText = 'En el Cliente';
  }

  const smallText = gameModeName ? `Modo: ${gameModeName}` : 'League of Legends';

  return {
    details,
    state: stateText,
    timestamps: {
      start: Math.floor(Date.now() / 1000)
    },
    assets: {
      large_image: profileIconUrl,
      large_text: `${summonerName} (Nivel ${summoner?.summonerLevel || 1})`,
      small_image: LEAGUE_LOGO_URL,
      small_text: smallText
    }
  };
}
