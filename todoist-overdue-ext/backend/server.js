import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';
import fs from 'node:fs';
import dns from 'node:dns/promises';
import { URL } from 'node:url';
import nodemailer from 'nodemailer';
import {
  checkLmStudioStatus,
  generateTouchpointSequence,
  searchAndQualifyPlants,
  checkDomainMx,
  auditFunnelWithAi,
  LM_STUDIO_URL,
  LM_STUDIO_MODEL,
  PLANT_CATALOG,
} from './ai_service.js';
import { verifyPlantWebsite, verifyAllPlantWebsites } from './website_verifier.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const env = {
  BACKEND_API_KEY: process.env.BACKEND_API_KEY || '',
  SMTP_HOST: process.env.SMTP_HOST || 'smtp.ya.ru',
  SMTP_PORT: Number(process.env.SMTP_PORT || 465),
  SMTP_SECURE: String(process.env.SMTP_SECURE || 'true').toLowerCase() === 'true',
  SMTP_USER: process.env.SMTP_USER || 'pdu@mehan59.ru',
  SMTP_PASS: process.env.SMTP_PASS || '',
  SMTP_FROM: process.env.SMTP_FROM || 'pdu@mehan59.ru',
  SMTP_BCC: process.env.SMTP_BCC || 'pdu@mehan59.ru, krantehpto@list.ru',
  PORT: Number(process.env.PORT || 8787),
};

const DATASET_PATH = path.resolve(__dirname, '../../campaign_emails/campaign_dataset.json');
const FOLLOWUP1_DATASET_PATH = path.resolve(__dirname, '../../campaign_emails/followup1_dataset.json');
const FOLLOWUP_DATASET_PATHS = {
  2: path.resolve(__dirname, '../../campaign_emails/followup1_dataset.json'),
  3: path.resolve(__dirname, '../../campaign_emails/followup2_dataset.json'),
  4: path.resolve(__dirname, '../../campaign_emails/followup3_dataset.json'),
  5: path.resolve(__dirname, '../../campaign_emails/followup4_dataset.json'),
};
const AUTOPILOT_CONFIG_PATH = path.resolve(__dirname, '../../campaign_emails/autopilot_config.json');
const LOG_PATH = path.resolve(__dirname, '../../campaign_emails/dispatch_log.json');
const LEADS_PATH = path.resolve(__dirname, '../../campaign_emails/leads.json');
const ATTACHMENT_DIR = path.resolve(__dirname, '../../Вложения');

// Campaign queue state (Initial Offer)
const campaignState = {
  isRunning: false,
  isPaused: false,
  currentIndex: 0,
  total: 0,
  intervalSec: 35,
  countdownSec: 0,
  lastSentAt: null,
  timerId: null,
};

// Generalized Follow-up queue state (Stage 2–5, 35s interval)
const followupState = {
  activeTouch: 2,
  isRunning: false,
  isPaused: false,
  currentIndex: 0,
  total: 14,
  intervalSec: 35,
  countdownSec: 0,
  lastSentAt: null,
  targetPlantIds: null,
  timerId: null,
};
const followup1State = followupState; // Alias for backward compatibility

// Autopilot Configuration
let autopilotConfig = {
  enabled: true,
  mode: 'auto', // 'auto' | 'manual'
  testModeImmediate: false, // if true, min days delay is bypassed for instant test
  checkIntervalSec: 30,
  lastEvaluatedAt: null,
  status: 'IDLE',
};

function loadAutopilotConfig() {
  if (fs.existsSync(AUTOPILOT_CONFIG_PATH)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(AUTOPILOT_CONFIG_PATH, 'utf-8'));
      autopilotConfig = { ...autopilotConfig, ...parsed };
    } catch (e) {
      console.warn('Warning loading autopilot_config.json:', e.message);
    }
  } else {
    saveAutopilotConfig();
  }
  return autopilotConfig;
}

function saveAutopilotConfig() {
  try {
    fs.writeFileSync(AUTOPILOT_CONFIG_PATH, JSON.stringify(autopilotConfig, null, 2), 'utf-8');
  } catch (e) {
    console.error('Error saving autopilot_config.json:', e.message);
  }
}

loadAutopilotConfig();

function loadTouchDataset(touch = 2) {
  const p = FOLLOWUP_DATASET_PATHS[touch] || FOLLOWUP_DATASET_PATHS[2];
  if (fs.existsSync(p)) {
    try {
      return JSON.parse(fs.readFileSync(p, 'utf-8'));
    } catch {
      return [];
    }
  }
  return [];
}

function loadFollowup1Dataset() {
  return loadTouchDataset(2);
}

function getBccList() {
  if (!env.SMTP_BCC) return undefined;
  const list = env.SMTP_BCC.split(',').map(e => e.trim()).filter(Boolean);
  return list.length > 0 ? list : undefined;
}

function json(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, api-key',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
      if (data.length > 2 * 1024 * 1024) {
        reject(new Error('Payload too large'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function getTransport() {
  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
  });
}

function loadDataset() {
  if (fs.existsSync(DATASET_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(DATASET_PATH, 'utf-8'));
    } catch {
      return [];
    }
  }
  return [];
}

function loadLog() {
  if (fs.existsSync(LOG_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(LOG_PATH, 'utf-8'));
    } catch {
      return [];
    }
  }
  return [];
}

function saveLog(entry) {
  const log = loadLog();
  const existingIdx = log.findIndex(l => 
    l.contactId === entry.contactId && 
    (l.stage || 'initial') === (entry.stage || 'initial') &&
    (l.touchNumber || 1) === (entry.touchNumber || 1)
  );
  if (existingIdx >= 0 && entry.status === 'SENT') {
    log[existingIdx] = entry;
  } else {
    log.push(entry);
  }
  fs.writeFileSync(LOG_PATH, JSON.stringify(log, null, 2), 'utf-8');
  return log;
}

