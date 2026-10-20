import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import nodemailer from 'nodemailer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const user = 'pdu@mehan59.ru';
const pass = 'zyntqqqdqafgyksv';

console.log(`=== ТЕСТ КОРПОРАТИВНОГО АККАУНТА ЯНДЕКС 360 ===`);
console.log(`Email: ${user}`);
console.log(`Пароль: ${pass}\n`);

async function test() {
  process.stdout.write(`Проверка авторизации pdu@mehan59.ru на smtp.ya.ru:465 ... `);
  const transport = nodemailer.createTransport({
    host: 'smtp.ya.ru',
    port: 465,
    secure: true,
    auth: { user, pass },
    connectionTimeout: 7000,
    greetingTimeout: 7000,
    socketTimeout: 7000,
  });

  try {
    await transport.verify();
    console.log('\n\n УСПЕХ! АВТОРИЗАЦИЯ ПРИНЯТА!');
    console.log('Почтовый сервер Яндекс 360 готов к отправке писем от завода mehan59.ru.');
  } catch (e) {
    console.log(`\n\nОШИБКА: ${e.message}`);
  }
}

test();
