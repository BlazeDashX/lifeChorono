import CalendarHeatmap from 'react-calendar-heatmap';
import 'react-calendar-heatmap/dist/styles.css';
import '@/styles/mood-calendar.css';

interface MoodData {
  date: string;
  score: number;
}

interface MoodCalendarProps {
  data: MoodData[];
}

const MoodCalendar = ({ data }: MoodCalendarProps) => {
  return (
    <div className="p-4 bg-gray-800 rounded-xl">
      <h2 className="text-white font-bold mb-4">Mood Heatmap</h2>
      <CalendarHeatmap
        startDate={new Date('2026-01-01')}
        endDate={new Date('2026-12-31')}
        values={data} // Expects [{ date: '2026-02-27', score: 5 }]
        classForValue={(value: any) => {
          if (!value) return 'fill-gray-700';
          return `fill-mood-${value.score}`;
        }}
      />
    </div>
  );
};

export default MoodCalendar;