function loadLeads() {
  if (fs.existsSync(LEADS_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(LEADS_PATH, 'utf-8'));
    } catch {
      return [];
    }
  }
  return [];
}

function saveLead(leadData) {
  const leads = loadLeads();
  const entry = {
    id: Date.now(),
    createdAt: new Date().toISOString(),
    ...leadData,
  };
  leads.push(entry);
  fs.writeFileSync(LEADS_PATH, JSON.stringify(leads, null, 2), 'utf-8');
  return entry;
}

function checkAttachments() {
  const files = [
    { name: 'Механика Инф.pdf', path: path.join(ATTACHMENT_DIR, 'Механика Инф.pdf') },
    { name: 'КП_ЧЗМ_стеллаж_для_предприятий_с_фото.pdf', path: path.join(ATTACHMENT_DIR, 'КП_ЧЗМ_стеллаж_для_предприятий_с_фото.pdf') },
  ];

  return files.map(f => {
    const exists = fs.existsSync(f.path);
    let size = 0;
    if (exists) {
      size = fs.statSync(f.path).size;
    }
    return {
      filename: f.name,
      path: f.path,
      exists,
      sizeBytes: size,
      sizeKb: Math.round(size / 1024),
    };
  });
}

// Single Email Sender
async function sendEmailItem(item, overrideEmail = null) {
  const transporter = getTransport();
  const targetEmail = overrideEmail || item.to_email;
  const bcc = getBccList();

  const attachments = (item.attachments || []).map(a => ({
    filename: a.filename,
    path: a.path,
  }));

  const info = await transporter.sendMail({
    from: `"Пыхтеев Денис (ЧЗ «Механика»)" <${env.SMTP_USER}>`,
    to: targetEmail,
    bcc,
    replyTo: `"Пыхтеев Денис Юрьевич" <${env.SMTP_USER}>`,
    subject: item.subject,
    text: item.plain_text,
    html: item.html,
    attachments,
  });

  const logEntry = {
    contactId: item.id,
    company: item.company,
    targetEmail,
    isOverride: Boolean(overrideEmail),
    subject: item.subject,
    messageId: info.messageId,
    status: 'SENT',
    accepted: info.accepted,
    timestamp: new Date().toISOString(),
  };

  saveLog(logEntry);
  return logEntry;
}

// Background Campaign Runner
async function runCampaignCycle() {
  if (!campaignState.isRunning || campaignState.isPaused) return;

  const dataset = loadDataset();
  const log = loadLog();
  const sentIds = new Set(log.filter(l => l.status === 'SENT' && !l.isOverride).map(l => l.contactId));

  const unsent = dataset.filter(d => !sentIds.has(d.id));

  if (unsent.length === 0) {
    campaignState.isRunning = false;
    campaignState.countdownSec = 0;
    console.log('[Campaign] Все 15 писем успешно отправлены!');
    return;
  }

  const nextItem = unsent[0];
  campaignState.currentIndex = dataset.findIndex(d => d.id === nextItem.id) + 1;
  campaignState.total = dataset.length;

  console.log(`[Campaign] Отправка ${campaignState.currentIndex}/${campaignState.total}: ${nextItem.company}...`);

  try {
    await sendEmailItem(nextItem);
    campaignState.lastSentAt = new Date().toISOString();
  } catch (err) {
    console.error(`[Campaign Ошибка]:`, err.message);
    saveLog({
      contactId: nextItem.id,
      company: nextItem.company,
      targetEmail: nextItem.to_email,
      status: 'FAILED',
      error: err.message,
      timestamp: new Date().toISOString(),
    });
  }

  // Запуск обратного отсчета перед следующим
  campaignState.countdownSec = campaignState.intervalSec;
  const intervalId = setInterval(() => {
    if (!campaignState.isRunning || campaignState.isPaused) {
      clearInterval(intervalId);
      return;
    }
    campaignState.countdownSec--;
    if (campaignState.countdownSec <= 0) {
      clearInterval(intervalId);
      runCampaignCycle();
    }
  }, 1000);
}

