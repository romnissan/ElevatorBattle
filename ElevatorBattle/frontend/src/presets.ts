import { SimulationConfig } from './types';

export const CONFIG_MORNING_RUSH: SimulationConfig = {
  floors: 15,
  elevators: 4,
  maxCapacity: 3,
  mode: 'PREBUILT_SCENARIO',
  scenario: 'MORNING_RUSH',
  floorPriorities: { 0: 10.0 }, 
  initialPeople: { 0: 200 },    
};

const getLunchRushPopulation = () => {
    const pop: Record<number, number> = {};
    for (let i = 0; i < 8; i++) {
        if (i === 0 || i === 7) pop[i] = 0;
        else {
            if (i%2 === 0) pop[i] = 10;
            else pop[i] = 30;
        }
    }
    return pop;
};

const getLunchRushPriorities = () => {
    const prio: Record<number, number> = {};
    for (let i = 0; i < 8; i++) {
        if (i === 0 || i === 7) prio[i] = 0;
        else prio[i] = 5;
    }
    return prio;
};

export const CONFIG_LUNCH_RUSH: SimulationConfig = {
  floors: 8,
  elevators: 4,
  maxCapacity: 3,
  mode: 'PREBUILT_SCENARIO',
  scenario: 'LUNCH_RUSH',
  floorPriorities: getLunchRushPriorities(),
  initialPeople: getLunchRushPopulation(),
};

const getEndOfDayPriorities = () => {
    const prio: Record<number, number> = {};
    for (let i = 0; i < 10; i++) {
        prio[i] = (i === 0) ? 0 : 10; 
    }
    return prio;
};

const getEndOfDayPopulation = () => {
    const pop: Record<number, number> = {};
    for (let i = 0; i < 10; i++) {
        pop[i] = (i === 0) ? 0 : 50; 
    }
    return pop;
};

export const CONFIG_END_OF_DAY: SimulationConfig = {
    floors: 7,
    elevators: 4,
    maxCapacity: 3,
    mode: 'PREBUILT_SCENARIO',
    scenario: 'END_OF_DAY',
    floorPriorities: getEndOfDayPriorities(),
    initialPeople: getEndOfDayPopulation()
};

const getLunchReturnPriorities = () => {
    const prio: Record<number, number> = {};
    for (let i = 0; i <= 10; i++) {
        if (i === 0 || i === 10) prio[i] = 10;
        else prio[i] = 0;
    }
    return prio;
};

const getLunchReturnPopulation = () => {
    const pop: Record<number, number> = {};
    for (let i = 0; i <= 10; i++) {
        if (i === 0 || i === 10) pop[i] = 100;
        else pop[i] = 0;
    }
    return pop;
};

export const CONFIG_LUNCH_RETURN: SimulationConfig = {
    floors: 11, 
    elevators: 4,
    maxCapacity: 5,
    mode: 'PREBUILT_SCENARIO',
    scenario: 'LUNCH_RETURN',
    floorPriorities: getLunchReturnPriorities(),
    initialPeople: getLunchReturnPopulation()
};

export const CONFIG_STRESS_TEST: SimulationConfig = {
  floors: 20,
  elevators: 3, 
  maxCapacity: 5,
  mode: 'PREBUILT_SCENARIO',
  scenario: 'STRESS_TEST',
  floorPriorities: {}, 
  initialPeople: { 0: 10, 10: 10, 19: 10 }, 
};

export const CONFIG_FULL_DAY: SimulationConfig = {
    floors: 10,
    elevators: 4,
    maxCapacity: 3,
    mode: 'PREBUILT_SCENARIO',
    scenario: 'FULL_DAY_CYCLE', 
    initialPeople: { 0: 100 },
    floorPriorities: { 0: 10 }
};

const generateLoopTimeline = () => {
  const events = [];
  let tick = 10; 

  events.push({ timeStep: tick, source: 6, destination: 7, count: 1 });
  tick += 5; 

  events.push({ timeStep: tick, source: 7, destination: 0, count: 1 });
  tick += 10;

  for (let i = 0; i < 100; i++) {
    events.push({ timeStep: tick, source: 0, destination: 7, count: 1 });
    tick += 10; 
    events.push({ timeStep: tick, source: 7, destination: 0, count: 1 });
    tick += 10; 
  }

  return events;
};

export const CONFIG_INFINITE_LOOP: SimulationConfig = {
  floors: 10,
  elevators: 1,
  maxCapacity: 5,
  mode: 'DETAILED_DAY_FLOW', 
  floorPriorities: {}, 
  initialPeople: { 6: 1 }, 
  timeline: generateLoopTimeline()
};