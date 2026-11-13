import React, { useEffect, useRef } from 'react';
import { Chart, registerables, type ChartConfiguration } from 'chart.js';

Chart.register(...registerables);

export const ChartCanvas: React.FC<{
  config: ChartConfiguration;
  heightClass?: string;
  label: string;
}> = ({ config, heightClass = 'h-64', label }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    if (chartRef.current) {
      chartRef.current.destroy();
    }
    chartRef.current = new Chart(canvasRef.current, config);
    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [config]);

  return (
    <div className={`relative w-full ${heightClass}`}>
      <canvas ref={canvasRef} aria-label={label} role="img" />
    </div>
  );
};
