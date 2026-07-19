import { EventBus } from '../../core/events/eventBus.js';

export function runEventBusUnitTest() {
  const bus = new EventBus();
  let received = null;
  bus.on('test', (payload) => { received = payload; });
  bus.emit('test', 42);
  if (received !== 42) throw new Error('EventBus unit test failed.');
  return true;
}
