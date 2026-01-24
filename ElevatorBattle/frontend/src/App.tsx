import React, { useEffect, useState } from 'react';
import io from 'socket.io-client';
import { Building } from './Building';
import { StatsPanel } from './StatsPanel';
import { SimulationChart } from './SimulationChart'; 
import { SummaryView } from './SummaryView';          
import { SimulationState, SimulationConfig, PhaseSnapshot } from './types';
import { 
  CONFIG_MORNING_RUSH, 
  CONFIG_LUNCH_RUSH, 
  CONFIG_END_OF_DAY,
  CONFIG_LUNCH_RETURN,
  CONFIG_STRESS_TEST,
  CONFIG_FULL_DAY
} from './presets';

const socket = io('http://localhost:3001');

const App: React.FC = () => {
  const [simState, setSimState] = useState<SimulationState | null>(null);
  const [summary, setSummary] = useState<SimulationState | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [speed, setSpeed] = useState(1); 

  useEffect(() => {
    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));
    socket.on('simulation_update', (data: SimulationState) => setSimState(data));
    
    socket.on('simulation_finished', (data: { history: any[], phaseHistory: PhaseSnapshot[] }) => {
        setSimState((prevState) => {
            if (prevState) {
                setSummary({ 
                    ...prevState, 
                    history: data.history,
                    phaseHistory: data.phaseHistory
                }); 
            }
            return null; 
        });
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('simulation_update');
      socket.off('simulation_finished');
    };
  }, []);

  const startScenario = (config: SimulationConfig) => {
    setSummary(null);
    setSpeed(1); 
    fetch('http://localhost:3001/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    }).catch(console.error);
  };

  const handleStop = () => {
    if (simState) setSummary(simState);
    fetch('http://localhost:3001/stop', { method: 'POST' });
    setSimState(null);
  };

  const togglePause = () => {
      if (simState?.isPaused) {
          fetch('http://localhost:3001/resume', { method: 'POST' });
      } else {
          fetch('http://localhost:3001/pause', { method: 'POST' });
      }
  };

  const changeSpeed = (multiplier: number) => {
      setSpeed(multiplier);
      fetch('http://localhost:3001/speed', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ multiplier })
      });
  };

  const getTabStyle = (scenarioKey: string) => {
      const active = simState?.activeScenario === scenarioKey || 
                     (scenarioKey === 'FULL_DAY_CYCLE' && simState?.activeScenario?.includes('Phase'));
      return active ? styles.tabActive : styles.tab;
  };

  const getSpeedStyle = (val: number) => {
      return speed === val ? styles.speedBtnActive : styles.speedBtn;
  };

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div style={styles.brand}>
          <h1 style={styles.title}>Elevator<span style={{fontWeight: 800, color: '#4F46E5'}}>Battle</span></h1>
        </div>
        <div style={styles.connectionTag}>
            <div style={{ 
                ...styles.statusDot, 
                backgroundColor: isConnected ? '#10B981' : '#EF4444',
                boxShadow: isConnected ? '0 0 8px #10B981' : 'none'
            }}></div>
            {isConnected ? 'ONLINE' : 'OFFLINE'}
        </div>
      </div>

      <div style={styles.controlBar}>
        <div style={styles.controlGroup}>
            <div style={styles.barLabel}>SCENARIO</div>
            <div style={styles.segmentedControl}>
                <button style={getTabStyle('MORNING_RUSH')} onClick={() => startScenario(CONFIG_MORNING_RUSH)}>Morning</button>
                <div style={styles.divider}></div>
                
                <button style={getTabStyle('LUNCH_RUSH')} onClick={() => startScenario(CONFIG_LUNCH_RUSH)}>Lunch</button>
                <div style={styles.divider}></div>
                
                <button style={getTabStyle('LUNCH_RETURN')} onClick={() => startScenario(CONFIG_LUNCH_RETURN)}>Lunch Return</button>
                <div style={styles.divider}></div>

                <button style={getTabStyle('END_OF_DAY')} onClick={() => startScenario(CONFIG_END_OF_DAY)}>End Day</button>
                <div style={styles.divider}></div>

                <button style={getTabStyle('STRESS_TEST')} onClick={() => startScenario(CONFIG_STRESS_TEST)}>Stress</button>
                <div style={styles.divider}></div>
                
                <button 
                    style={getTabStyle('FULL_DAY_CYCLE')} 
                    onClick={() => startScenario(CONFIG_FULL_DAY)}
                >
                    Full Day Cycle
                </button>
            </div>
        </div>

        {simState && (
            <div style={styles.controlGroup}>
                <div style={styles.speedControl}>
                    <button style={getSpeedStyle(1)} onClick={() => changeSpeed(1)}>1x</button>
                    <button style={getSpeedStyle(2)} onClick={() => changeSpeed(2)}>2x</button>
                    <button style={getSpeedStyle(5)} onClick={() => changeSpeed(5)}>5x</button>
                    <button style={getSpeedStyle(10)} onClick={() => changeSpeed(10)}>10x</button>
                </div>
                <button style={styles.stopBtn} onClick={handleStop}>Terminate Simulation</button>
            </div>
        )}
      </div>

      <div style={styles.contentArea}>
        {simState ? (
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                
                {simState.activeScenario?.includes('Phase') && (
                    <div style={{
                        marginBottom: '20px', 
                        padding: '10px 20px', 
                        backgroundColor: '#EEF2FF', 
                        borderRadius: '20px',
                        border: '1px solid #C7D2FE',
                        color: '#4338CA',
                        fontWeight: 'bold',
                        fontSize: '14px'
                    }}>
                        🕒 Current: {simState.activeScenario}
                    </div>
                )}

                <div style={{
                    ...styles.arena, 
                    opacity: simState.isPaused ? 0.5 : 1, 
                    filter: simState.isPaused ? 'grayscale(50%)' : 'none',
                    transition: 'all 0.3s ease'
                }}>
                    <div style={styles.column}>
                        <div style={styles.algoHeader}>
                            <div style={{...styles.colorDot, background: '#F97316'}}></div>
                            Naive Algorithm
                        </div>
                        <StatsPanel stats={simState.naiveWorld.stats} color="#F97316" />
                        <Building elevators={simState.naiveWorld.elevators} floors={simState.naiveWorld.floors} />
                    </div>

                    <div style={styles.centerColumn}>
                        <div style={styles.statsSpacer}></div>
                        <div style={styles.buttonContainer}>
                            <div style={styles.vsLineTop}></div>
                            <div style={styles.floatingControls}>
                                    <div style={styles.vsBadge}>VS</div>
                                    <button style={simState.isPaused ? styles.resumeBtn : styles.pauseBtn} onClick={togglePause}>
                                            {simState.isPaused ? "▶" : "⏸"}
                                    </button>
                                    <div style={styles.pauseLabel}>{simState.isPaused ? "RESUME" : "PAUSE"}</div>
                            </div>
                            <div style={styles.vsLineBottom}></div>
                        </div>
                    </div>

                    <div style={styles.column}>
                        <div style={styles.algoHeader}>
                            <div style={{...styles.colorDot, background: '#3B82F6'}}></div>
                            Improved Algorithm
                        </div>
                        <StatsPanel stats={simState.improvedWorld.stats} color="#3B82F6" />
                        <Building elevators={simState.improvedWorld.elevators} floors={simState.improvedWorld.floors} />
                    </div>
                </div>

                <div style={{
                    ...styles.liveGraphContainer,
                    opacity: simState.isPaused ? 0.5 : 1, 
                    filter: simState.isPaused ? 'grayscale(50%)' : 'none',
                    transition: 'all 0.3s ease'
                }}>
                    <SimulationChart data={simState.history} />
                </div>
            </div>

        ) : summary ? (
            <SummaryView data={summary} />
        ) : (
            <div style={styles.placeholder}>
                <div style={styles.placeholderBox}>
                    <div style={styles.placeholderIcon}>⚡</div>
                    <h3>Ready to Simulate</h3>
                    <p>Select a scenario to initialize the engine.</p>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  page: { fontFamily: "'Inter', sans-serif", backgroundColor: '#F8FAFC', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#0F172A', paddingBottom: '50px' },
  
  header: { width: '100%', height: '70px', padding: '0 40px', backgroundColor: '#fff', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  brand: { display: 'flex', alignItems: 'center', gap: '12px' },
  title: { margin: 0, fontSize: '22px', fontWeight: '600', letterSpacing: '-0.5px', color: '#0F172A' },
  connectionTag: { fontSize: '11px', fontWeight: '700', color: '#64748B', display: 'flex', alignItems: 'center', gap: '8px', letterSpacing: '0.5px' },
  statusDot: { width: '8px', height: '8px', borderRadius: '50%' },

  controlBar: { 
    width: '95%', maxWidth: '1400px', backgroundColor: '#fff', borderRadius: '12px', 
    padding: '12px 20px', marginTop: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
    border: '1px solid #E2E8F0'
  },
  controlGroup: { display: 'flex', alignItems: 'center', gap: '20px' },
  barLabel: { fontSize: '11px', fontWeight: '800', color: '#94A3B8', letterSpacing: '1px', marginRight: '5px' },
  
  segmentedControl: { display: 'flex', alignItems: 'center', backgroundColor: '#F1F5F9', borderRadius: '8px', padding: '4px', gap: '2px' },
  tab: { padding: '8px 16px', border: 'none', backgroundColor: 'transparent', color: '#64748B', fontSize: '13px', fontWeight: '600', cursor: 'pointer', borderRadius: '6px', transition: 'all 0.2s' },
  tabActive: { padding: '8px 16px', border: 'none', backgroundColor: '#fff', color: '#0F172A', fontSize: '13px', fontWeight: '700', cursor: 'pointer', borderRadius: '6px', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' },
  divider: { width: '1px', height: '16px', backgroundColor: '#CBD5E1' },

  speedControl: { display: 'flex', backgroundColor: '#F1F5F9', borderRadius: '6px', padding: '2px', marginRight: '15px' },
  speedBtn: { padding: '6px 10px', border: 'none', backgroundColor: 'transparent', color: '#64748B', fontSize: '11px', fontWeight: '600', cursor: 'pointer', borderRadius: '4px' },
  speedBtnActive: { padding: '6px 10px', border: 'none', backgroundColor: '#fff', color: '#2563EB', fontSize: '11px', fontWeight: '800', cursor: 'pointer', borderRadius: '4px', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' },

  stopBtn: { padding: '10px 20px', backgroundColor: '#FFF1F2', color: '#E11D48', border: '1px solid #FECDD3', borderRadius: '8px', fontWeight: '700', fontSize: '12px', cursor: 'pointer', transition: 'all 0.2s', letterSpacing: '0.5px' },

  contentArea: { width: '100%', display: 'flex', justifyContent: 'center', marginTop: '32px' },
  liveGraphContainer: { width: '95%', maxWidth: '1400px', marginTop: '30px' },

  arena: { display: 'grid', gridTemplateColumns: '1fr 100px 1fr', width: '98%', maxWidth: '1600px', gap: '0px', alignItems: 'start', transition: 'all 0.3s ease' },
  column: { display: 'flex', flexDirection: 'column', width: 'min-content', justifySelf: 'center' },
  algoHeader: { display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', fontWeight: '700', color: '#475569', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' },
  colorDot: { width: '10px', height: '10px', borderRadius: '3px' },

  centerColumn: { display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%' },
  statsSpacer: { height: '170px', width: '100%', flexShrink: 0 },
  buttonContainer: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', width: '100%' },

  vsLineTop: { width: '1px', flex: 1, background: 'linear-gradient(to bottom, transparent, #CBD5E1)', minHeight: '20px' },
  vsLineBottom: { width: '1px', flex: 1, background: 'linear-gradient(to bottom, #CBD5E1, transparent)', minHeight: '20px' },
  floatingControls: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '10px 0', zIndex: 10 },
  vsBadge: { fontSize: '11px', fontWeight: '900', color: '#94A3B8', backgroundColor: '#F8FAFC', padding: '4px 8px', borderRadius: '4px' },
  
  pauseBtn: { width: '64px', height: '64px', borderRadius: '50%', backgroundColor: '#F59E0B', border: '1px solid #fff', color: 'white', fontSize: '24px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 15px -3px rgba(245, 158, 11, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.05)', paddingLeft: '6px' },
  resumeBtn: { width: '64px', height: '64px', borderRadius: '50%', backgroundColor: '#10B981', border: '1px solid #fff', color: 'white', fontSize: '24px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 15px -3px rgba(16, 185, 129, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.05)', paddingLeft: '4px' },
  pauseLabel: { fontSize: '10px', fontWeight: '800', color: '#94A3B8', letterSpacing: '1px' },

  placeholder: { width: '100%', height: '60vh', display: 'flex', justifyContent: 'center', alignItems: 'center' },
  placeholderBox: { textAlign: 'center', color: '#64748B', backgroundColor: '#fff', padding: '48px', borderRadius: '24px', border: '1px solid #E2E8F0', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05)' },
  placeholderIcon: { fontSize: '32px', marginBottom: '16px' }
};

export default App;