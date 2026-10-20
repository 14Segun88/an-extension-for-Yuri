import dotenv from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import nodemailer from 'nodemailer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const datasetPath = path.resolve(__dirname, '../../campaign_emails/campaign_dataset.json');
if (!fs.existsSync(datasetPath)) {
  console.error('[ОШИБКА] Файл campaign_dataset.json не найден!');
  process.exit(1);
}

const campaignData = JSON.parse(fs.readFileSync(datasetPath, 'utf-8'));

// Задержка между отправками в миллисекундах (35 секунд по антиспам-регламенту)
const DELAY_MS = 35000;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('========================================================');
  console.log('   ЗАПУСК РАССЫЛКИ ЧЗМ ДЛЯ 15 ПРОМЫШЛЕННЫХ ЗАВОДОВ      ');
  console.log('========================================================');
  console.log(`Отправитель: ${process.env.SMTP_USER}`);
  console.log(`BCC (копии): ${process.env.SMTP_BCC || 'нет'}`);
  console.log(`Интервал между письмами: ${DELAY_MS / 1000} сек.`);
  console.log(`Количество предприятий: ${campaignData.length}`);
  console.log('--------------------------------------------------------\n');

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.ya.ru',
    port: Number(process.env.SMTP_PORT || 465),
    secure: String(process.env.SMTP_SECURE || 'true').toLowerCase() === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const bccList = (process.env.SMTP_BCC || '')
    .split(',')
    .map(e => e.trim())
    .filter(Boolean);

  const results = [];

  for (let i = 0; i < campaignData.length; i++) {
    const item = campaignData[i];
    console.log(`[${i + 1}/${campaignData.length}] Отправка: ${item.company}`);
    console.log(`   -> Кому: ${item.to_email} (${item.fio})`);
    console.log(`   -> Тема: ${item.subject}`);

    try {
      const attachments = item.attachments.map(a => ({
        filename: a.filename,
        path: a.path,
      }));

      const info = await transporter.sendMail({
        from: `"Пыхтеев Денис (ЧЗ «Механика»)" <${process.env.SMTP_USER}>`,
        to: item.to_email,
        bcc: bccList.length > 0 ? bccList : undefined,
        replyTo: `"Пыхтеев Денис Юрьевич" <${process.env.SMTP_USER}>`,
        subject: item.subject,
        text: item.plain_text,
        html: item.html,
        attachments: attachments,
      });

      console.log(`   [УСПЕХ] Message-ID: ${info.messageId}`);
      results.push({
        id: item.id,
        company: item.company,
        email: item.to_email,
        status: 'SENT',
        messageId: info.messageId,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      console.error(`   [ОШИБКА]: ${err.message}`);
      results.push({
        id: item.id,
        company: item.company,
        email: item.to_email,
        status: 'FAILED',
        error: err.message,
        timestamp: new Date().toISOString(),
      });
    }

    if (i < campaignData.length - 1) {
      console.log(`   Ожидание ${DELAY_MS / 1000} сек. перед следующим письмом...\n`);
      await sleep(DELAY_MS);
    }
  }

  // Сохранение лога отправок
  const logPath = path.resolve(__dirname, '../../campaign_emails/dispatch_log.json');
  fs.writeFileSync(logPath, JSON.stringify(results, null, 2), 'utf-8');

  console.log('\n========================================================');
  console.log('   РАССЫЛКА ЗАВЕРШЕНА!');
  console.log(`Успешно отправлено: ${results.filter(r => r.status === 'SENT').length} из ${results.length}`);
  console.log(`Лог сохранен в: ${logPath}`);
  console.log('========================================================');
}

main().catch(console.error);
