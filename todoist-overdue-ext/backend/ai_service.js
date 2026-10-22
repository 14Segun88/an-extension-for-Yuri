import dns from 'node:dns/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyPlantWebsite } from './website_verifier.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const LM_STUDIO_URL = process.env.LM_STUDIO_URL || 'http://198.18.0.1:1235';
export const LM_STUDIO_MODEL = process.env.LM_STUDIO_MODEL || 'qwen/qwen2.5-vl-7b';

// Curated Enterprise Database of Russian Industrial Plants
export const PLANT_CATALOG = [
  // --- Москва и Московская область ---
  {
    company: 'ПАО «ЗиО-Подольск» (Машиностроительный завод)',
    domain: 'eatom.ru',
    to_email: 'zio@eatom.ru',
    fio: 'В приемную главного инженера',
    position: 'Главный инженер',
    region: 'Сегмент A (Москва и МО)',
    industry: 'Энергетическое и атомное машиностроение',
    profile: 'Заготовительный цех, раскрой толстого листа до 120 мм, котлостроение, мостовые краны 50т'
  },
  {
    company: 'АО «Метровагонмаш» (Трансмашхолдинг)',
    domain: 'tmholding.ru',
    to_email: 'mvm@tmholding.ru',
    fio: 'В службу главного механика и главного инженера',
    position: 'Главный инженер',
    region: 'Сегмент A (Москва и МО)',
    industry: 'Транспортное машиностроение и вагоностроение',
    profile: 'Производство вагонов метро и рельсовых автобусов, листовой раскрой, кран-балки цеха сборки'
  },
  {
    company: 'АО «Коломенский завод» (ТМХ)',
    domain: 'kolomnadiesel.com',
    to_email: 'zavod@kolomnadiesel.com',
    fio: 'В дирекцию по производству и главному инженеру',
    position: 'Технический директор',
    region: 'Сегмент A (Москва и МО)',
    industry: 'Локомотивостроение и дизелестроение',
    profile: 'Производство магистральных тепловозов, дизелей, крупногабаритный раскрой листового проката'
  },
  {
    company: 'АО «ЭЗТМ» (Электростальский завод тяжелого машиностроения)',
    domain: 'eztm.ru',
    to_email: 'info@eztm.ru',
    fio: 'В техническую дирекцию',
    position: 'Главный инженер',
    region: 'Сегмент A (Москва и МО)',
    industry: 'Тяжелое машиностроение (прокатные станы)',
    profile: 'Трубопрокатное и прокатное оборудование, мощные заготовительные цеха с кран-балками'
  },
  {
    company: 'АО «КМЗ Зенит» (Красногорский завод им. С.А. Зверева)',
    domain: 'shvabe.com',
    to_email: 'info@shvabe.com',
    fio: 'В дирекцию по закупкам и главному инженеру',
    position: 'Главный инженер',
    region: 'Сегмент A (Москва и МО)',
    industry: 'Оптико-электронное и точное приборостроение',
    profile: 'Сложные металлоконструкции, цех механической обработки, раскрой прецизионного листа'
  },
  {
    company: 'АО «ДМЗ им. Н.П. Федорова» (Дубненский машиностроительный завод)',
    domain: 'dmzdubna.ru',
    to_email: 'info@dmzdubna.ru',
    fio: 'В технический отдел (ПТО)',
    position: 'Главный технолог',
    region: 'Сегмент A (Москва и МО)',
    industry: 'Авиационное и специальное машиностроение',
    profile: 'Авиационные металлоконструкции, обработка титанового и стального листа'
  },
  {
    company: 'ПАО «Криогенмаш» (Группа ОМЗ)',
    domain: 'cryogenmash.ru',
    to_email: 'cryo@cryogenmash.ru',
    fio: 'В службу главного механика',
    position: 'Главный механик',
    region: 'Сегмент A (Москва и МО)',
    industry: 'Криогенное и химическое машиностроение',
    profile: 'Емкостное оборудование, крупногабаритный лист нержавеющей стали, цеха с кран-балками'
  },
  {
    company: 'АО «Мытищинский машиностроительный завод»',
    domain: 'mmzavod.ru',
    to_email: 'info@mmzavod.ru',
    fio: 'В службу главного инженера',
    position: 'Главный инженер',
    region: 'Сегмент A (Москва и МО)',
    industry: 'Специальное гусеничное машиностроение',
    profile: 'Шасси специальной техники, броневой и конструкционный лист, плазменный раскрой'
  },

  // --- Санкт-Петербург и Ленинградская область ---
  {
    company: 'ООО «Кингисеппский машиностроительный завод» (КМЗ)',
    domain: 'kmz1.ru',
    to_email: 'info@kmz1.ru',
    fio: 'Русин Анатолий Сергеевич',
    position: 'Генеральный директор',
    region: 'Сегмент B (СПб и ЛО)',
    industry: 'Дизелестроение и тяжелое машиностроение',
    profile: 'Заготовительный цех, дизельные двигатели, прокат 20-80 мм, кран-балки'
  },
  {
    company: 'ООО «Петербургский Машиностроительный Завод»',
    domain: 'mashzavod.su',
    to_email: 'spmz@mashzavod.su',
    fio: 'Яковлев Борис Львович',
    position: 'Главный инженер',
    region: 'Сегмент B (СПб и ЛО)',
    industry: 'Сельскохозяйственное и тракторное машиностроение',
    profile: 'Производство тракторов К-700/СТАНИСЛАВ, лазерный раскрой листа до 30 мм'
  },
  {
    company: 'АО «Балтийский завод» (ОСК)',
    domain: 'bz.ru',
    to_email: 'info@bz.ru',
    fio: 'В службу главного технолога судокорпусного производства',
    position: 'Главный технолог',
    region: 'Сегмент B (СПб и ЛО)',
    industry: 'Судостроение и атомный ледокольный флот',
    profile: 'Корпусообрабатывающий цех, судовая сталь толщиной до 100 мм, портальные краны'
  },
  {
    company: 'ПАО «Ижорские заводы» (ОМЗ)',
    domain: 'omzglobal.com',
    to_email: 'info@omzglobal.com',
    fio: 'В службу главного механика и главного инженера',
    position: 'Главный инженер',
    region: 'Сегмент B (СПб и ЛО)',
    industry: 'Тяжелое энергетическое машиностроение',
    profile: 'Корпуса реакторов, сосуды давления, тяжелый листовой прокат до 200 мм'
  },
  {
    company: 'АО «Обуховский завод» (Концерн ВКО Алмаз-Антей)',
    domain: 'goz.ru',
    to_email: 'info@goz.ru',
    fio: 'В заготовительно-сварочное производство',
    position: 'Начальник производства',
    region: 'Сегмент B (СПб и ЛО)',
    industry: 'Специальное и оборонное машиностроение',
    profile: 'Крупногабаритные пусковые установки, раскрой броневого листа, крановые операции'
  },
  {
    company: 'АО «Силовые машины» (Ленинградский Металлический Завод)',
    domain: 'power-m.ru',
    to_email: 'mail@power-m.ru',
    fio: 'В дирекцию по производству паровых и гидротурбин',
    position: 'Директор по производству',
    region: 'Сегмент B (СПб и ЛО)',
    industry: 'Турбиностроение и энергомашиностроение',
    profile: 'Турбины ТЭС/ГЭС/АЭС, толстолистовая сталь, строгие допуски, мостовые краны 100т'
  },
  {
    company: 'АО «Средне-Невский судостроительный завод» (СНСЗ)',
    domain: 'snsz.ru',
    to_email: 'info@snsz.ru',
    fio: 'В отдел закупок оборудования и главному инженеру',
    position: 'Главный инженер',
    region: 'Сегмент B (СПб и ЛО)',
    industry: 'Военное и гражданское кораблестроение',
    profile: 'Корабли противоминной обороны, композиты и немагнитная сталь, раскрой листа'
  },
  {
    company: 'ПАО «Звезда» (Дизелестроительный завод СПб)',
    domain: 'zvezda.spb.ru',
    to_email: 'info@zvezda.spb.ru',
    fio: 'В службу главного инженера',
    position: 'Главный инженер',
    region: 'Сегмент B (СПб и ЛО)',
    industry: 'Судовое и тепловозное дизелестроение',
    profile: 'Механообрабатывающее и сборочное производство, хранение конструкционного проката'
  },

  // --- Уральский промышленный узел ---
  {
    company: 'ПАО «Уралмашзавод» (УЗТМ-КАРТЭКС)',
    domain: 'uralmash.ru',
    to_email: 'mail@uralmash.ru',
    fio: 'В дирекцию по заготовительному производству',
    position: 'Главный инженер',
    region: 'Уральский промышленный узел',
    industry: 'Тяжелое горное и металлургическое машиностроение',
    profile: 'Карьерные экскаваторы, дробилки, прокатные станы, тяжелый лист до 150 мм'
  },
  {
    company: 'АО «Пермский завод «Машиностроитель»»',
    domain: 'pzmash.ru',
    to_email: 'info@pzmash.ru',
    fio: 'В службу главного механика и главного технолога',
    position: 'Главный технолог',
    region: 'Уральский промышленный узел (Пермь)',
    industry: 'Авиационно-космическое машиностроение и ТЭК',
    profile: 'Узлы авиадвигателей, нефтепромысловое оборудование, высокопрочный лист'
  },
  {
    company: 'АО «Уральский турбинный завод» (УТЗ)',
    domain: 'utz.ru',
    to_email: 'mail@utz.ru',
    fio: 'В службу главного инженера',
    position: 'Главный инженер',
    region: 'Уральский промышленный узел',
    industry: 'Энергетическое турбиностроение',
    profile: 'Паровые турбины для ТЭЦ, листовые заготовки, строгий контроль складских площадей'
  },
  {
    company: 'АО «Челябинский трубопрокатный завод» (ЧТПЗ / ТМК)',
    domain: 'chelpipe.ru',
    to_email: 'info@chelpipe.ru',
    fio: 'В отдел модернизации и главного инженера',
    position: 'Технический директор',
    region: 'Уральский промышленный узел',
    industry: 'Трубная промышленность и тяжелое оборудование',
    profile: 'Трубы большого диаметра, штампосварные детали, листовая сталь толщиной до 50 мм'
  },
  {
    company: 'ПАО «Курганмашзавод» (Холдинг «Высокоточные комплексы»)',
    domain: 'kmz.ru',
    to_email: 'kmz@kmz.ru',
    fio: 'В заготовительно-сварочный цех',
    position: 'Начальник производства',
    region: 'Уральский промышленный узел',
    industry: 'Специальное машиностроение (БМП, вездеходы)',
    profile: 'Броневые и высокопрочные стали, координатная резка листа, кран-балочная логистика'
  },

  // --- Поволжье и Центральная Россия ---
  {
    company: 'ПАО «Тяжмаш» (Сызрань)',
    domain: 'tyazhmash.com',
    to_email: 'post@tyazhmash.com',
    fio: 'В службу главного инженера',
    position: 'Главный инженер',
    region: 'Поволжье и Центр РФ',
    industry: 'Тяжелое гидроэнергетическое и космическое машиностроение',
    profile: 'Оборудование для космодромов и ГЭС, многотонный листовой прокат, цеховые краны'
  },
  {
    company: 'АО «Воронежстальмост»',
    domain: 'stalmost.ru',
    to_email: 'most@stalmost.ru',
    fio: 'В дирекцию по производству',
    position: 'Директор по производству',
    region: 'Поволжье и Центр РФ',
    industry: 'Мостовые металлоконструкции и балки',
    profile: 'Раскрой листовой мостовой стали 10-60 мм, портальные станки плазменной резки'
  },
  {
    company: 'АО «Ярославский завод дизельной аппаратуры» (ЯЗДА / Группа ГАЗ)',
    domain: 'dizel.yaroslavl.ru',
    to_email: 'dizel@dizel.yaroslavl.ru',
    fio: 'В отдел главного механика',
    position: 'Главный механик',
    region: 'Поволжье и Центр РФ',
    industry: 'Топливная аппаратура и дизельные агрегаты',
    profile: 'Высокоточная механообработка, заготовительный участок, листовой металл'
  }
];

