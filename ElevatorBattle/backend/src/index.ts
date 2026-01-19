import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { Simulation } from './Simulation';
import { NaiveController } from './algorithms/NaiveController';
import { ImprovedController } from './algorithms/ImprovedController';
import { SimulationConfig, TrafficEvent, HistoryPoint, FloorState, PhaseSnapshot, ScenarioType } from '../../shared/types';

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// GLOBAL STATE
let simNaive: Simulation | null = null;
let simImproved: Simulation | null = null;
let simulationInterval: NodeJS.Timeout | null = null;
let currentTick = 0;
let isPaused = false;
let history: HistoryPoint[] = [];
let phaseHistory: PhaseSnapshot[] = []; 
let currentConfig: SimulationConfig | null = null;
let tickSpeed = 500; 

// --- FULL DAY STATE MANAGER ---
interface CumulativeStats {
    delivered: number;
    waitSum: number;
    tripSum: number;
}

let fullDayState = {
    active: false,
    phase: 0,
    eventsGeneratedInPhase: 0,
    phaseStartTick: 0, // NEW: Persist the start tick across speed changes
    cumulative: {
        naive: { delivered: 0, waitSum: 0, tripSum: 0 } as CumulativeStats,
        improved: { delivered: 0, waitSum: 0, tripSum: 0 } as CumulativeStats
    }
};

const FULL_DAY_PHASES: { name: string, scenario: ScenarioType, limit: number }[] = [
    { name: 'Phase 1: Morning Rush', scenario: 'MORNING_RUSH', limit: 100 },
    { name: 'Phase 2: Stress Test #1', scenario: 'STRESS_TEST', limit: 100 },
    { name: 'Phase 3: Lunch Time', scenario: 'LUNCH_RUSH', limit: 100 },
    { name: 'Phase 4: Lunch Return', scenario: 'LUNCH_RETURN', limit: 100 },
    { name: 'Phase 5: Stress Test #2', scenario: 'STRESS_TEST', limit: 100 },
    { name: 'Phase 6: End of Day', scenario: 'END_OF_DAY', limit: 100 }
];

// --- HELPER: INITIALIZE SIMULATION FOR PHASE ---
const initSimulationForPhase = (popMap: Record<number, number> | null, phaseIndex: number) => {
    const scenario = FULL_DAY_PHASES[phaseIndex].scenario;
    const phaseConfig: SimulationConfig = {
        ...currentConfig!, 
        scenario: scenario, 
        initialPeople: popMap || currentConfig!.initialPeople,
        floorPriorities: {} 
    };

    simNaive = new Simulation(phaseConfig, new NaiveController(), "Naive");
    simImproved = new Simulation(phaseConfig, new ImprovedController(), "Improved");

    updatePhasePriorities(simNaive, phaseIndex);
    updatePhasePriorities(simImproved, phaseIndex);
};

const getPopulationMap = (sim: Simulation): Record<number, number> => {
    const map: Record<number, number> = {};
    sim.getWorldState().floors.forEach(f => {
        if (f.currentPopulation > 0) map[f.level] = f.currentPopulation;
    });
    return map;
};

// --- HELPER: CAPTURE & ACCUMULATE STATS ---
const completePhaseAndAccumulate = (duration: number) => {
    if (!simNaive || !simImproved) return;

    const nStats = simNaive.getWorldState().stats;
    const iStats = simImproved.getWorldState().stats;

    phaseHistory.push({
        phaseName: FULL_DAY_PHASES[fullDayState.phase].name,
        duration: duration,
        naive: { 
            delivered: nStats.totalDelivered, 
            avgWait: nStats.avgWaitingTime, 
            avgTrip: nStats.avgTransitTime,
            avgUtil: nStats.elevatorUtilization 
        },
        improved: { 
            delivered: iStats.totalDelivered, 
            avgWait: iStats.avgWaitingTime, 
            avgTrip: iStats.avgTransitTime,
            avgUtil: iStats.elevatorUtilization 
        }
    });

    fullDayState.cumulative.naive.delivered += nStats.totalDelivered;
    fullDayState.cumulative.naive.waitSum += (nStats.avgWaitingTime * nStats.totalDelivered);
    fullDayState.cumulative.naive.tripSum += (nStats.avgTransitTime * nStats.totalDelivered);

    fullDayState.cumulative.improved.delivered += iStats.totalDelivered;
    fullDayState.cumulative.improved.waitSum += (iStats.avgWaitingTime * iStats.totalDelivered);
    fullDayState.cumulative.improved.tripSum += (iStats.avgTransitTime * iStats.totalDelivered);
};

