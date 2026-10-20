import dotenv from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import nodemailer from 'nodemailer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const RECIPIENT = 'loftglam@gmail.com';

const ATTACHMENTS = [
  {
    filename: 'Механика Инф.pdf',
    path: path.resolve(__dirname, '../../Вложения/Механика Инф.pdf')
  },
  {
    filename: 'КП_ЧЗМ_стеллаж_для_предприятий_с_фото.pdf',
    path: path.resolve(__dirname, '../../Вложения/КП_ЧЗМ_стеллаж_для_предприятий_с_фото.pdf')
  }
];

// Проверка наличия файлов
console.log('=== ПРОВЕРКА ВЛОЖЕНИЙ ПЕРЕД ОТПРАВКОЙ ===');
for (const att of ATTACHMENTS) {
  if (fs.existsSync(att.path)) {
    const stat = fs.statSync(att.path);
    console.log(`[OK] Файл найден: ${att.filename} (${Math.round(stat.size / 1024)} КБ)`);
  } else {
    console.error(`[ОШИБКА] Файл не найден: ${att.path}`);
    process.exit(1);
  }
}

// Загрузка первого сгенерированного письма из датасета
const datasetPath = path.resolve(__dirname, '../../campaign_emails/campaign_dataset.json');
let sample = null;
if (fs.existsSync(datasetPath)) {
  const data = JSON.parse(fs.readFileSync(datasetPath, 'utf-8'));
  sample = data[0]; // Берем адаптацию для КМЗ как эталон
}

const subject = `[ТЕСТОВОЕ ПИСЬМО] ${sample ? sample.subject : 'Электромеханический стеллаж 25 тн для хранения листового металла'}`;
const html = sample ? sample.html : '<p>Тест</p>';
const text = sample ? sample.plain_text : 'Тест';

async function main() {
  console.log('\n=== ПОДКЛЮЧЕНИЕ К SMTP ЯНДЕКС 360 ===');
  console.log(`Host: ${process.env.SMTP_HOST}:${process.env.SMTP_PORT}`);
  console.log(`User: ${process.env.SMTP_USER}`);
  console.log(`Recipient (To): ${RECIPIENT}`);
  console.log(`BCC (Скрытая копия): ${process.env.SMTP_BCC || 'нет'}`);
  console.log(`Subject: ${subject}`);

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.ya.ru',
    port: Number(process.env.SMTP_PORT || 465),
    secure: String(process.env.SMTP_SECURE || 'true').toLowerCase() === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    logger: true,
    debug: true,
  });

  const bccList = (process.env.SMTP_BCC || '')
    .split(',')
    .map(e => e.trim())
    .filter(Boolean);

  console.log('\nОтправка письма с 2 вложениями...');
  const info = await transporter.sendMail({
    from: `"Пыхтеев Денис (ЧЗ «Механика»)" <${process.env.SMTP_USER}>`,
    to: RECIPIENT,
    bcc: bccList.length > 0 ? bccList : undefined,
    replyTo: `"Пыхтеев Денис Юрьевич" <${process.env.SMTP_USER}>`,
    subject: subject,
    text: text,
    html: html,
    attachments: ATTACHMENTS,
  });

  console.log('\n=============================================');
  console.log(' УСПЕХ! ТЕСТОВОЕ ПИСЬМО УСПЕШНО ОТПРАВЛЕНО!');
  console.log('Message-ID:', info.messageId);
  console.log('Accepted:', info.accepted);
  console.log('Response сервера:', info.response);
  console.log('=============================================');
}

main().catch(err => {
  console.error('\n[ОШИБКА ОТПРАВКИ]:', err);
  process.exit(1);
});
