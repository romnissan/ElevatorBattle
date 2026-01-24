export type SimulationMode = 'DETAILED_DAY_FLOW' | 'PREBUILT_SCENARIO';
export type ScenarioType = 'MORNING_RUSH' | 'LUNCH_RUSH' | 'STRESS_TEST' | 'CUSTOM_FLOW' | 'END_OF_DAY' | 'LUNCH_RETURN' | 'FULL_DAY_CYCLE';

export interface PhaseSnapshot {
    phaseName: string;
    duration: number;
    naive: {
        delivered: number;
        avgWait: number;
        avgTrip: number;
        avgUtil: number;
    };
    improved: {
        delivered: number;
        avgWait: number;
        avgTrip: number;
        avgUtil: number;
    };
}

export interface SimulationConfig {
  floors: number;
  elevators: number;
  maxCapacity: number;
  mode: SimulationMode;
  scenario?: ScenarioType;
  floorPriorities: Record<number, number>;
  initialPeople?: Record<number, number>;
  timeline?: TrafficEvent[];
}

export interface TrafficEvent {
  timeStep: number;
  source: number;
  destination: number;
  count: number;
}

export type Direction = 'UP' | 'DOWN' | 'IDLE';

export interface Person {
  id: string;
  sourceFloor: number;
  destFloor: number;
  spawnTime: number;
}

export interface Elevator {
  id: number;
  currentFloor: number;
  direction: Direction;
  passengers: Person[];
  targetFloors: number[];
  state: 'MOVING' | 'DOORS_OPEN' | 'BOARDING' | 'IDLE';
  stats: {
    totalDelivered: number;
    activeTicks: number; 
  };
}

export interface FloorState {
  level: number;
  waitingQueue: Person[];
  currentPopulation: number;
  priority: number; 
}

export interface SimulationStats {
  algorithmName: string;
  totalDelivered: number;
  avgWaitingTime: number;
  avgTransitTime: number;
  elevatorUtilization: number;
}

export interface WorldState {
    elevators: Elevator[];
    floors: FloorState[];
    stats: SimulationStats;
}

export interface HistoryPoint {
    tick: number;
    naiveDelivered: number;
    improvedDelivered: number;
    naiveWait: number;
    improvedWait: number;
    naiveTrip: number;
    improvedTrip: number;
}

export interface SimulationState {
  tick: number;
  activeScenario?: ScenarioType;
  naiveWorld: WorldState;
  improvedWorld: WorldState;
  isPaused: boolean;
  history: HistoryPoint[];
  phaseHistory?: PhaseSnapshot[]; 
}