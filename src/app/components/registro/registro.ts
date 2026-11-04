import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService, LoginResponse } from '../../services/auth.service';
import { Categoria, Categorias } from '../../services/categorias.service';
import { Registro as RegistroService } from '../../services/registro-service/registro';
import { AvatarSelector, avatarAleatorio } from '../avatar-selector/avatar-selector';
import { MarcoPagina } from '../marco-pagina/marco-pagina';
import { CloudinaryService } from '../../services/cloudinary.service';
import { environment } from '../../../environments/environment';

type TipoRegistro = 'cliente' | 'vendedor';

const NO_VACIO = /\S/;
const PATRON_CONTRASENA = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).+$/;

function fechaAnteriorAHoy(fecha: string): boolean {
  if (!fecha) {
    return false;
  }
  const hoy = new Date();
  const fechaLocal = new Date(`${fecha}T00:00:00`);
  hoy.setHours(0, 0, 0, 0);
  return !Number.isNaN(fechaLocal.getTime()) && fechaLocal < hoy;
}

function validarMayorDeEdad(control: AbstractControl): ValidationErrors | null {
  if (!control.value) {
    return null;
  }

  const fechaNacimiento = new Date(`${control.value}T00:00:00`);
  if (Number.isNaN(fechaNacimiento.getTime())) {
    return { fechaInvalida: true };
  }

  const fechaLimite = new Date();
  fechaLimite.setFullYear(fechaLimite.getFullYear() - 18);
  fechaLimite.setHours(0, 0, 0, 0);
  return fechaNacimiento <= fechaLimite ? null : { menorDeEdad: true };
}

function validarDatosPersonales(control: AbstractControl): ValidationErrors | null {
  const form = control.parent;
  if (!form) return null;

  const contrasena = control.value?.toLowerCase() || '';
  if (!contrasena) return null;

  const nombre = form.get('nombre')?.value?.toLowerCase();
  const email = form.get('email')?.value?.toLowerCase();

  // Comprueba que no incluya el nombre (mínimo 3 letras para evitar falsos positivos)
  if (nombre && nombre.length > 2 && contrasena.includes(nombre)) {
    return { contieneNombre: true };
  }
  
  // Comprueba que no incluya la parte local del correo
  if (email) {
    const parteLocal = email.split('@')[0];
    if (parteLocal.length > 2 && contrasena.includes(parteLocal)) {
      return { contieneEmail: true };
    }
  }
  return null;
}

