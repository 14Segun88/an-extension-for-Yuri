// test-project-owners.js — тестовый скрипт для получения руководителей проектов
// Запустить в консоли браузера с загруженным расширением или как отдельный файл

// Если запускаем отдельно, нужно импортировать функции
// import { getProjectOwners, getProjects, getTeamMembers } from './lib/todoist.js';

async function testProjectOwners() {
  // Вставьте ваш Todoist токен
  const TODOIST_TOKEN = 'YOUR_TODOIST_TOKEN_HERE';
  
  if (TODOIST_TOKEN === 'YOUR_TODOIST_TOKEN_HERE') {
    console.error('❌ Пожалуйста, вставьте ваш Todoist токен в скрипт');
    return;
  }

  console.log('🔍 Начинаем поиск руководителей проектов...');
  
  try {
    // 1. Получаем все проекты
    console.log('📋 Получаем список проектов...');
    const projects = await fetch('https://api.todoist.com/rest/v2/projects', {
      headers: {
        'Authorization': `Bearer ${TODOIST_TOKEN}`,
        'Content-Type': 'application/json',
      },
    }).then(res => res.json());
    
    console.log(`✅ Найдено проектов: ${projects.length}`);
    
    // Фильтруем только открытые проекты (не архивированные)
    const openProjects = projects.filter(p => !p.is_archived);
    console.log(`📂 Открытых проектов: ${openProjects.length}`);
    
    // 2. Получаем информацию о команде
    console.log('👥 Получаем информацию о команде...');
    const teamMembers = await fetch('https://api.todoist.com/rest/v2/team/members', {
      headers: {
        'Authorization': `Bearer ${TODOIST_TOKEN}`,
        'Content-Type': 'application/json',
      },
    }).then(res => res.json());
    
    console.log(`✅ Членов команды: ${teamMembers.length}`);
    
    // Создаем карту членов команды
    const memberMap = new Map(teamMembers.map(m => [m.id, m]));
    
    // 3. Определяем руководителей для каждого проекта
    console.log('\n🎯 Руководители проектов:\n');
    
    const projectOwners = [];
    
    for (const project of openProjects) {
      // Проверяем разные поля для владельца
      const ownerId = project.owner_id || project.creator_id;
      
      if (ownerId && memberMap.has(ownerId)) {
        const owner = memberMap.get(ownerId);
        projectOwners.push({
          project_id: project.id,
          project_name: project.name,
          owner_id: owner.id,
          owner_name: owner.name,
          owner_email: owner.email,
          role: owner.role,
        });
        
        console.log(`📁 Проект: "${project.name}"`);
        console.log(`   👤 Руководитель: ${owner.name}`);
        console.log(`   📧 Email: ${owner.email}`);
        console.log(`   🏷️ Роль: ${owner.role}`);
        console.log(`   🆔 ID: ${owner.id}`);
        console.log('');
      } else {
        console.log(`📁 Проект: "${project.name}"`);
        console.log(`   ⚠️ Руководитель не найден`);
        console.log(`   🆔 Owner ID: ${ownerId || 'не указан'}`);
        console.log('');
      }
    }
    
    // 4. Итоговая статистика
    console.log('\n📊 Статистика:');
    console.log(`   Всего проектов: ${openProjects.length}`);
    console.log(`   С найденными руководителями: ${projectOwners.length}`);
    console.log(`   Без руководителей: ${openProjects.length - projectOwners.length}`);
    
    // 5. Группировка по руководителям
    console.log('\n👥 Проекты по руководителям:\n');
    
    const byOwner = new Map();
    for (const po of projectOwners) {
      const key = `${po.owner_name} (${po.owner_email})`;
      if (!byOwner.has(key)) {
        byOwner.set(key, []);
      }
      byOwner.get(key).push(po.project_name);
    }
    
    for (const [owner, projects] of byOwner) {
      console.log(`👤 ${owner}`);
      console.log(`   📁 Проектов: ${projects.length}`);
      console.log(`   📂 ${projects.join(', ')}`);
      console.log('');
    }
    
    return projectOwners;
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    console.error('Детали:', error);
  }
}

// Если запускаем в браузере
if (typeof window !== 'undefined') {
  window.testProjectOwners = testProjectOwners;
  console.log('✅ Функция testProjectOwners() готова к использованию');
  console.log('📝 Вызовите testProjectOwners() для запуска теста');
}

// Если запускаем как Node.js скрипт
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { testProjectOwners };
}