const updatePhasePriorities = (sim: Simulation, phaseIndex: number) => {
    const scenario = FULL_DAY_PHASES[phaseIndex].scenario;
    const floorCount = sim.getWorldState().floors.length;
    const topFloor = floorCount - 1; 

    for (let i = 0; i < floorCount; i++) {
        let newPrio = 0;
        if (scenario === 'MORNING_RUSH') newPrio = (i === 0) ? 10 : 0;
        else if (scenario === 'STRESS_TEST') newPrio = 0;
        else if (scenario === 'LUNCH_RUSH') newPrio = (i === 0 || i === topFloor) ? 0 : 10;
        else if (scenario === 'LUNCH_RETURN') newPrio = (i === 0 || i === topFloor) ? 10 : 0;
        else if (scenario === 'END_OF_DAY') newPrio = (i === 0) ? 0 : 10;
        sim.setFloorPriority(i, newPrio);
    }
};

const getCommonWeightedFloor = (floorsA: FloorState[], floorsB: FloorState[], excludedFloors: number[] = []): number => {
    const hasHighPriority = floorsA.some(f => (f.priority || 0) > 1);
    let totalWeight = 0;
    const weightedCandidates: { level: number, weight: number }[] = [];

    for (let i = 0; i < floorsA.length; i++) {
        const fA = floorsA[i];
        const fB = floorsB[i]; 
        if (excludedFloors.includes(fA.level)) continue;
        if (hasHighPriority) { if ((fA.priority || 0) <= 1) continue; } 
        if (fA.currentPopulation > 0 && fB.currentPopulation > 0) {
            const weight = Math.min(fA.currentPopulation, fB.currentPopulation);
            let priorityFactor = (fA.priority === undefined) ? 1 : fA.priority;
            if (priorityFactor === 0 && !hasHighPriority) priorityFactor = 1;
            const finalWeight = weight * priorityFactor;
            if (finalWeight > 0) {
                totalWeight += finalWeight;
                weightedCandidates.push({ level: fA.level, weight: finalWeight });
            }
        }
    }
    if (totalWeight === 0) return -1; 
    let randomPointer = Math.random() * totalWeight;
    for (const item of weightedCandidates) {
        if (randomPointer < item.weight) return item.level;
        randomPointer -= item.weight;
    }
    return weightedCandidates[weightedCandidates.length - 1].level;
};

// --- HELPER: GENERATE EVENTS ---
const generateScenarioEvents = (
    tick: number, 
    config: SimulationConfig, 
    floorsNaive: FloorState[],
    floorsImproved: FloorState[],
    phaseStartTick: number
): TrafficEvent[] => {
    
    if (fullDayState.active) {
        // DELAY LOGIC: 10 Ticks delay for non-morning phases
        if (fullDayState.phase > 0 && (tick < phaseStartTick + 10)) {
            return [];
        }

        const limit = FULL_DAY_PHASES[fullDayState.phase].limit;
        if (fullDayState.eventsGeneratedInPhase >= limit) return []; 
    }

    const scenario = fullDayState.active ? FULL_DAY_PHASES[fullDayState.phase].scenario : config.scenario;
    const events: TrafficEvent[] = [];
    const randomChance = Math.random();
    let eventGenerated = false;
    const topFloor = config.floors - 1;

    if (scenario === 'MORNING_RUSH' && randomChance < 0.4) {
        const source = getCommonWeightedFloor(floorsNaive, floorsImproved); 
        if (source !== -1) {
            let dest = Math.floor(Math.random() * config.floors);
            while (dest === source) dest = Math.floor(Math.random() * config.floors);
            events.push({ timeStep: tick, source, destination: dest, count: 1 });
            eventGenerated = true;
        }
    } else if (scenario === 'LUNCH_RUSH' && randomChance < 0.5) {
        const source = getCommonWeightedFloor(floorsNaive, floorsImproved, [0, topFloor]); 
        if (source !== -1) {
            const dest = Math.random() > 0.5 ? 0 : topFloor;
            events.push({ timeStep: tick, source, destination: dest, count: 1 });
            eventGenerated = true;
        }
    } else if (scenario === 'LUNCH_RETURN' && randomChance < 0.5) {
        const source = getCommonWeightedFloor(floorsNaive, floorsImproved);
        if (source !== -1) {
            if (config.floors > 2) {
                let dest = Math.floor(Math.random() * config.floors);
                while (dest === 0 || dest === topFloor) dest = Math.floor(Math.random() * config.floors);
                events.push({ timeStep: tick, source, destination: dest, count: 1 });
                eventGenerated = true;
            }
        }
    } else if (scenario === 'END_OF_DAY' && randomChance < 0.5) {
        const source = getCommonWeightedFloor(floorsNaive, floorsImproved, [0]);
        if (source !== -1) {
            events.push({ timeStep: tick, source, destination: 0, count: 1 });
            eventGenerated = true;
        }
    } else if (scenario === 'STRESS_TEST' && randomChance < 0.6) {
        const source = getCommonWeightedFloor(floorsNaive, floorsImproved);
        if (source !== -1) {
            let dest = Math.floor(Math.random() * config.floors);
            while(dest === source) dest = Math.floor(Math.random() * config.floors);
            events.push({ timeStep: tick, source, destination: dest, count: 1 });
            eventGenerated = true;
        }
    }
    if (fullDayState.active && eventGenerated) fullDayState.eventsGeneratedInPhase++;
    return events;
};

