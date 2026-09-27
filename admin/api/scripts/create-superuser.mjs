// Bootstraps the first admin account. Run:
//   npm run create-superuser -- --email=you@example.com --password=...
// Add --force to create another admin even if one already exists.
import { createInterface } from 'node:readline/promises';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function parseArgs(argv) {
  const args = {};
  for (const arg of argv) {
    const match = arg.match(/^--([^=]+)(?:=(.*))?$/);
    if (match) args[match[1]] = match[2] ?? true;
  }
  return args;
}

async function prompt(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(question);
  rl.close();
  return answer.trim();
}

// Minimal hidden-input prompt (no external deps): mute echo while typing.
async function promptHidden(question) {
  if (!process.stdin.isTTY) return prompt(question);
  return new Promise((resolve) => {
    process.stdout.write(question);
    let input = '';
    const onData = (char) => {
      char = char.toString();
      if (char === '\n' || char === '\r' || char === '') {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.removeListener('data', onData);
        process.stdout.write('\n');
        resolve(input);
      } else if (char === '') {
        process.exit(1);
      } else if (char === '') {
        input = input.slice(0, -1);
      } else {
        input += char;
      }
    };
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('data', onData);
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const email = (args.email || (await prompt('Email: '))).toLowerCase().trim();
  if (!email || !email.includes('@')) {
    throw new Error('Некорректный email');
  }

  const password = args.password || (await promptHidden('Пароль: '));
  if (!password || password.length < 8) {
    throw new Error('Пароль должен быть не короче 8 символов');
  }

  const existingAdmin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  if (existingAdmin && existingAdmin.email !== email && !args.force) {
    throw new Error(
      `Администратор уже существует (${existingAdmin.email}). Добавляйте новых пользователей через саму админку, ` +
        `или передайте --force, если действительно нужен ещё один через CLI.`,
    );
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  const passwordHash = await bcrypt.hash(password, 12);

  const user = existingUser
    ? await prisma.user.update({ where: { email }, data: { role: 'ADMIN', passwordHash, isActive: true } })
    : await prisma.user.create({ data: { email, passwordHash, role: 'ADMIN' } });

  console.log(`Готово: ${user.email} теперь ADMIN (id ${user.id}).`);
}

main()
  .catch((err) => {
    console.error(`Ошибка: ${err.message}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
