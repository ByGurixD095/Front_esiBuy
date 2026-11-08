import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService, Rol } from '../../services/auth.service';
import { MfaAuth } from '../mfa-auth/mfa-auth';
import { MarcoPagina } from '../marco-pagina/marco-pagina';

@Component({
  selector: 'app-inicio-sesion',
  imports: [ReactiveFormsModule, MfaAuth, MarcoPagina, RouterLink],
  templateUrl: './inicio-sesion.html',
  styleUrl: './inicio-sesion.css',
})
export class InicioSesion {
  private readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly iniciarSesion = output<{ username: string; password: string }>();

  readonly form = new FormGroup({
    usuario: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    contrasena: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  readonly mostrarContrasena = signal(false);
  readonly fase = signal<'login' | 'setup' | 'verify' | 'backup'>('login');
  readonly cargando = signal(false);
  readonly mensajeError = signal('');
  readonly emailMfa = signal('');
  readonly mfaSetupToken = signal('');
  readonly qrCodeUri = signal('');
  readonly manualSecretKey = signal('');
  readonly backupCodes = signal<string[]>([]);
  readonly emailOtpRequired = signal(false);

  constructor() {
    const emailRegistro = this.route.snapshot.queryParamMap.get('email');
    if (emailRegistro) {
      this.form.controls.usuario.setValue(emailRegistro);
    }
  }

  alternarContrasena(): void {
    this.mostrarContrasena.update((visible) => !visible);
  }

  enviar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { usuario, contrasena } = this.form.getRawValue();
    this.iniciarSesion.emit({ username: usuario, password: contrasena });
    this.mensajeError.set('');
    this.cargando.set(true);

    this.authService.login({ username: usuario, password: contrasena }).subscribe({
      next: (respuesta) => {
        this.cargando.set(false);
        this.emailMfa.set(respuesta.email ?? usuario);
        this.emailOtpRequired.set(
          respuesta.emailOtpRequired === true ||
            respuesta.rol === 'ADMINISTRADOR' ||
            respuesta.rol === 'VENDEDOR',
        );

        if (respuesta.mfaStatus === 'SUCCESS') {
          this.navegarTrasLogin(respuesta.rol);
        } else if (respuesta.mfaStatus === 'REQUIRES_MFA_SETUP' && respuesta.mfaSetupToken) {
          this.mfaSetupToken.set(respuesta.mfaSetupToken);
          this.fase.set('setup');
          this.inicializarConfiguracionMfa();
        } else if (respuesta.mfaStatus === 'REQUIRES_MFA_VERIFICATION') {
          this.fase.set('verify');
        } else {
          this.mensajeError.set('El servidor devolvió un estado de autenticación no reconocido.');
        }
      },
      error: (error: HttpErrorResponse) => {
        this.cargando.set(false);
        this.mensajeError.set(
          this.authService.errorMessage(
            error,
            'No se ha podido iniciar sesión. Revisa tus credenciales.',
          ),
        );
      },
    });
  }

  confirmarConfiguracion(code: string): void {
    this.cargando.set(true);
    this.mensajeError.set('');
    this.authService
      .confirmMfaSetup({
        email: this.emailMfa(),
        code,
        setupToken: this.mfaSetupToken(),
      })
      .subscribe({
        next: (respuesta) => {
          this.cargando.set(false);
          this.backupCodes.set(respuesta.backupCodes);
          this.fase.set('backup');
        },
        error: (error: HttpErrorResponse) => {
          this.cargando.set(false);
          this.mensajeError.set(
            this.authService.errorMessage(error, 'No se ha podido confirmar el código TOTP.'),
          );
        },
      });
  }

  verificarMfa(codigos: { totpCode: string; emailOtpCode: string }): void {
    this.cargando.set(true);
    this.mensajeError.set('');
    this.authService.verifyMfa({ email: this.emailMfa(), ...codigos }).subscribe({
      next: (respuesta) => {
        this.cargando.set(false);
        this.navegarTrasLogin(respuesta.rol);
      },
      error: (error: HttpErrorResponse) => {
        this.cargando.set(false);
        this.mensajeError.set(
          this.authService.errorMessage(error, 'No se han podido validar los códigos.'),
        );
      },
    });
  }

  finalizarRespaldo(): void {
    this.reiniciarFlujo();
  }

  private inicializarConfiguracionMfa(): void {
    this.authService.initializeMfaSetup(this.emailMfa(), this.mfaSetupToken()).subscribe({
      next: (respuesta) => {
        this.qrCodeUri.set(respuesta.qrCodeUri);
        this.manualSecretKey.set(respuesta.manualSecretKey);
      },
      error: (error: HttpErrorResponse) => {
        this.mensajeError.set(
          this.authService.errorMessage(error, 'No se ha podido preparar la configuración MFA.'),
        );
      },
    });
  }

  private reiniciarFlujo(): void {
    this.fase.set('login');
    this.form.reset();
    this.mensajeError.set('');
    this.backupCodes.set([]);
    this.emailOtpRequired.set(false);
  }

  private navegarTrasLogin(rol: Rol): void {
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
    const destinoPorDefecto = rol === 'ADMINISTRADOR' ? '/' : '/products';
    const destino =
      returnUrl?.startsWith('/') && !returnUrl.startsWith('//') && !returnUrl.includes('\\')
        ? this.router.parseUrl(returnUrl)
        : this.router.parseUrl(destinoPorDefecto);

    void this.router.navigateByUrl(destino);
  }
}
