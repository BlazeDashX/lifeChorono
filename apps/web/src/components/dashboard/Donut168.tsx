'use client';

import { motion } from 'framer-motion';

export default function Donut168({ data }: { data: any }) {
  const radius = 120;
  const circumference = 2 * Math.PI * radius;
  
  // Calculate stroke dash arrays based on 168 hours total
  const getOffset = (hours: number, accumulatedHours: number) => {
    const fillPercent = hours / 168;
    const startPercent = accumulatedHours / 168;
    return {
      dasharray: `${fillPercent * circumference} ${circumference}`,
      dashoffset: -startPercent * circumference
    };
  };

  const segments = [
    { key: 'productive', color: '#10B981', hours: data.breakdown.productive },
    { key: 'leisure', color: '#F59E0B', hours: data.breakdown.leisure },
    { key: 'restoration', color: '#06B6D4', hours: data.breakdown.restoration },
    { key: 'neutral', color: '#64748B', hours: data.breakdown.neutral },
  ];

  let accHours = 0;

  return (
    <div className="relative w-72 h-72 mx-auto flex items-center justify-center">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 260 260">
        {/* Background Unlogged Track */}
        <circle 
          cx="130" cy="130" r={radius} 
          fill="transparent" 
          stroke="#1E293B" 
          strokeWidth="16" 
          strokeDasharray="4 4" 
        />
        
        {/* Animated Segments */}
        {segments.map((seg) => {
          if (seg.hours === 0) return null;
          const { dasharray, dashoffset } = getOffset(seg.hours, accHours);
          accHours += seg.hours;
          
          return (
            <motion.circle
              key={seg.key}
              cx="130" cy="130" r={radius}
              fill="transparent"
              stroke={seg.color}
              strokeWidth="16"
              strokeDasharray={dasharray}
              strokeDashoffset={dashoffset}
              strokeLinecap="round"
              initial={{ strokeDasharray: `0 ${circumference}` }}
              animate={{ strokeDasharray: dasharray }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
          );
        })}
      </svg>
      
      {/* Center Text */}
      <div className="absolute flex flex-col items-center justify-center text-center">
        <span className="text-4xl font-bold text-white">{data.loggedHours.toFixed(1)}</span>
        <span className="text-sm text-neutral mt-1">/ 168 hrs logged</span>
      </div>
    </div>
  );
}
