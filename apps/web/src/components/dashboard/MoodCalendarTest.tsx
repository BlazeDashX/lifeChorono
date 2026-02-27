import MoodCalendar from './MoodCalender';

// Sample mood data for testing
const sampleMoodData = [
  { date: '2026-01-01', score: 4 },
  { date: '2026-01-02', score: 3 },
  { date: '2026-01-03', score: 5 },
  { date: '2026-01-04', score: 2 },
  { date: '2026-01-05', score: 1 },
  { date: '2026-01-06', score: 4 },
  { date: '2026-01-07', score: 3 },
  { date: '2026-01-08', score: 5 },
  { date: '2026-01-09', score: 4 },
  { date: '2026-01-10', score: 3 },
  { date: '2026-01-11', score: 2 },
  { date: '2026-01-12', score: 4 },
  { date: '2026-01-13', score: 5 },
  { date: '2026-01-14', score: 3 },
  { date: '2026-01-15', score: 4 },
  // Add more dates to see the heatmap pattern
  { date: '2026-02-01', score: 3 },
  { date: '2026-02-02', score: 4 },
  { date: '2026-02-03', score: 5 },
  { date: '2026-02-04', score: 2 },
  { date: '2026-02-05', score: 3 },
  { date: '2026-02-06', score: 4 },
  { date: '2026-02-07', score: 5 },
  { date: '2026-02-08', score: 3 },
  { date: '2026-02-09', score: 4 },
  { date: '2026-02-10', score: 2 },
  { date: '2026-02-11', score: 3 },
  { date: '2026-02-12', score: 5 },
  { date: '2026-02-13', score: 4 },
  { date: '2026-02-14', score: 3 },
  { date: '2026-02-15', score: 4 },
  // Current date
  { date: '2026-02-27', score: 5 },
];

export default function MoodCalendarTest() {
  return (
    <div className="min-h-screen bg-gray-900 p-8">
      <h1 className="text-3xl font-bold text-white mb-8">Mood Calendar Test</h1>
      
      <div className="mb-8">
        <h2 className="text-xl text-white mb-4">Sample Data:</h2>
        <pre className="bg-gray-800 p-4 rounded-lg text-green-400 text-sm overflow-auto">
          {JSON.stringify(sampleMoodData, null, 2)}
        </pre>
      </div>

      <div className="mb-8">
        <h2 className="text-xl text-white mb-4">Mood Heatmap:</h2>
        <MoodCalendar data={sampleMoodData} />
      </div>

      <div className="mb-8">
        <h2 className="text-xl text-white mb-4">Empty Data Test:</h2>
        <MoodCalendar data={[]} />
      </div>

      <div className="mb-8">
        <h2 className="text-xl text-white mb-4">All Mood Scores Test:</h2>
        <MoodCalendar data={[
          { date: '2026-02-20', score: 1 }, // Awful
          { date: '2026-02-21', score: 2 }, // Bad
          { date: '2026-02-22', score: 3 }, // Neutral
          { date: '2026-02-23', score: 4 }, // Good
          { date: '2026-02-24', score: 5 }, // Awesome
        ]} />
      </div>
    </div>
  );
}
