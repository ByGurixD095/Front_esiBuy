import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MarcoPagina } from '../marco-pagina/marco-pagina';
import { AuthService, Rol } from '../../services/auth.service';
import {
  ActualizarPerfilRequest,
  PerfilService,
  PerfilUsuario,
  TipoCliente,
} from '../../services/perfil.service';
import { AvatarSelector, avatarAleatorio } from '../avatar-selector/avatar-selector';
import { CloudinaryService } from '../../services/cloudinary.service';
import { environment } from '../../../environments/environment';

const NO_VACIO = /\S/;
const TELEFONO_PATTERN = /^\d{9}$/;

@Component({
  selector: 'app-cuenta',
  imports: [MarcoPagina, ReactiveFormsModule, AvatarSelector],
  templateUrl: './cuenta.html',
  styleUrl: './cuenta.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Cuenta {
  private readonly auth = inject(AuthService);
  private readonly perfilService = inject(PerfilService);
  private readonly router = inject(Router);
  private readonly cloudinary = inject(CloudinaryService);
  readonly archivoAvatar = signal<File | null>(null);

  readonly rol = this.auth.rol;
  readonly esPerfilEditable = computed(() => {
    const rol = this.rol();
    return rol === 'ADMINISTRADOR' || rol === 'CLIENTE' || rol === 'VENDEDOR';
  });
  readonly perfil = signal<PerfilUsuario | null>(null);
  readonly cargando = signal(false);
  readonly guardando = signal(false);
  readonly mensajeExito = signal('');
  readonly mensajeError = signal('');
  readonly confirmandoCierreSesion = signal(false);
  readonly cerrandoSesion = signal(false);
  readonly errorCierreSesion = signal('');
  readonly confirmandoEliminacion = signal(false);
  readonly eliminandoCuenta = signal(false);
  readonly errorEliminacion = signal('');
  readonly puedeEliminarCuenta = computed(() => this.rol() !== null);
  readonly configurandoMfa = signal(false);
  readonly mensajeMfa = signal('');
  readonly errorMfa = signal('');

  readonly mfaForm = new FormGroup({
    enable2fa: new FormControl(false, { nonNullable: true }),
    enable3fa: new FormControl(false, { nonNullable: true }),
  });

  readonly form = new FormGroup({
    nombre: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(NO_VACIO)],
    }),
    apellidos: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(NO_VACIO)],
    }),
    telefono: new FormControl('', {
      nonNullable: true,
      validators: [Validators.pattern(TELEFONO_PATTERN)],
    }),
    imagenPerfil: new FormControl('', { nonNullable: true }),
    tipoCliente: new FormControl<TipoCliente>('NORMAL', { nonNullable: true }),
    sede: new FormControl('', { nonNullable: true }),
    nombreComercial: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(NO_VACIO)],
    }),
    categoriaPrincipalId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(NO_VACIO)],
    }),
  });

  constructor() {
    if (this.esPerfilEditable()) {
      if (this.rol() === 'CLIENTE' || this.rol() === 'ADMINISTRADOR') {
        this.form.controls.nombreComercial.disable();
        this.form.controls.categoriaPrincipalId.disable();
      }
      if (this.rol() === 'ADMINISTRADOR') {
        this.form.controls.tipoCliente.disable();
      }
      this.cargarPerfil();
    }
  }

  cargarPerfil(): void {
    if (!this.esPerfilEditable() || this.cargando()) {
      return;
    }
    this.cargando.set(true);
    this.mensajeError.set('');

    this.perfilService.obtenerMiPerfil().subscribe({
      next: (perfil) => {
        this.perfil.set(perfil);
        this.form.patchValue({
          nombre: perfil.name,
          apellidos: perfil.apellidos,
          telefono: perfil.telefono ?? '',
          imagenPerfil: perfil.imagenPerfil ?? '',
          tipoCliente: perfil.tipoCliente ?? 'NORMAL',
          sede: perfil.sede ?? '',
          nombreComercial: perfil.nombreComercial ?? '',
          categoriaPrincipalId: perfil.categoriaPrincipalId ?? '',
        });
        this.mfaForm.patchValue({
          enable2fa: perfil.dosFactorActivoCliente ?? false,
          enable3fa: perfil.tresFactorActivoCliente ?? false,
        });
        this.cargando.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.cargando.set(false);
        this.mensajeError.set(
          this.auth.errorMessage(error, 'No se han podido cargar los datos del perfil.'),
        );
      },
    });
  }

  guardar(): void {
    if (this.cargando() || this.guardando() || this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const rol = this.rol();
    if (rol !== 'ADMINISTRADOR' && rol !== 'CLIENTE' && rol !== 'VENDEDOR') {
      return;
    }

    this.guardando.set(true);
    this.mensajeError.set('');
    this.mensajeExito.set('');

    const archivo = this.archivoAvatar();
    if (archivo) {
      this.cloudinary.subirImagen(archivo, environment.carpetaAvatares).subscribe({
        next: (url) => this.ejecutarGuardado(url, rol),
        error: () => {
          this.mensajeError.set('Error al subir la imagen de perfil.');
          this.guardando.set(false);
        },
      });
    } else {
      let imagenFinal = this.form.controls.imagenPerfil.value.trim();
      if (!imagenFinal || imagenFinal.startsWith('data:image')) {
        imagenFinal = avatarAleatorio(rol === 'VENDEDOR');
      }
      this.ejecutarGuardado(imagenFinal, rol);
    }
  }

  private ejecutarGuardado(imagenFinal: string, rol: string): void {
    this.form.controls.imagenPerfil.setValue(imagenFinal);
    const valores = this.form.getRawValue();
    const datosEspecificos: Partial<ActualizarPerfilRequest> = {};

    if (rol === 'CLIENTE') {
      datosEspecificos.tipoCliente = valores.tipoCliente;
    } else if (rol === 'ADMINISTRADOR') {
      datosEspecificos.sede = valores.sede.trim();
    } else if (rol === 'VENDEDOR') {
      datosEspecificos.nombreComercial = valores.nombreComercial.trim();
      datosEspecificos.categoriaPrincipalId = valores.categoriaPrincipalId.trim();
    }

    const datos: ActualizarPerfilRequest = {
      nombre: valores.nombre.trim(),
      apellidos: valores.apellidos.trim(),
      ...(valores.telefono.trim() ? { telefono: valores.telefono.trim() } : {}),
      imagenPerfil: imagenFinal,
      ...datosEspecificos,
    };

    this.perfilService.actualizarMiPerfil(datos).subscribe({
      next: () => {
        this.aplicarCambiosLocales(datos, rol as Rol);
        this.guardando.set(false);
        this.mensajeExito.set('Los datos de tu perfil se han actualizado.');
      },
      error: (error: HttpErrorResponse) => {
        this.guardando.set(false);
        this.mensajeError.set(
          this.auth.errorMessage(error, 'No se han podido guardar los cambios del perfil.'),
        );
      },
    });
  }

  esInvalido(campo: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[campo];
    return control.invalid && (control.touched || control.dirty);
  }

  guardarConfiguracionMfa(): void {
    if (this.configurandoMfa()) {
      return;
    }

    this.configurandoMfa.set(true);
    this.mensajeMfa.set('');
    this.errorMfa.set('');
    this.auth.configureMfa(this.mfaForm.getRawValue()).subscribe({
      next: () => {
        this.configurandoMfa.set(false);
        this.mensajeMfa.set('La configuración de factores se ha actualizado.');
      },
      error: (error: HttpErrorResponse) => {
        this.configurandoMfa.set(false);
        this.errorMfa.set(
          this.auth.errorMessage(error, 'No se ha podido actualizar la configuración de factores.'),
        );
      },
    });
  }

  cerrarSesion(): void {
    this.errorCierreSesion.set('');
    this.confirmandoCierreSesion.set(true);
  }

  cancelarCierreSesion(): void {
    if (!this.cerrandoSesion()) {
      this.errorCierreSesion.set('');
      this.confirmandoCierreSesion.set(false);
    }
  }

  confirmarCierreSesion(): void {
    if (!this.confirmandoCierreSesion() || this.cerrandoSesion()) {
      return;
    }

    this.cerrandoSesion.set(true);
    this.auth.logout().subscribe({
      next: () => {
        this.confirmandoCierreSesion.set(false);
        void this.router.navigate(['/']);
      },
      error: (error: HttpErrorResponse) => {
        this.cerrandoSesion.set(false);
        this.errorCierreSesion.set(
          this.auth.errorMessage(error, 'No se ha podido cerrar la sesión. Inténtalo de nuevo.'),
        );
      },
    });
  }

  solicitarEliminacionCuenta(): void {
    this.errorEliminacion.set('');
    this.confirmandoEliminacion.set(true);
  }

  cancelarEliminacionCuenta(): void {
    if (!this.eliminandoCuenta()) {
      this.confirmandoEliminacion.set(false);
      this.errorEliminacion.set('');
    }
  }

  eliminarMiCuenta(): void {
    if (!this.confirmandoEliminacion() || this.eliminandoCuenta()) {
      return;
    }

    this.eliminandoCuenta.set(true);
    this.errorEliminacion.set('');
    this.perfilService.eliminarMiCuenta().subscribe({
      next: () => {
        this.auth.clearSession();
        void this.router.navigate(['/']);
      },
      error: (error: HttpErrorResponse) => {
        this.eliminandoCuenta.set(false);
        this.errorEliminacion.set(
          this.auth.errorMessage(error, 'No se ha podido eliminar la cuenta. Inténtalo de nuevo.'),
        );
      },
    });
  }

  private aplicarCambiosLocales(datos: ActualizarPerfilRequest, rol: Rol): void {
    const datosEspecificos: Partial<PerfilUsuario> = {};
    if (rol === 'CLIENTE') {
      datosEspecificos.tipoCliente = datos.tipoCliente;
    } else if (rol === 'ADMINISTRADOR') {
      datosEspecificos.sede = datos.sede;
    } else if (rol === 'VENDEDOR') {
      datosEspecificos.nombreComercial = datos.nombreComercial;
      datosEspecificos.categoriaPrincipalId = datos.categoriaPrincipalId;
    }

    this.perfil.update((perfil) => {
      if (!perfil) {
        return perfil;
      }

      return {
        ...perfil,
        name: datos.nombre || perfil.name,
        apellidos: datos.apellidos || perfil.apellidos,
        telefono: datos.telefono || perfil.telefono,
        imagenPerfil: datos.imagenPerfil || perfil.imagenPerfil,
        ...datosEspecificos,
      };
    });
  }
}
