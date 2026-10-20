// test-owners-now.js — немедленный тест с предоставленным токеном

const TODOIST_TOKEN = 'b81725ef77207b73947823e208638ad4fb2812c7';

async function getProjectOwners() {
  const BASE_URL = 'https://api.todoist.com/rest/v2';
  
  async function restGet(endpoint) {
    const url = `${BASE_URL}${endpoint}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${TODOIST_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return response.json();
  }
  
  try {
    console.log('🔍 Получаем проекты и команду...');
    
    const [projects, teamMembers] = await Promise.all([
      restGet('/projects'),
      restGet('/team/members'),
    ]);

    console.log(`📂 Всего проектов: ${projects.length}`);
    console.log(`👥 Членов команды: ${teamMembers.length}`);
    
    // Фильтруем только открытые проекты
    const openProjects = projects.filter(p => !p.is_archived);
    console.log(`📂 Открытых проектов: ${openProjects.length}`);
    
    const memberMap = new Map(teamMembers.map(m => [m.id, m]));
    const owners = [];

    console.log('\n🎯 Руководители проектов:\n');

    for (const project of openProjects) {
      const ownerId = project.owner_id || project.creator_id;
      
      if (ownerId && memberMap.has(ownerId)) {
        const owner = memberMap.get(ownerId);
        owners.push({
          project_id: project.id,
          project_name: project.name,
          owner_id: owner.id,
          owner_name: owner.name,
          owner_email: owner.email,
          role: owner.role,
        });
        
        console.log(`📁 "${project.name}"`);
        console.log(`   👤 ${owner.name} (${owner.email})`);
        console.log(`   🏷️ Роль: ${owner.role}`);
        console.log('');
      } else {
        console.log(`📁 "${project.name}"`);
        console.log(`   ⚠️ Руководитель не найден (ID: ${ownerId || 'не указан'})`);
        console.log('');
      }
    }
    
    // Статистика по руководителям
    console.log('📊 Статистика по руководителям:\n');
    
    const byOwner = new Map();
    for (const owner of owners) {
      const key = `${owner.owner_name} (${owner.owner_email})`;
      if (!byOwner.has(key)) {
        byOwner.set(key, []);
      }
      byOwner.get(key).push(owner.project_name);
    }
    
    for (const [owner, projects] of byOwner) {
      console.log(`👤 ${owner}`);
      console.log(`   📁 Проектов: ${projects.length}`);
      console.log(`   📂 ${projects.join(', ')}`);
      console.log('');
    }
    
    console.log(`\n✅ Итого: ${owners.length} руководителей найдено`);
    
    return owners;
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    throw error;
  }
}

// Запускаем тест
getProjectOwners().catch(console.error);
