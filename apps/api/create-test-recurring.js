const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createTestRecurringTask() {
  try {
    // Get the test user
    const user = await prisma.user.findFirst({
      where: { email: 'test@example.com' }
    });

    if (!user) {
      console.log('Test user not found. Please create a user first.');
      return;
    }

    // Create a test recurring task
    const recurringTask = await prisma.recurringTask.create({
      data: {
        userId: user.id,
        title: 'Morning Exercise',
        category: 'productive',
        defaultDuration: 30, // 30 minutes
        daysOfWeek: [1, 2, 3, 4, 5], // Monday to Friday
        isActive: true,
      },
    });

    console.log('Created test recurring task:', recurringTask);

    // Create another test task
    const sleepTask = await prisma.recurringTask.create({
      data: {
        userId: user.id,
        title: 'Sleep',
        category: 'restoration',
        defaultDuration: 480, // 8 hours
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6], // Every day
        isActive: true,
      },
    });

    console.log('Created sleep recurring task:', sleepTask);

  } catch (error) {
    console.error('Error creating recurring tasks:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestRecurringTask();
