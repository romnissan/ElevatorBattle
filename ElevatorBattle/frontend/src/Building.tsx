import React from 'react';
import { Elevator, FloorState } from './types';

interface BuildingProps {
  elevators: Elevator[];
  floors: FloorState[];
}

export const Building: React.FC<BuildingProps> = ({ elevators, floors }) => {
  const floorHeight = 48; 
  const totalHeight = floors.length * floorHeight;
  const totalInElevators = elevators.reduce((sum, e) => sum + e.passengers.length, 0);

  return (
    <div style={styles.container}>
      <style>
        {`
          @keyframes slideEnter {
            from { transform: translateX(-50px) scale(0.5); opacity: 0; }
            to { transform: translateX(0) scale(1); opacity: 1; }
          }
        `}
      </style>

      {/* FLOORS LAYER */}
      <div style={{ ...styles.layerContainer, width: '280px', marginRight: '24px' }}>
        {floors.map(floor => (
          <div key={floor.level} style={{ ...styles.floorRow, height: `${floorHeight}px` }}>
            
            {/* Label Area */}
            <div style={styles.floorLabel}>
               <div style={styles.badgeSlot}>
                 {floor.priority > 1.0 && (
                   <div style={styles.priorityBadge} title={`Priority: ${floor.priority}`}>
                      <span style={{ color: '#D97706', fontSize: '11px' }}>★</span>
                      <span style={{ fontSize: '11px', color: '#78350F', fontWeight: '800' }}>{floor.priority}</span>
                   </div>
                 )}
               </div>
               <div style={styles.numberSlot}>{floor.level}</div>
            </div>

            {/* Floor Content */}
            <div style={styles.floorContent}>
              <div style={styles.queueContainer}>
                 {floor.waitingQueue.map((p) => (
                   <div key={p.id} style={styles.personDot}></div>
                 ))}
              </div>
              
              {/* UPDATED LABEL: POPULATION */}
              {floor.currentPopulation > 0 && (
                  <div style={styles.popBadge}>
                     POPULATION: <strong>{floor.currentPopulation}</strong>
                  </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ELEVATOR SHAFT LAYER */}
      <div style={styles.shaftContainer}>
        
        <div style={styles.shaftHeader}>
            <span style={styles.transitIcon}>⇅</span> 
            {totalInElevators} IN TRANSIT
        </div>

        <div style={{ ...styles.shaftBody, height: `${totalHeight}px` }}>
          {elevators.map(elevator => (
            <div key={elevator.id} style={styles.shaft}>
              <div style={styles.rail}></div>
              
              <div style={{
                ...styles.cab,
                bottom: `${elevator.currentFloor * floorHeight}px`,
                backgroundColor: elevator.state === 'DOORS_OPEN' || elevator.state === 'BOARDING' 
                    ? '#10B981' 
                    : (elevator.state === 'IDLE' ? '#6B7280' : '#2563EB'), 
                boxShadow: elevator.state === 'MOVING' ? '0 10px 15px -3px rgba(37, 99, 235, 0.3)' : '0 4px 6px -1px rgba(0,0,0,0.1)',
                border: elevator.state === 'BOARDING' ? '2px solid #A7F3D0' : 'none'
              }}>
                 <span style={styles.cabLabel}>E{elevator.id}</span>
                 
                 <div style={styles.cabPassengers}>
                    {elevator.passengers.map(p => (
                        <div key={p.id} style={styles.cabDot}></div>
                    ))}
                 </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: { 
    display: 'flex', flexDirection: 'row', padding: '24px', 
    backgroundColor: '#fff', borderRadius: '16px', 
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)', 
    justifyContent: 'center', border: '2px solid #E5E7EB' 
  },
  
  layerContainer: { display: 'flex', flexDirection: 'column-reverse', borderRight: '2px solid #D1D5DB' },
  floorRow: { display: 'flex', alignItems: 'center', borderBottom: '1px solid #E5E7EB', position: 'relative' },
  
  floorLabel: { width: '80px', display: 'flex', alignItems: 'center', paddingRight: '16px' },
  badgeSlot: { flex: 1, display: 'flex', justifyContent: 'flex-end', paddingRight: '8px' },
  priorityBadge: { display: 'flex', alignItems: 'center', gap: '3px', backgroundColor: '#FFFBEB', padding: '3px 6px', borderRadius: '6px', border: '1px solid #FCD34D', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' },
  numberSlot: { width: '24px', textAlign: 'right', color: '#374151', fontSize: '15px', fontWeight: '800' },

  floorContent: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: '12px' },
  queueContainer: { display: 'flex', flexDirection: 'row', gap: '4px', marginLeft: '16px' },
  personDot: { width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#EF4444', boxShadow: 'inset 0 -1px 2px rgba(0,0,0,0.2)' },
  
  popBadge: { fontSize: '10px', color: '#4B5563', backgroundColor: '#F3F4F6', padding: '4px 8px', borderRadius: '12px', fontWeight: '600', border: '1px solid #E5E7EB' },

  shaftContainer: { display: 'flex', flexDirection: 'column', alignItems: 'center' },
  shaftHeader: { marginBottom: '12px', fontSize: '12px', fontWeight: '800', color: '#6B7280', display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' },
  transitIcon: { fontSize: '16px', color: '#2563EB', fontWeight: 'bold' },
  
  shaftBody: { display: 'flex', backgroundColor: '#F9FAFB', borderRadius: '12px', overflow: 'hidden', border: '2px solid #D1D5DB' },
  shaft: { width: '72px', position: 'relative', borderRight: '2px solid #D1D5DB' },
  rail: { position: 'absolute', left: '50%', top: 0, bottom: 0, width: '2px', backgroundColor: '#D1D5DB', transform: 'translateX(-50%)', opacity: 0.5 },
  
  cab: { 
    position: 'absolute', left: '8px', right: '8px', height: '42px', marginBottom: '3px', borderRadius: '8px', 
    color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', 
    transition: 'bottom 0.5s cubic-bezier(0.4, 0, 0.2, 1)', 
    zIndex: 10 
  },
  cabLabel: { fontSize: '11px', fontWeight: '800', opacity: 1, letterSpacing: '0.5px' },
  cabPassengers: { display: 'flex', gap: '3px', marginTop: '3px', height: '6px', alignItems: 'center' },
  cabDot: { width: '5px', height: '5px', borderRadius: '50%', backgroundColor: 'white', boxShadow: '0 1px 2px rgba(0,0,0,0.2)', animation: 'slideEnter 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards' }
};