@Component({
  selector: 'app-registro',
  imports: [ReactiveFormsModule, MarcoPagina, RouterLink, AvatarSelector],
  templateUrl: './registro.html',
  styleUrl: './registro.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegistroComponent implements OnInit {
  private readonly registroService = inject(RegistroService);
  private readonly authService = inject(AuthService);
  private readonly categoriasService = inject(Categorias);
  private readonly router = inject(Router);
  private readonly cloudinary = inject(CloudinaryService);
  readonly archivoAvatar = signal<File | null>(null);
  readonly tipo: TipoRegistro =
    inject(ActivatedRoute).snapshot.data['tipoRegistro'] === 'vendedor' ? 'vendedor' : 'cliente';
  readonly esVendedor = this.tipo === 'vendedor';
  readonly mensajeExito = signal('');
  readonly mensajeError = signal('');
  readonly enviando = signal(false);
  readonly cuentaCreada = signal(false);
  readonly puedeReintentarLogin = signal(false);
  readonly fechaMaxima = this.fechaDeHoy();
  readonly categorias = signal<Categoria[]>([]);
  readonly cargandoCategorias = signal(false);
  readonly errorCategorias = signal('');

  readonly form = new FormGroup({
    nombre: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(NO_VACIO)],
    }),
    apellidos: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(NO_VACIO)],
    }),
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    contrasena: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.minLength(8),
        Validators.maxLength(72),
        Validators.pattern(PATRON_CONTRASENA),
        validarDatosPersonales
      ],
    }),
    confirmarContrasena: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    telefono: new FormControl('', { nonNullable: true }),
    imagenPerfil: new FormControl('', { nonNullable: true }),
    dni: new FormControl('', { nonNullable: true }),
    fechaNacimiento: new FormControl('', { nonNullable: true }),
    nombreComercial: new FormControl('', { nonNullable: true }),
    cifNif: new FormControl('', { nonNullable: true }),
    categoriaPrincipalId: new FormControl('', { nonNullable: true }),
  });

  constructor() {
    if (this.esVendedor) {
      this.form.controls.nombreComercial.addValidators([
        Validators.required,
        Validators.pattern(NO_VACIO),
      ]);
      this.form.controls.cifNif.addValidators([Validators.required, Validators.pattern(NO_VACIO)]);
      this.form.controls.categoriaPrincipalId.addValidators([
        Validators.required,
        Validators.pattern(NO_VACIO),
      ]);
      this.form.controls.nombreComercial.updateValueAndValidity();
      this.form.controls.cifNif.updateValueAndValidity();
      this.form.controls.categoriaPrincipalId.updateValueAndValidity();
      this.form.controls.dni.disable();
      this.form.controls.fechaNacimiento.disable();
    } else {
      this.form.controls.dni.addValidators([Validators.required, Validators.pattern(NO_VACIO)]);
      this.form.controls.fechaNacimiento.addValidators([
        Validators.required,
        (control) => (fechaAnteriorAHoy(control.value) ? null : { past: true }),
        validarMayorDeEdad,
      ]);
      this.form.controls.dni.updateValueAndValidity();
      this.form.controls.fechaNacimiento.updateValueAndValidity();
      this.form.controls.nombreComercial.disable();
      this.form.controls.cifNif.disable();
      this.form.controls.categoriaPrincipalId.disable();
    }
    this.form.updateValueAndValidity();
  }

  ngOnInit(): void {
    if (this.esVendedor) {
      this.cargarCategorias();
    }
  }

  cargarCategorias(): void {
    this.cargandoCategorias.set(true);
    this.errorCategorias.set('');
    this.categoriasService.listar().subscribe({
      next: (categorias) => {
        this.categorias.set(categorias);
        this.cargandoCategorias.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.errorCategorias.set(
          error.status === 0
            ? 'No se ha podido conectar con el servidor para cargar las categorías.'
            : `No se han podido cargar las categorías (HTTP ${error.status}).`,
        );
        this.cargandoCategorias.set(false);
      },
    });
  }

  enviar(): void {
    if (this.enviando() || this.cuentaCreada()) {
      return;
    }

    this.form.controls.confirmarContrasena.setErrors(
      this.form.controls.contrasena.value === this.form.controls.confirmarContrasena.value
        ? null
        : { noCoinciden: true },
    );

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.mensajeExito.set('');
    this.mensajeError.set('');
    this.enviando.set(true);

    const archivo = this.archivoAvatar();
    if (archivo) {
      this.cloudinary.subirImagen(archivo, environment.carpetaAvatares).subscribe({
        next: (url) => this.ejecutarRegistro(url),
        error: () => {
          this.mensajeError.set('Error al subir la imagen de perfil.');
          this.enviando.set(false);
        }
      });
    } else {
      let imagenFinal = this.form.controls.imagenPerfil.value.trim();
      if (!imagenFinal || imagenFinal.startsWith('data:image')) {
        imagenFinal = avatarAleatorio(this.esVendedor);
      }
      this.ejecutarRegistro(imagenFinal);
    }
  }

  private ejecutarRegistro(imagenFinal: string): void {
    const datos = this.form.getRawValue();
    datos.imagenPerfil = imagenFinal;

    const peticion = this.esVendedor
      ? this.registroService.registrarVendedor({
          nombre: datos.nombre,
          apellidos: datos.apellidos,
          email: datos.email,
          contrasena: datos.contrasena,
          confirmarContrasena: datos.confirmarContrasena,
          telefono: datos.telefono,
          imagenPerfil: datos.imagenPerfil,
          nombreComercial: datos.nombreComercial,
          cifNif: datos.cifNif,
          categoriaPrincipalId: datos.categoriaPrincipalId,
        })
      : this.registroService.registrarCliente({
          nombre: datos.nombre,
          apellidos: datos.apellidos,
          email: datos.email,
          contrasena: datos.contrasena,
          confirmarContrasena: datos.confirmarContrasena,
          telefono: datos.telefono,
          imagenPerfil: datos.imagenPerfil,
          dni: datos.dni,
          fechaNacimiento: datos.fechaNacimiento,
        });

    peticion.subscribe({
      next: (respuesta) => {
        this.cuentaCreada.set(true);
        this.procesarRespuestaRegistro(respuesta);
      },
      error: (error: HttpErrorResponse) => {
        this.enviando.set(false);
        this.mensajeError.set(this.textoDeError(error));
      },
    });
  }

  reintentarInicioSesion(): void {
    if (!this.cuentaCreada() || this.enviando()) {
      return;
    }
    this.iniciarSesionTrasRegistro();
  }

  esInvalido(campo: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[campo];
    return control.invalid && (control.touched || control.dirty);
  }

  private textoDeError(error: HttpErrorResponse): string {
    if (error.status === 0) {
      return 'No se ha podido conectar con el servidor.';
    }
    if (error.status === 409) {
      const message = error.error?.message ?? error.error?.mensaje;
      return typeof message === 'string' && message.length > 0
        ? message
        : 'Ya existe una cuenta con ese correo electrónico o documento.';
    }
    if (error.status === 400) {
      return 'No se ha podido crear la cuenta. Revisa los datos introducidos.';
    }
    return 'Ha ocurrido un error al crear la cuenta. Inténtalo de nuevo.';
  }

  private iniciarSesionTrasRegistro(): void {
    this.enviando.set(true);
    this.mensajeError.set('');
    this.puedeReintentarLogin.set(false);

    const { email, contrasena } = this.form.getRawValue();
    this.authService.login({ username: email, password: contrasena }).subscribe({
      next: (respuesta) => this.procesarRespuestaLogin(respuesta),
      error: () => {
        this.enviando.set(false);
        this.mensajeExito.set('');
        this.mensajeError.set(
          'La cuenta se creó, pero no se pudo iniciar sesión automáticamente. Puedes volver a intentarlo.',
        );
        this.puedeReintentarLogin.set(true);
      },
    });
  }

  private procesarRespuestaRegistro(respuesta: LoginResponse): void {
    this.enviando.set(false);
    if (respuesta.mfaStatus === 'PENDING_ACTIVATION') {
      this.mensajeExito.set(
        'Cuenta creada. Un administrador debe activarla antes de que puedas iniciar sesión.',
      );
      return;
    }
    if (respuesta.mfaStatus === 'SUCCESS') {
      this.authService.applyAuthenticationResponse(respuesta);
      this.mensajeExito.set('Cuenta creada e inicio de sesión completado.');
      void this.router.navigate(['/products']);
      return;
    }

    this.mensajeExito.set(
      'Cuenta creada. Continúa el inicio de sesión para configurar la autenticación.',
    );
    void this.router.navigate(['/login'], {
      queryParams: { email: this.form.controls.email.value },
    });
  }

  private procesarRespuestaLogin(respuesta: LoginResponse): void {
    this.enviando.set(false);
    if (respuesta.mfaStatus === 'SUCCESS') {
      this.mensajeExito.set('Cuenta creada e inicio de sesión completado.');
      void this.router.navigate(['/products']);
      return;
    }

    this.mensajeExito.set('');
    if (
      respuesta.mfaStatus === 'REQUIRES_MFA_SETUP' ||
      respuesta.mfaStatus === 'REQUIRES_MFA_VERIFICATION'
    ) {
      this.mensajeError.set(
        'La cuenta se creó, pero el servidor requiere completar la verificación MFA antes de iniciar sesión. Ese paso aún no está disponible.',
      );
      return;
    }

    this.mensajeError.set(
      'La cuenta se creó, pero el inicio de sesión no se completó. Inténtalo de nuevo.',
    );
    this.puedeReintentarLogin.set(true);
  }

  private fechaDeHoy(): string {
    const hoy = new Date();
    const mes = String(hoy.getMonth() + 1).padStart(2, '0');
    const dia = String(hoy.getDate()).padStart(2, '0');
    return `${hoy.getFullYear()}-${mes}-${dia}`;
  }
}