const isSimulationIdle = (sim: Simulation): boolean => {
    const elevatorsIdle = sim.getWorldState().elevators.every(e => e.state === 'IDLE' && e.passengers.length === 0 && e.targetFloors.length === 0);
    const queuesEmpty = sim.getWorldState().floors.every(f => f.waitingQueue.length === 0);
    return elevatorsIdle && queuesEmpty;
};

const isPhaseStarved = (sim: Simulation, phaseIndex: number): boolean => {
    const scenario = FULL_DAY_PHASES[phaseIndex].scenario;
    const floors = sim.getWorldState().floors;
    const topFloor = floors.length - 1;
    if (scenario === 'MORNING_RUSH') return floors[0].currentPopulation === 0;
    if (scenario === 'LUNCH_RUSH') return !floors.some(f => f.level !== 0 && f.level !== topFloor && f.currentPopulation > 0);
    if (scenario === 'LUNCH_RETURN') return !((floors[0].currentPopulation > 0 || floors[topFloor].currentPopulation > 0));
    if (scenario === 'END_OF_DAY') return !floors.some(f => f.level !== 0 && f.currentPopulation > 0);
    return false;
};

const startSimulationLoop = () => {
    if (simulationInterval) clearInterval(simulationInterval);

    // FIXED: Removed the initialization block from here. 
    // Initialization now happens ONLY in the /start endpoint.
    // This allows speed changes to resume the current phase instead of resetting it.

    simulationInterval = setInterval(() => {
        if (!currentConfig) return;

        if (isPaused) {
             if (simNaive && simImproved) {
                io.emit('simulation_update', {
                    tick: currentTick,
                    activeScenario: currentConfig.scenario || 'CUSTOM_FLOW',
                    naiveWorld: simNaive.getWorldState(),
                    improvedWorld: simImproved.getWorldState(),
                    isPaused: true,
                    history: history,
                    phaseHistory: phaseHistory 
                });
             }
             return; 
        }

        currentTick++;

        if (fullDayState.active && simNaive && simImproved) {
            if (isSimulationIdle(simNaive) && isSimulationIdle(simImproved)) {
                
                const currentPhaseLimit = FULL_DAY_PHASES[fullDayState.phase].limit;
                const eventsDone = fullDayState.eventsGeneratedInPhase >= currentPhaseLimit;
                const isStarved = isPhaseStarved(simNaive, fullDayState.phase);

                if (eventsDone || isStarved) {
                    
                    completePhaseAndAccumulate(currentTick - fullDayState.phaseStartTick);

                    if (fullDayState.phase < FULL_DAY_PHASES.length - 1) {
                        console.log(`[Phase ${fullDayState.phase + 1} Complete] -> Starting Phase ${fullDayState.phase + 2}...`);
                        
                        const nextPop = getPopulationMap(simNaive);
                        fullDayState.phase++;
                        fullDayState.eventsGeneratedInPhase = 0;
                        fullDayState.phaseStartTick = currentTick; // UPDATE START TICK

                        initSimulationForPhase(nextPop, fullDayState.phase);

                    } else {
                        console.log("Full Day Simulation Complete.");
                        io.emit('simulation_finished', { history, phaseHistory });
                        clearInterval(simulationInterval!);
                        fullDayState.active = false;
                        return;
                    }
                }
            }
        }

        let newEvents: TrafficEvent[] = [];
        if (simNaive && simImproved) {
            const fNaive = simNaive.getWorldState().floors;
            const fImproved = simImproved.getWorldState().floors;
            // FIXED: Using persistent phaseStartTick
            newEvents = generateScenarioEvents(currentTick, currentConfig, fNaive, fImproved, fullDayState.phaseStartTick);
        }
        
        if (simNaive) { simNaive.injectEvents(newEvents); simNaive.step(); }
        if (simImproved) { simImproved.injectEvents(newEvents); simImproved.step(); }

        if (simNaive && simImproved) {
            const nStats = simNaive.getWorldState().stats;
            const iStats = simImproved.getWorldState().stats;
            const scenarioName = fullDayState.active ? FULL_DAY_PHASES[fullDayState.phase].name : (currentConfig.scenario || 'CUSTOM');

            const nTotalDelivered = fullDayState.cumulative.naive.delivered + nStats.totalDelivered;
            const iTotalDelivered = fullDayState.cumulative.improved.delivered + iStats.totalDelivered;

            const nTotalWait = fullDayState.cumulative.naive.waitSum + (nStats.avgWaitingTime * nStats.totalDelivered);
            const nTotalTrip = fullDayState.cumulative.naive.tripSum + (nStats.avgTransitTime * nStats.totalDelivered);
            
            const iTotalWait = fullDayState.cumulative.improved.waitSum + (iStats.avgWaitingTime * iStats.totalDelivered);
            const iTotalTrip = fullDayState.cumulative.improved.tripSum + (iStats.avgTransitTime * iStats.totalDelivered);

            history.push({
                tick: currentTick,
                naiveDelivered: nTotalDelivered,
                improvedDelivered: iTotalDelivered,
                naiveWait: nTotalDelivered > 0 ? nTotalWait / nTotalDelivered : 0,
                naiveTrip: nTotalDelivered > 0 ? nTotalTrip / nTotalDelivered : 0,
                improvedWait: iTotalDelivered > 0 ? iTotalWait / iTotalDelivered : 0,
                improvedTrip: iTotalDelivered > 0 ? iTotalTrip / iTotalDelivered : 0
            });

            io.emit('simulation_update', {
                tick: currentTick,
                activeScenario: scenarioName,
                naiveWorld: simNaive.getWorldState(),
                improvedWorld: simImproved.getWorldState(),
                isPaused: false,
                history,
                phaseHistory
            });
        }
    }, tickSpeed);
};