// ==========================================
// --- MULTI-TOUCH PIPELINE REASONING & EVALUATION ---
// ==========================================
function evaluatePipeline() {
  const dataset = loadDataset(); // all 30 factories
  const logs = loadLog(); // dispatch_log.json
  const leads = loadLeads(); // leads.json
  const leadIds = new Set();
  leads.forEach(l => {
    if (l.contactId) leadIds.add(l.contactId);
    if (l.id && typeof l.id === 'number' && l.id < 1000) leadIds.add(l.id);
  });
  leadIds.add(5); // Plant #5 Rosatom Elemash is won lead
  leadIds.add(21); // Plant #21 MMZ is registered lead

  const now = new Date();

  // Rules:
  // Touch 2 (Follow-up #1): min 3 days after Touch 1
  // Touch 3 (Follow-up #2): min 4 days after Touch 2 (Day 7-10 total)
  // Touch 4 (Follow-up #3): min 4 days after Touch 3 (Day 14 total)
  // Touch 5 (Final Touch): min 7 days after Touch 4 (Day 21 total)
  const minDaysRules = { 2: 3, 3: 4, 4: 4, 5: 7 };

  const plants = dataset.map(item => {
    const isLead = leadIds.has(item.id);
    const plantLogs = logs.filter(l => l.contactId === item.id && l.status === 'SENT');

    const touch1Log = plantLogs.find(l => !l.stage || l.stage === 'initial' || l.touchNumber === 1);
    const touch2Log = plantLogs.find(l => l.stage === 'followup_1' || l.touchNumber === 2);
    const touch3Log = plantLogs.find(l => l.stage === 'followup_2' || l.touchNumber === 3);
    const touch4Log = plantLogs.find(l => l.stage === 'followup_3' || l.touchNumber === 4);
    const touch5Log = plantLogs.find(l => l.stage === 'followup_4' || l.touchNumber === 5);

    let currentTouch = 0;
    let lastSentAt = null;
    if (touch5Log) { currentTouch = 5; lastSentAt = touch5Log.timestamp; }
    else if (touch4Log) { currentTouch = 4; lastSentAt = touch4Log.timestamp; }
    else if (touch3Log) { currentTouch = 3; lastSentAt = touch3Log.timestamp; }
    else if (touch2Log) { currentTouch = 2; lastSentAt = touch2Log.timestamp; }
    else if (touch1Log) { currentTouch = 1; lastSentAt = touch1Log.timestamp; }

    let nextTouch = null;
    let isDue = false;
    let daysPassed = 0;
    let scheduledAt = null;
    let minDaysNeeded = 0;

    if (isLead) {
      nextTouch = null;
    } else if (currentTouch === 0) {
      nextTouch = 1;
      isDue = false;
    } else if (currentTouch < 5) {
      nextTouch = currentTouch + 1;
      minDaysNeeded = minDaysRules[nextTouch] || 3;
      if (lastSentAt) {
        const lastSentDate = new Date(lastSentAt);
        const diffMs = now - lastSentDate;
        daysPassed = Math.max(0, parseFloat((diffMs / (1000 * 60 * 60 * 24)).toFixed(1)));
        const schedTime = new Date(lastSentDate.getTime() + minDaysNeeded * 24 * 60 * 60 * 1000);
        scheduledAt = schedTime.toISOString();
        isDue = autopilotConfig.testModeImmediate ? true : (daysPassed >= minDaysNeeded);
      }
    }

    return {
      id: item.id,
      company: item.company,
      batch: item.batch || 1,
      isLead,
      currentTouch,
      lastSentAt,
      nextTouch,
      minDaysNeeded,
      daysPassed,
      scheduledAt,
      isDue,
    };
  });

  const dueItems = plants.filter(p => p.isDue && p.nextTouch && !p.isLead);

  return {
    now: now.toISOString(),
    totalPlants: dataset.length,
    leadsCount: leadIds.size,
    mode: autopilotConfig.mode,
    enabled: autopilotConfig.enabled,
    testModeImmediate: autopilotConfig.testModeImmediate,
    dueCount: dueItems.length,
    dueItems,
    plants,
    batches: {
      batch1: {
        total: plants.filter(p => p.batch === 1).length,
        touch1Sent: plants.filter(p => p.batch === 1 && p.currentTouch >= 1).length,
        touch2Sent: plants.filter(p => p.batch === 1 && p.currentTouch >= 2).length,
        touch3Sent: plants.filter(p => p.batch === 1 && p.currentTouch >= 3).length,
        nextTouch: 3,
        scheduledAt: '2026-10-23T10:00:00.000Z',
        isDue: plants.some(p => p.batch === 1 && p.isDue),
      },
      batch2: {
        total: plants.filter(p => p.batch === 2).length,
        touch1Sent: plants.filter(p => p.batch === 2 && p.currentTouch >= 1).length,
        touch2Sent: plants.filter(p => p.batch === 2 && p.currentTouch >= 2).length,
        touch3Sent: plants.filter(p => p.batch === 2 && p.currentTouch >= 3).length,
        nextTouch: 2,
        scheduledAt: '2026-10-21T10:00:00.000Z',
        isDue: plants.some(p => p.batch === 2 && p.isDue),
      },
    },
  };
}

// Background Generalized Follow-up Runner (Touches 2–5, 35s rate limiter)
async function runFollowupCycle() {
  if (!followupState.isRunning || followupState.isPaused) return;

  const touch = followupState.activeTouch || 2;
  const stageName = `followup_${touch - 1}`;
  const dataset = loadTouchDataset(touch);
  const log = loadLog();
  const leads = loadLeads();
  const leadIds = new Set(leads.map(l => l.id));
  leadIds.add(5); // Rosatom Elemarsh is permanently won lead

  const sentIds = new Set(
    log.filter(l => l.status === 'SENT' && (l.stage === stageName || l.touchNumber === touch)).map(l => l.contactId)
  );

  let eligible = dataset.filter(d => !leadIds.has(d.id) && !sentIds.has(d.id));
  if (followupState.targetPlantIds && Array.isArray(followupState.targetPlantIds) && followupState.targetPlantIds.length > 0) {
    const targetSet = new Set(followupState.targetPlantIds);
    eligible = eligible.filter(d => targetSet.has(d.id));
  }

  if (eligible.length === 0) {
    followupState.isRunning = false;
    followupState.countdownSec = 0;
    console.log(`[Follow-up Touch ${touch}] Все подготовленные письма успешно отправлены!`);
    autopilotConfig.status = 'IDLE';
    saveAutopilotConfig();
    return;
  }

  const nextItem = eligible[0];
  followupState.currentIndex = dataset.findIndex(d => d.id === nextItem.id) + 1;
  followupState.total = eligible.length + sentIds.size;

  console.log(`[Follow-up Touch ${touch}] Отправка ${followupState.currentIndex}: ${nextItem.company}...`);

  try {
    const transporter = getTransport();
    const targetEmail = nextItem.to_email;
    const bcc = getBccList();

    const info = await transporter.sendMail({
      from: `"Пыхтеев Денис (ЧЗ «Механика»)" <${env.SMTP_USER}>`,
      to: targetEmail,
      bcc,
      replyTo: `"Пыхтеев Денис Юрьевич" <${env.SMTP_USER}>`,
      subject: nextItem.subject,
      text: nextItem.plain_text,
      html: nextItem.html,
    });

    const logEntry = {
      contactId: nextItem.id,
      company: nextItem.company,
      targetEmail,
      stage: stageName,
      touchNumber: touch,
      subject: nextItem.subject,
      messageId: info.messageId,
      status: 'SENT',
      accepted: info.accepted,
      timestamp: new Date().toISOString(),
    };

    saveLog(logEntry);
    followupState.lastSentAt = logEntry.timestamp;
    console.log(`[Follow-up Touch ${touch} Успех]: ${nextItem.company} (SMTP 250 OK, Message-ID: ${info.messageId})`);
  } catch (err) {
    console.error(`[Follow-up Touch ${touch} Ошибка]:`, err.message);
    saveLog({
      contactId: nextItem.id,
      company: nextItem.company,
      targetEmail: nextItem.to_email,
      stage: stageName,
      touchNumber: touch,
      subject: nextItem.subject,
      status: 'FAILED',
      error: err.message,
      timestamp: new Date().toISOString(),
    });
  }

  // 35-sec countdown
  followupState.countdownSec = followupState.intervalSec;
  const intervalId = setInterval(() => {
    if (!followupState.isRunning || followupState.isPaused) {
      clearInterval(intervalId);
      return;
    }
    followupState.countdownSec--;
    if (followupState.countdownSec <= 0) {
      clearInterval(intervalId);
      runFollowupCycle();
    }
  }, 1000);
}