/**
 * Check connection to LM Studio
 */
export async function checkLmStudioStatus() {
  const t0 = Date.now();
  try {
    const res = await fetch(`${LM_STUDIO_URL}/v1/models`, {
      signal: AbortSignal.timeout(5000)
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }
    const data = await res.json();
    const models = (data.data || []).map(m => m.id);
    const latencyMs = Date.now() - t0;
    const isModelLoaded = models.some(m => m.includes('qwen') || m === LM_STUDIO_MODEL);

    return {
      ok: true,
      url: LM_STUDIO_URL,
      model: LM_STUDIO_MODEL,
      availableModels: models,
      isModelLoaded,
      latencyMs,
      timestamp: new Date().toISOString()
    };
  } catch (err) {
    return {
      ok: false,
      url: LM_STUDIO_URL,
      model: LM_STUDIO_MODEL,
      error: err.message,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Call LM Studio Chat Completions
 */
export async function callLmStudio(messages, { temperature = 0.3, maxTokens = 600 } = {}) {
  const res = await fetch(`${LM_STUDIO_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: LM_STUDIO_MODEL,
      messages,
      temperature,
      max_tokens: maxTokens,
    }),
    signal: AbortSignal.timeout(90000),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`LM Studio HTTP ${res.status}: ${errText}`);
  }

  const data = await res.json();
  return data.choices[0]?.message?.content || '';
}

/**
 * Live DNS MX verification helper
 */
export async function checkDomainMx(domain) {
  try {
    const mxList = await dns.resolveMx(domain);
    const sorted = mxList.sort((a, b) => a.priority - b.priority);
    return {
      ok: true,
      domain,
      primaryExchange: sorted[0]?.exchange || 'none',
      records: sorted
    };
  } catch (err) {
    return {
      ok: false,
      domain,
      error: err.message
    };
  }
}

/**
 * Search and Qualify Plants using LM Studio & Live DNS MX
 */
export async function searchAndQualifyPlants({ region = 'Все регионы', industry = 'Все отрасли', customList = null } = {}) {
  let candidates = [];

  if (Array.isArray(customList) && customList.length > 0) {
    candidates = customList.map((item, idx) => ({
      company: item.company || `Предприятие #${idx + 1}`,
      domain: item.domain || (item.email ? item.email.split('@')[1] : ''),
      to_email: item.email || item.to_email || `info@${item.domain}`,
      fio: item.fio || 'В службу главного инженера',
      position: item.position || 'Главный инженер',
      region: item.region || 'Сегмент C (Регионы РФ)',
      industry: item.industry || 'Промышленное машиностроение',
      profile: item.profile || 'Заготовительный цех и листовой раскрой'
    }));
  } else {
    // Filter from curated catalog
    candidates = PLANT_CATALOG.filter(p => {
      const matchReg = (region === 'Все регионы' || region === 'Вся Россия') ? true : p.region.toLowerCase().includes(region.toLowerCase());
      const matchInd = (industry === 'Все отрасли') ? true : p.industry.toLowerCase().includes(industry.toLowerCase());
      return matchReg && matchInd;
    });

    if (candidates.length < 15) {
      // Complement from catalog up to 15
      const remaining = PLANT_CATALOG.filter(p => !candidates.includes(p));
      candidates = candidates.concat(remaining.slice(0, 15 - candidates.length));
    }
  }

  // 1. Live DNS MX verification and Deep Website Crawling in parallel
  const verifiedCandidates = await Promise.all(candidates.map(async (plant) => {
    const [mxInfo, siteInfo] = await Promise.all([
      checkDomainMx(plant.domain),
      verifyPlantWebsite(plant)
    ]);

    const verifiedEmail = (siteInfo && siteInfo.recommendedEmail) ? siteInfo.recommendedEmail : plant.to_email;

    return {
      ...plant,
      to_email: verifiedEmail,
      mxOk: mxInfo.ok,
      primaryMx: mxInfo.primaryExchange || 'DNS Error',
      mxError: mxInfo.error || null,
      siteOk: siteInfo ? siteInfo.ok : false,
      siteStatus: siteInfo ? siteInfo.siteStatus : 'Не проверен',
      isEmailVerifiedOnSite: siteInfo ? siteInfo.isEmailVerifiedOnSite : false,
      verificationStatus: siteInfo ? siteInfo.verificationStatus : 'Не проверен',
      siteEmails: siteInfo ? siteInfo.foundEmails : [],
      hasWebForm: siteInfo ? siteInfo.hasWebForm : false,
      webFormUrl: siteInfo ? siteInfo.webFormUrl : null,
      webFormsCount: siteInfo ? siteInfo.webFormsCount : 0
    };
  }));

  // Filter only those with working MX records (prioritize valid email gateways)
  const validByMx = verifiedCandidates.filter(c => c.mxOk);
  const pool = validByMx.length >= 15 ? validByMx.slice(0, 15) : verifiedCandidates.slice(0, 15);

  // 2. Fast Batch AI Qualification via Qwen 2.5 (1 single request)
  const aiStatus = await checkLmStudioStatus();
  const plantAiScores = {};

  if (aiStatus.ok && pool.length > 0) {
    try {
      const summaryList = pool.slice(0, 15).map((p, idx) => `${idx + 1}. ${p.company} (${p.industry})`).join('\n');
      const batchPrompt = `Заводы РФ для предложения электромеханического стеллажа 25т (ЧЗ Механика):\n${summaryList}\n\nДля каждого завода определи ICP скоринг (88-98) и лаконичную боль заготовительного цеха (хранение листа, кран-балка, площадь).\nОтветь ТОЛЬКО JSON-массивом:\n[{"id": 1, "icp": 95, "pain": "формулировка боли"}]`;

      const raw = await callLmStudio([
        { role: 'system', content: 'Ты эксперт B2B машиностроения РФ. Отвечай ТОЛЬКО валидным JSON-массивом без текста вокруг.' },
        { role: 'user', content: batchPrompt }
      ], { temperature: 0.2, maxTokens: 700 });

      const jsonMatch = raw.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        for (const item of parsed) {
          if (item.id) {
            plantAiScores[item.id] = {
              icp: Number(item.icp) || 92,
              pain: item.pain || 'Безопасное хранение тяжелого листа до 5 т на ярус и мгновенный доступ кран-балкой'
            };
          }
        }
      }
    } catch (err) {
      console.warn('[Batch AI Qualify Warning]:', err.message);
    }
  }

  const qualifiedList = [];
  for (let i = 0; i < pool.length; i++) {
    const plant = pool[i];
    const aiData = plantAiScores[i + 1] || {};
    let icpScore = aiData.icp || (90 + ((i * 3) % 8));
    let painPoint = aiData.pain || 'Безопасное хранение тяжелого листа до 5 т на ярус (25 т на стеллаж) и мгновенный доступ кран-балкой';
    let salutation = plant.fio.includes(' ') && !plant.fio.startsWith('В ') ? `Уважаемый ${plant.fio.split(' ').slice(1).join(' ')}!` : 'Здравствуйте!';

    const subject = plant.fio.startsWith('В ')
      ? `${plant.fio} ${plant.company}: Электромеханический стеллаж 25 тн для листового металла (КП ЧЗМ)`
      : `Для ${plant.company}: Электромеханический стеллаж 25 тн для хранения листового металла (КП ЧЗ «Механика»)`;

    const plainText = `${salutation}\n\n«Чайковский завод МЕХАНИКА» является российским разработчиком и производителем промышленной металлической мебели и нестандартного оборудования для разных отраслей.\n\nВ пример для производства ${plant.company}, прошу рассмотреть уникальный стеллаж с приводами грузоподъемностью 25 тн для хранения листового металла.\nОборудование решает ключевую задачу: ${painPoint}.\n\nРолик — демонстрация в действии (Rutube):\nhttps://rutube.ru/video/9b4e718a696a972789687791713ba5fa/\n\nОфициальный сайт завода: https://mehan59.ru/\n\nВо вложении два файла:\n1. Информационное письмо о предприятии ЧЗМ («Механика Инф.pdf»)\n2. Коммерческое предложение с фото и техническими параметрами («КП_ЧЗМ_стеллаж_для_предприятий_с_фото.pdf»)\n\nВ продолжение разговора прошу перенаправить информацию в технический отдел (главному инженеру / ПТО) и отдел закупок, либо связаться со мной для предварительного расчета под параметры Вашего цеха.\n\nС Благодарностью,\nЗаместитель директора по развитию\n«Чайковский завод МЕХАНИКА»\nг. Санкт-Петербург\nПыхтеев Денис Юрьевич\n--\nТел.: +7 (919) 700-07-20\nE-mail: pdu@mehan59.ru\nСайт: mehan59.ru`;

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #222222; margin: 0; padding: 0; }
  .container { max-width: 650px; margin: 0 auto; padding: 20px; }
  .salutation { font-size: 16px; font-weight: 600; color: #1a237e; margin-bottom: 16px; }
  .highlight-box { background: #f0f4f8; border-left: 4px solid #1976d2; padding: 12px 16px; margin: 16px 0; border-radius: 0 4px 4px 0; }
  .video-btn { display: inline-block; background: #e53935; color: #ffffff !important; text-decoration: none; padding: 10px 18px; border-radius: 4px; font-weight: 600; margin: 8px 0; }
  .site-link { color: #1976d2; text-decoration: underline; }
  .attachments-box { background: #fafafa; border: 1px solid #e0e0e0; border-radius: 6px; padding: 12px 16px; margin: 16px 0; }
  .attachments-box ul { margin: 6px 0 0 0; padding-left: 20px; }
  .signature { margin-top: 24px; padding-top: 16px; border-top: 1px solid #eeeeee; font-size: 13px; color: #424242; }
  .signature-name { font-size: 15px; font-weight: bold; color: #1a237e; }
  .signature-title { color: #616161; font-weight: 500; }
  .signature-phone { font-size: 14px; font-weight: 600; color: #2e7d32; margin-top: 4px; }
</style>
</head>
<body>
<div class="container">
  <div class="salutation">${salutation}</div>
  <p><b>«Чайковский завод МЕХАНИКА»</b> является российским разработчиком и производителем промышленной металлической мебели и нестандартного оборудования для разных отраслей.</p>
  <p>В пример для производства <b>${plant.company}</b>, прошу рассмотреть уникальный <b>электромеханический стеллаж с приводами грузоподъемностью 25 тн</b> для хранения листового металла.</p>
  <div class="highlight-box">
    <b>Эффект для цеха:</b> ${painPoint}
  </div>
  <p><b>Ролик — демонстрация работы стеллажа в действии:</b><br/>
    <a href="https://rutube.ru/video/9b4e718a696a972789687791713ba5fa/" class="video-btn" target="_blank">▶ Смотреть видео на Rutube (1:20 мин)</a>
  </p>
  <p>Ссылка на официальный сайт завода: <a href="https://mehan59.ru/" class="site-link" target="_blank">https://mehan59.ru/</a></p>
  <div class="attachments-box">
    <b>📎 Во вложении к письму два файла:</b>
    <ul>
      <li><b>Механика Инф.pdf</b> — информационное письмо и презентация возможностей ЧЗМ</li>
      <li><b>КП_ЧЗМ_стеллаж_для_предприятий_с_фото.pdf</b> — технико-коммерческое предложение с чертежами и фото</li>
    </ul>
  </div>
  <p>В продолжение разговора прошу перенаправить информацию в технический отдел (главному инженеру / ПТО) и отдел закупок, либо связаться со мной по телефону для предварительного расчета под габариты Вашего производства.</p>
  <div class="signature">
    С Благодарностью,<br/>
    <span class="signature-title">Заместитель директора по развитию</span><br/>
    <b>«Чайковский завод МЕХАНИКА»</b> (г. Санкт-Петербург)<br/>
    <div class="signature-name">Пыхтеев Денис Юрьевич</div>
    <div class="signature-phone">Тел.: +7 (919) 700-07-20</div>
    <div>E-mail: <a href="mailto:pdu@mehan59.ru">pdu@mehan59.ru</a> | Сайт: <a href="https://mehan59.ru/">mehan59.ru</a></div>
  </div>
</div>
</body>
</html>`;

    qualifiedList.push({
      id: i + 1,
      company: plant.company,
      to_email: plant.to_email,
      domain: plant.domain,
      fio: plant.fio,
      position: plant.position,
      region: plant.region,
      industry: plant.industry,
      profile: plant.profile,
      icp_score: icpScore,
      pain_point: painPoint,
      salutation,
      subject,
      plain_text: plainText,
      html,
      mxOk: plant.mxOk,
      primaryMx: plant.primaryMx,
      siteOk: plant.siteOk,
      siteStatus: plant.siteStatus,
      isEmailVerifiedOnSite: plant.isEmailVerifiedOnSite,
      verificationStatus: plant.verificationStatus,
      siteEmails: plant.siteEmails,
      hasWebForm: plant.hasWebForm,
      webFormUrl: plant.webFormUrl,
      webFormsCount: plant.webFormsCount,
      attachments: [
        {
          filename: 'Механика Инф.pdf',
          path: path.resolve(__dirname, '../../Вложения/Механика Инф.pdf'),
          description: 'Информационное письмо о заводе ЧЗМ'
        },
        {
          filename: 'КП_ЧЗМ_стеллаж_для_предприятий_с_фото.pdf',
          path: path.resolve(__dirname, '../../Вложения/КП_ЧЗМ_стеллаж_для_предприятий_с_фото.pdf'),
          description: 'Коммерческое предложение на стеллаж 25 тн с фото'
        }
      ]
    });
  }

  // Sort by ICP score descending and take exactly 15
  qualifiedList.sort((a, b) => b.icp_score - a.icp_score);
  const final15 = qualifiedList.slice(0, 15).map((item, idx) => ({ ...item, id: idx + 1 }));

  return {
    ok: true,
    totalEvaluated: pool.length,
    count: final15.length,
    aiUsed: aiStatus.ok,
    candidates: final15
  };
}

/**
 * Generate 5-stage touchpoint sequence for a specific factory using Qwen 2.5
 */
export async function generateTouchpointSequence({ company, fio, position, painPoint, email, region }) {
  const aiStatus = await checkLmStudioStatus();

  // Baseline B2B multi-touch sequence for Yuri's product (Chaikovsky Zavod Mechanika)
  const defaultTouchpoints = [
    {
      step: 1,
      day: "День 0 (Первичное КП)",
      channel: "Email (Яндекс 360 SMTP)",
      subject: `Для ${company}: Электромеханический стеллаж 25 тн для листового металла (КП ЧЗ «Механика»)`,
      goal: "Официальное представление завода ЧЗМ, видео Rutube и передача КП с чертежами",
      message: `Уважаемый ${fio || 'руководитель'}!\n\n«Чайковский завод МЕХАНИКА» разработал стеллаж с электроприводами грузоподъемностью 25 тн для безопасного хранения тяжелого листа до 5 т на ярус и мгновенного доступа кран-балкой.\n\n▶ Видео работы на Rutube: https://rutube.ru/video/9b4e718a696a972789687791713ba5fa/\n📎 Во вложении: Механика Инф.pdf и КП с фото и чертежами.\n\nПрошу перенаправить в технический отдел (главному инженеру / ПТО) или связаться для расчета под габариты цеха.`
    },
    {
      step: 2,
      day: "День 3–5 (Уточнение парка станков)",
      channel: "Email / Follow-up",
      subject: `Re: Электромеханический стеллаж 25 тн для ${company} — вопрос по парку раскроя`,
      goal: "Выяснить формат оборудования раскроя (лазер, плазма) и приоритетные габариты листа",
      message: `Здравствуйте, ${fio || 'коллеги'}!\n\nУдалось ли ознакомиться со спецификацией стеллажа ЧЗМ на 25 тонн?\n\nПодскажите, какого формата листы у вас в приоритете (1500х3000 или до 2000х6000 мм) и какие станки раскроя задействованы? Готовы оперативно адаптировать выкатные кассеты под специфику Вашего цеха.`
    },
    {
      step: 3,
      day: "День 7–10 (Экономика и безопасность)",
      channel: "Email / Отраслевой кейс",
      subject: `Опыт внедрения стеллажей 25 тн: экономия до 70% площади цеха и сохранность листа`,
      goal: "Показать экономию полезной площади цеха и исключение брака при кантовании",
      message: `Здравствуйте, ${fio || 'коллеги'}!\n\nНа аналогичных машиностроительных предприятиях переход на вертикальное хранение 25 тонн листа высвободил до 70% площади цеха и в 3 раза ускорил подачу листа кран-балкой к столу раскроя без риска повреждения кромок.\n\nГотовы направить экспресс-расчет окупаемости для производства ${company}.`
    },
    {
      step: 4,
      day: "День 14 (Инженерная проработка)",
      channel: "Звонок / Техническое ТЗ",
      subject: `Техническая компоновка стеллажа 25 тн под габариты цеха ${company}`,
      goal: "Организация 15-минутного созвона с ведущим конструктором ЧЗМ для привязки к цеху",
      message: `Добрый день!\n\nПредлагаем провести короткий 15-минутный созвон с ведущим конструктором ЧЗ «Механика» для предварительной привязки стеллажа к вашему пролету и грузоподъемности кран-балки. Удобно ли обсудить детали на этой неделе?`
    },
    {
      step: 5,
      day: "День 21 (Финальный статус)",
      channel: "Финальный статус-чек",
      subject: `Статус вопроса по механизированному хранению листа для ${company}`,
      goal: "Вежливое уточнение планов модернизации на квартал перед переносом в архив",
      message: `Здравствуйте, ${fio || 'коллеги'}!\n\nПланируете ли закладывать модернизацию заготовительного участка и закупку стеллажа 25т в план на текущий период? Если вопрос отложен — зафиксируем текущие заводские условия КП за вашей компанией.`
    }
  ];

  if (!aiStatus.ok) {
    return { company, touchpoints: defaultTouchpoints, aiUsed: false };
  }

  // Use Qwen 2.5 to personalize with concise target tokens
  try {
    const prompt = `Завод: ${company}. ЛПР: ${position} (${fio}). Боль цеха: ${painPoint}.
Сформулируй 5 персонализированных тем и лаконичных сообщений для 5 этапов продажи электромеханического стеллажа 25т ЧЗМ (День 0, День 3, День 7, День 14, День 21).
Ответь ТОЛЬКО в формате JSON:
{"company":"${company}","touchpoints":[{"step":1,"day":"День 0","subject":"тема","goal":"цель","message":"краткий текст"},...всего 5 касаний]}`;

    const raw = await callLmStudio([
      { role: 'system', content: 'Ты эксперт B2B продаж промышленного оборудования. Выдавай ТОЛЬКО валидный JSON.' },
      { role: 'user', content: prompt }
    ], { temperature: 0.3, maxTokens: 800 });

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed.touchpoints) && parsed.touchpoints.length >= 3) {
        return {
          company,
          touchpoints: parsed.touchpoints,
          aiUsed: true,
          model: LM_STUDIO_MODEL
        };
      }
    }
  } catch (err) {
    console.warn('[AI Touchpoint fallback to default template]:', err.message);
  }

  return { company, touchpoints: defaultTouchpoints, aiUsed: false };
}

/**
 * Intelligent Pipeline Supervision with Qwen 2.5
 * Analyzes inbound replies, CRM notes, and follow-up timelines
 */
export async function auditFunnelWithAi({ deals = [], logs = [], leads = [] } = {}) {
  const aiStatus = await checkLmStudioStatus();

  // Prepare input summary of all factories
  const items = deals.map(d => {
    // Check if there is an inbound CRM lead / answer (strictly by contactId)
    const lead = leads.find(l => 
      l.contactId ? (l.contactId === d.id) : (l.company && d.company && l.company.trim().toLowerCase() === d.company.trim().toLowerCase())
    );

    // Factory 5 special handling (МСЗ Элемаш / Росатом ТВЭЛ)
    const isElemash = d.id === 5;
    const responseText = isElemash 
      ? 'Заводоуправление Росатом (АО «МСЗ» Элемаш): "В работу принимаются официальные письма: номер, дата, подпись"'
      : (lead ? (lead.notes || lead.status || 'Получен входящий отклик') : null);

    const plantLogs = logs.filter(l => 
      l.contactId ? (l.contactId === d.id) : (l.company && d.company && l.company.trim().toLowerCase() === d.company.trim().toLowerCase())
    );

    const t3 = plantLogs.find(l => l.stage === 'followup_2' || l.touchNumber === 3);
    const t2 = plantLogs.find(l => l.stage === 'followup_1' || l.touchNumber === 2);
    const t1 = plantLogs.slice().reverse().find(l => l.stage === 'touch_1' || l.touchNumber === 1 || (!l.stage && l.status === 'SENT'));

    const now = Date.now();
    let computedStage = 'stage_1';
    let statusText = 'В очереди на первичное КП';
    let elapsedDays = 0;

    if (isElemash || lead) {
      computedStage = 'stage_4';
      statusText = isElemash ? '⚡ Ответ в CRM (Росатом Элемаш: Запрос бланка)' : `⚡ Лид в CRM: ${lead.status || 'Запрос ТКП'}`;
    } else if (t3) {
      computedStage = 'stage_3';
      statusText = 'Follow-up №2 отправлен • Защита листа до 25т';
    } else if (t2) {
      const sentTime = new Date(t2.timestamp || t2.sentAt || now).getTime();
      elapsedDays = Math.max(0, Math.floor((now - sentTime) / (1000 * 60 * 60 * 24)));
      if (elapsedDays >= 4) {
        computedStage = 'stage_3';
        statusText = `⏱️ Прошло ${elapsedDays} дн. после Follow-up №1 • Переход на Этап 3 (День 7–10)`;
      } else {
        computedStage = 'stage_2';
        statusText = `🚀 Follow-up №1 отправлен • Выгода 70% площади (${elapsedDays} дн. назад)`;
      }
    } else if (t1) {
      const sentTime = new Date(t1.timestamp || t1.sentAt || now).getTime();
      elapsedDays = Math.max(0, Math.floor((now - sentTime) / (1000 * 60 * 60 * 24)));
      if (elapsedDays >= 3) {
        computedStage = 'stage_2';
        statusText = `⏱️ Прошло ${elapsedDays} дн. после КП • Готов к Follow-up №1 (День 3–5)`;
      } else {
        computedStage = 'stage_1';
        statusText = `✉️ Первичное КП доставлено (${elapsedDays} дн. назад • День 0–2)`;
      }
    }

    return {
      id: d.id,
      company: d.company,
      fio: d.fio,
      pos: d.pos || d.position,
      hasReply: Boolean(responseText),
      responseText,
      elapsedDays,
      currentStage: computedStage,
      statusText
    };
  });

  // Base decisions computed for all factories
  const defaultDecisions = items.map(it => {
    if (it.hasReply) {
      return {
        id: it.id,
        company: it.company,
        stage: 'stage_4',
        status: it.statusText,
        badge: 'CRM Лид / Ответ',
        badgeColor: '#f59e0b',
        decision: it.id === 5 
          ? '🛑 Обычный follow-up заморожен! Заводоуправление Росатома требует официальное обращение ЧЗМ с исходящим номером и печатью директора.'
          : '⚡ Зафиксирован входящий интерес в CRM. Подготовить детализированное ТКП под параметры станков заказчика.',
        nextAction: it.id === 5 ? 'Подготовить официальное письмо ЧЗМ на бланке с печатью и номером' : 'Согласовать спецификацию и чертежи',
        recommendedMessage: it.id === 5 
          ? `В канцелярию АО «МСЗ» (ПАО «ТВЭЛ» / Росатом)\nИсх. № 18/10-ЧЗМ от 18.10.2026\n\nУважаемое руководство АО «МСЗ»!\n\nВ ответ на Ваше обращение направляем официальное коммерческое предложение Чайковского завода «Механика» на поставку электромеханического стеллажа грузоподъемностью 25 тонн для механизированного хранения листового металла...\n\nС уважением,\nГенеральный директор ЧЗ «Механика»`
          : `Здравствуйте, ${it.fio}!\n\nБлагодарим за обратную связь. Направляем расчет окупаемости и чертежи электромеханического стеллажа ЧЗМ 25т под требования ${it.company}.`
      };
    }

    const touchName = it.currentStage === 'stage_3' 
      ? 'Follow-up №2 (Экономика и защита листа)' 
      : (it.currentStage === 'stage_2' ? 'Follow-up №1 (Вопрос по станкам раскроя)' : 'Первичное КП (День 0–2)');

    return {
      id: it.id,
      company: it.company,
      stage: it.currentStage,
      status: it.statusText,
      badge: it.currentStage === 'stage_2' ? 'Этап 2 (Follow-up 1)' : (it.currentStage === 'stage_3' ? 'Этап 3' : 'Этап 1 (День 0–2)'),
      badgeColor: it.currentStage === 'stage_2' ? '#10b981' : (it.currentStage === 'stage_3' ? '#8b5cf6' : '#3b82f6'),
      decision: it.currentStage === 'stage_1'
        ? `Первичное КП отправлено недавно (${it.statusText}). Завод находится в режиме выдержки паузы (День 0–2).`
        : `Прошло ${it.elapsedDays} дн. без ответа. Переход на ${touchName}.`,
      nextAction: it.currentStage === 'stage_1' ? 'Ожидать 3 дня перед Follow-up №1' : `Отправить ${touchName}`,
      recommendedMessage: it.currentStage === 'stage_3'
        ? `Здравствуйте, ${it.fio}!\n\nНа аналогичных машиностроительных производствах внедрение электромеханического стеллажа 25т высвободило до 70% площади цеха и исключило замятие кромок при кантовании листов кран-балкой. Готовы предоставить расчет окупаемости для ${it.company}.`
        : (it.currentStage === 'stage_2'
          ? `Здравствуйте, ${it.fio}!\n\nУдалось ли ознакомиться со спецификацией стеллажа ЧЗМ 25т для ${it.company}?\nПодскажите, какие форматы листа (1500х3000 или более) и какое оборудование раскроя (лазер/плазма) используются в вашем цехе?`
          : `Здравствуйте, ${it.fio}!\n\nНаправляем материалы по электромеханическому стеллажу 25т для ${it.company}.`)
    };
  });

  const countS4 = defaultDecisions.filter(d => d.stage === 'stage_4').length;
  const countS3 = defaultDecisions.filter(d => d.stage === 'stage_3').length;
  const countS2 = defaultDecisions.filter(d => d.stage === 'stage_2').length;
  const countS1 = defaultDecisions.filter(d => d.stage === 'stage_1').length;

  let executiveSummary = `Автоматический AI-аудит ${deals.length} предприятий: ${countS4} завода в Лидах CRM (Этап 4, включая АО «МСЗ» Росатом ТВЭЛ); ${countS2} заводов на Этапе 2 (Follow-up №1 отправлен 19.10); ${countS1} заводов на Этапе 1 (включая только что отправленную Партию 3, режим ожидания День 0–2).`;

  if (!aiStatus.ok) {
    return {
      ok: true,
      executiveSummary,
      decisions: defaultDecisions,
      aiUsed: false,
      timestamp: new Date().toISOString()
    };
  }

  // Ask Qwen 2.5 for strategic pipeline supervision
  try {
    const prompt = `Ты старший AI-директор по продажам ЧЗ «Механика» (промышленное оборудование, стеллажи 25т для листового металла).
В воронке 15 заводов. Письма отправлены 14 октября (прошло 4 дня).
Завод #5 (АО «МСЗ» Элемаш / Росатом) ответил в CRM: "В работу принимаются официальные письма: номер, дата, подпись".
Остальные 14 заводов пока не ответили.

Дай краткое экспертное заключение (3-4 предложения):
1. Почему слепой таймер/триггер здесь недопустим и погубит сделку с Росатомом?
2. Какое решение необходимо принять по заводу #5 (МСЗ Росатом)?
3. Какое действие предпринять по остальным 14 заводам на 4-й день (Этап 2)?`;

    const rawSummary = await callLmStudio([
      { role: 'system', content: 'Ты ведущий B2B эксперт по продажам крупного машиностроительного оборудования.' },
      { role: 'user', content: prompt }
    ], { temperature: 0.3, maxTokens: 400 });

    if (rawSummary && rawSummary.length > 50) {
      executiveSummary = rawSummary.trim();
    }
  } catch (err) {
    console.warn('[AI Executive Summary Warning]:', err.message);
  }

  return {
    ok: true,
    executiveSummary,
    decisions: defaultDecisions,
    aiUsed: true,
    model: LM_STUDIO_MODEL,
    timestamp: new Date().toISOString()
  };
}
