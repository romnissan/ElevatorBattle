import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { HistoryPoint } from './types'; // Adjust import path if needed (e.g. '../../shared/types')

interface Props {
  data: HistoryPoint[];
}

export const SimulationChart: React.FC<Props> = ({ data }) => {
  // Process data to calculate percentage improvement for each tick
  const processedData = data.map(point => {
    const waitImp = point.naiveWait > 0 
      ? ((point.naiveWait - point.improvedWait) / point.naiveWait) * 100 
      : 0;

    const tripImp = point.naiveTrip > 0 
      ? ((point.naiveTrip - point.improvedTrip) / point.naiveTrip) * 100 
      : 0;

    return {
      ...point,
      waitImprovement: parseFloat(waitImp.toFixed(1)),
      tripImprovement: parseFloat(tripImp.toFixed(1))
    };
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
      
      {/* 1. TOTAL DELIVERED CHART */}
      <div style={styles.chartContainer}>
        <h4 style={styles.chartTitle}>Live Delivery Performance</h4>
        <div style={{ width: '100%', height: 300 }}>
          <ResponsiveContainer>
            <LineChart data={processedData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis 
                dataKey="tick" 
                label={{ value: 'Time (Ticks)', position: 'insideBottomRight', offset: -5 }} 
                tick={{fontSize: 12}}
              />
              <YAxis 
                label={{ value: 'Delivered', angle: -90, position: 'insideLeft' }} 
                tick={{fontSize: 12}}
              />
              <Tooltip 
                contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
              />
              <Legend verticalAlign="bottom" height={36}/>
              <Line 
                type="monotone" 
                dataKey="improvedDelivered" 
                name="Improved" 
                stroke="#3B82F6" 
                strokeWidth={3} 
                dot={false} 
                activeDot={{ r: 6 }}
              />
              <Line 
                type="monotone" 
                dataKey="naiveDelivered" 
                name="Naive" 
                stroke="#F97316" 
                strokeWidth={3} 
                dot={false} 
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={styles.row}>
          {/* 2. WAITING TIME IMPROVEMENT CHART */}
          <div style={styles.chartContainer}>
            <h4 style={styles.chartTitle}>Wait Time Improvement (%)</h4>
            <div style={{ width: '100%', height: 250 }}>
              <ResponsiveContainer>
                <LineChart data={processedData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="tick" tick={{fontSize: 10}} />
                  <YAxis unit="%" tick={{fontSize: 10}} />
                  {/* FIX: Use 'any' or check for value existence to satisfy TS */}
                  <Tooltip formatter={(val: any) => [`${val}%`, 'Improvement']} />
                  <Line 
                    type="monotone" 
                    dataKey="waitImprovement" 
                    stroke="#10B981" 
                    strokeWidth={2} 
                    dot={false} 
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 3. TRIP TIME IMPROVEMENT CHART */}
          <div style={styles.chartContainer}>
            <h4 style={styles.chartTitle}>Trip Time Improvement (%)</h4>
            <div style={{ width: '100%', height: 250 }}>
              <ResponsiveContainer>
                <LineChart data={processedData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="tick" tick={{fontSize: 10}} />
                  <YAxis unit="%" tick={{fontSize: 10}} />
                  {/* FIX: Use 'any' here as well */}
                  <Tooltip formatter={(val: any) => [`${val}%`, 'Improvement']} />
                  <Line 
                    type="monotone" 
                    dataKey="tripImprovement" 
                    stroke="#8B5CF6" 
                    strokeWidth={2} 
                    dot={false} 
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
      </div>

    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  chartContainer: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '20px',
    border: '1px solid #E2E8F0',
    flex: 1
  },
  chartTitle: {
    margin: '0 0 15px 0',
    fontSize: '14px',
    color: '#64748B',
    textTransform: 'uppercase',
    fontWeight: '700'
  },
  row: {
      display: 'flex',
      gap: '20px',
      marginTop: '10px'
  }
};