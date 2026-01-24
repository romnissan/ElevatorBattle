// @ts-ignore
import { v4 as uuidv4 } from 'uuid';
import { 
  SimulationConfig, 
  SimulationState, 
  Elevator, 
  FloorState, 
  TrafficEvent,
  WorldState,
  SimulationStats
} from '../../shared/types';

export abstract class ElevatorController {
  abstract update(elevators: Elevator[], floors: FloorState[], config: SimulationConfig): void;
}

export class Simulation {
  private config: SimulationConfig;
  private tick: number = 0;
  private elevators: Elevator[];
  private floors: FloorState[];
  private controller: ElevatorController;
  private algoName: string;
  
  private totalWaitTime: number = 0;
  private totalTransitTime: number = 0;
  private deliveredCount: number = 0;

  constructor(config: SimulationConfig, controller: ElevatorController, algoName: string) {
    this.config = JSON.parse(JSON.stringify(config)); // Deep copy to prevent ref issues
    this.controller = controller;
    this.algoName = algoName;
    
    this.floors = Array.from({ length: this.config.floors }, (_, i) => ({
      level: i,
      waitingQueue: [],
      currentPopulation: this.config.initialPeople?.[i] || 0,
      priority: this.config.floorPriorities?.[i] || 0 // Default to 0 if undefined
    }));

    this.elevators = Array.from({ length: this.config.elevators }, (_, i) => ({
      id: i,
      currentFloor: 0,
      direction: 'IDLE',
      passengers: [],
      targetFloors: [],
      state: 'IDLE',
      stats: {
          totalDelivered: 0,
          activeTicks: 0
      }
    }));
  }

  public setFloorPriority(floorIndex: number, priority: number) {
      if (this.floors[floorIndex]) {
          this.floors[floorIndex].priority = priority;
          if (!this.config.floorPriorities) this.config.floorPriorities = {};
          this.config.floorPriorities[floorIndex] = priority;
      }
  }

  public injectEvents(events: TrafficEvent[]) {
      events.forEach(event => this.spawnPerson(event.source, event.destination, event.count));
  }

  public step() {
    this.tick++;
    this.handleOffloading();
    this.handleOnloading();
    
    this.elevators.forEach(e => {
        if (e.state !== 'IDLE') {
            e.stats.activeTicks++;
        }
    });

    this.controller.update(this.elevators, this.floors, this.config);
    this.moveElevators();
  }

  private spawnPerson(source: number, dest: number, count: number) {
    if (this.floors[source].currentPopulation < count) return; 

    for (let i = 0; i < count; i++) {
      this.floors[source].currentPopulation--;
      this.floors[source].waitingQueue.push({
        id: uuidv4(),
        sourceFloor: source,
        destFloor: dest,
        spawnTime: this.tick
      });
    }
  }

  private handleOffloading() {
    this.elevators.forEach(elevator => {
      const staying = elevator.passengers.filter(p => p.destFloor !== elevator.currentFloor);
      const leaving = elevator.passengers.filter(p => p.destFloor === elevator.currentFloor);
      
      leaving.forEach(p => {
        this.totalTransitTime += (this.tick - p.spawnTime); 
        this.deliveredCount++;
        this.floors[elevator.currentFloor].currentPopulation++;
        elevator.stats.totalDelivered++;
      });
      
      elevator.passengers = staying;
      if (elevator.targetFloors.includes(elevator.currentFloor)) {
          elevator.targetFloors = elevator.targetFloors.filter(f => f !== elevator.currentFloor);
      }
    });
  }

  private handleOnloading() {
    this.elevators.forEach(elevator => {
        const floor = this.floors[elevator.currentFloor];
        if (elevator.passengers.length < this.config.maxCapacity && floor.waitingQueue.length > 0) {
            elevator.state = 'BOARDING'; 
            const person = floor.waitingQueue.shift();
            if (person) {
                const waitTime = this.tick - person.spawnTime;
                this.totalWaitTime += waitTime;
                elevator.passengers.push(person);
                if (!elevator.targetFloors.includes(person.destFloor)) {
                    elevator.targetFloors.push(person.destFloor);
                }
            }
        } else {
            if (elevator.state === 'BOARDING') elevator.state = 'DOORS_OPEN';
        }
    });
  }

  private moveElevators() {
    this.elevators.forEach(elevator => {
        if (elevator.state === 'BOARDING') return;
        if (elevator.targetFloors.length === 0) {
            elevator.state = 'IDLE'; elevator.direction = 'IDLE'; return;
        }
        const nextTarget = elevator.targetFloors[0];
        elevator.state = 'MOVING';
        if (nextTarget > elevator.currentFloor) {
            elevator.currentFloor++; elevator.direction = 'UP';
        } else if (nextTarget < elevator.currentFloor) {
            elevator.currentFloor--; elevator.direction = 'DOWN';
        } else {
             elevator.state = 'DOORS_OPEN';
        }
    });
  }

  public getWorldState(): WorldState {
      const avgWait = this.deliveredCount + this.elevators.reduce((sum, e) => sum + e.passengers.length, 0) > 0 
          ? this.totalWaitTime / (this.deliveredCount + this.elevators.reduce((sum, e) => sum + e.passengers.length, 0))
          : 0;

      const avgTransit = this.deliveredCount > 0 
        ? this.totalTransitTime / this.deliveredCount 
        : 0;
      
      const globalUtilization = this.elevators.length > 0
        ? (this.elevators.reduce((sum, e) => sum + (e.stats.activeTicks / (this.tick || 1)), 0) / this.elevators.length)
        : 0;
      
      return {
          elevators: this.elevators,
          floors: this.floors,
          stats: {
              algorithmName: this.algoName,
              totalDelivered: this.deliveredCount,
              avgWaitingTime: avgWait,
              avgTransitTime: avgTransit,
              elevatorUtilization: globalUtilization
          }
      };
  }
}