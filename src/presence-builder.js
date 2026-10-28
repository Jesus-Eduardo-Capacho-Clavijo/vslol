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
  const lp = typeof target.leaguePoints === 'number' && target.leaguePoints > 0 ? ` (${target.leaguePoints} LP)` : '';

  if (['MASTER', 'GRANDMASTER', 'CHALLENGER'].includes(rawTier)) {
    return `${tierName}${lp}`;
  }

  return `${tierName}${division}${lp}`;
}

export function buildInGamePresence(liveData, config, rankText = '', skinName = '') {
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
  // Formato: Campeón (Rol) • Elo y División actual
  // Ej: "Miss Fortune • Master (120 LP)" o "Miss Fortune (Bot) • Master (120 LP)"
  let details = champ.name;
  const pos = (liveData.positionName || '').trim();
  if (pos && pos.toUpperCase() !== 'NONE') {
    details += ` (${pos})`;
  }
  if (rankText) {
    details += ` • ${rankText}`;
  } else {
    details += ` • ${liveData.kills} / ${liveData.deaths} / ${liveData.assists}`;
  }

  // 3. Construir State (segunda línea de texto)
  // Formato: Modo de juego • CS actual (y estado si está muerto sin contador de segundos para evitar rate limit de Discord)
  let stateText = liveData.gameModeName || 'En partida';
  if (liveData.isDead) {
    stateText += ' (Muerto)';
  }
  const cs = Number(liveData.cs) || 0;
  if (config.showCs !== false) {
    stateText += ` • ${cs} CS`;
  }

  // 4. Determinar imagen principal (Large Image):
  // Splash Art oficial en alta resolución de la Skin activa (ej: MissFortune_31.jpg)
  let largeImage = `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${champ.key}_${skinNum}.jpg`;

  if (config.imageStyle === 'ddragon-tile') {
    largeImage = `https://ddragon.leagueoflegends.com/cdn/img/champion/tiles/${champ.key}_${skinNum}.jpg`;
  }

  // 5. Large Text (tooltip sobre la imagen)
  // Muestra solo el nombre de la skin (ya que incluye el campeón) y SIN (0.0/min)
  const displaySkinName = skinName || champ.name;
  let largeText = displaySkinName;
  if (config.showLevel && liveData.level) {
    largeText += ` • Nivel ${liveData.level}`;
  }
  largeText += ` • KDA: ${liveData.kdaRatio}`;
  if (config.showCs !== false) {
    largeText += ` • ${cs} CS`;
  }

  // 6. Botones interactivos en Discord (máximo 2)
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
      small_text: 'League of Legends'
    },
    buttons: buttons.length > 0 ? buttons : undefined
  };
}

export function buildLcuPresence(phase, summoner, config, rankText = '') {
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
      stateText = 'En Sala (Lobby)';
      break;
    case 'Matchmaking':
      stateText = 'Buscando Partida...';
      break;
    case 'ReadyCheck':
      stateText = '¡Partida Encontrada!';
      break;
    case 'ChampSelect':
      stateText = 'En Selección de Campeón';
      break;
    case 'GameStart':
      stateText = 'Iniciando Partida...';
      break;
    case 'EndOfGame':
    case 'WaitingForStats':
    case 'PreEndOfGame':
      stateText = 'Estadísticas Post-Partida';
      break;
    default:
      stateText = 'En el Cliente';
  }

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
      small_text: 'League of Legends'
    }
  };
}