function runFollowup1Cycle() {
  followupState.activeTouch = 2;
  return runFollowupCycle();
}

// Background Autopilot Logic Ticker (Every 30 seconds)
async function checkAutopilotTick() {
  loadAutopilotConfig();
  if (!autopilotConfig.enabled || autopilotConfig.mode !== 'auto') {
    return;
  }
  if (followupState.isRunning && !followupState.isPaused) {
    return; // Already busy sending
  }

  const evalResult = evaluatePipeline();
  autopilotConfig.lastEvaluatedAt = new Date().toISOString();

  if (evalResult.dueItems.length > 0) {
    const firstDue = evalResult.dueItems[0];
    const targetTouch = firstDue.nextTouch;
    const sameTouchItems = evalResult.dueItems.filter(i => i.nextTouch === targetTouch);
    const plantIds = sameTouchItems.map(i => i.id);

    console.log(`[Auto-Pilot] Автоматический запуск Касания ${targetTouch} для ${plantIds.length} предприятий по календарной логике воронки!`);
    followupState.activeTouch = targetTouch;
    followupState.targetPlantIds = plantIds;
    followupState.isRunning = true;
    followupState.isPaused = false;
    autopilotConfig.status = `SENDING_TOUCH_${targetTouch}`;
    saveAutopilotConfig();
    runFollowupCycle();
  }
}

// Start Background Autopilot Ticker
setInterval(checkAutopilotTick, 30000);

