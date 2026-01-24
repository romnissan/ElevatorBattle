import { ElevatorController } from '../Simulation';
import { Elevator, FloorState, SimulationConfig } from '../../../shared/types';

export class NaiveController extends ElevatorController {
  
  update(elevators: Elevator[], floors: FloorState[], config: SimulationConfig): void {
    
    elevators.forEach(elevator => {
      // 1. If the elevator is already moving or has a destination, let it finish.
      // The naive algorithm does NOT dynamically change route to pick up new people.
      if (elevator.targetFloors.length > 0) return;

      // 2. Scan all floors for waiting people
      // We look for the FIRST floor that has people waiting (strict order)
      for (const floor of floors) {
        if (floor.waitingQueue.length > 0) {
          // Found someone waiting
          
          // Check if any other elevator is already going there
          const isAlreadyTargeted = elevators.some(e => e.targetFloors.includes(floor.level));
          
          if (!isAlreadyTargeted) {
             elevator.targetFloors.push(floor.level);
             break;
          }
        }
      }
    });
  }
}