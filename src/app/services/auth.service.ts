import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, catchError, map, of, shareReplay, tap } from 'rxjs';
import { environment } from '../../environments/environment';

export type Rol = 'ADMINISTRADOR' | 'VENDEDOR' | 'CLIENTE';
export type MfaStatus =
  | 'SUCCESS'
  | 'REQUIRES_MFA_SETUP'
  | 'REQUIRES_MFA_VERIFICATION'
  | 'PENDING_ACTIVATION';

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string | null;
  refreshToken: string | null;
  rol: Rol;
  tipoCliente: string | null;
  mfaStatus: MfaStatus;
  email: string | null;
  mfaSetupToken: string | null;
}

export interface MfaSetupResponse {
  qrCodeUri: string;
  manualSecretKey: string;
}

export interface MfaBackupCodesResponse {
  backupCodes: string[];
  mensaje: string;
}

export interface MfaVerifyRequest {
  email: string;
  totpCode: string;
  emailOtpCode: string;
}

export interface MfaSetupConfirmRequest {
  email: string;
  code: string;
  setupToken: string;
}

export interface MfaConfigRequest {
  enable2fa: boolean;
  enable3fa: boolean;
}

interface SessionProfile {
  rol: Rol;
  email: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly rolSignal = signal<Rol | null>(null);
  private readonly emailSignal = signal<string | null>(null);
  private readonly sessionCheckedSignal = signal(false);
  private sessionCheck$: Observable<SessionProfile | null> | null = null;

  readonly rol = this.rolSignal.asReadonly();
  readonly email = this.emailSignal.asReadonly();
  readonly sessionChecked = this.sessionCheckedSignal.asReadonly();

  login(datos: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${environment.apiUrl}/users/login`, datos).pipe(
      tap((respuesta) => this.storeSessionIfComplete(respuesta)),
    );
  }

  initializeMfaSetup(email: string, setupToken: string): Observable<MfaSetupResponse> {
    return this.http.post<MfaSetupResponse>(`${environment.apiUrl}/mfa/setup-init`, {
      email,
      setupToken,
    });
  }

  confirmMfaSetup(datos: MfaSetupConfirmRequest): Observable<MfaBackupCodesResponse> {
    return this.http.post<MfaBackupCodesResponse>(
      `${environment.apiUrl}/mfa/setup-confirm`,
      datos,
    );
  }

  verifyMfa(datos: MfaVerifyRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${environment.apiUrl}/mfa/verify-mfa`, datos).pipe(
      tap((respuesta) => this.storeSessionIfComplete(respuesta)),
    );
  }

  configureMfa(datos: MfaConfigRequest): Observable<void> {
    return this.http.post<void>(`${environment.apiUrl}/mfa/config`, datos);
  }

  refresh(): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${environment.apiUrl}/users/refresh`, {}).pipe(
    
      tap((respuesta) => this.storeSessionIfComplete(respuesta)),
    );
  }

  checkSessionOnLoad(): Observable<SessionProfile | null> {
    if (this.sessionCheck$) {
      return this.sessionCheck$;
    }

    this.sessionCheck$ = this.http.get<SessionProfile>(`${environment.apiUrl}/users/me`).pipe(
      tap((perfil) => {
        this.storeSessionFromProfile(perfil);
        this.sessionCheckedSignal.set(true);
      }),
      catchError(() => {
        this.clearSession();
        return of(null);
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );

    return this.sessionCheck$;
  }

  logout(): Observable<void> {
    return this.http.post<void>(`${environment.apiUrl}/users/logout`, {}).pipe(
      tap(() => this.clearSession()),
    );
  }

  applyAuthenticationResponse(respuesta: LoginResponse): void {
    this.storeSessionIfComplete(respuesta);
  }

  isAuthenticated(): boolean {
    return this.rolSignal() !== null;
  }

  hasRole(roles: readonly Rol[]): boolean {
    const rol = this.rolSignal();
    return rol !== null && roles.includes(rol);
  }

  clearSession(): void {
    this.rolSignal.set(null);
    this.emailSignal.set(null);
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem('esiBuy.rol');
      sessionStorage.removeItem('esiBuy.email');
      sessionStorage.removeItem('esiBuy.expiresAt');
    }
    this.sessionCheckedSignal.set(true);
  }

  errorMessage(error: HttpErrorResponse, fallback: string): string {
    if (error.status === 0) {
      return 'No se ha podido conectar con el servidor.';
    }
    const message = error.error?.message ?? error.error?.mensaje;
    return typeof message === 'string' && message.length > 0 ? message : fallback;
  }

  isAccessTokenExpired(): boolean {
    if (typeof sessionStorage === 'undefined') return false;
    const expStr = sessionStorage.getItem('esiBuy.expiresAt');
    if (!expStr) return false;
    const expiresAt = Number(expStr);
    // Damos un margen de seguridad de 5 segundos antes de la caducidad real
    return !Number.isFinite(expiresAt) || Date.now() > expiresAt - 5000;
  }

  private getTokenExpiration(token: string): number {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp * 1000; // Convertir a milisegundos
    } catch (e) {
      return 0;
    }
  }

private storeSessionIfComplete(respuesta: LoginResponse): void {
    if (respuesta.mfaStatus !== 'SUCCESS') {
      return;
    }
    this.rolSignal.set(respuesta.rol);
    this.emailSignal.set(respuesta.email);

    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('esiBuy.rol', respuesta.rol);
      if (respuesta.email) {
        sessionStorage.setItem('esiBuy.email', respuesta.email);
      }
      if (respuesta.accessToken) {
        const exp = this.getTokenExpiration(respuesta.accessToken);
        if (exp > 0) {
          sessionStorage.setItem('esiBuy.expiresAt', exp.toString());
        }
      }
    }
  }


  private storeSessionFromProfile(perfil: SessionProfile): void {
    this.rolSignal.set(perfil.rol);
    this.emailSignal.set(perfil.email);
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('esiBuy.rol', perfil.rol);
      sessionStorage.setItem('esiBuy.email', perfil.email);
    }
  }

}
