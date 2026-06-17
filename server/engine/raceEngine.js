import { EventEmitter } from 'events';

export class RaceEngine extends EventEmitter {
  constructor(cars, lapCount, seed) {
    super();
    this.cars = JSON.parse(JSON.stringify(cars));
    this.lapCount = lapCount;
    this.seed = seed;
    this.currentLap = 1;
    this._stopped = false;
    this._tickTimer = null;
    this._random = this.seededRandom(seed);
  }

  start() {
    this._stopped = false;
    this._runLap();
  }

  stop() {
    this._stopped = true;
    if (this._tickTimer) clearTimeout(this._tickTimer);
  }

  applyDecision(decision) {
    const car = this.cars.find(c => c.id === 'player-car');
    if (car) {
      if (decision === 'push') car.aggression = Math.min(1, car.aggression + 0.2);
      if (decision === 'conserve') car.aggression = Math.max(0, car.aggression - 0.2);
      if (decision === 'pit') car.status = 'pit';
    }
  }

  _runLap() {
    if (this._stopped) return;

    for (const car of this.cars) {
      if (car.status === 'retired') continue;

      const baseWear = 0.3;
      const wear = baseWear * (1 + car.aggression * 1.2);
      const reliabilityLoss = wear * (1 + this._random() * 0.3);
      car.currentReliability = Math.max(0, car.currentReliability - reliabilityLoss);

      const failureChance = Math.max(0.01, (100 - car.currentReliability) / 100 * 0.12);
      if (this._random() < failureChance) {
        const severity = Math.floor(this._random() * 3);
        const reliabilityHit = [5, 15, 40][severity];
        car.currentReliability = Math.max(0, car.currentReliability - reliabilityHit);

        const eventTypes = ['mechanical', 'puncture', 'engine_blow'];
        const eventType = eventTypes[severity];

        if (severity === 2) {
          car.status = 'retired';
          car.retirementReason = eventType;
        }

        this.emit('event', {
          lap: this.currentLap,
          carId: car.id,
          team: car.team,
          type: eventType,
          severity,
          reliabilityHit
        });
      }

      if (car.status === 'pit') {
        car.currentReliability = Math.min(100, car.currentReliability + 15);
        car.status = 'running';
      }

      car.progress = 1.0;
      car.lap = this.currentLap;
    }

    this.cars.sort((a, b) => b.currentReliability - a.currentReliability);

    this.emit('lap', {
      lap: this.currentLap,
      cars: this.cars.map((c, i) => ({
        id: c.id,
        team: c.team,
        reliability: Math.round(c.currentReliability),
        status: c.status,
        position: i + 1
      }))
    });

    this.currentLap++;
    if (this.currentLap <= this.lapCount) {
      this._tickTimer = setTimeout(() => this._runLap(), 3000);
    } else {
      this.cars.forEach((c, i) => { c.position = i + 1; });
      this.emit('end', { cars: this.cars });
    }
  }

  seededRandom(seed) {
    let m_w = seed;
    let m_z = 987654321;
    return () => {
      m_z = (36969 * (m_z & 65535) + (m_z >> 16)) & 0xffffffff;
      m_w = (18000 * (m_w & 65535) + (m_w >> 16)) & 0xffffffff;
      let result = ((m_z << 16) + (m_w & 65535)) >>> 0;
      result /= 4294967296;
      return result;
    };
  }
}
