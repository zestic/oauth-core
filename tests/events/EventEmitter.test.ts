/**
 * Tests for EventEmitter
 */

import { EventEmitter } from '../../src/events/EventEmitter';

interface TestEventMap {
  'test': (message: string) => void;
  'data': (data: { id: number; name: string }) => void;
  'error': (error: Error) => void;
  'noArgs': () => void;
  'multipleArgs': (a: string, b: number, c: boolean) => void;
}

describe('EventEmitter', () => {
  let emitter: EventEmitter<TestEventMap>;

  beforeEach(() => {
    emitter = new EventEmitter<TestEventMap>();
  });

  afterEach(() => {
    emitter.removeAllListeners();
  });

  describe('Basic functionality', () => {
    it('should add and call event listeners', () => {
      const callback = jest.fn();
      emitter.on('test', callback);
      
      emitter.emit('test', 'hello');
      
      expect(callback).toHaveBeenCalledWith('hello');
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should handle multiple listeners for the same event', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      
      emitter.on('test', callback1);
      emitter.on('test', callback2);
      
      emitter.emit('test', 'hello');
      
      expect(callback1).toHaveBeenCalledWith('hello');
      expect(callback2).toHaveBeenCalledWith('hello');
    });

    it('should handle events with no arguments', () => {
      const callback = jest.fn();
      emitter.on('noArgs', callback);
      
      emitter.emit('noArgs');
      
      expect(callback).toHaveBeenCalledWith();
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should handle events with multiple arguments', () => {
      const callback = jest.fn();
      emitter.on('multipleArgs', callback);
      
      emitter.emit('multipleArgs', 'test', 42, true);
      
      expect(callback).toHaveBeenCalledWith('test', 42, true);
    });

    it('should handle complex data types', () => {
      const callback = jest.fn();
      const testData = { id: 123, name: 'test' };
      
      emitter.on('data', callback);
      emitter.emit('data', testData);
      
      expect(callback).toHaveBeenCalledWith(testData);
    });
  });

  describe('Unsubscribe functionality', () => {
    it('should return unsubscribe function from on()', () => {
      const callback = jest.fn();
      const unsubscribe = emitter.on('test', callback);
      
      expect(typeof unsubscribe).toBe('function');
      
      emitter.emit('test', 'before');
      expect(callback).toHaveBeenCalledTimes(1);
      
      unsubscribe();
      emitter.emit('test', 'after');
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should remove listeners with off()', () => {
      const callback = jest.fn();
      emitter.on('test', callback);
      
      emitter.emit('test', 'before');
      expect(callback).toHaveBeenCalledTimes(1);
      
      emitter.off('test', callback);
      emitter.emit('test', 'after');
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should only remove the specific callback', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      
      emitter.on('test', callback1);
      emitter.on('test', callback2);
      
      emitter.off('test', callback1);
      emitter.emit('test', 'hello');
      
      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).toHaveBeenCalledWith('hello');
    });
  });

  describe('Once functionality', () => {
    it('should call once listeners only once', () => {
      const callback = jest.fn();
      emitter.once('test', callback);
      
      emitter.emit('test', 'first');
      emitter.emit('test', 'second');
      
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith('first');
    });

    it('should return unsubscribe function from once()', () => {
      const callback = jest.fn();
      const unsubscribe = emitter.once('test', callback);
      
      unsubscribe();
      emitter.emit('test', 'hello');
      
      expect(callback).not.toHaveBeenCalled();
    });

    it('should handle multiple once listeners', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      
      emitter.once('test', callback1);
      emitter.once('test', callback2);
      
      emitter.emit('test', 'hello');
      
      expect(callback1).toHaveBeenCalledWith('hello');
      expect(callback2).toHaveBeenCalledWith('hello');
      
      emitter.emit('test', 'world');
      
      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error handling', () => {
    it('should catch and log errors in listeners', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const errorCallback = jest.fn(() => {
        throw new Error('Test error');
      });
      const normalCallback = jest.fn();
      
      emitter.on('test', errorCallback);
      emitter.on('test', normalCallback);
      
      emitter.emit('test', 'hello');
      
      expect(errorCallback).toHaveBeenCalled();
      expect(normalCallback).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error in listener for event "test"'),
        expect.any(Error)
      );
      
      consoleSpy.mockRestore();
    });

    it('should catch and log errors in once listeners', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const errorCallback = jest.fn(() => {
        throw new Error('Test error');
      });
      
      emitter.once('test', errorCallback);
      emitter.emit('test', 'hello');
      
      expect(errorCallback).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });
  });

  describe('Utility methods', () => {
    it('should return correct listener count', () => {
      expect(emitter.listenerCount('test')).toBe(0);
      
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      
      emitter.on('test', callback1);
      expect(emitter.listenerCount('test')).toBe(1);
      
      emitter.on('test', callback2);
      expect(emitter.listenerCount('test')).toBe(2);
      
      emitter.once('test', jest.fn());
      expect(emitter.listenerCount('test')).toBe(3);
      
      emitter.off('test', callback1);
      expect(emitter.listenerCount('test')).toBe(2);
    });

    it('should return event names', () => {
      expect(emitter.eventNames()).toEqual([]);
      
      emitter.on('test', jest.fn());
      emitter.on('data', jest.fn());
      emitter.once('error', jest.fn());
      
      const eventNames = emitter.eventNames();
      expect(eventNames).toContain('test');
      expect(eventNames).toContain('data');
      expect(eventNames).toContain('error');
      expect(eventNames).toHaveLength(3);
    });

    it('should check if has listeners', () => {
      expect(emitter.hasListeners()).toBe(false);
      expect(emitter.hasListeners('test')).toBe(false);
      
      emitter.on('test', jest.fn());
      
      expect(emitter.hasListeners()).toBe(true);
      expect(emitter.hasListeners('test')).toBe(true);
      expect(emitter.hasListeners('data')).toBe(false);
    });

    it('should return listeners for an event', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      emitter.on('test', callback1);
      emitter.once('test', callback2);

      // Note: listeners method is private, so we test through public interface
      expect(emitter.listenerCount('test')).toBe(2);
    });
  });

  describe('removeAllListeners', () => {
    it('should remove all listeners for a specific event', () => {
      emitter.on('test', jest.fn());
      emitter.on('test', jest.fn());
      emitter.on('data', jest.fn());
      
      expect(emitter.listenerCount('test')).toBe(2);
      expect(emitter.listenerCount('data')).toBe(1);
      
      emitter.removeAllListeners('test');
      
      expect(emitter.listenerCount('test')).toBe(0);
      expect(emitter.listenerCount('data')).toBe(1);
    });

    it('should remove all listeners for all events', () => {
      emitter.on('test', jest.fn());
      emitter.on('data', jest.fn());
      emitter.once('error', jest.fn());
      
      expect(emitter.hasListeners()).toBe(true);
      
      emitter.removeAllListeners();
      
      expect(emitter.hasListeners()).toBe(false);
      expect(emitter.eventNames()).toHaveLength(0);
    });
  });

  describe('Memory leak prevention', () => {
    it('should warn when max listeners exceeded', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const smallEmitter = new EventEmitter<TestEventMap>({ maxListeners: 2 });
      
      smallEmitter.on('test', jest.fn());
      smallEmitter.on('test', jest.fn());
      expect(consoleSpy).not.toHaveBeenCalled();
      
      smallEmitter.on('test', jest.fn());
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Possible memory leak detected')
      );
      
      consoleSpy.mockRestore();
    });

    it('should not warn when warnOnMaxListeners is false', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const smallEmitter = new EventEmitter<TestEventMap>({ 
        maxListeners: 1, 
        warnOnMaxListeners: false 
      });
      
      smallEmitter.on('test', jest.fn());
      smallEmitter.on('test', jest.fn());
      
      expect(consoleSpy).not.toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });

    it('should allow setting max listeners', () => {
      emitter.setMaxListeners(5);
      expect(emitter.getMaxListeners()).toBe(5);
    });
  });

  describe('Edge cases', () => {
    it('should handle removing non-existent listeners', () => {
      const callback = jest.fn();
      
      expect(() => {
        emitter.off('test', callback);
      }).not.toThrow();
    });

    it('should handle emitting events with no listeners', () => {
      const result = emitter.emit('test', 'hello');
      expect(result).toBe(false);
    });

    it('should return true when emitting to listeners', () => {
      emitter.on('test', jest.fn());
      const result = emitter.emit('test', 'hello');
      expect(result).toBe(true);
    });

    it('should handle concurrent modifications during emit', () => {
      const callbacks: Array<() => void> = [];
      
      // Create callbacks that modify the listener list during emission
      for (let i = 0; i < 5; i++) {
        const callback = jest.fn(() => {
          if (i < 3) {
            emitter.on('test', jest.fn());
          } else {
            emitter.off('test', callbacks[0]);
          }
        });
        callbacks.push(callback);
        emitter.on('test', callback);
      }
      
      expect(() => {
        emitter.emit('test', 'hello');
      }).not.toThrow();
      
      callbacks.forEach(callback => {
        expect(callback).toHaveBeenCalled();
      });
    });
  });
});
