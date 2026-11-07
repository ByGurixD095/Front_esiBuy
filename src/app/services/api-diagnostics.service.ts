import { Injectable } from '@angular/core';

export interface ApiDiagnostic {
  timestamp: string;
  requestId: string;
  method: string;
  endpoint: string;
  status: number;
  category: string;
  durationMs?: number;
  credentialsIncluded?: boolean;
  csrfHeaderPresent?: boolean;
}

/** Registro local y sanitizado para diagnosticar fallos del API desde DevTools. */
@Injectable({ providedIn: 'root' })
export class ApiDiagnosticsService {
  private readonly recent: ApiDiagnostic[] = [];
  private readonly maxEntries = 50;

  record(diagnostic: ApiDiagnostic): void {
    this.recent.push(diagnostic);
    if (this.recent.length > this.maxEntries) this.recent.shift();
    console.warn('[EsiBuy API]', diagnostic);
  }

  getRecent(): readonly ApiDiagnostic[] {
    return [...this.recent];
  }

  clear(): void {
    this.recent.length = 0;
  }
}
