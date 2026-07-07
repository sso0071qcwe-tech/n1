import { insert, generateId } from './db.js';
import { hashPin } from './auth.js';

export function seedDatabase() {
  // ===== HOME =====
  const home = insert('homes', {
    id: 'home_glebe',
    name: 'Glebe House Care (Nursing) Home',
    group: 'Merling Care Homes',
    address: 'Glebe House, Example Road, UK'
  });

  // ===== ROOMS =====
  const rooms = [];
  // Resident rooms 1-20
  for (let i = 1; i <= 20; i++) {
    rooms.push(insert('rooms', {
      id: `room_${i}`,
      home_id: 'home_glebe',
      room_number: `${i}`,
      type: 'resident',
      floor: i <= 10 ? 'ground' : 'first',
      occupied: i <= 18,
      resident_name: i <= 18 ? `Resident ${i}` : null
    }));
  }
  
  // Communal areas
  const communalAreas = ['Lounge', 'Dining Room', 'Conservatory', 'Hallway Upstairs', 'Hallway Downstairs'];
  communalAreas.forEach(area => {
    rooms.push(insert('rooms', {
      id: `area_${area.toLowerCase().replace(/\s+/g, '_')}`,
      home_id: 'home_glebe',
      room_number: area,
      type: 'communal',
      floor: area.includes('Upstairs') ? 'first' : 'ground',
      occupied: true
    }));
  });

  // ===== STAFF =====
  const staffData = [
    { name: 'Hannah Smith', initials: 'HS', role: 'housekeeper', pin: '1234' },
    { name: 'Rebecca Turner', initials: 'RT', role: 'housekeeper', pin: '2345' },
    { name: 'Angela Norris', initials: 'AN', role: 'housekeeper', pin: '3456' },
    { name: 'David Parks', initials: 'DP', role: 'housekeeper', pin: '4567' },
    { name: 'Sarah Mitchell', initials: 'SM', role: 'supervisor', pin: '5678' },
    { name: 'Jane Cooper', initials: 'JC', role: 'manager', pin: '6789' },
    { name: 'Mike Wilson', initials: 'MW', role: 'maintenance', pin: '7890' },
    { name: 'Linda Audit', initials: 'LA', role: 'auditor', pin: '8901' }
  ];
  
  staffData.forEach(s => {
    insert('staff', {
      id: `staff_${s.initials.toLowerCase()}`,
      home_id: 'home_glebe',
      name: s.name,
      initials: s.initials,
      role: s.role,
      pin_hash: hashPin(s.pin),
      active: true
    });
  });

  // ===== CHECKLIST TEMPLATES =====
  const templates = [
    {
      id: 'tpl_weekly_room',
      home_id: 'home_glebe',
      name: 'Weekly Housekeeping - Resident\'s Room',
      frequency: 'weekly',
      scope: 'resident',
      description: 'Weekly cleaning tasks for each resident room (W1-W5 per month)'
    },
    {
      id: 'tpl_daily_room',
      home_id: 'home_glebe',
      name: 'Daily Housekeeping - Resident\'s Room',
      frequency: 'daily',
      scope: 'resident',
      description: 'Daily cleaning tasks for each resident room (Mon-Sun)'
    },
    {
      id: 'tpl_daily_communal',
      home_id: 'home_glebe',
      name: 'Daily Housekeeping - Communal Areas',
      frequency: 'daily',
      scope: 'communal',
      description: 'Daily cleaning tasks for communal areas (Mon-Sun)'
    },
    {
      id: 'tpl_quarterly_deep',
      home_id: 'home_glebe',
      name: '3-Monthly Deep Clean - Resident\'s Room',
      frequency: 'quarterly',
      scope: 'resident',
      description: 'Quarterly deep clean tasks for each resident room'
    },
    {
      id: 'tpl_door_handles',
      home_id: 'home_glebe',
      name: 'Door Handles & Handrails (IPC)',
      frequency: 'twice_daily',
      scope: 'whole_home',
      description: 'Twice daily (AM + PM) disinfection of all door handles and handrails - infection control critical'
    }
  ];
  
  templates.forEach(t => insert('checklistTemplates', t));

  // ===== TASK DEFINITIONS =====
  // Weekly Room Tasks
  const weeklyRoomTasks = [
    'Vacuum including under beds',
    'Dust all fixtures and fittings',
    'Dust high corners and wardrobe tops',
    'Dust skirting boards',
    'Dust pictures and ornaments',
    'Remove fingermarks from door frames and switches',
    'Spot clean carpets'
  ];
  weeklyRoomTasks.forEach((task, i) => {
    insert('taskDefinitions', {
      id: `td_weekly_${i + 1}`,
      template_id: 'tpl_weekly_room',
      name: task,
      order: i + 1,
      requires_photo: false,
      ipc_critical: false
    });
  });

  // Daily Room Tasks
  const dailyRoomTasks = [
    'Remove waste and empty bins',
    'Vacuum floors',
    'Remove any dirt or spillage',
    'General clean and tidy',
    'Replenish consumables (toilet roll, soap, paper towels)',
    'Sweep and wash suite floor',
    'Clean door handles and railing'
  ];
  dailyRoomTasks.forEach((task, i) => {
    insert('taskDefinitions', {
      id: `td_daily_room_${i + 1}`,
      template_id: 'tpl_daily_room',
      name: task,
      order: i + 1,
      requires_photo: false,
      ipc_critical: task.includes('door handles')
    });
  });

  // Daily Communal Tasks
  const dailyCommunalTasks = [
    'Remove waste',
    'Vacuum and wash floors',
    'Remove any dirt or spillage',
    'Clean armchairs and tables',
    'Dust all surfaces',
    'Tidy curtains',
    'Clean flower area',
    'Clean tech appliances'
  ];
  dailyCommunalTasks.forEach((task, i) => {
    insert('taskDefinitions', {
      id: `td_daily_communal_${i + 1}`,
      template_id: 'tpl_daily_communal',
      name: task,
      order: i + 1,
      requires_photo: false,
      ipc_critical: false
    });
  });

  // Quarterly Deep Clean Tasks
  const quarterlyTasks = [
    'Wash down gloss paintwork',
    'Wash curtains (per label instructions)',
    'Clean bathroom fans',
    'Clean lampshades and lights',
    'Check towels and linen for damage',
    'Inspect and clean mattress, pillows, and bedding',
    'Clean sink and tub limescale'
  ];
  quarterlyTasks.forEach((task, i) => {
    insert('taskDefinitions', {
      id: `td_quarterly_${i + 1}`,
      template_id: 'tpl_quarterly_deep',
      name: task,
      order: i + 1,
      requires_photo: true,
      ipc_critical: false
    });
  });

  // Door Handles & Handrails Tasks
  const doorHandleTasks = [
    'Clean and disinfect all door handles - AM round',
    'Clean and disinfect all handrails - AM round',
    'Clean and disinfect all door handles - PM round',
    'Clean and disinfect all handrails - PM round'
  ];
  doorHandleTasks.forEach((task, i) => {
    insert('taskDefinitions', {
      id: `td_handles_${i + 1}`,
      template_id: 'tpl_door_handles',
      name: task,
      order: i + 1,
      requires_photo: false,
      ipc_critical: true,
      time_slot: i < 2 ? 'AM' : 'PM'
    });
  });

  // ===== GENERATE TASK INSTANCES FOR TODAY & PAST 7 DAYS =====
  const today = new Date();
  const staffIds = ['staff_hs', 'staff_rt', 'staff_an', 'staff_dp'];
  
  for (let dayOffset = -7; dayOffset <= 0; dayOffset++) {
    const date = new Date(today);
    date.setDate(date.getDate() + dayOffset);
    const dateStr = date.toISOString().split('T')[0];
    const isToday = dayOffset === 0;
    
    // Daily Room Tasks - assign rooms to staff
    for (let roomNum = 1; roomNum <= 18; roomNum++) {
      const assignedStaff = staffIds[roomNum % 4];
      dailyRoomTasks.forEach((task, taskIdx) => {
        const completed = !isToday || Math.random() > 0.4;
        insert('taskInstances', {
          id: generateId(),
          template_id: 'tpl_daily_room',
          task_definition_id: `td_daily_room_${taskIdx + 1}`,
          room_id: `room_${roomNum}`,
          assigned_to: assignedStaff,
          date: dateStr,
          time_slot: null,
          status: completed ? 'done' : (isToday ? 'pending' : 'missed'),
          completed_by: completed ? assignedStaff : null,
          completed_at: completed ? `${dateStr}T${9 + Math.floor(Math.random() * 6)}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}:00Z` : null,
          note: null,
          photo_url: null
        });
      });
    }

    // Daily Communal Tasks
    communalAreas.forEach((area, areaIdx) => {
      const assignedStaff = staffIds[areaIdx % 4];
      dailyCommunalTasks.forEach((task, taskIdx) => {
        const completed = !isToday || Math.random() > 0.3;
        insert('taskInstances', {
          id: generateId(),
          template_id: 'tpl_daily_communal',
          task_definition_id: `td_daily_communal_${taskIdx + 1}`,
          room_id: `area_${area.toLowerCase().replace(/\s+/g, '_')}`,
          assigned_to: assignedStaff,
          date: dateStr,
          time_slot: null,
          status: completed ? 'done' : (isToday ? 'pending' : 'missed'),
          completed_by: completed ? assignedStaff : null,
          completed_at: completed ? `${dateStr}T${8 + Math.floor(Math.random() * 4)}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}:00Z` : null,
          note: null,
          photo_url: null
        });
      });
    });

    // Door Handles & Handrails
    doorHandleTasks.forEach((task, taskIdx) => {
      const slot = taskIdx < 2 ? 'AM' : 'PM';
      const assignedStaff = staffIds[0];
      const completed = !isToday || (slot === 'AM' && Math.random() > 0.2);
      insert('taskInstances', {
        id: generateId(),
        template_id: 'tpl_door_handles',
        task_definition_id: `td_handles_${taskIdx + 1}`,
        room_id: null,
        assigned_to: assignedStaff,
        date: dateStr,
        time_slot: slot,
        status: completed ? 'done' : (isToday ? 'pending' : 'missed'),
        completed_by: completed ? assignedStaff : null,
        completed_at: completed ? `${dateStr}T${slot === 'AM' ? '09' : '15'}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}:00Z` : null,
        note: null,
        photo_url: null
      });
    });

    // Weekly Room Tasks (only on Monday or today for demo)
    if (date.getDay() === 1 || isToday) {
      for (let roomNum = 1; roomNum <= 18; roomNum++) {
        const assignedStaff = staffIds[roomNum % 4];
        weeklyRoomTasks.forEach((task, taskIdx) => {
          const completed = !isToday || Math.random() > 0.5;
          insert('taskInstances', {
            id: generateId(),
            template_id: 'tpl_weekly_room',
            task_definition_id: `td_weekly_${taskIdx + 1}`,
            room_id: `room_${roomNum}`,
            assigned_to: assignedStaff,
            date: dateStr,
            time_slot: null,
            status: completed ? 'done' : (isToday ? 'pending' : 'missed'),
            completed_by: completed ? assignedStaff : null,
            completed_at: completed ? `${dateStr}T${10 + Math.floor(Math.random() * 5)}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}:00Z` : null,
            note: null,
            photo_url: null
          });
        });
      }
    }
  }

  // ===== SAMPLE ISSUES =====
  const sampleIssues = [
    {
      id: 'issue_1',
      home_id: 'home_glebe',
      room_id: 'room_3',
      raised_by: 'staff_hs',
      category: 'damage',
      description: 'Lampshade in room 3 is cracked and needs replacing',
      photo_url: null,
      routed_to: 'staff_mw',
      status: 'open',
      created_at: new Date(Date.now() - 2 * 86400000).toISOString()
    },
    {
      id: 'issue_2',
      home_id: 'home_glebe',
      room_id: 'room_7',
      raised_by: 'staff_rt',
      category: 'damage',
      description: 'Mattress stain in room 7 - needs deep clean or replacement',
      photo_url: null,
      routed_to: 'staff_sm',
      status: 'in_progress',
      created_at: new Date(Date.now() - 5 * 86400000).toISOString()
    },
    {
      id: 'issue_3',
      home_id: 'home_glebe',
      room_id: 'area_lounge',
      raised_by: 'staff_an',
      category: 'stock_out',
      description: 'Running low on furniture polish for the lounge',
      photo_url: null,
      routed_to: 'staff_sm',
      status: 'resolved',
      created_at: new Date(Date.now() - 10 * 86400000).toISOString(),
      resolved_at: new Date(Date.now() - 8 * 86400000).toISOString()
    }
  ];
  sampleIssues.forEach(i => insert('issues', i));

  console.log('Database seeded successfully!');
  console.log(`  - ${rooms.length} rooms/areas`);
  console.log(`  - ${staffData.length} staff members`);
  console.log(`  - ${templates.length} checklist templates`);
  console.log(`  - ${weeklyRoomTasks.length + dailyRoomTasks.length + dailyCommunalTasks.length + quarterlyTasks.length + doorHandleTasks.length} task definitions`);
  console.log(`  - ${findAll('taskInstances').length} task instances generated`);
  console.log(`  - ${sampleIssues.length} sample issues`);
}

import { findAll } from './db.js';
