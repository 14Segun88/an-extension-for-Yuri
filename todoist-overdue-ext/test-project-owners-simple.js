// test-project-owners-simple.js — простой тест для функции getProjectOwners()
// Использует нашу новую функцию из lib/todoist.js

// Импортируем нашу функцию (для запуска в браузере с расширением)
async function testGetProjectOwners() {
  // Вставьте ваш Todoist токен
  const TODOIST_TOKEN = 'YOUR_TODOIST_TOKEN_HERE';
  
  if (TODOIST_TOKEN === 'YOUR_TODOIST_TOKEN_HERE') {
    console.error('❌ Пожалуйста, вставьте ваш Todoist токен');
    return;
  }

  console.log('🔍 Тестируем функцию getProjectOwners()...\n');
  
  try {
    // Вызываем нашу функцию из lib/todoist.js
    const owners = await getProjectOwners(TODOIST_TOKEN);
    
    console.log(`✅ Найдено руководителей проектов: ${owners.length}\n`);
    
    // Выводим информацию о каждом руководителе
    for (const owner of owners) {
      console.log(`📁 Проект: "${owner.project_name}"`);
      console.log(`   👤 Руководитель: ${owner.owner_name}`);
      console.log(`   📧 Email: ${owner.owner_email}`);
      console.log(`   🏷️ Роль: ${owner.role}`);
      console.log(`   🆔 ID: ${owner.owner_id}`);
      console.log('');
    }
    
    // Статистика по руководителям
    const byOwner = new Map();
    for (const owner of owners) {
      const key = `${owner.owner_name} (${owner.owner_email})`;
      if (!byOwner.has(key)) {
        byOwner.set(key, []);
      }
      byOwner.get(key).push(owner.project_name);
    }
    
    console.log('📊 Статистика по руководителям:\n');
    for (const [owner, projects] of byOwner) {
      console.log(`👤 ${owner}`);
      console.log(`   📁 Проектов: ${projects.length}`);
      console.log(`   📂 ${projects.join(', ')}`);
      console.log('');
    }
    
    return owners;
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    console.error('Детали:', error);
  }
}

// Функция getProjectOwners из lib/todoist.js
async function getProjectOwners(token) {
  const BASE_URL = 'https://api.todoist.com/rest/v2';
  
  async function restGet(endpoint) {
    const url = `${BASE_URL}${endpoint}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return response.json();
  }
  
  try {
    const [projects, teamMembers] = await Promise.all([
      restGet('/projects'),
      restGet('/team/members'),
    ]);

    const owners = new Map();
    const memberMap = new Map(teamMembers.map(m => [m.id, m]));

    // Фильтруем только открытые проекты
    const openProjects = projects.filter(p => !p.is_archived);
    console.log(`📂 Открытых проектов: ${openProjects.length}`);

    for (const project of openProjects) {
      const ownerId = project.owner_id || project.creator_id;
      
      if (ownerId && memberMap.has(ownerId)) {
        const owner = memberMap.get(ownerId);
        owners.set(project.id, {
          project_id: project.id,
          project_name: project.name,
          owner_id: owner.id,
          owner_name: owner.name,
          owner_email: owner.email,
          role: owner.role,
        });
      }
    }

    return Array.from(owners.values());
  } catch (e) {
    throw new Error(`Ошибка получения владельцев проектов: ${e.message}`);
  }
}

// Для запуска в браузере
if (typeof window !== 'undefined') {
  window.testGetProjectOwners = testGetProjectOwners;
  console.log('✅ Функция testGetProjectOwners() готова');
  console.log('📝 Вставьте токен и вызовите testGetProjectOwners()');
}