// --- ENDPOINTS ---
app.post('/start', (req, res) => {
  currentConfig = req.body;
  currentTick = 0;
  isPaused = false;
  history = []; 
  phaseHistory = []; 
  tickSpeed = 500; 

  if (currentConfig && currentConfig.scenario === 'FULL_DAY_CYCLE') {
      fullDayState = {
          active: true,
          phase: 0,
          eventsGeneratedInPhase: 0,
          phaseStartTick: 0, // Reset Start Tick
          cumulative: {
            naive: { delivered: 0, waitSum: 0, tripSum: 0 },
            improved: { delivered: 0, waitSum: 0, tripSum: 0 }
          }
      };
      // FIXED: Initialize ONLY here at start
      initSimulationForPhase(null, 0); 
  } else {
      fullDayState.active = false;
      simNaive = new Simulation(currentConfig!, new NaiveController(), "Naive");
      simImproved = new Simulation(currentConfig!, new ImprovedController(), "Improved");
  }
  
  console.log("Starting Simulation...");
  startSimulationLoop();
  res.json({ message: "Simulation started" });
});

app.post('/speed', (req, res) => {
    const { multiplier } = req.body;
    tickSpeed = 500 / multiplier;
    console.log(`Speed set to ${multiplier}x (${tickSpeed}ms)`);
    startSimulationLoop(); // Just restarts the loop, doesn't re-init logic
    res.json({ message: "Speed updated" });
});

app.post('/pause', (req, res) => { isPaused = true; res.json({ message: "Paused" }); });
app.post('/resume', (req, res) => { isPaused = false; res.json({ message: "Resumed" }); });
app.post('/stop', (req, res) => {
  if (simulationInterval) clearInterval(simulationInterval);
  simNaive = null; simImproved = null; isPaused = false;
  fullDayState.active = false;
  res.json({ message: "Simulation stopped", history });
  history = [];
});

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});