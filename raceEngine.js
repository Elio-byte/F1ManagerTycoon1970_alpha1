const EventEmitter = require('events');

class RaceEngine extends EventEmitter {
  constructor(cars, lapCount) {
    super();
    this.cars = cars;
    this.lapCount = lapCount;
    this.currentLap = 1;
    this._stopped = false;
    this._tickTimer = null;
  }

  startRace() {
    this._stopped = false;
    this._runLap();
  }

  stop() {
    this._stopped = true;
    if (this._tickTimer) clearTimeout(this._tickTimer);
  }

  _runLap() {
    if (this._stopped) return;
    // Simulate each car for this lap
    for (const car of this.cars) {
      if (car.status !== 'running') continue;
      // compute wear and reliability
      const baseWear = 0.2; // percent per lap
      const wear = baseWear * (1 + car.aggression * 0.8);
      const reliabilityLoss = wear * (1 + Math.random() * 0.2);
      car.currentReliability = Math.max(0, car.currentReliability - reliabilityLoss);

      // event roll
      const failureChance = Math.max(0.01, (100 - car.currentReliability) / 100 * 0.08);
      if (Math.random() < failureChance) {
        const severity = Math.floor(Math.random() * 3); // 0,1,2
        const reliabilityHit = [5, 15, 35][severity];
        car.currentReliability = Math.max(0, car.currentReliability - reliabilityHit);
        if (severity === 2) car.status = 'retired';
        this.emit('event', { lap: this.currentLap, carId: car.id, team: car.team, type: 'mechanical', severity, reliabilityHit });
      }

      // progress and lap bookkeeping
      car.progress = 1.0; // completed lap
      car.lap = this.currentLap;
    }

    this.emit('lapComplete', { lap: this.currentLap, cars: this.cars.map(c => ({ id: c.id, team: c.team, reliability: Math.round(c.currentReliability), status: c.status })) });

    this.currentLap++;
    if (this.currentLap <= this.lapCount) {
      // small delay between laps to make demo visible
      this._tickTimer = setTimeout(() => this._runLap(), 1500);
    } else {
      this.emit('raceEnd', { cars: this.cars });
    }
  }
}

module.exports = RaceEngine;
