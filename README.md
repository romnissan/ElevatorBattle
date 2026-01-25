# Optimization of Elevator Dispatching Algorithms using Heuristic Control
## Topics in Applications of Computer Science
**Ben-Gurion University of the Negev** **Course Instructor:** Prof. Moshe Sipper  
**Authors:** Rom Nissan & Niv Yaakobov  

---

## 1. Introduction

The **Elevator Dispatching Problem** is a classic optimization challenge in operations research and cyber-physical systems. It involves scheduling a limited fleet of elevators to serve a stochastic stream of passenger requests in a multi-story building. The objective is to minimize passenger **Wait Time** (time until boarding) and **Trip Time** (time until delivery) while maximizing system throughput.

In high-rise buildings, standard First-Come-First-Serve (FCFS) algorithms often fail during peak traffic hours, leading to "bunching" (multiple elevators serving the same floor) and excessive queuing. This project implements and compares a baseline **Naive Algorithm** against a heuristic-based **Improved Algorithm** designed with zoning strategies, ETA minimization, and anticipatory parking.



https://github.com/user-attachments/assets/f05b7fed-7fc3-44d7-9cba-fa4f650b1ffa


---

## 2. Background & Motivation

Elevator traffic is rarely uniform. It follows distinct patterns:
* **Up-Peak (Morning Rush):** Heavy unidirectional traffic from the Lobby to upper floors.
* **Two-Way Peak (Lunch Rush):** Heavy traffic between Office Floors, the Lobby, and the Cafeteria.
* **Down-Peak (End of Day):** Heavy unidirectional traffic from upper floors to the Lobby.

Our motivation is to demonstrate that integrating **Anticipatory Parking** (positioning idle elevators based on predicted demand) and **Dynamic Load Balancing** can yield order-of-magnitude improvements in passenger experience compared to standard reactive approaches.

### 2.1 Theoretical Context
The Elevator Dispatching Problem (EDP) is recognized in Operations Research as a complex optimization challenge, often classified as NP-hard due to the stochastic nature of passenger arrivals. Traditional dispatching systems rely on **Collective Control**, which serves requests reactively. However, extensive research demonstrates that heuristic approaches significantly outperform reactive systems, particularly during specific traffic patterns.

Our **Improved Algorithm** implements three key strategies derived from established literature:
* **Up-Peak Zoning:** Research indicates that during the "Morning Rush" (Up-Peak), elevators should immediately return to the main terminal (Lobby) upon becoming idle. Our algorithm implements this via dynamic deficit calculation.
* **Static Sectoring:** The strategy of assigning idle elevators to high-priority zones (e.g., Lobby or Cafeteria) is known as *Static Sectoring*. This reduces the "Parking Time" cost when a new request is generated.
* **Nearest Car (NC) Heuristic:** Our active assignment logic minimizes the Estimated Time of Arrival (ETA) by considering both travel distance and stopping costs, a method proven to minimize system-wide Waiting Time (WT).
---

## 3. Methods: Algorithm Descriptions

We implemented two distinct control strategies within a discrete-event simulation environment.

### 3.1 Baseline: The Naive Algorithm
The Naive algorithm operates on a strict **First-Come-First-Serve (FCFS)** basis.
* **Logic:** The controller iterates through floors. Upon finding the *first* floor with a waiting queue, it assigns the *first* available elevator. 
* **Constraint:** Unlike real-world scenarios where a full elevator might still stop despite being unable to board more passengers, our Naive algorithm bypasses floors when at capacity and dispatches a different available elevator instead, which improves the baseline performance.

### 3.2 The Improved Algorithm
The Improved Algorithm utilizes a multi-phase heuristic strategy involving **Active Request Interception** and **Smart Parking**.

