import { ElevatorController } from '../Simulation';
import { Elevator, FloorState, SimulationConfig } from '../../../shared/types';

export class ImprovedController extends ElevatorController {

  update(elevators: Elevator[], floors: FloorState[], config: SimulationConfig): void {
    // 0. CLEANUP
    elevators.forEach(e => {
        e.targetFloors = e.targetFloors.filter(f => f !== e.currentFloor);
        e.passengers.forEach(p => {
            if (!e.targetFloors.includes(p.destFloor)) e.targetFloors.push(p.destFloor);
        });
    });

    // --- PHASE 1: ASSIGN ACTIVE REQUESTS ---
    floors.forEach(floor => {
        if (floor.waitingQueue.length === 0) return;

        const incoming = elevators.filter(e => e.targetFloors.includes(floor.level));
        const activeCapacity = incoming.length * config.maxCapacity; 
        if (activeCapacity >= floor.waitingQueue.length) return;

        const movingCandidate = this.findBestMovingElevator(floor.level, elevators, config.maxCapacity);
        const idleCandidate = this.findNearestIdleElevator(floor.level, elevators);

        let chosenElevator: Elevator | null = null;
        if (movingCandidate && idleCandidate) {
            const distMoving = Math.abs(movingCandidate.currentFloor - floor.level);
            const distIdle = Math.abs(idleCandidate.currentFloor - floor.level);
            chosenElevator = distMoving <= distIdle ? movingCandidate : idleCandidate;
        } else {
            chosenElevator = movingCandidate || idleCandidate;
        }

        if (chosenElevator && !chosenElevator.targetFloors.includes(floor.level)) {
            chosenElevator.targetFloors.push(floor.level);
            chosenElevator.targetFloors.sort((a, b) => a - b);
        }
    });

    // --- PHASE 2: SMART PARKING ---
    this.manageIdleParking(elevators, floors);
  }

  // --- HELPER METHODS ---

  private manageIdleParking(allElevators: Elevator[], floors: FloorState[]) {
      // 1. Identify "Free" Elevators
      const freeElevators = allElevators.filter(e => 
          e.state === 'IDLE' && 
          e.targetFloors.length === 0 && 
          e.passengers.length === 0
      );
      if (freeElevators.length === 0) return;

      const priorityFloors = floors.filter(f => f.priority > 1);
      const populatedFloors = floors.filter(f => f.currentPopulation > 0);

      // 2. Map current distribution
      const currentDistribution = new Map<number, number>();
      floors.forEach(f => currentDistribution.set(f.level, 0));
      allElevators.forEach(e => {
          let location = e.currentFloor;
          if (e.passengers.length === 0 && e.targetFloors.length === 1) location = e.targetFloors[0];
          currentDistribution.set(location, (currentDistribution.get(location) || 0) + 1);
      });

      freeElevators.forEach(elevator => {
          let bestFloor = -1;

          if (priorityFloors.length > 0) {
              // PRIORITY LOGIC (With Stickiness)
              bestFloor = this.getBestHierarchicalSlot(elevator, allElevators.length, priorityFloors, currentDistribution);
          } 
          else if (populatedFloors.length > 0) {
              // POPULATION LOGIC (With Stickiness)
              bestFloor = this.getBestPopulationSlot(elevator, allElevators.length, populatedFloors, currentDistribution);
          } 
          else {
              // DEFAULT (Lobby)
              if (elevator.currentFloor !== 0) bestFloor = 0;
          }

          if (bestFloor !== -1 && bestFloor !== elevator.currentFloor) {
              elevator.targetFloors.push(bestFloor);
              currentDistribution.set(bestFloor, (currentDistribution.get(bestFloor) || 0) + 1);
          }
      });
  }

