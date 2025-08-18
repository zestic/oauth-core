/**
 * Core event emitter implementation for OAuth events
 * Provides type-safe event emission and subscription with memory leak prevention
 */

export type EventCallback<T extends unknown[] = unknown[]> = (...args: T) => void;
export type UnsubscribeFunction = () => void;

export interface EventEmitterOptions {
  maxListeners?: number;
  warnOnMaxListeners?: boolean;
}

/**
 * Generic event emitter with TypeScript support
 */
export class EventEmitter<TEventMap = Record<string, EventCallback>> {
  private listeners = new Map<string, Set<EventCallback>>();
  private onceListeners = new Map<string, Set<EventCallback>>();
  private maxListeners: number;
  private warnOnMaxListeners: boolean;

  constructor(options: EventEmitterOptions = {}) {
    this.maxListeners = options.maxListeners ?? 10;
    this.warnOnMaxListeners = options.warnOnMaxListeners ?? true;
  }

  /**
   * Add an event listener
   */
  on<TEvent extends keyof TEventMap>(
    event: TEvent,
    callback: TEventMap[TEvent]
  ): UnsubscribeFunction {
    const eventKey = String(event);
    if (!this.listeners.has(eventKey)) {
      this.listeners.set(eventKey, new Set());
    }

    const eventListeners = this.listeners.get(eventKey)!;
    eventListeners.add(callback as EventCallback);

    // Check for potential memory leaks
    if (this.warnOnMaxListeners && eventListeners.size > this.maxListeners) {
      console.warn(
        `EventEmitter: Possible memory leak detected. ${eventListeners.size} listeners added for event "${eventKey}". ` +
        `Consider checking for listener leaks or increasing maxListeners.`
      );
    }

    // Return unsubscribe function
    return () => this.off(event, callback);
  }

  /**
   * Add a one-time event listener
   */
  once<TEvent extends keyof TEventMap>(
    event: TEvent,
    callback: TEventMap[TEvent]
  ): UnsubscribeFunction {
    const eventKey = String(event);
    if (!this.onceListeners.has(eventKey)) {
      this.onceListeners.set(eventKey, new Set());
    }

    const eventListeners = this.onceListeners.get(eventKey)!;
    eventListeners.add(callback as EventCallback);

    // Return unsubscribe function
    return () => {
      eventListeners.delete(callback as EventCallback);
    };
  }

  /**
   * Remove an event listener
   */
  off<TEvent extends keyof TEventMap>(
    event: TEvent,
    callback: TEventMap[TEvent]
  ): void {
    const eventKey = String(event);
    const eventListeners = this.listeners.get(eventKey);
    if (eventListeners) {
      eventListeners.delete(callback as EventCallback);
      if (eventListeners.size === 0) {
        this.listeners.delete(eventKey);
      }
    }

    const onceListeners = this.onceListeners.get(eventKey);
    if (onceListeners) {
      onceListeners.delete(callback as EventCallback);
      if (onceListeners.size === 0) {
        this.onceListeners.delete(eventKey);
      }
    }
  }

  /**
   * Emit an event to all listeners
   */
  emit<TEvent extends keyof TEventMap>(
    event: TEvent,
    ...args: unknown[]
  ): boolean {
    const eventKey = String(event);
    let hasListeners = false;

    // Call regular listeners
    const eventListeners = this.listeners.get(eventKey);
    if (eventListeners && eventListeners.size > 0) {
      hasListeners = true;
      // Create a copy to avoid issues if listeners are modified during emission
      const listenersArray = Array.from(eventListeners);
      for (const callback of listenersArray) {
        try {
          callback(...args);
        } catch (error) {
          console.error(`EventEmitter: Error in listener for event "${eventKey}":`, error);
        }
      }
    }

    // Call once listeners and remove them
    const onceListeners = this.onceListeners.get(eventKey);
    if (onceListeners && onceListeners.size > 0) {
      hasListeners = true;
      // Create a copy and clear the set to avoid issues during emission
      const onceListenersArray = Array.from(onceListeners);
      onceListeners.clear();

      for (const callback of onceListenersArray) {
        try {
          callback(...args);
        } catch (error) {
          console.error(`EventEmitter: Error in once listener for event "${eventKey}":`, error);
        }
      }

      // Clean up empty set
      if (onceListeners.size === 0) {
        this.onceListeners.delete(eventKey);
      }
    }

    return hasListeners;
  }

  /**
   * Remove all listeners for a specific event or all events
   */
  removeAllListeners(event?: keyof TEventMap): void {
    if (event !== undefined) {
      const eventKey = String(event);
      this.listeners.delete(eventKey);
      this.onceListeners.delete(eventKey);
    } else {
      this.listeners.clear();
      this.onceListeners.clear();
    }
  }

  /**
   * Get the number of listeners for an event
   */
  listenerCount(event: keyof TEventMap): number {
    const eventKey = String(event);
    const regularCount = this.listeners.get(eventKey)?.size ?? 0;
    const onceCount = this.onceListeners.get(eventKey)?.size ?? 0;
    return regularCount + onceCount;
  }

  /**
   * Get all event names that have listeners
   */
  eventNames(): string[] {
    const regularEvents = Array.from(this.listeners.keys());
    const onceEvents = Array.from(this.onceListeners.keys());
    return Array.from(new Set([...regularEvents, ...onceEvents]));
  }

  /**
   * Get listeners for a specific event
   */
  getListeners<TEvent extends keyof TEventMap>(event: TEvent): TEventMap[TEvent][] {
    const eventKey = String(event);
    const regularListeners = Array.from(this.listeners.get(eventKey) ?? []);
    const onceListeners = Array.from(this.onceListeners.get(eventKey) ?? []);
    return [...regularListeners, ...onceListeners] as TEventMap[TEvent][];
  }

  /**
   * Set the maximum number of listeners before warning
   */
  setMaxListeners(maxListeners: number): void {
    this.maxListeners = maxListeners;
  }

  /**
   * Get the maximum number of listeners
   */
  getMaxListeners(): number {
    return this.maxListeners;
  }

  /**
   * Check if there are any listeners
   */
  hasListeners(event?: keyof TEventMap): boolean {
    if (event !== undefined) {
      return this.listenerCount(event) > 0;
    }
    return this.listeners.size > 0 || this.onceListeners.size > 0;
  }
}