#### Phase A: Active Assignment (ETA Minimization)
When a passenger request is detected at a specific floor (let's call it `RequestFloor`), the algorithm performs a comparative cost analysis to determine the optimal elevator assignment. The decision process follows these specific steps:

1.  **Identify Candidates:** The algorithm scans the entire fleet to identify two types of candidates:
    * **Moving Candidates:** Elevators that are currently `MOVING` towards `RequestFloor` in the correct direction (e.g., an elevator moving UP from floor 2 to 8 is a candidate for a request at floor 5). These are only considered if they have spare capacity.
    * **Idle Candidates:** Elevators that are currently `IDLE` with no active tasks.

2.  **Calculate Distance Costs:**
    * For the best **Moving Candidate**, the cost is the distance from its current position to `RequestFloor` (`Math.abs(Current - Request)`).
    * For the best **Idle Candidate**, the cost is similarly the absolute distance.

3.  **Selection Logic (The Interception Heuristic):**
    The algorithm compares the distance of the best Moving Candidate against the best Idle Candidate.
    * If `Distance(Moving) <= Distance(Idle)`, the algorithm selects the **Moving Elevator**. This "intercepts" the elevator mid-journey, allowing it to serve multiple passengers in a single directional sweep, significantly reducing Trip Time and energy usage.
    * Otherwise, the nearest **Idle Elevator** is dispatched.

This logic effectively prioritizes "piggybacking" on existing trips over starting new ones, which reduces the "Stop-and-Go" penalties that plague naive algorithms.

#### Phase B: Smart Parking (Hierarchical Deficit Calculation)
The core innovation of the Improved Algorithm is how it handles idle elevators. Rather than remaining stationary at the last drop-off floor, elevators are proactively moved to high-demand zones using a **Weighted Fleet Deficit** logic.

This logic adapts dynamically when floors have different priority levels (e.g., Lobby = 10, VIP Floor = 5, Regular Floor = 1). The algorithm distributes the fleet proportionally based on the "Priority Mass" of each tier.

**The Two-Step Allocation Logic:**

1.  **Tier Allocation (Inter-Group):**
    First, the algorithm calculates how many elevators should be allocated to each *Priority Tier* (a group of floors with the same priority score). The share is proportional to the total priority score of that tier relative to the sum of all priorities in the building.

    $$\text{TierShare}_{\text{group}} = \text{TotalFleet} \times \left( \frac{\sum_{f \in \text{group}} \text{Priority}_f}{\sum_{\text{all}} \text{Priority}} \right)$$

    *Example:* If the Lobby (Prio 10) and Cafeteria (Prio 10) exist alongside 8 Office floors (Prio 0), the algorithm allocates 100% of the fleet to the Lobby/Cafeteria tier because the Office tier has 0 priority mass.

2.  **Floor Allocation (Intra-Group):**
    Within a specific tier, the allocated elevators are distributed based on real-time **Population** demand.

    $$\text{FloorShare}_f = \text{TierShare}_{\text{group}} \times \left( \frac{\text{Population}_f}{\text{TotalPopulation}_{\text{group}}} \right)$$

    *Note:* If a high-priority floor has 0 population, it still retains its static priority share to ensure readiness.

3.  **Deficit & Selection:**
    Finally, the algorithm calculates the **Deficit** for every floor to determine where elevators are needed most:

    $$\text{Deficit}_f = \text{FloorShare}_f - \text{ActualElevators}_f + \text{StickinessBonus}$$

    * **ActualElevators:** The number of elevators currently at or moving to floor $f$.
    * **StickinessBonus (1.2):** If an elevator is *already* at floor $f$, we artificially inflate the deficit by 1.2. This prevents "thrashing" (elevators constantly moving between floors with slightly varying scores) by ensuring an elevator only leaves its current spot if another floor has a massive shortage (deficit > 1.0).

**Outcome:** Elevators automatically "flow" to floors with high priorities (Lobby) or high populations (Cafeteria at lunch) before requests are even made, while lower-priority floors only receive elevators when explicitly requested.

---

## 4. Experimental Setup

The simulation is built using a **TypeScript** backend and **React** frontend.

### 4.1 Input Parameters
* **Tick Rate:** 500ms (Adjustable multiplier 1x-10x).
* **Fleet Size:** 3-4 elevators (depending on scenario).
* **Capacity:** 3-8 passengers per elevator.
* **Floors:** 8-20 floors.

### 4.2 Scenarios
We evaluated performance across 6 distinct phases:
1.  **Morning Rush:** Heavy Lobby $\to$ Offices.
2.  **Lunch Rush:** Offices $\leftrightarrow$ Cafeteria/Lobby.
3.  **Lunch Return:** Lobby/Cafeteria $\to$ Offices.
4.  **End of Day:** Offices $\to$ Lobby.
5.  **Stress Test:** High-frequency random noise.
6.  **Full Day Cycle:** A continuous sequence of all above phases.

---

## 5. Results

The following results are derived from the `Simulation Report` outputs generated by the system.

### 5.1 Cumulative Performance (Full Day Cycle)
Over the course of the full simulation (approx 1450 ticks), the Improved Algorithm demonstrated significant efficiency gains.

![Full Day Results](ElevatorBattle/full_day_results.png)
 #### Phase 1: Morning Rush
![phase Results](ElevatorBattle/phase1.png)

 #### phase 2: Stress Test
![phase Results](ElevatorBattle/phase2.png)

 #### phase 3: Lunch Rush
![phase Results](ElevatorBattle/phase3.png)

 #### phase 4: Lunch Return
![phase Results](ElevatorBattle/phase4.png)

 #### phase 5: Stress Test
 ![phase Results](ElevatorBattle/phase5.png)

 #### phase 6: End of Day
![phase Results](ElevatorBattle/phase6.png)

### 5.2 Scenarios Analysis

#### Scenario 1: Morning Rush
This scenario yielded the most dramatic improvement. The "Smart Parking" logic recognized the high population at Floor 0 (Lobby) and kept returning elevators there immediately after drop-offs.
* **Wait Time Improvement:** **+94.3%**
* **Trip Time Improvement:** **+87.6%**

![Morning Rush Results](ElevatorBattle/Morning_Rush_results.jpeg)


#### Scenario 2: Stress Test
Under chaotic conditions with random spawning, the Improved algorithm's ability to intercept passengers while moving (rather than FCFS locking) proved superior.
* **Wait Time Improvement:** **+47.8%**
* **Trip Time Improvement:** **+25.5%**

![Stress Test Results](ElevatorBattle/Stress_test-results.jpeg)


#### Scenario 3: Lunch Rush
Handling bidirectional traffic (People leaving offices + People returning). The population-based deficit calculation ensured elevators didn't cluster at the Lobby but also served office floors.
* **Wait Time Improvement:** **+30.9%**
* **Trip Time Improvement:** **+13.2%**

![Lunch Rush Results](ElevatorBattle/Lunch-rush-results.jpeg)


#### Scenario 4: Lunch Return
Similar to Morning Rush but with higher density. The algorithm successfully prioritized the two main source floors (Lobby and Cafeteria).
* **Wait Time Improvement:** **+30.3%**
* **Trip Time Improvement:** **+13.9%**

![Lunch Return Results](ElevatorBattle/Lunch-Return-Results.jpeg)


#### Scenario 5: End of Day
Heavy downward traffic. The Improved algorithm utilized capacity efficiently by picking up passengers from multiple floors on a single descent.
* **Wait Time Improvement:** **+33.8%**
* **Trip Time Improvement:** **+15.7%**

![End of Day Results](ElevatorBattle/End-of-Day-results.jpeg)


---

## 6. Conclusions

### 6.1 What Worked Well
1.  **Deficit-Based Parking:** The decision to incorporate `currentPopulation` and `floorPriority` into the parking logic was decisive. In the Morning Rush, the algorithm essentially dedicated the entire fleet to the Lobby without explicit hard-coding, purely because the population count and the high priority at Floor 0 created a massive "Deficit" score.
2.  **Stickiness Factor:** The `+1.2` stickiness bonus in `ImprovedController.ts` successfully prevented "Thrashing" (elevators vibrating between empty floors), saving active ticks and energy.
3.  **Phase Adaptability:** The algorithm required no manual mode switching; it adapted to Morning vs. Lunch patterns purely based on the changing population data on the floors.

### 6.2 Tradeoffs & Limitations
* **Computational Cost:** The Improved controller runs $O(N \cdot M)$ calculations per tick (where N=Elevators, M=Floors) to calculate deficits, whereas the Naive approach is $O(M)$. In extremely large skyscrapers (100+ floors), this could impact simulation speed.


### 6.3 Comparison with Industry Standards

Our **Improved Algorithm** offers a hybrid approach that outperforms traditional industry standards in specific scenarios by utilizing **direct simulation state access** (real-time queue depths) and proactive positioning.

#### 1. VS. Collective Control (SCAN)
* **How it works:** The elevator acts like a bus, moving continuously in one direction (e.g., UP) and stopping at every floor with a request until it reaches the top, then reversing.
* **Where our algorithm wins:** **The "Morning Rush" Idle Problem.**
    * *Scenario:* In a standard SCAN system, after an elevator drops a passenger at the 10th floor, it remains there idle until a new button is pressed. During a morning rush, this forces the next person at the Lobby to wait for the elevator to travel all the way down from floor 10.
    * *Our Solution:* The **Improved Algorithm** utilizes **Smart Parking**. It detects that the Lobby (Floor 0) has a high priority or population density and automatically returns the idle elevator to the Lobby immediately after the drop-off, ensuring zero wait time for the next incoming passenger.

#### 2. VS. Group Control (ETA Dispatch)
* **How it works:** When a button is pressed, a central controller calculates the "Estimated Time of Arrival" for every elevator and assigns the call to the one that can arrive soonest.
* **Where our algorithm wins:** **The "Hidden Crowd" Problem.**
    * *Scenario:* 20 people are waiting at the Cafeteria. They press the "UP" button *once*. A standard ETA system sees "1 active call" and dispatches a single elevator. That elevator arrives, fills up with 8 people, and leaves 12 stranded, requiring them to press the button again and wait for a second cycle.
    * *Our Solution:* Our algorithm reads the exact `waitingQueue.length` (e.g., 20 people). It calculates a **Fleet Deficit** and realizes that a single elevator (capacity 8) is insufficient. It can proactively adjust the fleet distribution to send multiple elevators to the Cafeteria to handle the volume in a single wave.

#### 3. VS. Destination Control System (DCS)
* **How it works:** Passengers select their destination floor on a keypad in the lobby *before* entering. The system groups passengers going to the same floors into the same elevator to minimize stops.
* **Where our algorithm wins:**
    * **Scenario A: The "Piggybacking" Efficiency (Interception).**
      DCS systems are often rigid; once a group is assigned to Elevator A, the plan is fixed. If a new passenger appears on Floor 3 wanting to go UP, and Elevator B is passing by floor 3 on its way to floor 8, DCS might not stop Elevator B because it wasn't pre-planned. Our algorithm dynamically identifies Elevator B as a **Moving Candidate** and modifies its path to "intercept" the new passenger, reducing overall wait time.
    
    * **Scenario B: Stress Test (Chaotic Random Traffic).**
      DCS relies on forming groups of people with similar destinations. In a "Stress Test" scenario where requests are completely random (e.g., Floor 2 to 9, Floor 7 to 3, Floor 4 to 6), distinct groups do not form, causing the DCS optimization logic to falter. Our algorithm shines here by treating each request independently and calculating the optimal pickup cost in real-time, effectively managing chaotic flow without relying on the pre-existence of structured groups.
---

## 7. Installation & Execution

### Prerequisites
* Node.js (v16+)
* npm

### Steps
1.  **Clone the Repository:**
    ```bash
    git clone <repository_url>
    cd elevator-project
    ```

2.  **Start Backend:**
    ```bash
    cd backend
    npm install
    npx ts-node src/index.ts\
    ```
    *Server runs on port 3001.*

3.  **Start Frontend:**
    ```bash
    cd frontend
    npm install
    npm start
    ```
    *Client runs on http://localhost:3000.*

4.  **Select Scenario:**
    Use the top navigation bar to select **"Full Day Cycle"** to replicate the results presented above.
---

## 8. References

The heuristics and control strategies implemented in this project are based on the following academic literature and industry standards:

1.  **Barney, G., & Al-Sharif, L.** (2015). *Elevator Traffic Handbook: Theory and Practice* (2nd ed.). Routledge.  
    *(Source for Up-Peak handling strategies and Round Trip Time (RTT) calculations).*

2.  **Siikonen, M. L.** (1993). Planning and control models for elevators in high-rise buildings. *Control Engineering Practice*, 1(6), 1047-1054.  
    *(Source for Static Sectoring and Zoning logic implemented in our "Smart Parking" phase).*

3.  **Barney, G. C.** (2003). Elevator dispatching studies. *International Journal of Elevator Engineers*, 4.  
    *(Source for the Nearest Car (NC) rule and ETA minimization algorithms used in our active assignment logic).*
