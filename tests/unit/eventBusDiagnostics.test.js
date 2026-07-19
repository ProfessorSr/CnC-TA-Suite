import assert from 'node:assert/strict';
import { EventBus } from '../../core/events/eventBus.js';

const bus = new EventBus({ historyLimit: 2 });
let value = 0;
bus.on('test', (payload) => { value = payload; });
bus.emit('test', 7);
assert.equal(value, 7);
assert.equal(bus.snapshot().emitted, 1);
assert.equal(bus.snapshot().handled, 1);
assert.equal(bus.snapshot().listenerCount, 1);
console.log('eventBusDiagnostics.test.js passed');