  private getBestHierarchicalSlot(
      me: Elevator, 
      totalFleetSize: number, 
      priorityFloors: FloorState[], 
      distribution: Map<number, number>
  ): number {
      const totalPrioritySum = priorityFloors.reduce((sum, f) => sum + f.priority, 0);
      if (totalPrioritySum === 0) return -1;

      const priorityGroups = new Map<number, FloorState[]>();
      priorityFloors.forEach(f => {
          if (!priorityGroups.has(f.priority)) priorityGroups.set(f.priority, []);
          priorityGroups.get(f.priority)!.push(f);
      });

      let bestFloor = -1;
      let maxDeficit = -Infinity;

      priorityFloors.forEach(floor => {
          // 1. Calculate Share
          const groupPrioritySum = priorityGroups.get(floor.priority)!.reduce((sum, f) => sum + f.priority, 0);
          const groupShareOfFleet = (groupPrioritySum / totalPrioritySum) * totalFleetSize;
          const groupTotalPop = priorityGroups.get(floor.priority)!.reduce((sum, f) => sum + f.currentPopulation, 0);
          
          let floorShare = 0;
          if (groupTotalPop > 0) {
              floorShare = (floor.currentPopulation / groupTotalPop) * groupShareOfFleet;
          } else {
              floorShare = groupShareOfFleet / priorityGroups.get(floor.priority)!.length;
          }

          const actualCount = distribution.get(floor.level) || 0;
          let deficit = floorShare - actualCount;

          // --- STICKINESS BONUS ---
          // If I am already here, artificially boost the deficit (need) so I stay.
          // Adding 1.2 means another floor must effectively need >1 whole extra elevator to pull me away.
          if (me.currentFloor === floor.level) {
              deficit += 1.2;
          }

          if (deficit > maxDeficit) {
              maxDeficit = deficit;
              bestFloor = floor.level;
          } else if (Math.abs(deficit - maxDeficit) < 0.01) {
              // Tie-Breaker: Distance
              const distCurrent = Math.abs(me.currentFloor - floor.level);
              const distBest = Math.abs(me.currentFloor - bestFloor);
              if (distCurrent < distBest) bestFloor = floor.level;
          }
      });

      return bestFloor;
  }

  private getBestPopulationSlot(
      me: Elevator, 
      totalFleetSize: number, 
      candidateFloors: FloorState[], 
      distribution: Map<number, number>
  ): number {
      const totalPop = candidateFloors.reduce((sum, f) => sum + f.currentPopulation, 0);
      if (totalPop === 0) return -1;

      let bestFloor = -1;
      let maxDeficit = -Infinity;
      candidateFloors.forEach(floor => {
          const idealCount = (floor.currentPopulation / totalPop) * totalFleetSize;
          const actualCount = distribution.get(floor.level) || 0;
          let deficit = idealCount - actualCount;
          if (me.currentFloor === floor.level) {
              deficit += 1.2; 
          }
          if (deficit > maxDeficit) {
              maxDeficit = deficit;
              bestFloor = floor.level;
          } else if (Math.abs(deficit - maxDeficit) < 0.01) {
              const distCurrent = Math.abs(me.currentFloor - floor.level);
              const distBest = Math.abs(me.currentFloor - bestFloor);
              if (distCurrent < distBest) bestFloor = floor.level;
          }
      });
      return bestFloor;
  }

  private findNearestIdleElevator(floorNum: number, elevators: Elevator[]): Elevator | null {
      let best: Elevator | null = null;
      let minDist = 9999;
      elevators.forEach(e => {
          if (e.state === 'IDLE' && e.targetFloors.length === 0) {
              const dist = Math.abs(e.currentFloor - floorNum);
              if (dist < minDist) { minDist = dist; best = e; }
          }
      });
      return best;
  }

  private findBestMovingElevator(floorNum: number, elevators: Elevator[], capacity: number): Elevator | null {
      let best: Elevator | null = null;
      let minDist = 9999;
      elevators.forEach(e => {
          if (e.state !== 'MOVING' || e.passengers.length >= capacity) return;
          const isGoingUp = e.targetFloors[0] > e.currentFloor;
          const isIncoming = (isGoingUp && e.currentFloor < floorNum) || (!isGoingUp && e.currentFloor > floorNum);
          if (isIncoming) {
              const dist = Math.abs(e.currentFloor - floorNum);
              if (dist < minDist) { minDist = dist; best = e; }
          }
      });
      return best;
  }
}