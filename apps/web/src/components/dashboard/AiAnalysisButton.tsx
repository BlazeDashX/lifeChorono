'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Brain, Loader2 } from 'lucide-react';

export default function AiAnalysisButton() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const queryClient = useQueryClient();

  const analyzeMutation = useMutation({
    mutationFn: () => api.post('/api/ai-insights/analyze').then(res => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-insights'] });
      setIsAnalyzing(false);
    },
    onError: () => {
      setIsAnalyzing(false);
    },
  });

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    analyzeMutation.mutate();
  };

  return (
    <button
      onClick={handleAnalyze}
      disabled={isAnalyzing}
      className="flex items-center gap-2 px-4 py-2 bg-brand hover:bg-brand-light text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isAnalyzing ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Analyzing...</span>
        </>
      ) : (
        <>
          <Brain className="w-4 h-4" />
          <span>Generate AI Insights</span>
        </>
      )}
    </button>
  );
}
