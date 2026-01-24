import React from 'react';
import { SimulationStats } from './types';

interface StatsPanelProps {
  stats: SimulationStats;
  color: string;
}

export const StatsPanel: React.FC<StatsPanelProps> = ({ stats, color }) => {
  return (
    <div style={{ ...styles.card, borderTop: `4px solid ${color}` }}>
      <div style={styles.grid}>
        <StatItem label="Avg Wait Time" value={`${stats.avgWaitingTime.toFixed(1)}s`} />
        <StatItem label="Avg Trip Time" value={`${stats.avgTransitTime.toFixed(1)}s`} />
        <StatItem label="Delivered" value={stats.totalDelivered} />
        <StatItem label="Utilization" value={`${(stats.elevatorUtilization * 100).toFixed(0)}%`} />
      </div>
    </div>
  );
};

const StatItem = ({ label, value }: { label: string, value: string | number }) => (
  <div style={styles.item}>
    <div style={styles.value}>{value}</div>
    <div style={styles.label}>{label}</div>
  </div>
);

const styles: Record<string, React.CSSProperties> = {
  card: { width: '95%', backgroundColor: '#fff', borderRadius: '8px', padding: '15px', marginBottom: '15px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' },
  grid: { display: 'flex', justifyContent: 'space-around' },
  item: { display: 'flex', flexDirection: 'column', alignItems: 'center' },
  value: { fontSize: '20px', fontWeight: 'bold', color: '#333' },
  label: { fontSize: '10px', color: '#888', textTransform: 'uppercase' }
};