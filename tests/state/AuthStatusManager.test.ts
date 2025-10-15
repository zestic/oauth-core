/**
 * Tests for AuthStatusManager class
 */

import { AuthStatusManager } from '../../src/state/AuthStatusManager';
import type { OAuthEventMap } from '../../src/events/OAuthEvents';
import { EventEmitter } from '../../src/events/EventEmitter';

describe('AuthStatusManager', () => {
  let manager: AuthStatusManager;
  let mockEventEmitter: EventEmitter<OAuthEventMap>;

  beforeEach(() => {
    mockEventEmitter = new EventEmitter<OAuthEventMap>();
    manager = new AuthStatusManager(mockEventEmitter);
  });

  describe('initial state', () => {
    it('should start with unauthenticated status by default', () => {
      expect(manager.status).toBe('unauthenticated');
      expect(manager.isAuthenticated).toBe(false);
      expect(manager.isUnauthenticated).toBe(true);
    });

    it('should accept custom initial status', () => {
      const customManager = new AuthStatusManager(mockEventEmitter, {
        initialStatus: 'authenticated'
      });

      expect(customManager.status).toBe('authenticated');
      expect(customManager.isAuthenticated).toBe(true);
    });
  });

  describe('status setters', () => {
    it('should set status to authenticating', () => {
      manager.startAuthenticating();
      expect(manager.status).toBe('authenticating');
      expect(manager.isAuthenticating).toBe(true);
    });

    it('should set status to authenticated', () => {
      manager.setAuthenticated();
      expect(manager.status).toBe('authenticated');
      expect(manager.isAuthenticated).toBe(true);
    });

    it('should set status to unauthenticated', () => {
      manager.setAuthenticated();
      manager.setUnauthenticated();
      expect(manager.status).toBe('unauthenticated');
      expect(manager.isUnauthenticated).toBe(true);
    });

    it('should set status to error', () => {
      manager.setError();
      expect(manager.status).toBe('error');
      expect(manager.hasError).toBe(true);
    });

    it('should set status to expired', () => {
      manager.setExpired();
      expect(manager.status).toBe('expired');
      expect(manager.isExpired).toBe(true);
    });

    it('should set status to refreshing', () => {
      manager.startRefreshing();
      expect(manager.status).toBe('refreshing');
      expect(manager.isRefreshing).toBe(true);
    });
  });

  describe('convenience getters', () => {
    it('should provide boolean getters for all statuses', () => {
      expect(manager.isUnauthenticated).toBe(true);
      expect(manager.isAuthenticated).toBe(false);
      expect(manager.isAuthenticating).toBe(false);
      expect(manager.isRefreshing).toBe(false);
      expect(manager.isExpired).toBe(false);
      expect(manager.hasError).toBe(false);

      manager.setAuthenticated();
      expect(manager.isAuthenticated).toBe(true);
      expect(manager.isUnauthenticated).toBe(false);
    });
  });

  describe('event emission', () => {
    it('should emit authStatusChange event when status changes', () => {
      const emitSpy = jest.spyOn(mockEventEmitter, 'emit');

      manager.setAuthenticated();

      expect(emitSpy).toHaveBeenCalledWith('authStatusChange', 'authenticated', 'unauthenticated');
    });

    it('should not emit event when status is set to same value', () => {
      const emitSpy = jest.spyOn(mockEventEmitter, 'emit');

      manager.setStatus('unauthenticated'); // Same as current

      expect(emitSpy).not.toHaveBeenCalled();
    });

    it('should not emit events if disabled', () => {
      const noEmitManager = new AuthStatusManager(mockEventEmitter, {
        emitEvents: false
      });
      const emitSpy = jest.spyOn(mockEventEmitter, 'emit');

      noEmitManager.setAuthenticated();

      expect(emitSpy).not.toHaveBeenCalled();
    });
  });

  describe('setStatus method', () => {
    it('should update status and emit event', () => {
      const emitSpy = jest.spyOn(mockEventEmitter, 'emit');

      manager.setStatus('authenticated');

      expect(manager.status).toBe('authenticated');
      expect(emitSpy).toHaveBeenCalledWith('authStatusChange', 'authenticated', 'unauthenticated');
    });

    it('should handle all status types', () => {
      const statuses: Array<'unauthenticated' | 'authenticating' | 'authenticated' | 'refreshing' | 'expired' | 'error'> = [
        'unauthenticated', 'authenticating', 'authenticated', 'refreshing', 'expired', 'error'
      ];

      for (const status of statuses) {
        manager.setStatus(status);
        expect(manager.status).toBe(status);
      }
    });
  });

  describe('status descriptions', () => {
    it('should provide human-readable descriptions', () => {
      manager.setAuthenticated();
      expect(manager.getStatusDescription()).toBe('Successfully authenticated');

      manager.setError();
      expect(manager.getStatusDescription()).toBe('Authentication error occurred');

      manager.setExpired();
      expect(manager.getStatusDescription()).toBe('Authentication tokens have expired');
    });
  });

  describe('operation permissions', () => {
    it('should allow login when unauthenticated or error', () => {
      expect(manager.canPerformOperation('login')).toBe(true);

      manager.setError();
      expect(manager.canPerformOperation('login')).toBe(true);

      manager.setAuthenticated();
      expect(manager.canPerformOperation('login')).toBe(false);
    });

    it('should allow logout when authenticated or expired', () => {
      manager.setAuthenticated();
      expect(manager.canPerformOperation('logout')).toBe(true);

      manager.setExpired();
      expect(manager.canPerformOperation('logout')).toBe(true);

      manager.setUnauthenticated();
      expect(manager.canPerformOperation('logout')).toBe(false);
    });

    it('should allow refresh when authenticated or expired', () => {
      manager.setAuthenticated();
      expect(manager.canPerformOperation('refresh')).toBe(true);

      manager.setExpired();
      expect(manager.canPerformOperation('refresh')).toBe(true);

      manager.setError();
      expect(manager.canPerformOperation('refresh')).toBe(false);
    });
  });

  describe('reset', () => {
    it('should reset to unauthenticated status', () => {
      manager.setAuthenticated();
      expect(manager.status).toBe('authenticated');

      manager.reset();
      expect(manager.status).toBe('unauthenticated');
    });
  });

  describe('without event emitter', () => {
    it('should work without event emitter', () => {
      const managerNoEvents = new AuthStatusManager();

      managerNoEvents.setAuthenticated();
      expect(managerNoEvents.status).toBe('authenticated');
    });
  });
});