// HTTP Server
const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'OPTIONS') {
      json(res, 204, {});
      return;
    }

    const host = req.headers.host || `localhost:${env.PORT}`;
    const url = new URL(req.url, `http://${host}`);

    // --- Serve HTML Dashboard ---
    if ((url.pathname === '/' || url.pathname === '/dashboard' || url.pathname === '/dashboard.html') && (req.method === 'GET' || req.method === 'HEAD')) {
      const candidates = [
        path.resolve(__dirname, '../../dashboard.html'),
        path.resolve(__dirname, 'dashboard.html'),
      ];
      for (const p of candidates) {
        if (fs.existsSync(p)) {
          const html = fs.readFileSync(p, 'utf-8');
          res.writeHead(200, {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
          });
          res.end(html);
          return;
        }
      }
      json(res, 404, { message: 'dashboard.html not found' });
      return;
    }

    // --- API: Health ---
    if (url.pathname === '/health' && req.method === 'GET') {
      json(res, 200, { ok: true, service: 'smtp-backend', timestamp: new Date().toISOString() });
      return;
    }

    // --- API: Full Live State (Dataset, Attachments, Log, SMTP info) ---
    if (url.pathname === '/api/campaign/data' && req.method === 'GET') {
      const contacts = loadDataset();
      const logs = loadLog();
      const leads = loadLeads();
      const attachments = checkAttachments();

      json(res, 200, {
        ok: true,
        smtp: {
          host: env.SMTP_HOST,
          port: env.SMTP_PORT,
          user: env.SMTP_USER,
          bcc: env.SMTP_BCC,
          secure: env.SMTP_SECURE,
        },
        contacts,
        logs,
        leads,
        attachments,
        campaignState: {
          isRunning: campaignState.isRunning,
          isPaused: campaignState.isPaused,
          currentIndex: campaignState.currentIndex,
          total: contacts.length,
          sentCount: logs.filter(l => l.status === 'SENT' && !l.isOverride && l.stage !== 'followup_1' && l.touchNumber !== 2).length,
          intervalSec: campaignState.intervalSec,
          countdownSec: campaignState.countdownSec,
          lastSentAt: campaignState.lastSentAt,
        },
        followup1State: {
          isRunning: followup1State.isRunning,
          isPaused: followup1State.isPaused,
          currentIndex: followup1State.currentIndex,
          total: loadFollowup1Dataset().length,
          sentCount: logs.filter(l => l.status === 'SENT' && (l.stage === 'followup_1' || l.touchNumber === 2)).length,
          intervalSec: followup1State.intervalSec,
          countdownSec: followup1State.countdownSec,
          lastSentAt: followup1State.lastSentAt,
        },
        followup2State: {
          total: loadTouchDataset(3).length,
          sentCount: logs.filter(l => l.status === 'SENT' && (l.stage === 'followup_2' || l.touchNumber === 3)).length,
        },
        followup3State: {
          total: loadTouchDataset(4).length,
          sentCount: logs.filter(l => l.status === 'SENT' && (l.stage === 'followup_3' || l.touchNumber === 4)).length,
        },
      });
      return;
    }

    // --- API: Verify SMTP Connection in Real-Time ---
    if (url.pathname === '/api/smtp/verify' && req.method === 'POST') {
      const startTime = Date.now();
      const transport = getTransport();
      try {
        await transport.verify();
        const latencyMs = Date.now() - startTime;
        json(res, 200, {
          ok: true,
          message: 'Авторизация Яндекс 360 успешно принята!',
          user: env.SMTP_USER,
          host: env.SMTP_HOST,
          port: env.SMTP_PORT,
          latencyMs,
        });
      } catch (err) {
        json(res, 502, {
          ok: false,
          message: `Ошибка SMTP: ${err.message}`,
        });
      }
      return;
    }

    // --- API: Live DNS MX Lookup for a Domain ---
    if (url.pathname === '/api/dns/check-mx' && req.method === 'POST') {
      const body = await readBody(req);
      const data = body ? JSON.parse(body) : {};
      const domain = data.domain || 'kmz1.ru';

      try {
        const mxList = await dns.resolveMx(domain);
        const sorted = mxList.sort((a, b) => a.priority - b.priority);
        json(res, 200, {
          ok: true,
          domain,
          mxRecords: sorted,
          primaryExchange: sorted[0]?.exchange || 'none',
        });
      } catch (err) {
        json(res, 200, {
          ok: false,
          domain,
          error: err.message,
        });
      }
      return;
    }

    // --- API: Live DNS MX Batch Check for all 15 domains ---
    if (url.pathname === '/api/dns/check-all' && req.method === 'POST') {
      console.log('[DNS] Получен запрос на живой опрос MX записей по 15 доменам...');
      const dataset = loadDataset();
      const results = await Promise.all(dataset.map(async item => {
        const domain = (item.to_email || '').split('@')[1];
        const t0 = Date.now();
        try {
          const records = await dns.resolveMx(domain);
          const sorted = records.sort((a, b) => a.priority - b.priority);
          return {
            contactId: item.id,
            company: item.company,
            email: item.to_email,
            domain,
            ok: true,
            mxRecords: sorted,
            primaryExchange: sorted[0]?.exchange || 'none',
            latencyMs: Date.now() - t0,
          };
        } catch (err) {
          return {
            contactId: item.id,
            company: item.company,
            email: item.to_email,
            domain,
            ok: false,
            error: err.message,
            latencyMs: Date.now() - t0,
          };
        }
      }));

      console.log(`[DNS] Все 15 доменов успешно опрошены! Активных шлюзов: ${results.filter(r => r.ok).length}/15.`);
      json(res, 200, { ok: true, results });
      return;
    }

    // --- API: Send Single Email (Test or to a specific company) ---
    if (url.pathname === '/api/send/single' && req.method === 'POST') {
      const body = await readBody(req);
      const data = body ? JSON.parse(body) : {};
      const contactId = Number(data.contactId || 1);
      const overrideEmail = data.overrideEmail ? String(data.overrideEmail).trim() : null;

      const dataset = loadDataset();
      const item = dataset.find(d => d.id === contactId) || dataset[0];

      if (!item) {
        json(res, 404, { ok: false, message: 'Контакты не найдены' });
        return;
      }

      try {
        const result = await sendEmailItem(item, overrideEmail);
        json(res, 200, {
          ok: true,
          result,
          message: `Письмо успешно отправлено на ${result.targetEmail}!`,
        });
      } catch (err) {
        console.error('[Send Single Error]:', err);
        json(res, 500, {
          ok: false,
          error: err.message,
          message: `Ошибка отправки: ${err.message}`,
        });
      }
      return;
    }

    // --- API: Start Automated Campaign Queue ---
    if (url.pathname === '/api/campaign/start' && req.method === 'POST') {
      if (campaignState.isRunning && !campaignState.isPaused) {
        json(res, 200, { ok: true, message: 'Кампания уже запущена', campaignState });
        return;
      }

      campaignState.isRunning = true;
      campaignState.isPaused = false;
      runCampaignCycle();

      json(res, 200, {
        ok: true,
        message: 'Автоматическая рассылка запущена с интервалом 35 секунд!',
        campaignState,
      });
      return;
    }

    // --- API: Pause / Stop Campaign ---
    if (url.pathname === '/api/campaign/stop' && req.method === 'POST') {
      campaignState.isRunning = false;
      campaignState.isPaused = true;
      campaignState.countdownSec = 0;

      json(res, 200, {
        ok: true,
        message: 'Рассылка приостановлена',
        campaignState,
      });
      return;
    }

    // --- API: Reset Campaign Queue (Safe queue reset without wiping dispatch history) ---
    if (url.pathname === '/api/campaign/reset' && req.method === 'POST') {
      campaignState.isRunning = false;
      campaignState.isPaused = false;
      campaignState.currentIndex = 0;
      campaignState.countdownSec = 0;
      campaignState.lastSentAt = null;

      const body = await readBody(req);
      const data = body ? JSON.parse(body) : {};
      if (data.forceWipe === true) {
        if (fs.existsSync(LOG_PATH)) {
          const backupPath = path.resolve(__dirname, `../../campaign_emails/dispatch_log_backup_${Date.now()}.json`);
          fs.copyFileSync(LOG_PATH, backupPath);
        }
        fs.writeFileSync(LOG_PATH, '[]', 'utf-8');
      }

      json(res, 200, {
        ok: true,
        message: 'Очередь рассылки сброшена, история отправок сохранена!',
        campaignState,
      });
      return;
    }

    // --- API: Autopilot Status & Funnel Calendar Evaluation ---
    if (url.pathname === '/api/autopilot/status' && req.method === 'GET') {
      const pipeline = evaluatePipeline();
      json(res, 200, {
        ok: true,
        config: autopilotConfig,
        pipeline,
        followupState,
      });
      return;
    }

    // --- API: Switch Autopilot Mode (Auto / Manual / Test Immediate) ---
    if (url.pathname === '/api/autopilot/mode' && req.method === 'POST') {
      const body = await readBody(req);
      const data = body ? JSON.parse(body) : {};

      if (data.mode) autopilotConfig.mode = data.mode;
      if (typeof data.enabled === 'boolean') autopilotConfig.enabled = data.enabled;
      if (typeof data.testModeImmediate === 'boolean') autopilotConfig.testModeImmediate = data.testModeImmediate;

      saveAutopilotConfig();
      if (autopilotConfig.mode === 'auto' && autopilotConfig.enabled) {
        checkAutopilotTick();
      }

      json(res, 200, {
        ok: true,
        message: `Режим рассылки переключен на: ${autopilotConfig.mode === 'auto' ? 'АВТО-ПИЛОТ (По логике)' : 'РУЧНОЙ (По кнопкам)'}`,
        config: autopilotConfig,
        pipeline: evaluatePipeline(),
      });
      return;
    }

    // --- API: Trigger Autopilot Logic Run Right Now ---
    if (url.pathname === '/api/autopilot/run-now' && req.method === 'POST') {
      const body = await readBody(req);
      const data = body ? JSON.parse(body) : {};

      if (data.forceImmediate) {
        autopilotConfig.testModeImmediate = true;
        saveAutopilotConfig();
      }

      const evalBefore = evaluatePipeline();
      await checkAutopilotTick();
      const evalAfter = evaluatePipeline();

      json(res, 200, {
        ok: true,
        message: 'Проверка логики воронки выполнена',
        dueCount: evalBefore.dueCount,
        config: autopilotConfig,
        pipeline: evalAfter,
        followupState,
      });
      return;
    }

    // --- API: Start Follow-up Manual or Auto Queue (Touch 2, 3, 4, 5) ---
    if ((url.pathname === '/api/followup/start' || url.pathname === '/api/followup1/start') && req.method === 'POST') {
      const body = await readBody(req);
      const data = body ? JSON.parse(body) : {};
      const touch = parseInt(data.touch || (url.pathname === '/api/followup1/start' ? 2 : 2), 10);
      const plantIds = Array.isArray(data.plantIds) ? data.plantIds : null;

      if (followupState.isRunning && !followupState.isPaused) {
        json(res, 200, { ok: true, message: `Рассылка Касания ${followupState.activeTouch} уже выполняется`, followupState });
        return;
      }

      followupState.activeTouch = touch;
      followupState.targetPlantIds = plantIds;
      followupState.isRunning = true;
      followupState.isPaused = false;
      runFollowupCycle();

      json(res, 200, {
        ok: true,
        message: `Рассылка Касания ${touch} успешно запущена с интервалом 35 секунд!`,
        followupState,
      });
      return;
    }

    // --- API: Pause / Stop Follow-up ---
    if ((url.pathname === '/api/followup/stop' || url.pathname === '/api/followup1/stop') && req.method === 'POST') {
      followupState.isRunning = false;
      followupState.isPaused = true;
      followupState.countdownSec = 0;

      json(res, 200, {
        ok: true,
        message: `Рассылка Касания ${followupState.activeTouch} приостановлена`,
        followupState,
      });
      return;
    }

    // --- API: Get Follow-up Live State & Items ---
    if ((url.pathname.startsWith('/api/followup') && url.pathname.endsWith('/data')) && req.method === 'GET') {
      let defaultTouch = 2;
      if (url.pathname === '/api/followup2/data') defaultTouch = 3;
      else if (url.pathname === '/api/followup3/data') defaultTouch = 4;
      else if (url.pathname === '/api/followup4/data') defaultTouch = 5;
      const touch = parseInt(url.searchParams.get('touch') || defaultTouch || followupState.activeTouch || 2, 10);
      const items = loadTouchDataset(touch);
      const logs = loadLog();
      const stageName = `followup_${touch - 1}`;
      const followupLogs = logs.filter(l => l.stage === stageName || l.touchNumber === touch);
      const sentIds = new Set(followupLogs.filter(l => l.status === 'SENT').map(l => l.contactId));

      const enrichedItems = items.map(it => ({
        ...it,
        isSent: sentIds.has(it.id),
        sentAt: followupLogs.find(l => l.contactId === it.id && l.status === 'SENT')?.timestamp || null,
        messageId: followupLogs.find(l => l.contactId === it.id && l.status === 'SENT')?.messageId || null,
      }));

      json(res, 200, {
        ok: true,
        activeTouch: touch,
        items: enrichedItems,
        total: items.length,
        sentCount: sentIds.size,
        followupState: {
          activeTouch: followupState.activeTouch,
          isRunning: followupState.isRunning,
          isPaused: followupState.isPaused,
          currentIndex: followupState.currentIndex,
          total: items.length,
          sentCount: sentIds.size,
          intervalSec: followupState.intervalSec,
          countdownSec: followupState.countdownSec,
          lastSentAt: followupState.lastSentAt,
        },
        followup1State: {
          isRunning: followupState.isRunning,
          isPaused: followupState.isPaused,
          currentIndex: followupState.currentIndex,
          total: items.length,
          sentCount: sentIds.size,
          intervalSec: followupState.intervalSec,
          countdownSec: followupState.countdownSec,
          lastSentAt: followupState.lastSentAt,
        },
        logs: followupLogs,
      });
      return;
    }

    // --- API: Download Real Workspace Files ---
    if (url.pathname === '/api/files/download' && (req.method === 'GET' || req.method === 'HEAD')) {
      const filename = url.searchParams.get('file');
      const safeMap = {
        'Механика Инф.pdf': path.join(ATTACHMENT_DIR, 'Механика Инф.pdf'),
        'КП_ЧЗМ_стеллаж_для_предприятий_с_фото.pdf': path.join(ATTACHMENT_DIR, 'КП_ЧЗМ_стеллаж_для_предприятий_с_фото.pdf'),
        'followup1_dataset.json': FOLLOWUP1_DATASET_PATH,
        'followup2_dataset.json': FOLLOWUP_DATASET_PATHS[3],
        'followup3_dataset.json': FOLLOWUP_DATASET_PATHS[4],
        'followup4_dataset.json': FOLLOWUP_DATASET_PATHS[5],
        'campaign_dataset.json': DATASET_PATH,
        'b2b_contacts_validated.xlsx': path.resolve(__dirname, '../../b2b_contacts_validated.xlsx'),
        'b2b_segment_A_moscow.xlsx': path.resolve(__dirname, '../../b2b_segment_A_moscow.xlsx'),
        'b2b_segment_B_spb.xlsx': path.resolve(__dirname, '../../b2b_segment_B_spb.xlsx'),
        'leads.json': LEADS_PATH,
        'dispatch_log.json': LOG_PATH,
        'b2b_mailing_workflow.drawio': path.resolve(__dirname, '../../b2b_mailing_workflow.drawio'),
      };

      const targetPath = safeMap[filename];
      if (targetPath && fs.existsSync(targetPath)) {
        const stat = fs.statSync(targetPath);
        const ext = path.extname(targetPath).toLowerCase();
        let mime = 'application/octet-stream';
        if (ext === '.pdf') mime = 'application/pdf';
        if (ext === '.xlsx') mime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        if (ext === '.json') mime = 'application/json';

        res.writeHead(200, {
          'Content-Type': mime,
          'Content-Length': stat.size,
          'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(filename)}`,
        });

        if (req.method === 'HEAD') {
          res.end();
          return;
        }

        const stream = fs.createReadStream(targetPath);
        stream.pipe(res);
        return;
      }

      json(res, 404, { ok: false, message: 'Файл не найден' });
      return;
    }

    // --- API: Save Lead from Qualification Form (Stage 4) ---
    if (url.pathname === '/api/leads/save' && req.method === 'POST') {
      const body = await readBody(req);
      const data = body ? JSON.parse(body) : {};
      const entry = saveLead(data);

      json(res, 200, {
        ok: true,
        lead: entry,
        message: 'Лид успешно сохранен в базе CRM!',
      });
      return;
    }

    // --- API: Get Saved Leads ---
    if (url.pathname === '/api/leads' && req.method === 'GET') {
      const leads = loadLeads();
      json(res, 200, { ok: true, leads });
      return;
    }

    // --- API: LM Studio AI Status & Ping ---
    if (url.pathname === '/api/ai/status' && req.method === 'GET') {
      const status = await checkLmStudioStatus();
      json(res, 200, status);
      return;
    }

    // --- API: Deep Website Crawler & Contact Verification (Stage 1) ---
    if (url.pathname === '/api/validate/crawl-website' && req.method === 'POST') {
      const body = await readBody(req);
      const data = body ? JSON.parse(body) : {};

      if (data.plantId) {
        const dataset = loadDataset();
        const plant = dataset.find(d => d.id === data.plantId);
        if (!plant) {
          json(res, 404, { ok: false, message: 'Предприятие не найдено' });
          return;
        }
        const result = await verifyPlantWebsite(plant);
        json(res, 200, { ok: true, result });
        return;
      }

      // Batch verification for specified batch or all 15
      const dataset = loadDataset();
      const batchNum = data.batch || 1;
      const targetPlants = dataset.filter(d => (d.batch || 1) === batchNum);
      const listToCrawl = targetPlants.length > 0 ? targetPlants : dataset.slice(0, 15);
      const results = await verifyAllPlantWebsites(listToCrawl);
      json(res, 200, { ok: true, batch: batchNum, total: results.length, results });
      return;
    }

    // --- API: Apply Verified Email from Website ---
    if (url.pathname === '/api/validate/apply-site-email' && req.method === 'POST') {
      const body = await readBody(req);
      const data = body ? JSON.parse(body) : {};
      const { plantId, newEmail } = data;

      if (!plantId || !newEmail) {
        json(res, 400, { ok: false, message: 'Требуется plantId и newEmail' });
        return;
      }

      const dataset = loadDataset();
      const plant = dataset.find(d => d.id === plantId);
      if (!plant) {
        json(res, 404, { ok: false, message: 'Предприятие не найдено' });
        return;
      }

      const oldEmail = plant.to_email || plant.email;
      plant.to_email = newEmail;
      plant.email = newEmail;
      plant.isWebsiteVerified = true;
      plant.verifiedAt = new Date().toISOString();

      fs.writeFileSync(DATASET_PATH, JSON.stringify(dataset, null, 2), 'utf-8');

      // Also update follow-up datasets if present
      for (const t of [2, 3, 4, 5]) {
        const fpPath = FOLLOWUP_DATASET_PATHS[t];
        if (fs.existsSync(fpPath)) {
          try {
            const fpData = JSON.parse(fs.readFileSync(fpPath, 'utf-8'));
            const fItem = fpData.find(d => d.id === plantId);
            if (fItem) {
              fItem.to_email = newEmail;
              fItem.isWebsiteVerified = true;
              fs.writeFileSync(fpPath, JSON.stringify(fpData, null, 2), 'utf-8');
            }
          } catch (e) {}
        }
      }

      json(res, 200, {
        ok: true,
        message: `Email для ${plant.company} успешно обновлен с ${oldEmail} на проверенный с сайта: ${newEmail}`,
        plantId,
        newEmail
      });
      return;
    }

    // --- API: Web Form Dispatcher / Online Reception Submission ---
    if (url.pathname === '/api/webform/submit' && req.method === 'POST') {
      const body = await readBody(req);
      const data = body ? JSON.parse(body) : {};
      const { plantId, webFormUrl } = data;

      const dataset = loadDataset();
      const plant = dataset.find(d => d.id === plantId) || { company: `Предприятие #${plantId}` };

      // Log the webform dispatch attempt
      const logEntry = {
        contactId: plantId,
        company: plant.company,
        targetEmail: plant.to_email || plant.email || 'WebForm',
        stage: 'webform_submission',
        touchNumber: 1,
        subject: `Обращение через веб-форму сайта: ${plant.company}`,
        messageId: `webform_${Date.now()}_${plantId}`,
        webFormUrl: webFormUrl || `https://${plant.domain}/contacts`,
        status: 'DISPATCHED_TO_SITE',
        timestamp: new Date().toISOString()
      };
      saveLog(logEntry);

      json(res, 200, {
        ok: true,
        message: `Обращение зарегистрировано для отправки через онлайн-приёмную ${plant.company} (${webFormUrl})`,
        logEntry
      });
      return;
    }

    // --- API: AI Search & Batch Qualification (Qwen 2.5 + DNS MX) ---
    if (url.pathname === '/api/ai/search-and-qualify' && req.method === 'POST') {
      const body = await readBody(req);
      const data = body ? JSON.parse(body) : {};
      const result = await searchAndQualifyPlants(data);
      json(res, 200, result);
      return;
    }

    // --- API: AI Generate 5-Stage Touchpoints Sequence ---
    if (url.pathname === '/api/ai/generate-sequence' && req.method === 'POST') {
      const body = await readBody(req);
      const data = body ? JSON.parse(body) : {};
      const result = await generateTouchpointSequence(data);
      json(res, 200, { ok: true, result });
      return;
    }

    // --- API: AI Pipeline Supervision & CRM Reasoning (Qwen 2.5) ---
    if (url.pathname === '/api/ai/audit-funnel' && req.method === 'POST') {
      const body = await readBody(req);
      const data = body ? JSON.parse(body) : {};
      const deals = Array.isArray(data.deals) ? data.deals : loadDataset();
      const logs = loadLog();
      const leads = loadLeads();

      const result = await auditFunnelWithAi({ deals, logs, leads });
      json(res, 200, result);
      return;
    }

    // --- API: Apply AI Scored 15 Plants directly to Live Funnel (Accumulates batches) ---
    if (url.pathname === '/api/ai/apply-batch' && req.method === 'POST') {
      const body = await readBody(req);
      const data = body ? JSON.parse(body) : {};
      const contacts = Array.isArray(data.contacts) ? data.contacts.slice(0, 15) : [];

      if (contacts.length === 0) {
        json(res, 400, { ok: false, message: 'Пустой массив контактов' });
        return;
      }

      // Backup current dataset
      if (fs.existsSync(DATASET_PATH)) {
        const backupPath = path.resolve(__dirname, `../../campaign_emails/campaign_dataset_backup_${Date.now()}.json`);
        fs.copyFileSync(DATASET_PATH, backupPath);
      }

      const currentDataset = loadDataset();
      let updatedDataset = [];

      if (data.replace === true) {
        updatedDataset = contacts.map((c, idx) => ({
          ...c,
          id: idx + 1,
          batch: 1,
          batch_label: 'Партия 1'
        }));
      } else {
        const maxId = currentDataset.length > 0 ? Math.max(...currentDataset.map(c => c.id || 0)) : 0;
        const batchNum = Math.floor(maxId / 15) + 1;
        const nowStr = new Date().toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
        const newBatch = contacts.map((c, idx) => ({
          ...c,
          id: maxId + idx + 1,
          batch: batchNum,
          batch_label: `Партия ${batchNum} (${nowStr})`
        }));
        updatedDataset = [...currentDataset, ...newBatch];
      }

      fs.writeFileSync(DATASET_PATH, JSON.stringify(updatedDataset, null, 2), 'utf-8');

      // Note: Historical dispatch log is strictly preserved so previously processed factories are never wiped or re-sent

      json(res, 200, {
        ok: true,
        count: contacts.length,
        totalInFunnel: updatedDataset.length,
        message: `Успешно сохранено ${contacts.length} заводов в воронку! Всего в базе: ${updatedDataset.length} предприятий.`,
      });
      return;
    }

    // Legacy Brevo / extension compatibility endpoint
    if (url.pathname === '/v3/smtp/email' && req.method === 'POST') {
      const raw = await readBody(req);
      const payload = raw ? JSON.parse(raw) : {};
      const to = Array.isArray(payload.to) ? payload.to : [];
      const toEmail = to[0]?.email;
      const subject = payload.subject || '';
      const html = payload.htmlContent || '';

      const rawAttachments = payload.attachment || payload.attachments;
      let attachments;
      if (Array.isArray(rawAttachments)) {
        attachments = rawAttachments.map(att => {
          if (att.path) return { filename: att.filename || att.name, path: att.path };
          if (att.content) return { filename: att.name || att.filename, content: att.content };
          if (att.url) return { filename: att.name || att.filename, path: att.url };
          return att;
        });
      }

      const transport = getTransport();
      const bcc = getBccList();
      const info = await transport.sendMail({
        from: env.SMTP_FROM || env.SMTP_USER,
        to: toEmail,
        bcc,
        subject,
        html,
        attachments,
      });

      json(res, 201, { messageId: info.messageId });
      return;
    }

    json(res, 404, { message: 'Not found' });
  } catch (err) {
    console.error('[Server Error]:', err);
    json(res, 500, { message: err.message || 'Internal server error' });
  }
});

server.listen(env.PORT, '0.0.0.0', () => {
  console.log(`[smtp-backend] live at http://localhost:${env.PORT}`);
  console.log(`[smtp-backend] dashboard: http://localhost:${env.PORT}/dashboard`);
  console.log(`[smtp-backend] SMTP: ${env.SMTP_USER} -> ${env.SMTP_HOST}:${env.SMTP_PORT}`);
  console.log(`[smtp-backend] BCC: ${env.SMTP_BCC}`);
});
