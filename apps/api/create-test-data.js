const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createTestData() {
  try {
    // Get the test user
    const user = await prisma.user.findFirst({
      where: { email: 'test@example.com' }
    });

    if (!user) {
      console.log('Test user not found. Please login first to create the user.');
      return;
    }

    console.log('Found user:', user.id);

    // Create some test time entries for the past week
    const today = new Date();
    const entries = [];

    // Today's entries
    entries.push({
      userId: user.id,
      title: 'Morning Exercise',
      category: 'productive',
      startTime: new Date(today.setHours(7, 0, 0, 0)),
      endTime: new Date(today.setHours(8, 0, 0, 0)),
      durationMinutes: 60,
      date: new Date(today.setHours(0, 0, 0, 0)),
    });

    entries.push({
      userId: user.id,
      title: 'Work Session',
      category: 'productive',
      startTime: new Date(today.setHours(9, 0, 0, 0)),
      endTime: new Date(today.setHours(12, 0, 0, 0)),
      durationMinutes: 180,
      date: new Date(today.setHours(0, 0, 0, 0)),
    });

    entries.push({
      userId: user.id,
      title: 'Lunch Break',
      category: 'leisure',
      startTime: new Date(today.setHours(12, 0, 0, 0)),
      endTime: new Date(today.setHours(13, 0, 0, 0)),
      durationMinutes: 60,
      date: new Date(today.setHours(0, 0, 0, 0)),
    });

    entries.push({
      userId: user.id,
      title: 'Afternoon Work',
      category: 'productive',
      startTime: new Date(today.setHours(14, 0, 0, 0)),
      endTime: new Date(today.setHours(17, 0, 0, 0)),
      durationMinutes: 180,
      date: new Date(today.setHours(0, 0, 0, 0)),
    });

    entries.push({
      userId: user.id,
      title: 'Evening Relaxation',
      category: 'leisure',
      startTime: new Date(today.setHours(19, 0, 0, 0)),
      endTime: new Date(today.setHours(20, 0, 0, 0)),
      durationMinutes: 60,
      date: new Date(today.setHours(0, 0, 0, 0)),
    });

    entries.push({
      userId: user.id,
      title: 'Sleep',
      category: 'restoration',
      startTime: new Date(today.setHours(22, 0, 0, 0)),
      endTime: new Date(today.setHours(23, 59, 59, 999)),
      durationMinutes: 120,
      date: new Date(today.setHours(0, 0, 0, 0)),
    });

    // Create entries
    for (const entry of entries) {
      await prisma.timeEntry.create({
        data: entry,
      });
      console.log(`Created: ${entry.title}`);
    }

    console.log('Test data created successfully!');

  } catch (error) {
    console.error('Error creating test data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestData();
