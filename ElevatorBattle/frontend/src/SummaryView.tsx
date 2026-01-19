import React from 'react';
import { SimulationState, WorldState, PhaseSnapshot } from './types';
import { SimulationChart } from './SimulationChart';
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid, ResponsiveContainer } from 'recharts';

interface SummaryViewProps {
    data: SimulationState;
}

export const SummaryView: React.FC<SummaryViewProps> = ({ data }) => {
    // 1. GLOBAL STATS
    const lastPoint = data.history.length > 0 ? data.history[data.history.length - 1] : null;
    const phaseHistory = data.phaseHistory || [];

    // Calculate Global Utilization
    const totalDuration = phaseHistory.reduce((sum, p) => sum + p.duration, 0);
    const naiveGlobalUtil = totalDuration > 0 
        ? phaseHistory.reduce((sum, p) => sum + (p.naive.avgUtil * p.duration), 0) / totalDuration 
        : 0;
    const improvedGlobalUtil = totalDuration > 0 
        ? phaseHistory.reduce((sum, p) => sum + (p.improved.avgUtil * p.duration), 0) / totalDuration 
        : 0;

    const globalNaiveStats = {
        totalDelivered: lastPoint?.naiveDelivered || 0,
        avgWaitingTime: lastPoint?.naiveWait || 0,
        avgTransitTime: lastPoint?.naiveTrip || 0,
        avgUtilization: naiveGlobalUtil 
    };

    const globalImprovedStats = {
        totalDelivered: lastPoint?.improvedDelivered || 0,
        avgWaitingTime: lastPoint?.improvedWait || 0,
        avgTransitTime: lastPoint?.improvedTrip || 0,
        avgUtilization: improvedGlobalUtil
    };

    const waitImprovement = globalNaiveStats.avgWaitingTime > 0 
        ? ((globalNaiveStats.avgWaitingTime - globalImprovedStats.avgWaitingTime) / globalNaiveStats.avgWaitingTime) * 100 
        : 0;

    const tripImprovement = globalNaiveStats.avgTransitTime > 0 
        ? ((globalNaiveStats.avgTransitTime - globalImprovedStats.avgTransitTime) / globalNaiveStats.avgTransitTime) * 100 
        : 0;

    // Track cumulative ticks to slice history correctly
    let cumulativeTickCursor = 0;

    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <h2 style={styles.title}>Simulation Report</h2>
                <div style={styles.subtitle}>Scenario: {data.activeScenario || 'Custom Flow'} | Duration: {data.tick} Ticks</div>
            </div>

            {/* 1. GLOBAL CUMULATIVE IMPROVEMENT */}
            <div style={styles.section}>
                <h3 style={styles.sectionTitle}>Full Scenario Performance (Cumulative)</h3>
                <div style={styles.phaseStatsRow}>
                    <ImprovementBadge label="Total Wait Time Improvement" value={waitImprovement} />
                    <ImprovementBadge label="Total Trip Time Improvement" value={tripImprovement} />
                </div>
            </div>

            {/* 2. GLOBAL DETAILED STATS */}
            <div style={styles.grid}>
                <DetailedBlock 
                    stats={globalNaiveStats} 
                    name="Whole Scenario: Naive" 
                    color="#F97316" 
                />
                <DetailedBlock 
                    stats={globalImprovedStats} 
                    name="Whole Scenario: Improved" 
                    color="#3B82F6" 
                />
            </div>

            {/* 3. GLOBAL CUMULATIVE GRAPH */}
            <div style={styles.section}>
                <div style={{...styles.chartLabel, marginBottom: '10px'}}>Live Delivery Performance (Cumulative)</div>
                <SimulationChart data={data.history} />
            </div>

            {/* 4. PHASE ANALYSIS */}
            <h3 style={{...styles.sectionTitle, marginTop: '40px', borderTop: '1px solid #E2E8F0', paddingTop: '20px'}}>
                Phase-by-Phase Analysis
            </h3>

            {phaseHistory.map((phase, idx) => {
                // Determine tick range for this phase based on actual Tick values, not array index
                const phaseStartTick = cumulativeTickCursor;
                const phaseEndTick = cumulativeTickCursor + phase.duration;
                
                // Filter history points belonging to this phase
                const phaseSliceRaw = data.history.filter(h => h.tick >= phaseStartTick && h.tick <= phaseEndTick);
                
                // Baseline: The last point of the PREVIOUS phase (or 0 if first phase)
                // We find the history point closest to phaseStartTick
                const startSnapshot = idx === 0 
                    ? { naiveDelivered: 0, naiveWait: 0, naiveTrip: 0, improvedDelivered: 0, improvedWait: 0, improvedTrip: 0 }
                    : data.history.find(h => h.tick >= phaseStartTick) || data.history[0];

                // Pre-calculate baseline sums 
                const startNaiveWaitSum = (startSnapshot?.naiveWait || 0) * (startSnapshot?.naiveDelivered || 0);
                const startNaiveTripSum = (startSnapshot?.naiveTrip || 0) * (startSnapshot?.naiveDelivered || 0);
                const startImpWaitSum = (startSnapshot?.improvedWait || 0) * (startSnapshot?.improvedDelivered || 0);
                const startImpTripSum = (startSnapshot?.improvedTrip || 0) * (startSnapshot?.improvedDelivered || 0);

                // Generate Graph Data
                const localPhaseData = phaseSliceRaw.map((pt) => {
                    const nCount = pt.naiveDelivered - (startSnapshot?.naiveDelivered || 0);
                    if (nCount <= 0) return { tick: pt.tick - phaseStartTick, waitImprovement: 0, tripImprovement: 0 };

                    const nWaitSum = (pt.naiveWait * pt.naiveDelivered) - startNaiveWaitSum;
                    const nTripSum = (pt.naiveTrip * pt.naiveDelivered) - startNaiveTripSum;
                    
                    const nLocalWait = nWaitSum / nCount;
                    const nLocalTrip = nTripSum / nCount;

                    const iCount = pt.improvedDelivered - (startSnapshot?.improvedDelivered || 0);
                    if (iCount <= 0) return { tick: pt.tick - phaseStartTick, waitImprovement: 0, tripImprovement: 0 };

                    const iWaitSum = (pt.improvedWait * pt.improvedDelivered) - startImpWaitSum;
                    const iTripSum = (pt.improvedTrip * pt.improvedDelivered) - startImpTripSum;

                    const iLocalWait = iWaitSum / iCount;
                    const iLocalTrip = iTripSum / iCount;

                    const waitImp = nLocalWait > 0 ? ((nLocalWait - iLocalWait) / nLocalWait) * 100 : 0;
                    const tripImp = nLocalTrip > 0 ? ((nLocalTrip - iLocalTrip) / nLocalTrip) * 100 : 0;

                    return {
                        tick: pt.tick - phaseStartTick, // Relative Tick 0..Duration
                        waitImprovement: parseFloat(waitImp.toFixed(1)),
                        tripImprovement: parseFloat(tripImp.toFixed(1))
                    };
                });

                // Calculate TRUE Final Phase Stats (Yellow Block Data)
                const phaseWaitImp = phase.naive.avgWait > 0 ? ((phase.naive.avgWait - phase.improved.avgWait) / phase.naive.avgWait) * 100 : 0;
                const phaseTripImp = phase.naive.avgTrip > 0 ? ((phase.naive.avgTrip - phase.improved.avgTrip) / phase.naive.avgTrip) * 100 : 0;

                // *** FIX: INJECT FINAL POINT TO MATCH BADGE ***
                // We manually add the exact final result as the last point on the graph
                localPhaseData.push({
                    tick: phase.duration,
                    waitImprovement: parseFloat(phaseWaitImp.toFixed(1)),
                    tripImprovement: parseFloat(phaseTripImp.toFixed(1))
                });

                cumulativeTickCursor += phase.duration;

                return (
                    <div key={idx} style={styles.phaseContainer}>
                        <h4 style={styles.phaseTitle}>{phase.phaseName}</h4>
                        
                        <div style={styles.chartsRow}>
                            <div style={styles.smallChartBox}>
                                <div style={styles.chartLabel}>Wait Time Improvement (%)</div>
                                <div style={{ width: '100%', height: 200 }}>
                                    <ResponsiveContainer>
                                        <LineChart data={localPhaseData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                            <XAxis dataKey="tick" tick={{fontSize: 10}} hide />
                                            <YAxis unit="%" tick={{fontSize: 10}} />
                                            <Tooltip formatter={(val: any) => [`${val}%`, 'Imp.']} />
                                            <Line type="monotone" dataKey="waitImprovement" stroke="#10B981" strokeWidth={2} dot={false} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            <div style={styles.smallChartBox}>
                                <div style={styles.chartLabel}>Trip Time Improvement (%)</div>
                                <div style={{ width: '100%', height: 200 }}>
                                    <ResponsiveContainer>
                                        <LineChart data={localPhaseData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                            <XAxis dataKey="tick" tick={{fontSize: 10}} hide />
                                            <YAxis unit="%" tick={{fontSize: 10}} />
                                            <Tooltip formatter={(val: any) => [`${val}%`, 'Imp.']} />
                                            <Line type="monotone" dataKey="tripImprovement" stroke="#8B5CF6" strokeWidth={2} dot={false} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>

                        <div style={styles.phaseStatsRow}>
                            <ImprovementBadge label="Phase Wait Time" value={phaseWaitImp} small />
                            <ImprovementBadge label="Phase Trip Time" value={phaseTripImp} small />
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

interface BlockProps { 
    stats: { totalDelivered: number; avgUtilization: number; avgWaitingTime: number; avgTransitTime: number; }; 
    name: string; 
    color: string; 
}

const DetailedBlock: React.FC<BlockProps> = ({ stats, name, color }) => {
    return (
        <div style={{ ...styles.card, borderTop: `4px solid ${color}` }}>
            <h3 style={{ ...styles.cardTitle, color }}>{name}</h3>
            <div style={styles.statRow}><span>Total Delivered:</span><strong>{stats.totalDelivered}</strong></div>
            <div style={styles.statRow}><span>Avg Utilization:</span><strong>{(stats.avgUtilization * 100).toFixed(1)}%</strong></div>
            <div style={styles.statRow}><span>Avg Wait Time:</span><strong>{stats.avgWaitingTime.toFixed(1)}s</strong></div>
            <div style={styles.statRow}><span>Avg Trip Time:</span><strong>{stats.avgTransitTime.toFixed(1)}s</strong></div>
        </div>
    );
};

const ImprovementBadge = ({ label, value, small }: { label: string, value: number, small?: boolean }) => {
    const isPositive = value > 0;
    const color = isPositive ? '#10B981' : '#EF4444'; 
    return (
        <div style={{ 
            ...styles.badge, 
            borderColor: color, 
            backgroundColor: isPositive ? '#ECFDF5' : '#FEF2F2',
            padding: small ? '10px 15px' : '15px 20px',
            flex: 1
        }}>
            <div style={{...styles.badgeLabel, fontSize: small ? '12px' : '14px'}}>{label}</div>
            <div style={{ ...styles.badgeValue, color, fontSize: small ? '16px' : '18px' }}>
                {value > 0 ? '+' : ''}{value.toFixed(1)}%
            </div>
        </div>
    );
};

const styles: Record<string, React.CSSProperties> = {
    container: { width: '100%', maxWidth: '1000px', backgroundColor: '#fff', borderRadius: '16px', padding: '30px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', border: '1px solid #E2E8F0' },
    header: { textAlign: 'center', marginBottom: '30px' },
    title: { margin: 0, fontSize: '24px', color: '#1E293B', fontWeight: '800' },
    subtitle: { color: '#64748B', marginTop: '5px', fontSize: '14px' },
    section: { marginBottom: '30px' },
    sectionTitle: { fontSize: '16px', fontWeight: '700', marginBottom: '15px', color: '#334155', textTransform: 'uppercase', letterSpacing: '0.5px' },
    
    // PHASE CONTAINER
    phaseContainer: { marginBottom: '30px', padding: '20px', border: '1px solid #E2E8F0', borderRadius: '12px', backgroundColor: '#F8FAFC' },
    phaseTitle: { margin: '0 0 15px 0', fontSize: '15px', fontWeight: '800', color: '#475569', textTransform: 'uppercase' },
    
    // BLUE PART LAYOUT
    chartsRow: { display: 'flex', gap: '20px', marginBottom: '15px' },
    smallChartBox: { flex: 1, backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #E2E8F0', padding: '15px' },
    chartLabel: { fontSize: '11px', fontWeight: '700', color: '#94A3B8', marginBottom: '10px', textTransform: 'uppercase' },

    // YELLOW PART (PHASE STATS)
    phaseStatsRow: { display: 'flex', gap: '15px', width: '100%' },

    grid: { display: 'flex', gap: '20px', marginBottom: '20px' },
    card: { flex: 1, padding: '20px', backgroundColor: '#F8FAFC', borderRadius: '12px', border: '1px solid #E2E8F0' },
    cardTitle: { marginTop: 0, fontSize: '18px', marginBottom: '15px' },
    statRow: { display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px', color: '#334155' },
    
    badge: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: '8px', border: '1px solid' },
    badgeLabel: { fontWeight: '600', color: '#334155' },
    badgeValue: { fontWeight: '800' },
};